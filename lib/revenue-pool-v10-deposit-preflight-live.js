import algosdk from 'algosdk';

import {
  getAlgodClient,
  getSigner,
  getTransactionParams,
  getUsdcAssetId,
} from './algorand.js';

import {
  preflightV10DepositUsdc,
} from './revenue-pool-v10-deposit-preflight.js';

const EXPECTED_V10_APP_ID_ENV = 'NEXT_PUBLIC_REVENUE_POOL_APP_ID';

export class V10DepositLivePreflightError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'V10DepositLivePreflightError';
    this.code = code || 'V10_DEPOSIT_LIVE_PREFLIGHT_ERROR';
  }
}

function assertPositiveSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new V10DepositLivePreflightError(
      `${fieldName} must be a positive safe integer`,
      { code: 'INVALID_INTEGER' },
    );
  }

  return value;
}

function assertPoolKey(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new V10DepositLivePreflightError(
      'poolKey must be a non-empty string',
      { code: 'INVALID_POOL_KEY' },
    );
  }

  const poolKey = value.trim();

  if (Buffer.byteLength(poolKey) > 50) {
    throw new V10DepositLivePreflightError(
      'poolKey must not exceed 50 UTF-8 bytes',
      { code: 'INVALID_POOL_KEY' },
    );
  }

  return poolKey;
}

function assertAlgorandAddress(value, fieldName) {
  if (typeof value !== 'string' || !algosdk.isValidAddress(value)) {
    throw new V10DepositLivePreflightError(
      `${fieldName} must be a valid Algorand address`,
      { code: 'INVALID_ADDRESS' },
    );
  }

  return value;
}

function assertBatch(batch) {
  if (!batch || typeof batch !== 'object') {
    throw new V10DepositLivePreflightError(
      'batch must be an object',
      { code: 'INVALID_BATCH' },
    );
  }

  return {
    _id: batch._id,
    status: String(batch.status || ''),
    revenuePoolAppId: assertPositiveSafeInteger(
      batch.revenuePoolAppId,
      'batch.revenuePoolAppId',
    ),
    poolKey: assertPoolKey(batch.poolKey),
    revenueTokenAssetId: assertPositiveSafeInteger(
      batch.revenueTokenAssetId,
      'batch.revenueTokenAssetId',
    ),
    totalAllocationCents: assertPositiveSafeInteger(
      batch.totalAllocationCents,
      'batch.totalAllocationCents',
    ),
    totalUsdcAtomicUnits: assertPositiveSafeInteger(
      batch.totalUsdcAtomicUnits,
      'batch.totalUsdcAtomicUnits',
    ),
  };
}

function assertBatchMoney(batch) {
  if (
    batch.totalUsdcAtomicUnits !==
    batch.totalAllocationCents * 10_000
  ) {
    throw new V10DepositLivePreflightError(
      'batch.totalUsdcAtomicUnits must equal batch.totalAllocationCents × 10,000',
      { code: 'BATCH_TOTAL_MISMATCH' },
    );
  }
}

function getExpectedAppId({
  expectedRevenuePoolAppId,
  environment = process.env,
}) {
  if (
    expectedRevenuePoolAppId !== undefined &&
    expectedRevenuePoolAppId !== null
  ) {
    return assertPositiveSafeInteger(
      expectedRevenuePoolAppId,
      'expectedRevenuePoolAppId',
    );
  }

  const rawValue = environment?.[EXPECTED_V10_APP_ID_ENV];

  if (typeof rawValue !== 'string' || !/^\d+$/.test(rawValue.trim())) {
    throw new V10DepositLivePreflightError(
      `${EXPECTED_V10_APP_ID_ENV} must be configured as a positive integer`,
      { code: 'MISSING_EXPECTED_APP_ID' },
    );
  }

  return assertPositiveSafeInteger(
    Number(rawValue),
    EXPECTED_V10_APP_ID_ENV,
  );
}

function getConfiguredUsdcAssetId({
  usdcAssetId,
  network,
  getUsdcAssetIdFn,
}) {
  const value =
    usdcAssetId !== undefined && usdcAssetId !== null
      ? usdcAssetId
      : getUsdcAssetIdFn(network);

  return assertPositiveSafeInteger(value, 'usdcAssetId');
}

function getSignerAddress({ depositorAddress, signer }) {
  if (
    depositorAddress !== undefined &&
    depositorAddress !== null
  ) {
    return assertAlgorandAddress(
      depositorAddress,
      'depositorAddress',
    );
  }

  if (!signer || typeof signer !== 'object') {
    throw new V10DepositLivePreflightError(
      'signer is required when depositorAddress is not provided',
      { code: 'INVALID_SIGNER' },
    );
  }

  return assertAlgorandAddress(signer.address, 'signer.address');
}

function getPoolBoxName(poolKey) {
  return new Uint8Array(Buffer.from(`p_${poolKey}`));
}

function assertAlgodClient(algodClient) {
  const requiredMethods = [
    'getApplicationByID',
    'getApplicationBoxByName',
    'accountInformation',
  ];

  for (const methodName of requiredMethods) {
    if (typeof algodClient?.[methodName] !== 'function') {
      throw new V10DepositLivePreflightError(
        `algodClient must provide ${methodName}()`,
        { code: 'INVALID_ALGOD_CLIENT' },
      );
    }
  }
}

async function runRead(label, readFn) {
  try {
    return await readFn();
  } catch (cause) {
    throw new V10DepositLivePreflightError(
      `Unable to read ${label} during V10 deposit preflight`,
      {
        code: 'ALGOD_READ_FAILED',
        cause,
      },
    );
  }
}

/**
 * Read-only orchestration for the pure V10 deposit preflight.
 *
 * This function:
 * - reads Algod state;
 * - builds an unsigned proposal only;
 * - does not connect to MongoDB;
 * - does not invoke signer.signTxn/signTxns;
 * - does not sign, submit, or poll a transaction.
 */
export async function preflightLiveV10Deposit({
  batch,
  network = 'testnet',
  expectedRevenuePoolAppId,
  usdcAssetId,
  depositorAddress,
  algodClient = null,
  signer = null,
  environment = process.env,
  getAlgodClientFn = getAlgodClient,
  getSignerFn = getSigner,
  getUsdcAssetIdFn = getUsdcAssetId,
  getTransactionParamsFn = getTransactionParams,
}) {
  const normalizedBatch = assertBatch(batch);
  assertBatchMoney(normalizedBatch);

  if (normalizedBatch.status !== 'recipient_snapshot_prepared') {
    throw new V10DepositLivePreflightError(
      `batch.status must be "recipient_snapshot_prepared"; received "${normalizedBatch.status}"`,
      { code: 'INVALID_BATCH_STATUS' },
    );
  }

  const expectedAppId = getExpectedAppId({
    expectedRevenuePoolAppId,
    environment,
  });

  const configuredUsdcAssetId = getConfiguredUsdcAssetId({
    usdcAssetId,
    network,
    getUsdcAssetIdFn,
  });

  const resolvedSigner =
    signer ||
    (depositorAddress ? null : getSignerFn());

  const resolvedDepositorAddress = getSignerAddress({
    depositorAddress,
    signer: resolvedSigner,
  });

  const resolvedAlgodClient =
    algodClient || getAlgodClientFn(network);

  assertAlgodClient(resolvedAlgodClient);

  const appAddress = algosdk
    .getApplicationAddress(normalizedBatch.revenuePoolAppId)
    .toString();
  const poolBoxName = getPoolBoxName(normalizedBatch.poolKey);

  const [
    application,
    poolBoxResponse,
    appAccount,
    depositorAccount,
    suggestedParams,
  ] = await Promise.all([
    runRead(
      `V10 application ${normalizedBatch.revenuePoolAppId}`,
      () =>
        resolvedAlgodClient
          .getApplicationByID(normalizedBatch.revenuePoolAppId)
          .do(),
    ),
    runRead(
      `V10 pool box for ${normalizedBatch.poolKey}`,
      () =>
        resolvedAlgodClient
          .getApplicationBoxByName(
            normalizedBatch.revenuePoolAppId,
            poolBoxName,
          )
          .do(),
    ),
    runRead(
      `V10 application account ${appAddress}`,
      () =>
        resolvedAlgodClient
          .accountInformation(appAddress)
          .do(),
    ),
    runRead(
      `V10 depositor account ${resolvedDepositorAddress}`,
      () =>
        resolvedAlgodClient
          .accountInformation(resolvedDepositorAddress)
          .do(),
    ),
    runRead(
      'Algod suggested transaction parameters',
      () => getTransactionParamsFn(),
    ),
  ]);

  const result = preflightV10DepositUsdc({
    revenuePoolAppId: normalizedBatch.revenuePoolAppId,
    expectedRevenuePoolAppId: expectedAppId,
    usdcAssetId: configuredUsdcAssetId,
    depositorAddress: resolvedDepositorAddress,
    poolKey: normalizedBatch.poolKey,
    revenueTokenAssetId: normalizedBatch.revenueTokenAssetId,
    amountUsdcAtomicUnits: normalizedBatch.totalUsdcAtomicUnits,
    suggestedParams,
    application,
    poolBoxValue: poolBoxResponse?.value,
    appAccount,
    depositorAccount,
  });

  return Object.freeze({
    ...result,
    liveReadMetadata: Object.freeze({
      network,
      revenuePoolAppId: normalizedBatch.revenuePoolAppId,
      poolKey: normalizedBatch.poolKey,
      appAddress,
      depositorAddress: resolvedDepositorAddress,
      usdcAssetId: configuredUsdcAssetId,
      expectedRevenuePoolAppId: expectedAppId,
    }),
  });
}