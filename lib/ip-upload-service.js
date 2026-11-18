import {
  createIpSignedUpload,
  verifyIpUploadReceipt,
} from './pinata.js';
import {
  createOrResumeIpUploadOperation,
  loadIpUploadOperation,
  claimIpUploadAuthorization,
  recordIpUploadIssuance,
  associateVerifiedIpUploadReceipt,
  IpUploadOperationConflict,
} from './ip-upload-operations.js';

function authorizationResponse(authorization, extra = {}) {
  return {
    authorizationId: authorization.authorizationId,
    purpose: authorization.purpose,
    status: authorization.status,
    network: authorization.network,
    expiresAt: authorization.expiresAt || null,
    ...extra,
  };
}

// Internal service: ownerId must come from authenticated server context.
// revision, inputHash and constraints must come from server-normalized inputs.
export async function authorizeIpUpload({
  db,
  ownerId,
  operationKey,
  revision,
  inputHash,
  sourceDeclaration,
  purpose,
  maxBytes,
  allowedMimeTypes,
  providerDependencies = {},
}) {
  await createOrResumeIpUploadOperation({
    db,
    ownerId,
    operationKey,
    revision,
    inputHash,
    sourceDeclaration,
  });

  const { authorization, claimed } = await claimIpUploadAuthorization({
    db,
    ownerId,
    operationKey,
    revision,
    inputHash,
    purpose,
    network: 'public',
    maxBytes,
    allowedMimeTypes,
    expiresSeconds: 900,
  });

  if (!claimed) {
    return {
      step: 'upload_recovery_required',
      authorization: authorizationResponse(authorization),
    };
  }

  let capability;

  try {
    capability = await createIpSignedUpload(
      authorization,
      providerDependencies,
    );
  } catch {
    // An issuance error does not prove that no capability was created.
    try {
      await recordIpUploadIssuance({
        db,
        ownerId,
        operationKey,
        revision,
        inputHash,
        purpose,
        authorizationId: authorization.authorizationId,
        outcome: 'issuance_unknown',
      });
    } catch {
      // Retain the original claim even when outcome persistence fails.
      // Never reset it or issue another capability here.
    }

    throw new Error('IP upload authorization requires recovery');
  }

  let recorded;

  try {
    recorded = await recordIpUploadIssuance({
      db,
      ownerId,
      operationKey,
      revision,
      inputHash,
      purpose,
      authorizationId: authorization.authorizationId,
      outcome: 'issued',
      expiresAt: capability.expiresAt,
    });
  } catch {
    // Do not expose a capability before its issuance is durably recorded.
    throw new Error('IP upload authorization requires recovery');
  }

  return {
    step: 'upload_authorized',
    authorization: authorizationResponse(recorded.authorization),
    upload: {
      method: 'POST',
      url: capability.uploadUrl,
      network: 'public',
    },
  };
}

// The browser supplies only identifiers, never a trusted provider receipt.
export async function confirmIpUpload({
  db,
  ownerId,
  operationKey,
  revision,
  purpose,
  authorizationId,
  providerFileId,
  providerDependencies = {},
}) {
  if (!['source', 'display_thumbnail'].includes(purpose)) {
    throw new TypeError('Unsupported IP upload purpose');
  }

  const operation = await loadIpUploadOperation({
    db,
    ownerId,
    operationKey,
  });

  const authorization = operation?.authorizations?.[purpose];

  if (
    !operation ||
    operation.revision !== revision ||
    !authorization ||
    authorization.authorizationId !== authorizationId ||
    authorization.operationRevision !== revision ||
    authorization.purpose !== purpose ||
    authorization.network !== 'public' ||
    !['issued', 'issuance_unknown', 'associated'].includes(
      authorization.status,
    )
  ) {
    throw new IpUploadOperationConflict();
  }

  const verifiedReceipt = await verifyIpUploadReceipt({
    authorization,
    providerFileId,
    network: 'public',
  }, providerDependencies);

  const result = await associateVerifiedIpUploadReceipt({
    db,
    ownerId,
    operationKey,
    revision,
    inputHash: operation.inputHash,
    purpose,
    verifiedReceipt,
  });

  // Provider association is not authoritative source-byte validation.
  return {
    step: 'upload_received',
    operationKey: operation.operationKey,
    revision: operation.revision,
    purpose,
    authorizationId: result.receipt.authorizationId,
    providerFileId: result.receipt.providerFileId,
    network: result.receipt.network,
    validationStatus: result.receipt.sourceValidationStatus,
    resumed: !result.associated,
  };
}
