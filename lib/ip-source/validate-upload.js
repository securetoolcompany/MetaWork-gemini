import { isDeepStrictEqual } from 'node:util';
import {
  loadIpUploadOperation,
  IP_UPLOAD_OPERATIONS_COLLECTION,
  IpUploadOperationConflict,
} from '../ip-upload-operations.js';
import { readIpSourceBytes } from './read-source.js';
import { validateIpSourceBytes } from './validate-source.js';

function assertRequestedSource(operation, {
  revision,
  authorizationId,
  providerFileId,
}) {
  const authorization = operation?.authorizations?.source;
  const receipt = operation?.receipts?.source;

  if (
    !operation ||
    operation.status !== 'confirmed' ||
    operation.revision !== revision ||
    !operation.sourceDeclaration ||
    authorization?.status !== 'associated' ||
    authorization.authorizationId !== authorizationId ||
    authorization.operationRevision !== revision ||
    authorization.purpose !== 'source' ||
    authorization.network !== 'public' ||
    authorization.associatedProviderFileId !== providerFileId ||
    receipt?.authorizationId !== authorizationId ||
    receipt.providerFileId !== providerFileId ||
    receipt.operationRevision !== revision ||
    receipt.purpose !== 'source' ||
    receipt.network !== 'public' ||
    !['pending', 'valid'].includes(receipt.sourceValidationStatus)
  ) {
    throw new IpUploadOperationConflict();
  }
}

// Internal server service. ownerId must come from authenticated context.
// readBytes is an internal test seam, never a request-supplied dependency.
export async function validateIpUploadSource({
  db,
  ownerId,
  operationKey,
  revision,
  authorizationId,
  providerFileId,
  readBytes = readIpSourceBytes,
  now = () => new Date(),
}) {
  for (const value of [revision, authorizationId, providerFileId]) {
    if (
      typeof value !== 'string' ||
      !value ||
      value.length > 128 ||
      value.trim() !== value
    ) {
      throw new TypeError('Bounded source identifiers are required');
    }
  }

  const requested = { revision, authorizationId, providerFileId };
  const loaded = await loadIpUploadOperation({ db, ownerId, operationKey });
  assertRequestedSource(loaded, requested);

  // Own the database snapshot across asynchronous retrieval and validation.
  const operation = structuredClone(loaded);
  const source = operation.sourceDeclaration;
  const receipt = operation.receipts.source;

  const bytes = await readBytes({ operation: structuredClone(operation) });
  const validated = await validateIpSourceBytes({
    bytes,
    sourceDeclaration: source,
  });

  // Processing timings are diagnostics, not immutable validation identity.
  const { processing, ...result } = validated;

  const timestamp = now();

  if (
    !(timestamp instanceof Date) ||
    !Number.isFinite(timestamp.getTime())
  ) {
    throw new TypeError('now must return a valid Date');
  }

  const binding = {
    schemaVersion: 1,
    revision,
    inputHash: operation.inputHash,
    authorizationId,
    providerFileId,
    cid: receipt.cid,
    sourceDeclaration: {
      format: source.format,
      filename: source.filename,
      byteLength: source.byteLength,
    },
    result,
  };

  const filter = {
    _id: operation._id,
    schemaVersion: 1,
    ownerId: operation.ownerId,
    operationKey: operation.operationKey,
    revision,
    inputHash: operation.inputHash,
    status: 'confirmed',
    'sourceDeclaration.format': source.format,
    'sourceDeclaration.filename': source.filename,
    'sourceDeclaration.byteLength': source.byteLength,
    'authorizations.source.authorizationId': authorizationId,
    'authorizations.source.operationRevision': revision,
    'authorizations.source.purpose': 'source',
    'authorizations.source.network': 'public',
    'authorizations.source.status': 'associated',
    'authorizations.source.associatedProviderFileId': providerFileId,
    'authorizations.source.maxBytes': operation.authorizations.source.maxBytes,
    'receipts.source.authorizationId': authorizationId,
    'receipts.source.providerFileId': providerFileId,
    'receipts.source.operationRevision': revision,
    'receipts.source.purpose': 'source',
    'receipts.source.network': 'public',
    'receipts.source.provider': 'pinata',
    'receipts.source.verificationMethod': 'pinata_authenticated_file_lookup',
    'receipts.source.providerNumberOfFiles': 1,
    'receipts.source.providerSize': source.byteLength,
    'receipts.source.cid': receipt.cid,
    'receipts.source.sourceValidationStatus': 'pending',
    'receipts.source.sourceValidation': { $exists: false },
  };

  const write = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).updateOne(
    filter,
    {
      $set: {
        'receipts.source.sourceValidationStatus': 'valid',
        'receipts.source.sourceValidation': {
          ...binding,
          validatedAt: new Date(timestamp.getTime()),
        },
        updatedAt: new Date(timestamp.getTime()),
      },
    },
  );

  if (write.matchedCount === 1) {
    return {
      step: 'source_validated',
      operationKey: operation.operationKey,
      revision,
      authorizationId,
      providerFileId,
      validationStatus: 'valid',
      resumed: false,
    };
  }

  const current = await loadIpUploadOperation({ db, ownerId, operationKey });
  assertRequestedSource(current, requested);

  const existing = current.receipts.source.sourceValidation;
  const expected = { ...binding };
  const actual = existing ? { ...existing } : null;
  if (actual) delete actual.validatedAt;

  // Recheck the complete write binding, except the two fields that
  // legitimately transition when another validation wins the race.
  const sameBinding = Object.entries(filter).every(([path, expected]) => {
    if (
      path === 'receipts.source.sourceValidationStatus' ||
      path === 'receipts.source.sourceValidation'
    ) return true;

    const actualValue = path.split('.').reduce(
      (value, key) => value?.[key], current,
    );
    return isDeepStrictEqual(actualValue, expected);
  });

  if (
    !sameBinding ||
    current.inputHash !== operation.inputHash ||
    current.receipts.source.sourceValidationStatus !== 'valid' ||
    !isDeepStrictEqual(current.sourceDeclaration, source) ||
    !isDeepStrictEqual(actual, expected)
  ) {
    throw new IpUploadOperationConflict();
  }

  return {
    step: 'source_validated',
    operationKey: operation.operationKey,
    revision,
    authorizationId,
    providerFileId,
    validationStatus: 'valid',
    resumed: true,
  };
}
