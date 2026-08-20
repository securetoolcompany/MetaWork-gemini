import algosdk from 'algosdk';

const APP_CALL_FEE_MICROALGOS = 2_000;

function normalizePositiveInteger(value, name) {
  const normalized = Number(value);

  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }

  return normalized;
}

function normalizePositiveBigInt(value, name) {
  try {
    const normalized = BigInt(value);

    if (normalized <= 0n) {
      throw new Error();
    }

    return normalized;
  } catch {
    throw new Error(`${name} must be a positive integer atomic-unit amount.`);
  }
}

function normalizeAddress(value, name) {
  const normalized = String(value || '').trim();

  if (!algosdk.isValidAddress(normalized)) {
    throw new Error(`${name} must be a valid Algorand address.`);
  }

  return normalized;
}

function normalizePoolKey(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new Error('poolKey is required.');
  }

  return normalized;
}

function normalizeSuggestedParams(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('suggestedParams are required.');
  }

  return value;
}

function uint64ToBytes(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(value));
  return new Uint8Array(bytes);
}

function encodePoolBoxName(poolKey) {
  return new Uint8Array(Buffer.from(`p_${poolKey}`, 'utf8'));
}

/**
 * Builds the two-transaction V10 escrow-deposit group:
 *   0. USDC transfer to the application address
 *   1. Application call: deposit_held(poolKey, exactAtomicAmount)
 *
 * This does not sign or submit transactions.
 */
export function buildV10DepositHeldUsdcGroup({
  sender,
  revenuePoolAppId,
  poolKey,
  revenueTokenAssetId,
  usdcAssetId,
  amountUsdcAtomicUnits,
  suggestedParams,
}) {
  const normalizedSender = normalizeAddress(sender, 'sender');
  const normalizedAppId = normalizePositiveInteger(
    revenuePoolAppId,
    'revenuePoolAppId',
  );
  const normalizedPoolKey = normalizePoolKey(poolKey);
  const normalizedRevenueTokenAssetId = normalizePositiveInteger(
    revenueTokenAssetId,
    'revenueTokenAssetId',
  );
  const normalizedUsdcAssetId = normalizePositiveInteger(
    usdcAssetId,
    'usdcAssetId',
  );
  const normalizedAmount = normalizePositiveBigInt(
    amountUsdcAtomicUnits,
    'amountUsdcAtomicUnits',
  );
  const normalizedSuggestedParams = normalizeSuggestedParams(suggestedParams);
  const appAddress = algosdk.getApplicationAddress(normalizedAppId);

  const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: normalizedSender,
    receiver: appAddress,
    amount: normalizedAmount,
    assetIndex: normalizedUsdcAssetId,
    suggestedParams: normalizedSuggestedParams,
  });

  const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: normalizedSender,
    appIndex: normalizedAppId,
    appArgs: [
      new Uint8Array(Buffer.from('deposit_held', 'utf8')),
      new Uint8Array(Buffer.from(normalizedPoolKey, 'utf8')),
      uint64ToBytes(normalizedAmount),
    ],
    foreignAssets: [
      normalizedUsdcAssetId,
      normalizedRevenueTokenAssetId,
    ],
    boxes: [
      {
        appIndex: 0,
        name: encodePoolBoxName(normalizedPoolKey),
      },
    ],
    suggestedParams: {
      ...normalizedSuggestedParams,
      flatFee: true,
      fee: Math.max(
        Number(normalizedSuggestedParams.fee || 0),
        APP_CALL_FEE_MICROALGOS,
      ),
    },
  });

  algosdk.assignGroupID([transferTxn, appCallTxn]);

  return {
    appAddress,
    appId: normalizedAppId,
    poolKey: normalizedPoolKey,
    revenueTokenAssetId: normalizedRevenueTokenAssetId,
    usdcAssetId: normalizedUsdcAssetId,
    amountUsdcAtomicUnits: normalizedAmount,
    group: [transferTxn, appCallTxn],
    unsignedGroup: [
      Buffer.from(algosdk.encodeUnsignedTransaction(transferTxn)).toString(
        'base64',
      ),
      Buffer.from(algosdk.encodeUnsignedTransaction(appCallTxn)).toString(
        'base64',
      ),
    ],
  };
}