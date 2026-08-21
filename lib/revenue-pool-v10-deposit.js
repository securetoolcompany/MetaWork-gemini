import algosdk from 'algosdk';
import { createHash } from 'node:crypto';

export const V10_DEPOSIT_ACTION = 'deposit_usdc';
export const V10_DEPOSIT_HELD_ACTION = 'deposit_held';
export const V10_USDC_TRANSFER_TRANSACTION_INDEX = 0;
export const V10_APP_CALL_TRANSACTION_INDEX = 1;
export const V10_DEPOSIT_TRANSACTION_COUNT = 2;

export class V10DepositValidationError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'V10DepositValidationError';
    this.code = code || 'V10_DEPOSIT_VALIDATION_ERROR';
  }
}

function assertSafeInteger(value, fieldName, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new V10DepositValidationError(
      `${fieldName} must be a safe integer greater than or equal to ${minimum}`,
      { code: 'INVALID_INTEGER' },
    );
  }

  return value;
}

function assertPoolKey(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new V10DepositValidationError(
      'poolKey must be a non-empty string',
      { code: 'INVALID_POOL_KEY' },
    );
  }

  const poolKey = value.trim();

  if (Buffer.byteLength(poolKey) > 50) {
    throw new V10DepositValidationError(
      'poolKey must not exceed 50 UTF-8 bytes',
      { code: 'INVALID_POOL_KEY' },
    );
  }

  return poolKey;
}

function assertAlgorandAddress(value, fieldName) {
  if (typeof value !== 'string' || !algosdk.isValidAddress(value)) {
    throw new V10DepositValidationError(
      `${fieldName} must be a valid Algorand address`,
      { code: 'INVALID_ADDRESS' },
    );
  }

  return value;
}

function assertSuggestedParams(value) {
  if (!value || typeof value !== 'object') {
    throw new V10DepositValidationError(
      'suggestedParams is required',
      { code: 'INVALID_SUGGESTED_PARAMS' },
    );
  }

  return value;
}

function assertGroup(transactions) {
  if (
    !Array.isArray(transactions) ||
    transactions.length !== V10_DEPOSIT_TRANSACTION_COUNT
  ) {
    throw new V10DepositValidationError(
      `V10 deposit group must contain exactly ${V10_DEPOSIT_TRANSACTION_COUNT} transactions`,
      { code: 'INVALID_GROUP_LENGTH' },
    );
  }

  const group = transactions[0]?.group;

  if (!(group instanceof Uint8Array) || group.length === 0) {
    throw new V10DepositValidationError(
      'V10 deposit group is missing an assigned group ID',
      { code: 'MISSING_GROUP_ID' },
    );
  }

  const groupId = Buffer.from(group).toString('base64');

  for (const [index, transaction] of transactions.entries()) {
    if (!(transaction?.group instanceof Uint8Array)) {
      throw new V10DepositValidationError(
        `V10 deposit transaction ${index} is missing a group ID`,
        { code: 'MISSING_GROUP_ID' },
      );
    }

    if (Buffer.from(transaction.group).toString('base64') !== groupId) {
      throw new V10DepositValidationError(
        `V10 deposit transaction ${index} does not belong to the assigned group`,
        { code: 'GROUP_ID_MISMATCH' },
      );
    }
  }

  return groupId;
}

function getAppArgs(transaction) {
  return transaction?.applicationCall?.appArgs ?? [];
}

function getAction(transaction) {
  return Buffer.from(getAppArgs(transaction)[0] ?? []).toString();
}

function getPoolKeyArg(transaction) {
  return Buffer.from(getAppArgs(transaction)[1] ?? []).toString();
}

function getUint64Arg(transaction, index) {
  const encoded = getAppArgs(transaction)[index];

  if (!(encoded instanceof Uint8Array) || encoded.length !== 8) {
    return null;
  }

  return new DataView(
    encoded.buffer,
    encoded.byteOffset,
    encoded.byteLength,
  ).getBigUint64(0, false);
}

function getBoxName(transaction) {
  const boxes = transaction?.applicationCall?.boxes ?? [];

  if (!Array.isArray(boxes) || boxes.length !== 1) {
    return null;
  }

  const boxName = boxes[0]?.name;

  if (!(boxName instanceof Uint8Array)) {
    return null;
  }

  return boxName;
}

function getForeignAssets(transaction) {
  return transaction?.applicationCall?.foreignAssets ?? [];
}

function getTransferAmount(transaction) {
  const amount =
    transaction?.assetTransfer?.amount ??
    transaction?.assetTransfer?.assetAmount;

  if (typeof amount === 'bigint') {
    return amount;
  }

  if (typeof amount === 'number' && Number.isSafeInteger(amount)) {
    return BigInt(amount);
  }

  return null;
}

function getTransferAssetId(transaction) {
  const assetId =
    transaction?.assetTransfer?.assetIndex ??
    transaction?.assetTransfer?.xferAsset;

  if (typeof assetId === 'bigint') {
    return assetId;
  }

  if (typeof assetId === 'number' && Number.isSafeInteger(assetId)) {
    return BigInt(assetId);
  }

  return null;
}

function getTransferReceiver(transaction) {
  const receiver = transaction?.assetTransfer?.receiver ?? null;

  if (!receiver) {
    return null;
  }

  if (typeof receiver === 'string') {
    return receiver;
  }

  if (typeof receiver.toString === 'function') {
    const normalized = receiver.toString();

    if (algosdk.isValidAddress(normalized)) {
      return normalized;
    }
  }

  if (receiver.publicKey instanceof Uint8Array) {
    try {
      return algosdk.encodeAddress(receiver.publicKey);
    } catch {
      return null;
    }
  }

  return null;
}

function getTransactionId(transaction, fieldName) {
  if (!transaction || typeof transaction.txID !== 'function') {
    throw new V10DepositValidationError(
      `${fieldName} must provide txID()`,
      { code: 'INVALID_TRANSACTION' },
    );
  }

  const transactionId = transaction.txID();

  if (typeof transactionId !== 'string' || !transactionId) {
    throw new V10DepositValidationError(
      `${fieldName}.txID() must return a non-empty string`,
      { code: 'INVALID_TRANSACTION_ID' },
    );
  }

  return transactionId;
}

function encodeUnsignedTransactions(transactions) {
  return transactions.map((transaction) =>
    Buffer.from(algosdk.encodeUnsignedTransaction(transaction)).toString(
      'base64',
    ),
  );
}

function hashUnsignedTransactionPayloads(unsignedTransactionsBase64) {
  const hasher = createHash('sha256');

  for (const encodedTransaction of unsignedTransactionsBase64) {
    hasher.update(Buffer.from(encodedTransaction, 'base64'));
  }

  return `sha256:${hasher.digest('hex')}`;
}

function normalizeMetadataTarget(target) {
  if (!target || typeof target !== 'object') {
    throw new V10DepositValidationError(
      'target is required',
      { code: 'INVALID_TARGET' },
    );
  }

  return {
    revenuePoolAppId: assertSafeInteger(
      target.revenuePoolAppId,
      'target.revenuePoolAppId',
      { minimum: 1 },
    ),
    poolKey: assertPoolKey(target.poolKey),
    revenueTokenAssetId: assertSafeInteger(
      target.revenueTokenAssetId,
      'target.revenueTokenAssetId',
      { minimum: 1 },
    ),
    usdcAssetId: assertSafeInteger(
      target.usdcAssetId,
      'target.usdcAssetId',
      { minimum: 1 },
    ),
  };
}

function assertMetadataInteger(value, fieldName, expectedValue) {
  if (!Number.isSafeInteger(value) || value !== expectedValue) {
    throw new V10DepositValidationError(
      `${fieldName} must equal ${expectedValue}`,
      { code: 'INVALID_METADATA' },
    );
  }
}

export function getV10PoolBoxName(poolKey) {
  return new Uint8Array(Buffer.from(`p_${assertPoolKey(poolKey)}`));
}

export function buildV10DepositUsdcGroup({
  revenuePoolAppId,
  usdcAssetId,
  depositorAddress,
  poolKey,
  usdcAtomicUnits,
  suggestedParams,
}) {
  const appId = assertSafeInteger(
    revenuePoolAppId,
    'revenuePoolAppId',
    { minimum: 1 },
  );
  const assetId = assertSafeInteger(usdcAssetId, 'usdcAssetId', {
    minimum: 1,
  });
  const sender = assertAlgorandAddress(
    depositorAddress,
    'depositorAddress',
  );
  const normalizedPoolKey = assertPoolKey(poolKey);
  const amount = assertSafeInteger(
    usdcAtomicUnits,
    'usdcAtomicUnits',
    { minimum: 1 },
  );
  const params = assertSuggestedParams(suggestedParams);
  const appAddress = algosdk.getApplicationAddress(appId).toString();

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

  const depositUsdcAppCallTxn =
    algosdk.makeApplicationNoOpTxnFromObject({
      sender,
      appIndex: appId,
      appArgs: [
        new TextEncoder().encode(V10_DEPOSIT_ACTION),
        new TextEncoder().encode(normalizedPoolKey),
        algosdk.encodeUint64(
          BigInt(V10_USDC_TRANSFER_TRANSACTION_INDEX),
        ),
      ],
      foreignAssets: [assetId],
      boxes: [
        {
          appIndex: appId,
          name: getV10PoolBoxName(normalizedPoolKey),
        },
      ],
      suggestedParams: {
        ...params,
        fee: BigInt(2000),
        flatFee: true,
      },
    });

  const transactions = [usdcTransferTxn, depositUsdcAppCallTxn];

  algosdk.assignGroupID(transactions);

  return getV10PreparedGroupMetadata({
    transactions,
    target: {
      revenuePoolAppId: appId,
      poolKey: normalizedPoolKey,
      revenueTokenAssetId: null,
      usdcAssetId: assetId,
    },
    usdcAtomicUnits: amount,
  });
}

export function getV10PreparedGroupMetadata({
  transactions,
  target,
  usdcAtomicUnits,
}) {
  const normalizedTarget = normalizeMetadataTarget({
    ...target,
    revenueTokenAssetId:
      target?.revenueTokenAssetId ?? 1,
  });
  const amount = assertSafeInteger(
    usdcAtomicUnits,
    'usdcAtomicUnits',
    { minimum: 1 },
  );
  const groupId = assertGroup(transactions);

  const usdcTransferTxn =
    transactions[V10_USDC_TRANSFER_TRANSACTION_INDEX];
  const appCallTxn = transactions[V10_APP_CALL_TRANSACTION_INDEX];

  if (usdcTransferTxn?.type !== 'axfer') {
    throw new V10DepositValidationError(
      'V10 deposit transaction 0 must be a USDC asset transfer',
      { code: 'INVALID_TRANSACTION_ORDER' },
    );
  }

  if (appCallTxn?.type !== 'appl') {
    throw new V10DepositValidationError(
      'V10 deposit transaction 1 must be an application call',
      { code: 'INVALID_TRANSACTION_ORDER' },
    );
  }

  if (getAction(appCallTxn) !== V10_DEPOSIT_ACTION) {
    throw new V10DepositValidationError(
      `V10 app call action must be "${V10_DEPOSIT_ACTION}"`,
      { code: 'INVALID_APP_ACTION' },
    );
  }

  if (getPoolKeyArg(appCallTxn) !== normalizedTarget.poolKey) {
    throw new V10DepositValidationError(
      'V10 app call pool key does not match the expected pool key',
      { code: 'POOL_KEY_MISMATCH' },
    );
  }

  if (
    getUint64Arg(
      appCallTxn,
      2,
    ) !== BigInt(V10_USDC_TRANSFER_TRANSACTION_INDEX)
  ) {
    throw new V10DepositValidationError(
      'V10 deposit app call companion transfer index must be 0',
      { code: 'INVALID_COMPANION_INDEX' },
    );
  }

  if (
    getTransferAssetId(usdcTransferTxn) !==
    BigInt(normalizedTarget.usdcAssetId)
  ) {
    throw new V10DepositValidationError(
      'V10 deposit transfer asset does not match the configured USDC asset',
      { code: 'USDC_ASSET_MISMATCH' },
    );
  }

  if (
    getTransferAmount(usdcTransferTxn) !== BigInt(amount)
  ) {
    throw new V10DepositValidationError(
      'V10 deposit transfer amount does not match the frozen USDC amount',
      { code: 'USDC_AMOUNT_MISMATCH' },
    );
  }

  const expectedAppAddress = algosdk
    .getApplicationAddress(normalizedTarget.revenuePoolAppId)
    .toString();

  if (getTransferReceiver(usdcTransferTxn) !== expectedAppAddress) {
    throw new V10DepositValidationError(
      'V10 deposit transfer receiver must be the revenue-pool application address',
      { code: 'INVALID_USDC_RECEIVER' },
    );
  }

  const foreignAssets = getForeignAssets(appCallTxn);

  if (
    !Array.isArray(foreignAssets) ||
    foreignAssets.length !== 1 ||
    BigInt(foreignAssets[0]) !== BigInt(normalizedTarget.usdcAssetId)
  ) {
    throw new V10DepositValidationError(
      'V10 deposit app call must reference exactly the configured USDC asset',
      { code: 'INVALID_FOREIGN_ASSETS' },
    );
  }

  const boxName = getBoxName(appCallTxn);
  const expectedBoxName = getV10PoolBoxName(normalizedTarget.poolKey);

  if (
    !boxName ||
    Buffer.compare(Buffer.from(boxName), Buffer.from(expectedBoxName)) !== 0
  ) {
    throw new V10DepositValidationError(
      'V10 deposit app call must reference the exact target pool box',
      { code: 'INVALID_POOL_BOX_REFERENCE' },
    );
  }

  const unsignedTransactionsBase64 = encodeUnsignedTransactions(transactions);

  return Object.freeze({
    transactions: Object.freeze([...transactions]),
    groupId,
    transactionCount: V10_DEPOSIT_TRANSACTION_COUNT,
    usdcTransferTransactionIndex: V10_USDC_TRANSFER_TRANSACTION_INDEX,
    appCallTransactionIndex: V10_APP_CALL_TRANSACTION_INDEX,
    transactionIds: Object.freeze({
      usdcTransfer: getTransactionId(
        usdcTransferTxn,
        'V10 deposit USDC transfer',
      ),
      appCall: getTransactionId(
        appCallTxn,
        'V10 deposit app call',
      ),
    }),
    target: Object.freeze({
      revenuePoolAppId: normalizedTarget.revenuePoolAppId,
      poolKey: normalizedTarget.poolKey,
      revenueTokenAssetId:
        target?.revenueTokenAssetId ?? null,
      usdcAssetId: normalizedTarget.usdcAssetId,
    }),
    amountUsdcAtomicUnits: amount,
    unsignedTransactionsBase64: Object.freeze(
      unsignedTransactionsBase64,
    ),
    unsignedTransactionHash: hashUnsignedTransactionPayloads(
      unsignedTransactionsBase64,
    ),
  });
}

export function rebuildV10DepositGroupFromUnsignedTransactions({
  unsignedTransactionsBase64,
  target,
  usdcAtomicUnits,
}) {
  if (
    !Array.isArray(unsignedTransactionsBase64) ||
    unsignedTransactionsBase64.length !== V10_DEPOSIT_TRANSACTION_COUNT
  ) {
    throw new V10DepositValidationError(
      `unsignedTransactionsBase64 must contain exactly ${V10_DEPOSIT_TRANSACTION_COUNT} transactions`,
      { code: 'INVALID_UNSIGNED_TRANSACTIONS' },
    );
  }

  const transactions = unsignedTransactionsBase64.map(
    (encodedTransaction, index) => {
      if (
        typeof encodedTransaction !== 'string' ||
        !encodedTransaction
      ) {
        throw new V10DepositValidationError(
          `unsignedTransactionsBase64[${index}] must be a non-empty base64 string`,
          { code: 'INVALID_UNSIGNED_TRANSACTIONS' },
        );
      }

      try {
        return algosdk.decodeUnsignedTransaction(
          new Uint8Array(Buffer.from(encodedTransaction, 'base64')),
        );
      } catch (cause) {
        throw new V10DepositValidationError(
          `Unable to decode unsigned V10 deposit transaction ${index}`,
          {
            code: 'INVALID_UNSIGNED_TRANSACTIONS',
            cause,
          },
        );
      }
    },
  );

  return getV10PreparedGroupMetadata({
    transactions,
    target,
    usdcAtomicUnits,
  });
}

export function rebuildV10DepositHeldGroupFromUnsignedTransactions({
  unsignedTransactionsBase64,
  target,
  usdcAtomicUnits,
}) {
  if (
    !Array.isArray(unsignedTransactionsBase64) ||
    unsignedTransactionsBase64.length !== V10_DEPOSIT_TRANSACTION_COUNT
  ) {
    throw new V10DepositValidationError(
      `unsignedTransactionsBase64 must contain exactly ${V10_DEPOSIT_TRANSACTION_COUNT} transactions`,
      { code: 'INVALID_UNSIGNED_TRANSACTIONS' },
    );
  }

  const transactions = unsignedTransactionsBase64.map(
    (encodedTransaction, index) => {
      if (
        typeof encodedTransaction !== 'string' ||
        !encodedTransaction
      ) {
        throw new V10DepositValidationError(
          `unsignedTransactionsBase64[${index}] must be a non-empty base64 string`,
          { code: 'INVALID_UNSIGNED_TRANSACTIONS' },
        );
      }

      try {
        return algosdk.decodeUnsignedTransaction(
          new Uint8Array(
            Buffer.from(encodedTransaction, 'base64'),
          ),
        );
      } catch (cause) {
        throw new V10DepositValidationError(
          `Unable to decode unsigned V10 held deposit transaction ${index}`,
          {
            code: 'INVALID_UNSIGNED_TRANSACTIONS',
            cause,
          },
        );
      }
    },
  );

  return getV10PreparedHeldDepositGroupMetadata({
    transactions,
    target,
    usdcAtomicUnits,
  });
}

export function getV10PreparedHeldDepositGroupMetadata({
  transactions,
  target,
  usdcAtomicUnits,
}) {
  const normalizedTarget = normalizeMetadataTarget({
    ...target,
    revenueTokenAssetId:
      target?.revenueTokenAssetId ?? 1,
  });
  const amount = assertSafeInteger(
    usdcAtomicUnits,
    'usdcAtomicUnits',
    { minimum: 1 },
  );
  const groupId = assertGroup(transactions);

  const usdcTransferTxn =
    transactions[V10_USDC_TRANSFER_TRANSACTION_INDEX];
  const appCallTxn =
    transactions[V10_APP_CALL_TRANSACTION_INDEX];

  if (usdcTransferTxn?.type !== 'axfer') {
    throw new V10DepositValidationError(
      'V10 held deposit transaction 0 must be a USDC asset transfer',
      { code: 'INVALID_TRANSACTION_ORDER' },
    );
  }

  if (appCallTxn?.type !== 'appl') {
    throw new V10DepositValidationError(
      'V10 held deposit transaction 1 must be an application call',
      { code: 'INVALID_TRANSACTION_ORDER' },
    );
  }

  if (getAction(appCallTxn) !== V10_DEPOSIT_HELD_ACTION) {
    throw new V10DepositValidationError(
      'V10 held deposit app call action must be "deposit_held"',
      { code: 'INVALID_APP_ACTION' },
    );
  }

  if (getPoolKeyArg(appCallTxn) !== normalizedTarget.poolKey) {
    throw new V10DepositValidationError(
      'V10 held deposit app call pool key does not match the expected pool key',
      { code: 'POOL_KEY_MISMATCH' },
    );
  }

  if (
    getUint64Arg(
      appCallTxn,
      2,
    ) !== BigInt(V10_USDC_TRANSFER_TRANSACTION_INDEX)
  ) {
    throw new V10DepositValidationError(
      'V10 held deposit app call companion transfer index must be 0',
      { code: 'INVALID_COMPANION_INDEX' },
    );
  }

  if (
    getTransferAssetId(usdcTransferTxn) !==
    BigInt(normalizedTarget.usdcAssetId)
  ) {
    throw new V10DepositValidationError(
      'V10 held deposit transfer asset does not match the configured USDC asset',
      { code: 'USDC_ASSET_MISMATCH' },
    );
  }

  if (getTransferAmount(usdcTransferTxn) !== BigInt(amount)) {
    throw new V10DepositValidationError(
      'V10 held deposit transfer amount does not match the frozen USDC amount',
      { code: 'USDC_AMOUNT_MISMATCH' },
    );
  }

  const expectedAppAddress = algosdk
    .getApplicationAddress(normalizedTarget.revenuePoolAppId)
    .toString();

  if (getTransferReceiver(usdcTransferTxn) !== expectedAppAddress) {
    throw new V10DepositValidationError(
      'V10 held deposit transfer receiver must be the revenue-pool application address',
      { code: 'INVALID_USDC_RECEIVER' },
    );
  }

  const foreignAssets = getForeignAssets(appCallTxn);

  if (
    !Array.isArray(foreignAssets) ||
    foreignAssets.length !== 1 ||
    BigInt(foreignAssets[0]) !== BigInt(normalizedTarget.usdcAssetId)
  ) {
    throw new V10DepositValidationError(
      'V10 held deposit app call must reference exactly the configured USDC asset',
      { code: 'INVALID_FOREIGN_ASSETS' },
    );
  }

  const boxName = getBoxName(appCallTxn);
  const expectedBoxName = getV10PoolBoxName(normalizedTarget.poolKey);

  if (
    !boxName ||
    Buffer.compare(Buffer.from(boxName), Buffer.from(expectedBoxName)) !== 0
  ) {
    throw new V10DepositValidationError(
      'V10 held deposit app call must reference the exact target pool box',
      { code: 'INVALID_POOL_BOX_REFERENCE' },
    );
  }

  const unsignedTransactionsBase64 =
    encodeUnsignedTransactions(transactions);

  return Object.freeze({
    transactions: Object.freeze([...transactions]),
    groupId,
    transactionCount: V10_DEPOSIT_TRANSACTION_COUNT,
    usdcTransferTransactionIndex:
      V10_USDC_TRANSFER_TRANSACTION_INDEX,
    appCallTransactionIndex:
      V10_APP_CALL_TRANSACTION_INDEX,
    transactionIds: Object.freeze({
      usdcTransfer: getTransactionId(
        usdcTransferTxn,
        'V10 held deposit USDC transfer',
      ),
      appCall: getTransactionId(
        appCallTxn,
        'V10 held deposit app call',
      ),
    }),
    target: Object.freeze({
      revenuePoolAppId: normalizedTarget.revenuePoolAppId,
      poolKey: normalizedTarget.poolKey,
      revenueTokenAssetId:
        target?.revenueTokenAssetId ?? null,
      usdcAssetId: normalizedTarget.usdcAssetId,
    }),
    amountUsdcAtomicUnits: amount,
    unsignedTransactionsBase64: Object.freeze(
      unsignedTransactionsBase64,
    ),
    unsignedTransactionHash: hashUnsignedTransactionPayloads(
      unsignedTransactionsBase64,
    ),
  });
}

export function buildV10DepositHeldUsdcGroup({
  revenuePoolAppId,
  usdcAssetId,
  depositorAddress,
  poolKey,
  usdcAtomicUnits,
  suggestedParams,
}) {
  const appId = assertSafeInteger(
    revenuePoolAppId,
    'revenuePoolAppId',
    { minimum: 1 },
  );
  const assetId = assertSafeInteger(usdcAssetId, 'usdcAssetId', {
    minimum: 1,
  });
  const sender = assertAlgorandAddress(
    depositorAddress,
    'depositorAddress',
  );
  const normalizedPoolKey = assertPoolKey(poolKey);
  const amount = assertSafeInteger(
    usdcAtomicUnits,
    'usdcAtomicUnits',
    { minimum: 1 },
  );
  const params = assertSuggestedParams(suggestedParams);
  const appAddress = algosdk.getApplicationAddress(appId).toString();

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
        new TextEncoder().encode(V10_DEPOSIT_HELD_ACTION),
        new TextEncoder().encode(normalizedPoolKey),
        algosdk.encodeUint64(
          BigInt(V10_USDC_TRANSFER_TRANSACTION_INDEX),
        ),
      ],
      foreignAssets: [assetId],
      boxes: [
        {
          appIndex: appId,
          name: getV10PoolBoxName(normalizedPoolKey),
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

  return getV10PreparedHeldDepositGroupMetadata({
    transactions,
    target: {
      revenuePoolAppId: appId,
      poolKey: normalizedPoolKey,
      revenueTokenAssetId: null,
      usdcAssetId: assetId,
    },
    usdcAtomicUnits: amount,
  });
}