// lib/revenue-pool-v7-settlement.js

import algosdk from 'algosdk';

function assertSafeInteger(value, fieldName, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(
      `${fieldName} must be a safe integer greater than or equal to ${minimum}`
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
    throw new TypeError('ipAssetId must be a non-empty string');
  }

  return value.trim();
}

function assertSuggestedParams(value) {
  if (!value || typeof value !== 'object') {
    throw new TypeError('suggestedParams is required');
  }

  return value;
}

export function getV7PoolBoxName(ipAssetId) {
  return new Uint8Array(Buffer.from(`p_${assertPoolKey(ipAssetId)}`));
}

export function getV7RoundBoxName(ipAssetId, roundId) {
  const normalizedIpAssetId = assertPoolKey(ipAssetId);
  const normalizedRoundId = assertSafeInteger(roundId, 'roundId', {
    minimum: 1,
  });

  const roundBytes = Buffer.alloc(8);
  roundBytes.writeBigUInt64BE(BigInt(normalizedRoundId));

  return new Uint8Array(
    Buffer.concat([
      Buffer.from(`rnd_${normalizedIpAssetId}`),
      roundBytes,
    ])
  );
}

export function calculateV7RoundMbrMicroAlgos({
  ipAssetId,
  stakeholderCount,
}) {
  const normalizedIpAssetId = assertPoolKey(ipAssetId);
  const normalizedStakeholderCount = assertSafeInteger(
    stakeholderCount,
    'stakeholderCount',
    { minimum: 1 }
  );

  const roundSize = 18 + normalizedStakeholderCount * 41;

  return (
    2500 +
    400 * (12 + Buffer.byteLength(normalizedIpAssetId) + roundSize)
  );
}

export function buildV7DepositHeldGroup({
  revenuePoolAppId,
  usdcAssetId,
  adminAddress,
  ipAssetId,
  usdcAtomicUnits,
  suggestedParams,
}) {
  const appId = assertSafeInteger(revenuePoolAppId, 'revenuePoolAppId', {
    minimum: 1,
  });
  const assetId = assertSafeInteger(usdcAssetId, 'usdcAssetId', {
    minimum: 1,
  });
  const sender = assertAlgorandAddress(adminAddress, 'adminAddress');
  const poolKey = assertPoolKey(ipAssetId);
  const amount = assertSafeInteger(usdcAtomicUnits, 'usdcAtomicUnits', {
    minimum: 1,
  });
  const params = assertSuggestedParams(suggestedParams);
  const appAddress = algosdk.getApplicationAddress(appId);

  const usdcTransferTxn =
    algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender,
      receiver: appAddress,
      assetIndex: assetId,
      amount,
      suggestedParams: {
        ...params,
        fee: BigInt(1000),
        flatFee: true,
      },
    });

  const depositHeldAppCallTxn =
    algosdk.makeApplicationNoOpTxnFromObject({
      sender,
      appIndex: appId,
      appArgs: [
        new TextEncoder().encode('deposit_held'),
        new TextEncoder().encode(poolKey),
        algosdk.encodeUint64(0),
      ],
      foreignAssets: [assetId],
      boxes: [
        {
          appIndex: appId,
          name: getV7PoolBoxName(poolKey),
        },
      ],
      suggestedParams: {
        ...params,
        fee: BigInt(2000),
        flatFee: true,
      },
    });

  const transactions = [usdcTransferTxn, depositHeldAppCallTxn];

  algosdk.assignGroupID(transactions);

  return {
    transactions,
    companionTransactionIndex: 0,
    appCallTransactionIndex: 1,
    revenuePoolAppId: appId,
    ipAssetId: poolKey,
    usdcAssetId: assetId,
    usdcAtomicUnits: amount,
  };
}

export function buildV7ReleaseHeldGroup({
  revenuePoolAppId,
  usdcAssetId,
  adminAddress,
  ipAssetId,
  currentRoundId,
  stakeholderCount,
  suggestedParams,
}) {
  const appId = assertSafeInteger(revenuePoolAppId, 'revenuePoolAppId', {
    minimum: 1,
  });
  const assetId = assertSafeInteger(usdcAssetId, 'usdcAssetId', {
    minimum: 1,
  });
  const sender = assertAlgorandAddress(adminAddress, 'adminAddress');
  const poolKey = assertPoolKey(ipAssetId);
  const normalizedCurrentRoundId = assertSafeInteger(
    currentRoundId,
    'currentRoundId'
  );
  const params = assertSuggestedParams(suggestedParams);

  const nextRoundId = normalizedCurrentRoundId + 1;

  if (!Number.isSafeInteger(nextRoundId)) {
    throw new RangeError('nextRoundId exceeds JavaScript safe-integer range');
  }

  const roundMbrMicroAlgos = calculateV7RoundMbrMicroAlgos({
    ipAssetId: poolKey,
    stakeholderCount,
  });

  const appAddress = algosdk.getApplicationAddress(appId);

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
        new TextEncoder().encode('release_held'),
        new TextEncoder().encode(poolKey),
        algosdk.encodeUint64(0),
      ],
      foreignAssets: [assetId],
      boxes: [
        {
          appIndex: appId,
          name: getV7PoolBoxName(poolKey),
        },
        {
          appIndex: appId,
          name: getV7RoundBoxName(poolKey, nextRoundId),
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

  return {
    transactions,
    companionTransactionIndex: 0,
    appCallTransactionIndex: 1,
    revenuePoolAppId: appId,
    ipAssetId: poolKey,
    usdcAssetId: assetId,
    currentRoundId: normalizedCurrentRoundId,
    nextRoundId,
    roundMbrMicroAlgos,
  };
}