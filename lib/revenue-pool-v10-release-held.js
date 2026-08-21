import algosdk from 'algosdk';

export const V10_RELEASE_HELD_ACTION = 'release_held';
export const V10_RELEASE_COMPANION_TRANSACTION_INDEX = 0;
export const V10_RELEASE_APP_CALL_TRANSACTION_INDEX = 1;
export const V10_RELEASE_TRANSACTION_COUNT = 2;

const V10_ROUND_BOX_HEADER_BYTES = 18;
const V10_ROUND_ENTRY_BYTES = 41;
const V10_BOX_MBR_BASE_MICROALGOS = 2500;
const V10_BOX_MBR_PER_BYTE_MICROALGOS = 400;

function assertSafeInteger(value, fieldName, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(
      `${fieldName} must be a safe integer greater than or equal to ${minimum}`,
    );
  }

  return value;
}

function assertAlgorandAddress(value, fieldName) {
  if (typeof value !== 'string' || !algosdk.isValidAddress(value)) {
    throw new TypeError(`${fieldName} must be a valid Algorand address`);
  }

  return value;
}

function assertPoolKey(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('poolKey must be a non-empty string');
  }

  const normalized = value.trim();

  if (Buffer.byteLength(normalized, 'utf8') > 50) {
    throw new TypeError('poolKey must not exceed 50 UTF-8 bytes');
  }

  return normalized;
}

function assertSuggestedParams(value) {
  if (!value || typeof value !== 'object') {
    throw new TypeError('suggestedParams is required');
  }

  return value;
}

function encodeUint64(value, fieldName) {
  const normalized = assertSafeInteger(value, fieldName, {
    minimum: 0,
  });
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(normalized));
  return new Uint8Array(bytes);
}

export function getV10PoolBoxName(poolKey) {
  return new Uint8Array(
    Buffer.from(`p_${assertPoolKey(poolKey)}`, 'utf8'),
  );
}

export function getV10RoundBoxName(poolKey, roundId) {
  const normalizedPoolKey = assertPoolKey(poolKey);
  const normalizedRoundId = assertSafeInteger(roundId, 'roundId', {
    minimum: 1,
  });

  return new Uint8Array(
    Buffer.concat([
      Buffer.from(`rnd_${normalizedPoolKey}`, 'utf8'),
      Buffer.from(encodeUint64(normalizedRoundId, 'roundId')),
    ]),
  );
}

export function calculateV10ReleaseRoundMbrMicroAlgos({
  poolKey,
  stakeholderCount,
}) {
  const normalizedPoolKey = assertPoolKey(poolKey);
  const normalizedStakeholderCount = assertSafeInteger(
    stakeholderCount,
    'stakeholderCount',
    { minimum: 1 },
  );

  if (normalizedStakeholderCount > 100) {
    throw new RangeError('stakeholderCount must not exceed 100');
  }

  const roundSize =
    V10_ROUND_BOX_HEADER_BYTES +
    normalizedStakeholderCount * V10_ROUND_ENTRY_BYTES;

  return (
    V10_BOX_MBR_BASE_MICROALGOS +
    V10_BOX_MBR_PER_BYTE_MICROALGOS *
      (
        12 +
        Buffer.byteLength(normalizedPoolKey, 'utf8') +
        roundSize
      )
  );
}

export function buildV10ReleaseHeldGroup({
  revenuePoolAppId,
  adminAddress,
  poolKey,
  currentRoundId,
  stakeholderCount,
  suggestedParams,
}) {
  const appId = assertSafeInteger(revenuePoolAppId, 'revenuePoolAppId', {
    minimum: 1,
  });
  const sender = assertAlgorandAddress(adminAddress, 'adminAddress');
  const normalizedPoolKey = assertPoolKey(poolKey);
  const normalizedCurrentRoundId = assertSafeInteger(
    currentRoundId,
    'currentRoundId',
    { minimum: 0 },
  );
  const params = assertSuggestedParams(suggestedParams);

  const nextRoundId = normalizedCurrentRoundId + 1;

  if (!Number.isSafeInteger(nextRoundId)) {
    throw new RangeError('nextRoundId exceeds JavaScript safe-integer range');
  }

  const roundMbrMicroAlgos = calculateV10ReleaseRoundMbrMicroAlgos({
    poolKey: normalizedPoolKey,
    stakeholderCount,
  });

  const appAddress = algosdk.getApplicationAddress(appId).toString();

  const mbrPaymentTxn =
    algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender,
      receiver: appAddress,
      amount: roundMbrMicroAlgos,
      suggestedParams: {
        ...params,
        fee: BigInt(1000),
        flatFee: true,
      },
    });

  const releaseHeldAppCallTxn =
    algosdk.makeApplicationNoOpTxnFromObject({
      sender,
      appIndex: appId,
      appArgs: [
        new TextEncoder().encode(V10_RELEASE_HELD_ACTION),
        new TextEncoder().encode(normalizedPoolKey),
        encodeUint64(
          V10_RELEASE_COMPANION_TRANSACTION_INDEX,
          'companionTransactionIndex',
        ),
      ],
      boxes: [
        {
          appIndex: 0,
          name: getV10PoolBoxName(normalizedPoolKey),
        },
        {
          appIndex: 0,
          name: getV10RoundBoxName(
            normalizedPoolKey,
            nextRoundId,
          ),
        },
      ],
      suggestedParams: {
        ...params,
        fee: BigInt(2000),
        flatFee: true,
      },
    });

  const transactions = [mbrPaymentTxn, releaseHeldAppCallTxn];

  algosdk.assignGroupID(transactions);

  return Object.freeze({
    transactions: Object.freeze(transactions),
    transactionCount: V10_RELEASE_TRANSACTION_COUNT,
    companionTransactionIndex:
      V10_RELEASE_COMPANION_TRANSACTION_INDEX,
    appCallTransactionIndex:
      V10_RELEASE_APP_CALL_TRANSACTION_INDEX,
    revenuePoolAppId: appId,
    poolKey: normalizedPoolKey,
    currentRoundId: normalizedCurrentRoundId,
    nextRoundId,
    roundMbrMicroAlgos,
    appAddress,
    action: V10_RELEASE_HELD_ACTION,
  });
}