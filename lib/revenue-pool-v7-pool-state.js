// lib/revenue-pool-v7-pool-state.js

import algosdk from 'algosdk';

import { getV7PoolBoxName } from './revenue-pool-v7-settlement.js';

const MAX_IP_ID_BYTES = 50;
const MAX_STAKEHOLDERS = 100;
const TOTAL_BPS = 10000;

const POOL_HEADER_BYTES = 73;
const STAKEHOLDER_ENTRY_BYTES = 35;
const ADDRESS_BYTES = 32;

const REV_ASA_OFFSET = 0;
const UNALLOCATED_OFFSET = 8;
const TOTAL_CLAIMED_OFFSET = 16;
const HELD_OFFSET = 24;
const CURRENT_ROUND_OFFSET = 32;
const STAKEHOLDER_COUNT_OFFSET = 40;
const PROXY_ADDRESS_OFFSET = 41;
const STAKEHOLDERS_OFFSET = 73;

const STAKEHOLDER_ADDRESS_OFFSET = 0;
const STAKEHOLDER_BPS_OFFSET = 32;
const STAKEHOLDER_TOKEN_CLAIMED_OFFSET = 34;

const FLAG_UNCLAIMED = 0;
const FLAG_CLAIMED = 1;

export class V7PoolAppIdMismatchError extends Error {
  constructor({ revenuePoolAppId, expectedRevenuePoolAppId }) {
    super(
      `revenuePoolAppId ${revenuePoolAppId} does not match expectedRevenuePoolAppId ${expectedRevenuePoolAppId}`
    );
    this.name = 'V7PoolAppIdMismatchError';
    this.revenuePoolAppId = revenuePoolAppId;
    this.expectedRevenuePoolAppId = expectedRevenuePoolAppId;
  }
}

export class V7PoolBoxNotFoundError extends Error {
  constructor({ revenuePoolAppId, ipAssetId, cause } = {}) {
    super(
      `V7 pool box was not found for ipAssetId "${ipAssetId}" on application ${revenuePoolAppId}`,
      cause ? { cause } : undefined
    );
    this.name = 'V7PoolBoxNotFoundError';
    this.revenuePoolAppId = revenuePoolAppId;
    this.ipAssetId = ipAssetId;
  }
}

export class V7PoolBoxMalformedError extends Error {
  constructor(message, { cause, ipAssetId } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'V7PoolBoxMalformedError';
    this.ipAssetId = ipAssetId;
  }
}

export class V7PoolStateNetworkError extends Error {
  constructor({ revenuePoolAppId, ipAssetId, cause } = {}) {
    super(
      `Unable to read V7 pool box for ipAssetId "${ipAssetId}" on application ${revenuePoolAppId}`,
      cause ? { cause } : undefined
    );
    this.name = 'V7PoolStateNetworkError';
    this.revenuePoolAppId = revenuePoolAppId;
    this.ipAssetId = ipAssetId;
  }
}

function assertSafePositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${fieldName} must be a positive safe integer`);
  }

  return value;
}

function assertIpAssetId(ipAssetId) {
  if (typeof ipAssetId !== 'string' || !ipAssetId.trim()) {
    throw new TypeError('ipAssetId must be a non-empty string');
  }

  const normalizedIpAssetId = ipAssetId.trim();
  const byteLength = Buffer.byteLength(normalizedIpAssetId);

  if (byteLength > MAX_IP_ID_BYTES) {
    throw new TypeError(
      `ipAssetId must not exceed ${MAX_IP_ID_BYTES} UTF-8 bytes`
    );
  }

  return normalizedIpAssetId;
}

function assertBoxBytes(boxValue, ipAssetId) {
  if (boxValue instanceof Uint8Array) {
    return new Uint8Array(boxValue);
  }

  if (typeof boxValue === 'string') {
    return new Uint8Array(Buffer.from(boxValue, 'base64'));
  }

  throw new V7PoolBoxMalformedError(
    'V7 pool box value must be a Uint8Array or a base64 string',
    { ipAssetId }
  );
}

function readUint64BigEndian(bytes, offset, fieldName, ipAssetId) {
  try {
    return Buffer.from(bytes).readBigUInt64BE(offset);
  } catch (cause) {
    throw new V7PoolBoxMalformedError(
      `Unable to decode ${fieldName} as an unsigned 64-bit integer`,
      { cause, ipAssetId }
    );
  }
}

function readUint16BigEndian(bytes, offset, fieldName, ipAssetId) {
  try {
    return Buffer.from(bytes).readUInt16BE(offset);
  } catch (cause) {
    throw new V7PoolBoxMalformedError(
      `Unable to decode ${fieldName} as an unsigned 16-bit integer`,
      { cause, ipAssetId }
    );
  }
}

function isZeroAddress(addressBytes) {
  return addressBytes.every((value) => value === 0);
}

function decodeAddress(addressBytes, fieldName, ipAssetId) {
  if (addressBytes.length !== ADDRESS_BYTES) {
    throw new V7PoolBoxMalformedError(
      `${fieldName} must contain exactly ${ADDRESS_BYTES} bytes`,
      { ipAssetId }
    );
  }

  try {
    return algosdk.encodeAddress(addressBytes);
  } catch (cause) {
    throw new V7PoolBoxMalformedError(
      `${fieldName} is not a valid Algorand public key`,
      { cause, ipAssetId }
    );
  }
}

function getHttpStatus(error) {
  return (
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    error?.response?.statusCode
  );
}

function freezeStakeholder(stakeholder) {
  return Object.freeze({ ...stakeholder });
}

export function getV7PoolBoxExpectedByteLength(stakeholderCount) {
  if (
    !Number.isSafeInteger(stakeholderCount) ||
    stakeholderCount < 1 ||
    stakeholderCount > MAX_STAKEHOLDERS
  ) {
    throw new TypeError(
      `stakeholderCount must be a safe integer between 1 and ${MAX_STAKEHOLDERS}`
    );
  }

  return POOL_HEADER_BYTES + stakeholderCount * STAKEHOLDER_ENTRY_BYTES;
}

export function decodeV7PoolBox({ ipAssetId, boxValue }) {
  const normalizedIpAssetId = assertIpAssetId(ipAssetId);
  const bytes = assertBoxBytes(boxValue, normalizedIpAssetId);

  if (bytes.length < POOL_HEADER_BYTES) {
    throw new V7PoolBoxMalformedError(
      `V7 pool box is too short: expected at least ${POOL_HEADER_BYTES} bytes, received ${bytes.length}`,
      { ipAssetId: normalizedIpAssetId }
    );
  }

  const stakeholderCount = bytes[STAKEHOLDER_COUNT_OFFSET];

  if (stakeholderCount < 1 || stakeholderCount > MAX_STAKEHOLDERS) {
    throw new V7PoolBoxMalformedError(
      `V7 pool stakeholder count must be between 1 and ${MAX_STAKEHOLDERS}, received ${stakeholderCount}`,
      { ipAssetId: normalizedIpAssetId }
    );
  }

  const expectedByteLength =
    POOL_HEADER_BYTES + stakeholderCount * STAKEHOLDER_ENTRY_BYTES;

  if (bytes.length !== expectedByteLength) {
    throw new V7PoolBoxMalformedError(
      `V7 pool box length mismatch: expected ${expectedByteLength} bytes for ${stakeholderCount} stakeholders, received ${bytes.length}`,
      { ipAssetId: normalizedIpAssetId }
    );
  }

  const revenueTokenAssetId = readUint64BigEndian(
    bytes,
    REV_ASA_OFFSET,
    'revenueTokenAssetId',
    normalizedIpAssetId
  );

  if (revenueTokenAssetId === 0n) {
    throw new V7PoolBoxMalformedError(
      'V7 pool revenueTokenAssetId must be greater than zero',
      { ipAssetId: normalizedIpAssetId }
    );
  }

  const proxyAddressBytes = bytes.slice(
    PROXY_ADDRESS_OFFSET,
    PROXY_ADDRESS_OFFSET + ADDRESS_BYTES
  );

  const proxyAddress = isZeroAddress(proxyAddressBytes)
    ? null
    : decodeAddress(proxyAddressBytes, 'proxyAddress', normalizedIpAssetId);

  const stakeholders = [];
  let totalBps = 0;

  for (let index = 0; index < stakeholderCount; index += 1) {
    const entryOffset =
      STAKEHOLDERS_OFFSET + index * STAKEHOLDER_ENTRY_BYTES;

    const stakeholderAddressBytes = bytes.slice(
      entryOffset + STAKEHOLDER_ADDRESS_OFFSET,
      entryOffset + STAKEHOLDER_ADDRESS_OFFSET + ADDRESS_BYTES
    );

    const bps = readUint16BigEndian(
      bytes,
      entryOffset + STAKEHOLDER_BPS_OFFSET,
      `stakeholders[${index}].bps`,
      normalizedIpAssetId
    );

    const tokenClaimedFlag =
      bytes[entryOffset + STAKEHOLDER_TOKEN_CLAIMED_OFFSET];

    if (bps < 1) {
      throw new V7PoolBoxMalformedError(
        `stakeholders[${index}].bps must be greater than zero`,
        { ipAssetId: normalizedIpAssetId }
      );
    }

    if (
      tokenClaimedFlag !== FLAG_UNCLAIMED &&
      tokenClaimedFlag !== FLAG_CLAIMED
    ) {
      throw new V7PoolBoxMalformedError(
        `stakeholders[${index}].tokenClaimed flag must be 0 or 1`,
        { ipAssetId: normalizedIpAssetId }
      );
    }

    totalBps += bps;

    stakeholders.push(
      freezeStakeholder({
        address: decodeAddress(
          stakeholderAddressBytes,
          `stakeholders[${index}].address`,
          normalizedIpAssetId
        ),
        bps,
        tokensClaimed: tokenClaimedFlag === FLAG_CLAIMED,
      })
    );
  }

  if (totalBps !== TOTAL_BPS) {
    throw new V7PoolBoxMalformedError(
      `V7 pool stakeholder BPS must total ${TOTAL_BPS}, received ${totalBps}`,
      { ipAssetId: normalizedIpAssetId }
    );
  }

  return Object.freeze({
    ipAssetId: normalizedIpAssetId,
    revenueTokenAssetId,
    unallocatedUsdcAtomicUnits: readUint64BigEndian(
      bytes,
      UNALLOCATED_OFFSET,
      'unallocatedUsdcAtomicUnits',
      normalizedIpAssetId
    ),
    totalClaimedUsdcAtomicUnits: readUint64BigEndian(
      bytes,
      TOTAL_CLAIMED_OFFSET,
      'totalClaimedUsdcAtomicUnits',
      normalizedIpAssetId
    ),
    heldUsdcAtomicUnits: readUint64BigEndian(
      bytes,
      HELD_OFFSET,
      'heldUsdcAtomicUnits',
      normalizedIpAssetId
    ),
    currentRoundId: readUint64BigEndian(
      bytes,
      CURRENT_ROUND_OFFSET,
      'currentRoundId',
      normalizedIpAssetId
    ),
    stakeholderCount,
    proxyAddress,
    stakeholders: Object.freeze(stakeholders),
  });
}

export async function readV7PoolState({
  algodClient,
  revenuePoolAppId,
  expectedRevenuePoolAppId,
  ipAssetId,
}) {
  if (
    !algodClient ||
    typeof algodClient.getApplicationBoxByName !== 'function'
  ) {
    throw new TypeError(
      'algodClient must provide getApplicationBoxByName(appId, boxName)'
    );
  }

  const appId = assertSafePositiveInteger(
    revenuePoolAppId,
    'revenuePoolAppId'
  );
  const expectedAppId = assertSafePositiveInteger(
    expectedRevenuePoolAppId,
    'expectedRevenuePoolAppId'
  );
  const normalizedIpAssetId = assertIpAssetId(ipAssetId);

  if (appId !== expectedAppId) {
    throw new V7PoolAppIdMismatchError({
      revenuePoolAppId: appId,
      expectedRevenuePoolAppId: expectedAppId,
    });
  }

  const boxName = getV7PoolBoxName(normalizedIpAssetId);

  let response;

  try {
    response = await algodClient
      .getApplicationBoxByName(appId, boxName)
      .do();
  } catch (cause) {
    if (getHttpStatus(cause) === 404) {
      throw new V7PoolBoxNotFoundError({
        revenuePoolAppId: appId,
        ipAssetId: normalizedIpAssetId,
        cause,
      });
    }

    throw new V7PoolStateNetworkError({
      revenuePoolAppId: appId,
      ipAssetId: normalizedIpAssetId,
      cause,
    });
  }

  try {
    return decodeV7PoolBox({
      ipAssetId: normalizedIpAssetId,
      boxValue: response?.value,
    });
  } catch (cause) {
    if (cause instanceof V7PoolBoxMalformedError) {
      throw cause;
    }

    throw new V7PoolBoxMalformedError(
      'Unable to decode the V7 pool box response',
      {
        cause,
        ipAssetId: normalizedIpAssetId,
      }
    );
  }
}