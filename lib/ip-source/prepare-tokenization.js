import { createHash } from 'node:crypto';
import { canonicalIpDraft } from '../ip-upload-draft.js';
import {
  loadIpUploadOperation,
  IpUploadOperationConflict,
} from '../ip-upload-operations.js';
import { validateIpUploadSource } from './validate-upload.js';

// Internal server boundary: ownerId comes from authenticated context.
// Source identifiers are untrusted until checked against the stored operation.
export async function prepareValidatedIpTokenization({
  db,
  ownerId,
  operationKey,
  sourceUpload,
  draft,
}) {
  if (
    !sourceUpload ||
    typeof sourceUpload !== 'object' ||
    Array.isArray(sourceUpload) ||
    !draft ||
    typeof draft !== 'object' ||
    Array.isArray(draft)
  ) {
    throw new TypeError('A bound source upload and draft are required');
  }

  const normalizedDraft = canonicalIpDraft(draft);
  const operation = await loadIpUploadOperation({
    db,
    ownerId,
    operationKey,
  });

  if (
    !operation ||
    operation.status !== 'confirmed' ||
    operation.revision !== sourceUpload.revision ||
    !operation.sourceDeclaration
  ) {
    throw new IpUploadOperationConflict();
  }

  const source = operation.sourceDeclaration;
  const inputHash = createHash('sha256')
    .update(JSON.stringify({
      draft: normalizedDraft,
      source: {
        format: source.format,
        filename: source.filename,
        byteLength: source.byteLength,
      },
    }))
    .digest('hex');

  if (inputHash !== operation.inputHash) {
    throw new IpUploadOperationConflict();
  }

  await validateIpUploadSource({
    db,
    ownerId,
    operationKey,
    revision: sourceUpload.revision,
    authorizationId: sourceUpload.authorizationId,
    providerFileId: sourceUpload.providerFileId,
    expectedSource: {
      inputHash: operation.inputHash,
      cid: operation.receipts?.source?.cid,
      sourceDeclaration: structuredClone(source),
    },
  });

  return {
    ...normalizedDraft,
    operationKey: operation.operationKey,
    image: operation.receipts.source.cid,
  };
}
