import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const IP_UPLOAD_OPERATIONS_COLLECTION = 'ip_upload_operations';

export class IpUploadOperationConflict extends Error {
  constructor() {
    super('The IP upload operation cannot be resumed with these inputs');
    this.name = 'IpUploadOperationConflict';
    this.code = 'IP_UPLOAD_OPERATION_CONFLICT';
  }
}

function requireString(value, name, maxLength = 128) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value
  ) {
    throw new TypeError(`${name} must be a bounded nonempty string`);
  }

  return value;
}

function requireHash(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError('inputHash must be a lowercase SHA-256 hex string');
  }

  return value;
}

function collection(db) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('An injected database is required');
  }

  return db.collection(IP_UPLOAD_OPERATIONS_COLLECTION);
}

export function ipUploadOperationIdentity({ ownerId, operationKey }) {
  requireString(ownerId, 'ownerId');

  if (
    typeof operationKey !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      operationKey,
    )
  ) {
    throw new TypeError('operationKey must be a UUID-shaped string');
  }

  const normalizedKey = operationKey.toLowerCase();
  const digest = createHash('sha256')
    .update(JSON.stringify([ownerId, normalizedKey]))
    .digest('hex');

  return {
    id: `ip-upload:v1:${digest}`,
    ownerId,
    operationKey: normalizedKey,
  };
}

function assertIdentity(record, identity) {
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record._id !== identity.id ||
    record.ownerId !== identity.ownerId ||
    record.operationKey !== identity.operationKey
  ) {
    throw new IpUploadOperationConflict();
  }
}

function assertRevision(record, revision, inputHash) {
  if (
    record.revision !== revision ||
    record.inputHash !== inputHash
  ) {
    throw new IpUploadOperationConflict();
  }
}

export async function loadIpUploadOperation({
  db,
  ownerId,
  operationKey,
}) {
  const identity = ipUploadOperationIdentity({ ownerId, operationKey });
  const record = await collection(db).findOne({
    _id: identity.id,
    ownerId: identity.ownerId,
    operationKey: identity.operationKey,
  });

  if (record === null) return null;

  assertIdentity(record, identity);
  return record;
}

function normalizeSourceDeclaration(value) {
  if (value === undefined) return undefined;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('A valid source declaration is required');
  }

  const extensions = {
    png: /\.png$/i,
    jpeg: /\.jpe?g$/i,
    svg: /\.svg$/i,
    stl: /\.stl$/i,
  };

  if (!Object.prototype.hasOwnProperty.call(extensions, value.format)) {
    throw new TypeError('Unsupported source format');
  }

  const filename = requireString(value.filename, 'source filename', 255);
  const maxBytes = value.format === 'stl'
    ? 104857600
    : 50 * 1024 * 1024;

  if (
    /[/\\\u0000-\u001f\u007f]/.test(filename) ||
    !extensions[value.format].test(filename) ||
    !Number.isSafeInteger(value.byteLength) ||
    value.byteLength <= 0 ||
    value.byteLength > maxBytes
  ) {
    throw new TypeError('Invalid source declaration');
  }

  return {
    format: value.format,
    filename,
    byteLength: value.byteLength,
  };
}

function assertSourceDeclaration(record, sourceDeclaration) {
  if (
    JSON.stringify(record.sourceDeclaration) !==
    JSON.stringify(sourceDeclaration)
  ) {
    throw new IpUploadOperationConflict();
  }
}

export async function createOrResumeIpUploadOperation({
  db,
  ownerId,
  operationKey,
  revision,
  inputHash,
  sourceDeclaration,
  now = () => new Date(),
}) {
  const identity = ipUploadOperationIdentity({ ownerId, operationKey });
  requireString(revision, 'revision');
  requireHash(inputHash);
  const normalizedSource = normalizeSourceDeclaration(sourceDeclaration);

  const operations = collection(db);
  const filter = {
    _id: identity.id,
    ownerId: identity.ownerId,
    operationKey: identity.operationKey,
  };

  const existing = await operations.findOne(filter);

  if (existing !== null) {
    assertIdentity(existing, identity);
    assertRevision(existing, revision, inputHash);
    assertSourceDeclaration(existing, normalizedSource);

    return { operation: existing, resumed: true };
  }

  const timestamp = now();

  if (
    !(timestamp instanceof Date) ||
    !Number.isFinite(timestamp.getTime())
  ) {
    throw new TypeError('now must return a valid Date');
  }

  const operation = {
    _id: identity.id,
    schemaVersion: 1,
    ownerId: identity.ownerId,
    operationKey: identity.operationKey,
    revision,
    inputHash,
    status: 'confirmed',
    ...(normalizedSource === undefined
      ? {}
      : { sourceDeclaration: normalizedSource }),
    authorizations: {},
    receipts: {},
    createdAt: new Date(timestamp.getTime()),
    updatedAt: new Date(timestamp.getTime()),
  };

  try {
    await operations.insertOne(operation);
    return { operation, resumed: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;

    // The built-in unique _id resolves concurrent creation.
    // A duplicate error is not enough: verify the actual winning record.
    const winner = await operations.findOne(filter);
    assertIdentity(winner, identity);
    assertRevision(winner, revision, inputHash);
    assertSourceDeclaration(winner, normalizedSource);

    return { operation: winner, resumed: true };
  }
}

function requireUploadPurpose(purpose) {
  if (!['source', 'display_thumbnail'].includes(purpose)) {
    throw new TypeError('Unsupported IP upload purpose');
  }

  return purpose;
}

export async function claimIpUploadAuthorization({
  db,
  ownerId,
  operationKey,
  revision,
  inputHash,
  purpose,
  network,
  maxBytes,
  expiresSeconds,
  allowedMimeTypes,
  now = () => new Date(),
}) {
  const identity = ipUploadOperationIdentity({ ownerId, operationKey });
  requireString(revision, 'revision');
  requireHash(inputHash);
  requireUploadPurpose(purpose);

  if (!['public', 'private'].includes(network)) {
    throw new TypeError('An explicit storage network is required');
  }

  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer');
  }

  if (
    !Number.isSafeInteger(expiresSeconds) ||
    expiresSeconds <= 0 ||
    expiresSeconds > 900
  ) {
    throw new TypeError('expiresSeconds must be between 1 and 900');
  }

  if (
    !Array.isArray(allowedMimeTypes) ||
    allowedMimeTypes.length === 0 ||
    allowedMimeTypes.length > 16 ||
    allowedMimeTypes.some(value =>
      typeof value !== 'string' ||
      value.length > 128 ||
      !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+*-]+$/i.test(value)
    )
  ) {
    throw new TypeError('allowedMimeTypes must be a bounded MIME list');
  }

  const timestamp = now();

  if (
    !(timestamp instanceof Date) ||
    !Number.isFinite(timestamp.getTime())
  ) {
    throw new TypeError('now must return a valid Date');
  }

  const operations = collection(db);
  const filter = {
    _id: identity.id,
    ownerId: identity.ownerId,
    operationKey: identity.operationKey,
    revision,
    inputHash,
  };

  const authorization = {
    authorizationId: randomUUID(),
    operationRevision: revision,
    purpose,
    bindingNonce: randomBytes(32).toString('hex'),
    network,
    maxBytes,
    expiresSeconds,
    allowedMimeTypes: [...allowedMimeTypes],
    status: 'issuing',
    claimedAt: new Date(timestamp.getTime()),
    updatedAt: new Date(timestamp.getTime()),
  };

  const slot = `authorizations.${purpose}`;

  const result = await operations.updateOne(
    {
      ...filter,
      schemaVersion: 1,
      status: 'confirmed',
      authorizations: { $type: 'object' },
      receipts: { $type: 'object' },
      [slot]: { $exists: false },
      [`receipts.${purpose}`]: { $exists: false },
    },
    {
      $set: {
        [slot]: authorization,
        updatedAt: new Date(timestamp.getTime()),
      },
    },
  );

  if (result.matchedCount === 1) {
    return { authorization, claimed: true };
  }

  const current = await operations.findOne(filter);
  assertIdentity(current, identity);
  assertRevision(current, revision, inputHash);

  const existing = current.authorizations?.[purpose];

  if (
    !existing ||
    typeof existing !== 'object' ||
    Array.isArray(existing) ||
    existing.operationRevision !== revision ||
    existing.purpose !== purpose ||
    typeof existing.authorizationId !== 'string' ||
    typeof existing.bindingNonce !== 'string' ||
    !/^[a-f0-9]{64}$/.test(existing.bindingNonce) ||
    !['issuing', 'issued', 'issuance_unknown', 'associated', 'expired'].includes(
      existing.status,
    ) ||
    existing.network !== network ||
    existing.maxBytes !== maxBytes ||
    existing.expiresSeconds !== expiresSeconds ||
    JSON.stringify(existing.allowedMimeTypes) !==
      JSON.stringify(allowedMimeTypes)
  ) {
    throw new IpUploadOperationConflict();
  }

  return { authorization: existing, claimed: false };
}

export async function recordIpUploadIssuance({
  db,
  ownerId,
  operationKey,
  revision,
  inputHash,
  purpose,
  authorizationId,
  outcome,
  expiresAt,
  now = () => new Date(),
}) {
  const identity = ipUploadOperationIdentity({ ownerId, operationKey });
  requireString(revision, 'revision');
  requireHash(inputHash);
  requireUploadPurpose(purpose);
  requireString(authorizationId, 'authorizationId');

  if (!['issued', 'issuance_unknown'].includes(outcome)) {
    throw new TypeError('Unsupported upload issuance outcome');
  }

  let normalizedExpiry;

  if (outcome === 'issued') {
    if (
      typeof expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(expiresAt))
    ) {
      throw new TypeError('Issued authorization requires a valid expiresAt');
    }

    normalizedExpiry = new Date(expiresAt).toISOString();
  } else if (expiresAt !== undefined) {
    throw new TypeError('Unknown issuance must not invent an expiry');
  }

  const timestamp = now();

  if (
    !(timestamp instanceof Date) ||
    !Number.isFinite(timestamp.getTime())
  ) {
    throw new TypeError('now must return a valid Date');
  }

  const operations = collection(db);
  const slot = `authorizations.${purpose}`;
  const filter = {
    _id: identity.id,
    ownerId: identity.ownerId,
    operationKey: identity.operationKey,
    revision,
    inputHash,
    schemaVersion: 1,
  };

  const changes = {
    [`${slot}.status`]: outcome,
    [`${slot}.updatedAt`]: new Date(timestamp.getTime()),
    updatedAt: new Date(timestamp.getTime()),
  };

  if (outcome === 'issued') {
    changes[`${slot}.issuedAt`] = new Date(timestamp.getTime());
    changes[`${slot}.expiresAt`] = normalizedExpiry;
  } else {
    changes[`${slot}.issuanceUnknownAt`] = new Date(timestamp.getTime());
  }

  const result = await operations.updateOne(
    {
      ...filter,
      status: 'confirmed',
      [`${slot}.authorizationId`]: authorizationId,
      [`${slot}.operationRevision`]: revision,
      [`${slot}.purpose`]: purpose,
      [`${slot}.status`]: 'issuing',
      [`receipts.${purpose}`]: { $exists: false },
    },
    { $set: changes },
  );

  const current = await operations.findOne(filter);
  assertIdentity(current, identity);
  assertRevision(current, revision, inputHash);

  const authorization = current.authorizations?.[purpose];

  if (
    !authorization ||
    authorization.authorizationId !== authorizationId ||
    authorization.operationRevision !== revision ||
    authorization.purpose !== purpose ||
    authorization.status !== outcome ||
    (
      outcome === 'issued' &&
      authorization.expiresAt !== normalizedExpiry
    )
  ) {
    throw new IpUploadOperationConflict();
  }

  return {
    authorization,
    updated: result.matchedCount === 1,
  };
}

const IP_RECEIPT_FIELDS = Object.freeze([
  'provider',
  'providerFileId',
  'network',
  'cid',
  'providerSize',
  'providerMimeType',
  'providerNumberOfFiles',
  'providerGroupId',
  'providerCreatedAt',
  'authorizationId',
  'operationRevision',
  'purpose',
  'verificationMethod',
]);

export async function associateVerifiedIpUploadReceipt({
  db,
  ownerId,
  operationKey,
  revision,
  inputHash,
  purpose,
  verifiedReceipt,
  now = () => new Date(),
}) {
  const identity = ipUploadOperationIdentity({ ownerId, operationKey });
  requireString(revision, 'revision');
  requireHash(inputHash);
  requireUploadPurpose(purpose);

  if (
    !verifiedReceipt ||
    typeof verifiedReceipt !== 'object' ||
    Array.isArray(verifiedReceipt)
  ) {
    throw new TypeError('An internally verified provider receipt is required');
  }

  const receipt = {};

  for (const key of IP_RECEIPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(verifiedReceipt, key)) {
      throw new TypeError('Verified receipt is incomplete');
    }

    receipt[key] = verifiedReceipt[key];
  }

  requireString(receipt.authorizationId, 'authorizationId');
  requireString(receipt.providerFileId, 'providerFileId');
  requireString(receipt.cid, 'cid', 200);

  if (
    receipt.provider !== 'pinata' ||
    receipt.verificationMethod !== 'pinata_authenticated_file_lookup' ||
    receipt.operationRevision !== revision ||
    receipt.purpose !== purpose ||
    !['public', 'private'].includes(receipt.network) ||
    !Number.isSafeInteger(receipt.providerSize) ||
    receipt.providerSize <= 0 ||
    receipt.providerNumberOfFiles !== 1 ||
    typeof receipt.providerMimeType !== 'string' ||
    receipt.providerMimeType.length > 128 ||
    !(
      receipt.providerGroupId === null ||
      typeof receipt.providerGroupId === 'string'
    ) ||
    typeof receipt.providerCreatedAt !== 'string' ||
    !Number.isFinite(Date.parse(receipt.providerCreatedAt))
  ) {
    throw new TypeError('Verified receipt contains invalid fields');
  }

  const timestamp = now();

  if (
    !(timestamp instanceof Date) ||
    !Number.isFinite(timestamp.getTime())
  ) {
    throw new TypeError('now must return a valid Date');
  }

  const operations = collection(db);
  const filter = {
    _id: identity.id,
    ownerId: identity.ownerId,
    operationKey: identity.operationKey,
    revision,
    inputHash,
    schemaVersion: 1,
  };

  const current = await operations.findOne(filter);
  assertIdentity(current, identity);
  assertRevision(current, revision, inputHash);

  const authorization = current.authorizations?.[purpose];

  if (
    !authorization ||
    authorization.authorizationId !== receipt.authorizationId ||
    authorization.operationRevision !== revision ||
    authorization.purpose !== purpose ||
    authorization.network !== receipt.network ||
    !Number.isSafeInteger(authorization.maxBytes) ||
    authorization.maxBytes <= 0 ||
    receipt.providerSize > authorization.maxBytes
  ) {
    throw new IpUploadOperationConflict();
  }

  function sameReceipt(existing) {
    return Boolean(
      existing &&
      IP_RECEIPT_FIELDS.every(key => existing[key] === receipt[key])
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      current.receipts || {},
      purpose,
    )
  ) {
    const existing = current.receipts[purpose];

    if (
      authorization.status !== 'associated' ||
      authorization.associatedProviderFileId !== receipt.providerFileId ||
      !sameReceipt(existing)
    ) {
      throw new IpUploadOperationConflict();
    }

    return { receipt: existing, associated: false };
  }

  const slot = `authorizations.${purpose}`;
  const receiptSlot = `receipts.${purpose}`;

  const persistedReceipt = {
    ...receipt,
    bindingVerifiedAt: new Date(timestamp.getTime()),
    sourceValidationStatus: 'pending',
  };

  const result = await operations.updateOne(
    {
      ...filter,
      status: 'confirmed',
      authorizations: { $type: 'object' },
      receipts: { $type: 'object' },
      [`${slot}.authorizationId`]: receipt.authorizationId,
      [`${slot}.operationRevision`]: revision,
      [`${slot}.purpose`]: purpose,
      [`${slot}.network`]: receipt.network,
      [`${slot}.maxBytes`]: authorization.maxBytes,
      [`${slot}.status`]: {
        $in: ['issued', 'issuance_unknown'],
      },
      [receiptSlot]: { $exists: false },
    },
    {
      $set: {
        [receiptSlot]: persistedReceipt,
        [`${slot}.status`]: 'associated',
        [`${slot}.associatedProviderFileId`]: receipt.providerFileId,
        [`${slot}.associatedAt`]: new Date(timestamp.getTime()),
        [`${slot}.updatedAt`]: new Date(timestamp.getTime()),
        updatedAt: new Date(timestamp.getTime()),
      },
    },
  );

  if (result.matchedCount === 1) {
    return { receipt: persistedReceipt, associated: true };
  }

  const winner = await operations.findOne(filter);
  assertIdentity(winner, identity);
  assertRevision(winner, revision, inputHash);

  const winningAuthorization = winner.authorizations?.[purpose];
  const winningReceipt = winner.receipts?.[purpose];

  if (
    winningAuthorization?.authorizationId !== receipt.authorizationId ||
    winningAuthorization?.status !== 'associated' ||
    winningAuthorization?.associatedProviderFileId !== receipt.providerFileId ||
    !sameReceipt(winningReceipt)
  ) {
    throw new IpUploadOperationConflict();
  }

  return { receipt: winningReceipt, associated: false };
}
