import { createHash, randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ObjectId } from 'mongodb';
import { canonicalIpDraft } from '../ip-upload-draft.js';
import {
  loadIpUploadOperation,
  ipUploadOperationIdentity,
  IP_UPLOAD_OPERATIONS_COLLECTION,
  IpUploadOperationConflict,
} from '../ip-upload-operations.js';

const LEASE_MS = 60_000;
const token = () => randomBytes(32).toString('hex');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function ipPreparationError(code, status = 409) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function timestamp(now) {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError('now must return a valid Date');
  }
  return value;
}

function binding(operation) {
  return {
    revision: operation.revision,
    inputHash: operation.inputHash,
    sourceDeclaration: operation.sourceDeclaration,
    authorization: operation.authorizations?.source,
    receipt: operation.receipts?.source,
  };
}

function boundFilter(operation) {
  return {
    _id: operation._id,
    schemaVersion: 1,
    ownerId: operation.ownerId,
    operationKey: operation.operationKey,
    status: 'confirmed',
    revision: operation.revision,
    inputHash: operation.inputHash,
    sourceDeclaration: operation.sourceDeclaration,
    'authorizations.source': operation.authorizations.source,
    'receipts.source': operation.receipts.source,
  };
}

function reference(operation, slot) {
  return {
    ownerId: operation.ownerId,
    operationKey: operation.operationKey,
    ipAssetId: slot.assetId.toHexString(),
    token: slot.token,
  };
}

function assertBound(operation, slot) {
  if (
    operation?.schemaVersion !== 1 || operation.status !== 'confirmed' || slot?.schemaVersion !== 1 ||
    !(slot.assetId instanceof ObjectId) ||
    !isDeepStrictEqual(slot.binding, binding(operation))
  ) throw new IpUploadOperationConflict();
}

async function loadReservation(db, reservation, session) {
  const operation = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).findOne(
    {
      _id: ipUploadOperationIdentity(reservation).id,
      ownerId: reservation.ownerId,
      operationKey: reservation.operationKey,
    },
    { session },
  );
  const slot = operation?.tokenizationPreparation;
  assertBound(operation, slot);
  if (
    slot.token !== reservation.token ||
    slot.assetId.toHexString() !== reservation.ipAssetId
  ) throw new IpUploadOperationConflict();
  return { operation, slot };
}

async function preparedAsset(db, operation, slot, session) {
  const asset = await db.collection('ip_assets').findOne(
    { _id: slot.assetId }, { session },
  );
  if (!asset) throw ipPreparationError('IP_PREPARATION_ASSET_MISSING');
  if (
    asset.id !== slot.assetId.toHexString() ||
    asset.ownerId !== operation.ownerId ||
    asset.tokenizationOperationKey !== operation.operationKey ||
    asset.uploadPreparationId !== operation._id ||
    asset.uploadPreparationHash !== slot.assetHash
  ) throw new IpUploadOperationConflict();
  return asset;
}

export async function acquireIpTokenizationPreparation({
  db, ownerId, operationKey, sourceUpload, draft, expectedCid,
  now = () => new Date(),
}) {
  const operation = await loadIpUploadOperation({ db, ownerId, operationKey });
  const source = operation?.sourceDeclaration;
  const authorization = operation?.authorizations?.source;
  const receipt = operation?.receipts?.source;
  const validation = receipt?.sourceValidation;
  if (
    operation?.status !== 'confirmed' || !source || !sourceUpload ||
    !draft || typeof draft !== 'object' || Array.isArray(draft) ||
    operation.revision !== sourceUpload.revision ||
    authorization?.status !== 'associated' ||
    authorization.authorizationId !== sourceUpload.authorizationId ||
    authorization.operationRevision !== operation.revision ||
    authorization.associatedProviderFileId !== sourceUpload.providerFileId ||
    receipt?.authorizationId !== sourceUpload.authorizationId ||
    receipt.operationRevision !== operation.revision ||
    receipt.providerFileId !== sourceUpload.providerFileId ||
    receipt.cid !== expectedCid || receipt.sourceValidationStatus !== 'valid' ||
    validation?.schemaVersion !== 1 ||
    validation.revision !== operation.revision ||
    validation.inputHash !== operation.inputHash ||
    validation.authorizationId !== sourceUpload.authorizationId ||
    validation.providerFileId !== sourceUpload.providerFileId ||
    validation.cid !== receipt.cid ||
    !isDeepStrictEqual(validation.sourceDeclaration, source) ||
    validation.result?.validation?.status !== 'valid' ||
    hash({
      draft: canonicalIpDraft(draft),
      source: { format: source.format, filename: source.filename, byteLength: source.byteLength },
    }) !== operation.inputHash
  ) throw new IpUploadOperationConflict();

  const date = timestamp(now);
  const operations = db.collection(IP_UPLOAD_OPERATIONS_COLLECTION);
  let slot = operation.tokenizationPreparation;
  if (!slot) {
    const existing = await db.collection('ip_assets').findOne({
      ownerId: operation.ownerId,
      tokenizationOperationKey: operation.operationKey,
    }, { projection: { _id: 1 } });
    if (existing) {
      const current = await loadIpUploadOperation({ db, ownerId, operationKey });
      if (current?.tokenizationPreparation && isDeepStrictEqual(binding(current), binding(operation))) {
        return acquireIpTokenizationPreparation({ db, ownerId, operationKey, sourceUpload, draft, expectedCid, now });
      }
      throw ipPreparationError('IP_PREPARATION_EXISTING_ASSET_REVIEW_REQUIRED');
    }
    const candidate = {
      schemaVersion: 1, phase: 'reserved', token: token(),
      assetId: new ObjectId(), correlation: token(), binding: binding(operation),
      leaseUntil: new Date(date.getTime() + LEASE_MS), createdAt: date, updatedAt: date,
    };
    const write = await operations.updateOne(
      { ...boundFilter(operation), tokenizationPreparation: { $exists: false } },
      { $set: { tokenizationPreparation: candidate, updatedAt: date } },
    );
    if (write.matchedCount === 1) {
      return { state: 'acquired', reservation: reference(operation, candidate) };
    }
    const winner = await loadIpUploadOperation({ db, ownerId, operationKey });
    if (!winner || !isDeepStrictEqual(binding(winner), binding(operation))) {
      throw new IpUploadOperationConflict();
    }
    slot = winner.tokenizationPreparation;
  }
  assertBound(operation, slot);
  if (slot.phase === 'prepared') {
    return { state: 'prepared', asset: await preparedAsset(db, operation, slot) };
  }
  if (slot.phase === 'metadata_started') {
    if (!(slot.leaseUntil instanceof Date)) throw new IpUploadOperationConflict();
    if (slot.leaseUntil > date) {
      return { state: 'in_progress', ipAssetId: slot.assetId.toHexString() };
    }
    return {
      state: 'recovery_required', reservation: reference(operation, slot),
      request: slot.metadataRequest,
    };
  }
  if (!['reserved', 'metadata_recorded'].includes(slot.phase)) {
    throw new IpUploadOperationConflict();
  }
  if (!(slot.leaseUntil instanceof Date)) throw new IpUploadOperationConflict();
  if (slot.leaseUntil <= date) {
    const next = { ...slot, token: token(), leaseUntil: new Date(date.getTime() + LEASE_MS) };
    const write = await operations.updateOne({
      ...boundFilter(operation),
      'tokenizationPreparation.token': slot.token,
      'tokenizationPreparation.phase': slot.phase,
      'tokenizationPreparation.leaseUntil': slot.leaseUntil,
    }, { $set: {
      'tokenizationPreparation.token': next.token,
      'tokenizationPreparation.leaseUntil': next.leaseUntil,
      'tokenizationPreparation.updatedAt': date,
      updatedAt: date,
    } });
    if (write.matchedCount === 1) {
      return {
        state: 'acquired', reservation: reference(operation, next),
        request: slot.metadataRequest, metadata: slot.metadata,
      };
    }
  }
  return { state: 'in_progress', ipAssetId: slot.assetId.toHexString() };
}

export async function startIpTokenizationMetadata({
  db, reservation, metadata, now = () => new Date(),
}) {
  const date = timestamp(now);
  const { operation, slot } = await loadReservation(db, reservation);
  if (slot.phase !== 'reserved') throw new IpUploadOperationConflict();
  const json = JSON.stringify(metadata);
  if (typeof json !== 'string' || Buffer.byteLength(json) > 256 * 1024) {
    throw new TypeError('Metadata exceeds the preparation limit');
  }
  const request = {
    correlation: slot.correlation,
    metadata: JSON.parse(json),
    metadataHash: createHash('sha256').update(json).digest('base64'),
  };
  const write = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).updateOne({
    ...boundFilter(operation),
    'tokenizationPreparation.token': reservation.token,
    'tokenizationPreparation.phase': 'reserved',
    'tokenizationPreparation.leaseUntil': { $gt: date },
  }, { $set: {
    'tokenizationPreparation.phase': 'metadata_started',
    'tokenizationPreparation.metadataRequest': request,
    'tokenizationPreparation.updatedAt': date, updatedAt: date,
  } });
  if (write.matchedCount !== 1) throw new IpUploadOperationConflict();
  return request;
}

export async function recordIpTokenizationMetadata({
  db, reservation, metadata, now = () => new Date(),
}) {
  const date = timestamp(now);
  const { operation, slot } = await loadReservation(db, reservation);
  if (
    slot.phase !== 'metadata_started' ||
    !/^ipfs:\/\/[a-zA-Z0-9]{20,200}$/.test(metadata?.ipfsUrl || '')
  ) throw new IpUploadOperationConflict();
  const nextToken = token();
  const write = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).updateOne({
    ...boundFilter(operation),
    'tokenizationPreparation.token': reservation.token,
    'tokenizationPreparation.phase': 'metadata_started',
  }, { $set: {
    'tokenizationPreparation.phase': 'metadata_recorded',
    'tokenizationPreparation.metadata': { ipfsUrl: metadata.ipfsUrl },
    'tokenizationPreparation.token': nextToken,
    'tokenizationPreparation.leaseUntil': new Date(date.getTime() + LEASE_MS),
    'tokenizationPreparation.updatedAt': date, updatedAt: date,
  } });
  if (write.matchedCount !== 1) throw new IpUploadOperationConflict();
  return { ...reservation, token: nextToken };
}

export async function persistIpTokenizationPreparation({
  client, db, reservation, asset, now = () => new Date(),
  afterInsert, afterCommit,
}) {
  if (!client || typeof client.startSession !== 'function') {
    throw new TypeError('A transaction-capable MongoClient is required');
  }
  const session = client.startSession();
  let winner;
  try {
    await session.withTransaction(async () => {
      const date = timestamp(now);
      const { operation, slot } = await loadReservation(db, reservation, session);
      if (slot.phase === 'prepared') {
        winner = await preparedAsset(db, operation, slot, session);
        return;
      }
      if (
        slot.phase !== 'metadata_recorded' ||
        asset.metadataUrl !== slot.metadata.ipfsUrl ||
        asset.metadataHash !== slot.metadataRequest.metadataHash
      ) throw new IpUploadOperationConflict();
      const document = {
        ...asset, _id: slot.assetId, id: slot.assetId.toHexString(),
        ownerId: operation.ownerId, tokenizationOperationKey: operation.operationKey,
        uploadPreparationId: operation._id,
      };
      delete document.uploadPreparationHash;
      const assetHash = hash(document);
      document.uploadPreparationHash = assetHash;
      const write = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).updateOne({
        ...boundFilter(operation),
        'tokenizationPreparation.token': reservation.token,
        'tokenizationPreparation.phase': 'metadata_recorded',
        'tokenizationPreparation.leaseUntil': { $gt: date },
      }, { $set: {
        'tokenizationPreparation.phase': 'prepared',
        'tokenizationPreparation.assetHash': assetHash,
        'tokenizationPreparation.updatedAt': date,
        'tokenizationPreparation.preparedAt': date, updatedAt: date,
      } }, { session });
      if (write.matchedCount !== 1) throw new IpUploadOperationConflict();
      await db.collection('ip_assets').insertOne(document, { session });
      if (afterInsert) await afterInsert();
      winner = document;
    }, {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
  } catch (error) {
    // A concurrent winner or an ambiguous commit is accepted only after reloading
    // the bound operation and its actual asset. Duplicate-key alone is not proof.
    const { operation, slot } = await loadReservation(db, reservation);
    if (slot.phase === 'prepared') {
      winner = await preparedAsset(db, operation, slot);
    } else if (error?.code === 11000) {
      throw ipPreparationError('IP_PREPARATION_ASSET_COLLISION');
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }
  if (afterCommit) await afterCommit();
  return winner;
}
