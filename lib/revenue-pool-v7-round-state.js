// lib/revenue-pool-v7-round-state.js

import algosdk from 'algosdk';

import { getV7RoundBoxName } from './revenue-pool-v7-settlement.js';

const ROUND_HEADER_BYTES = 18;
const ROUND_ENTRY_BYTES = 41;
const MAX_IP_ID_BYTES = 50;
const MAX_SAFE_ROUND_ID = BigInt(Number.MAX_SAFE_INTEGER);

export class V7RoundBoxMalformedError extends Error {
  constructor(message, { cause, ipAssetId, roundId } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'V7RoundBoxMalformedError';
    this.ipAssetId = ipAssetId;
    this.roundId = roundId;
  }
}

export class V7RoundStateNetworkError extends Error {
  constructor({ revenuePoolAppId, ipAssetId, roundId, cause } = {}) {
    super(
      `Unable to read V7 round ${roundId} for ipAssetId "${ipAssetId}" on application ${revenuePoolAppId}`,
      cause ? { cause } : undefined
    );
    this.name = 'V7RoundStateNetworkError';
    this.revenuePoolAppId = revenuePoolAppId;
    this.ipAssetId = ipAssetId;
    this.roundId = roundId;
  }
}

function assertPositiveSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${fieldName} must be a positive safe integer`);
  }

  return value;
}

function assertIpAssetId(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('ipAssetId must be a non-empty string');
  }

  const normalized = value.trim();

  if (Buffer.byteLength(normalized) > MAX_IP_ID_BYTES) {
    throw new TypeError(
      `ipAssetId must not exceed ${MAX_IP_ID_BYTES} UTF-8 bytes`
    );
  }

  return normalized;
}

function assertPoolState(value) {
  if (!value || typeof value !== 'object') {
    throw new TypeError('poolState is required');
  }

  if (typeof value.currentRoundId !== 'bigint' || value.currentRoundId < 0n) {
    throw new TypeError(
      'poolState.currentRoundId must be a non-negative bigint'
    );
  }

  if (
    typeof value.heldUsdcAtomicUnits !== 'bigint' ||
    value.heldUsdcAtomicUnits < 0n
  ) {
    throw new TypeError(
      'poolState.heldUsdcAtomicUnits must be a non-negative bigint'
    );
  }

  return value;
}

function normalizeBoxValue(value, ipAssetId, roundId) {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }

  if (typeof value === 'string') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }

  throw new V7RoundBoxMalformedError(
    'V7 round box value must be a Uint8Array or a base64 string',
    { ipAssetId, roundId }
  );
}

function readUint64(bytes, offset, fieldName, ipAssetId, roundId) {
  try {
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    );

    return view.getBigUint64(offset, false);
  } catch (cause) {
    throw new V7RoundBoxMalformedError(
      `Unable to decode ${fieldName} as uint64`,
      { cause, ipAssetId, roundId }
    );
  }
}

function readUint16(bytes, offset, fieldName, ipAssetId, roundId) {
  try {
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    );

    return view.getUint16(offset, false);
  } catch (cause) {
    throw new V7RoundBoxMalformedError(
      `Unable to decode ${fieldName} as uint16`,
      { cause, ipAssetId, roundId }
    );
  }
}

function freezeState({
  releaseStatus,
  reasons,
  currentRoundId,
  activeRound,
  roundReadStatus,
}) {
  return Object.freeze({
    releaseStatus,
    reasons: Object.freeze(reasons),
    currentRoundId,
    activeRound,
    roundReadStatus,
  });
}

export function decodeV7RoundBox({ ipAssetId, roundId, boxValue }) {
  const normalizedIpAssetId = assertIpAssetId(ipAssetId);

  if (typeof roundId !== 'bigint' || roundId < 1n) {
    throw new TypeError('roundId must be a positive bigint');
  }

  const bytes = normalizeBoxValue(boxValue, normalizedIpAssetId, roundId);

  if (bytes.length < ROUND_HEADER_BYTES) {
    throw new V7RoundBoxMalformedError(
      `V7 round box is too short: expected at least ${ROUND_HEADER_BYTES} bytes, received ${bytes.length}`,
      { ipAssetId: normalizedIpAssetId, roundId }
    );
  }

  const entryCount = readUint16(
    bytes,
    16,
    'entryCount',
    normalizedIpAssetId,
    roundId
  );

  if (entryCount < 1) {
    throw new V7RoundBoxMalformedError(
      'V7 round entryCount must be greater than zero',
      { ipAssetId: normalizedIpAssetId, roundId }
    );
  }

  const expectedLength =
    ROUND_HEADER_BYTES + entryCount * ROUND_ENTRY_BYTES;

  if (bytes.length !== expectedLength) {
    throw new V7RoundBoxMalformedError(
      `V7 round box length mismatch: expected ${expectedLength} bytes for ${entryCount} entries, received ${bytes.length}`,
      { ipAssetId: normalizedIpAssetId, roundId }
    );
  }

  const totalUsdcAtomicUnits = readUint64(
    bytes,
    0,
    'totalUsdcAtomicUnits',
    normalizedIpAssetId,
    roundId
  );
  const createdAtUnixSeconds = readUint64(
    bytes,
    8,
    'createdAtUnixSeconds',
    normalizedIpAssetId,
    roundId
  );

  const entries = [];
  let totalAllocatedUsdcAtomicUnits = 0n;
  let totalClaimedUsdcAtomicUnits = 0n;
  let claimedEntryCount = 0;

  for (let index = 0; index < entryCount; index += 1) {
    const offset = ROUND_HEADER_BYTES + index * ROUND_ENTRY_BYTES;
    const amountUsdcAtomicUnits = readUint64(
      bytes,
      offset + 32,
      `entries[${index}].amountUsdcAtomicUnits`,
      normalizedIpAssetId,
      roundId
    );
    const claimedFlag = bytes[offset + 40];

    if (claimedFlag !== 0 && claimedFlag !== 1) {
      throw new V7RoundBoxMalformedError(
        `entries[${index}].claimed flag must be 0 or 1`,
        { ipAssetId: normalizedIpAssetId, roundId }
      );
    }

    const claimed = claimedFlag === 1;
    totalAllocatedUsdcAtomicUnits += amountUsdcAtomicUnits;

    if (claimed) {
      totalClaimedUsdcAtomicUnits += amountUsdcAtomicUnits;
      claimedEntryCount += 1;
    }

    entries.push(
      Object.freeze({
        address: algosdk.encodeAddress(bytes.slice(offset, offset + 32)),
        amountUsdcAtomicUnits,
        claimed,
      })
    );
  }

  if (totalAllocatedUsdcAtomicUnits > totalUsdcAtomicUnits) {
    throw new V7RoundBoxMalformedError(
      'V7 round allocated USDC cannot exceed the round total',
      { ipAssetId: normalizedIpAssetId, roundId }
    );
  }

  return Object.freeze({
    ipAssetId: normalizedIpAssetId,
    roundId,
    totalUsdcAtomicUnits,
    createdAtUnixSeconds,
    entryCount,
    entries: Object.freeze(entries),
    totalAllocatedUsdcAtomicUnits,
    totalClaimedUsdcAtomicUnits,
    totalUnclaimedUsdcAtomicUnits:
      totalAllocatedUsdcAtomicUnits - totalClaimedUsdcAtomicUnits,
    claimedEntryCount,
    unclaimedEntryCount: entryCount - claimedEntryCount,
    isComplete: claimedEntryCount === entryCount,
  });
}

export function deriveV7ReleaseState({
  poolState,
  activeRound,
  roundReadStatus = 'found',
  reason,
}) {
  const normalizedPoolState = assertPoolState(poolState);

  if (
    roundReadStatus === 'app-id-mismatch' ||
    roundReadStatus === 'missing' ||
    roundReadStatus === 'unsupported-round-id'
  ) {
    return freezeState({
      releaseStatus: 'blocked',
      reasons: [
        reason || 'The active settlement-round state is invalid.',
      ],
      currentRoundId: normalizedPoolState.currentRoundId,
      activeRound: null,
      roundReadStatus,
    });
  }

  if (normalizedPoolState.heldUsdcAtomicUnits > 0n) {
    return freezeState({
      releaseStatus: 'ready',
      reasons: [],
      currentRoundId: normalizedPoolState.currentRoundId,
      activeRound: activeRound || null,
      roundReadStatus,
    });
  }

  if (normalizedPoolState.currentRoundId === 0n) {
    return freezeState({
      releaseStatus: 'blocked',
      reasons: ['No held USDC is available for release.'],
      currentRoundId: 0n,
      activeRound: null,
      roundReadStatus: 'not-applicable',
    });
  }

  if (!activeRound) {
    return freezeState({
      releaseStatus: 'blocked',
      reasons: [reason || 'The active round could not be read.'],
      currentRoundId: normalizedPoolState.currentRoundId,
      activeRound: null,
      roundReadStatus,
    });
  }

  if (activeRound.isComplete) {
    return freezeState({
      releaseStatus: 'complete',
      reasons: [
        'The active round is fully claimed and no held USDC remains.',
      ],
      currentRoundId: normalizedPoolState.currentRoundId,
      activeRound,
      roundReadStatus,
    });
  }

  return freezeState({
    releaseStatus: 'pending',
    reasons: ['The active round still has unclaimed USDC entries.'],
    currentRoundId: normalizedPoolState.currentRoundId,
    activeRound,
    roundReadStatus,
  });
}

export async function readV7ActiveRoundState({
  algodClient,
  revenuePoolAppId,
  expectedRevenuePoolAppId,
  ipAssetId,
  poolState,
}) {
  if (
    !algodClient ||
    typeof algodClient.getApplicationBoxByName !== 'function'
  ) {
    throw new TypeError(
      'algodClient must provide getApplicationBoxByName(appId, boxName)'
    );
  }

  const appId = assertPositiveSafeInteger(
    revenuePoolAppId,
    'revenuePoolAppId'
  );
  const expectedAppId = assertPositiveSafeInteger(
    expectedRevenuePoolAppId,
    'expectedRevenuePoolAppId'
  );
  const normalizedIpAssetId = assertIpAssetId(ipAssetId);
  const normalizedPoolState = assertPoolState(poolState);

  if (appId !== expectedAppId) {
    return deriveV7ReleaseState({
      poolState: normalizedPoolState,
      activeRound: null,
      roundReadStatus: 'app-id-mismatch',
      reason:
        'The supplied revenue-pool application ID does not match the expected application ID.',
    });
  }

  const roundId = normalizedPoolState.currentRoundId;

  if (roundId === 0n) {
    return deriveV7ReleaseState({
      poolState: normalizedPoolState,
      activeRound: null,
      roundReadStatus: 'not-applicable',
    });
  }

  if (roundId > MAX_SAFE_ROUND_ID) {
    return deriveV7ReleaseState({
      poolState: normalizedPoolState,
      activeRound: null,
      roundReadStatus: 'unsupported-round-id',
      reason:
        'The current round ID exceeds the safe range supported by the existing settlement builder.',
    });
  }

  let response;

  try {
    response = await algodClient
      .getApplicationBoxByName(
        appId,
        getV7RoundBoxName(normalizedIpAssetId, Number(roundId))
      )
      .do();
  } catch (cause) {
    const status =
      cause?.status ??
      cause?.statusCode ??
      cause?.response?.status ??
      cause?.response?.statusCode;

    if (status === 404) {
      return deriveV7ReleaseState({
        poolState: normalizedPoolState,
        activeRound: null,
        roundReadStatus: 'missing',
        reason:
          'The pool references an active round whose box is missing.',
      });
    }

    throw new V7RoundStateNetworkError({
      revenuePoolAppId: appId,
      ipAssetId: normalizedIpAssetId,
      roundId,
      cause,
    });
  }

  const activeRound = decodeV7RoundBox({
    ipAssetId: normalizedIpAssetId,
    roundId,
    boxValue: response?.value,
  });

  return deriveV7ReleaseState({
    poolState: normalizedPoolState,
    activeRound,
    roundReadStatus: 'found',
  });
}