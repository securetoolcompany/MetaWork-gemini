import algosdk from 'algosdk';

import {
  preflightV10ReleaseHeld,
} from './revenue-pool-v10-release-held-preflight.js';

export class V10ReleaseLivePreflightError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'V10ReleaseLivePreflightError';
    this.code = code || 'V10_RELEASE_LIVE_PREFLIGHT_ERROR';
  }
}

function assertBatch(value) {
  if (!value || typeof value !== 'object') {
    throw new V10ReleaseLivePreflightError(
      'batch is required',
      { code: 'INVALID_BATCH' },
    );
  }

  if (
    !Number.isSafeInteger(value.revenuePoolAppId) ||
    value.revenuePoolAppId < 1
  ) {
    throw new V10ReleaseLivePreflightError(
      'batch.revenuePoolAppId must be a positive safe integer',
      { code: 'INVALID_BATCH' },
    );
  }

  if (typeof value.poolKey !== 'string' || !value.poolKey.trim()) {
    throw new V10ReleaseLivePreflightError(
      'batch.poolKey must be a non-empty string',
      { code: 'INVALID_BATCH' },
    );
  }

  return {
    status: value.status ?? null,
    revenuePoolAppId: value.revenuePoolAppId,
    poolKey: value.poolKey.trim(),
    };
}

function assertAlgodClient(value) {
  if (
    !value ||
    typeof value.getApplicationByID !== 'function' ||
    typeof value.getApplicationBoxByName !== 'function' ||
    typeof value.accountInformation !== 'function'
  ) {
    throw new V10ReleaseLivePreflightError(
      'algodClient must provide application, box, and account readers',
      { code: 'INVALID_ALGOD_CLIENT' },
    );
  }

  return value;
}

function getExpectedAppId({
  expectedRevenuePoolAppId,
  environment,
}) {
  const candidate =
    expectedRevenuePoolAppId ??
    Number(environment?.NEXT_PUBLIC_REVENUE_POOL_APP_ID);

  if (
    !Number.isSafeInteger(candidate) ||
    candidate < 1
  ) {
    throw new V10ReleaseLivePreflightError(
      'Expected V10 revenue-pool app ID must be configured',
      { code: 'MISSING_EXPECTED_APP_ID' },
    );
  }

  return candidate;
}

function assertAlgorandAddress(value, fieldName) {
  if (typeof value !== 'string' || !algosdk.isValidAddress(value)) {
    throw new V10ReleaseLivePreflightError(
      `${fieldName} must be a valid Algorand address`,
      { code: 'INVALID_ADDRESS' },
    );
  }

  return value;
}

function getSignerAddress({
  adminAddress,
  signer,
}) {
  if (adminAddress) {
    return assertAlgorandAddress(adminAddress, 'adminAddress');
  }

  const candidate =
    signer?.address ??
    signer?.addr ??
    signer?.account?.addr ??
    null;

  return assertAlgorandAddress(candidate, 'signer address');
}

function getPoolBoxName(poolKey) {
  return new Uint8Array(Buffer.from(`p_${poolKey}`, 'utf8'));
}

function decodePoolBox(poolKey, value) {
  const bytes =
    value instanceof Uint8Array
      ? new Uint8Array(value)
      : typeof value === 'string'
        ? new Uint8Array(Buffer.from(value, 'base64'))
        : null;

  if (!bytes || bytes.length < 73) {
    throw new V10ReleaseLivePreflightError(
      'V10 pool box is malformed',
      { code: 'POOL_BOX_INVALID' },
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const stakeholderCount = bytes[40];
  const expectedLength = 73 + stakeholderCount * 35;

  if (
    stakeholderCount < 1 ||
    stakeholderCount > 100 ||
    bytes.length !== expectedLength
  ) {
    throw new V10ReleaseLivePreflightError(
      'V10 pool box has an invalid stakeholder layout',
      { code: 'POOL_BOX_INVALID' },
    );
  }

  return Object.freeze({
    poolKey,
    heldUsdcAtomicUnits: view.getBigUint64(24, false),
    currentRoundId: view.getBigUint64(32, false),
    stakeholderCount,
  });
}

function getAccountBalance(account) {
  const amount =
    account?.amount ??
    account?.['amount'] ??
    null;

  if (typeof amount === 'bigint' && amount >= 0n) {
    return amount;
  }

  if (
    typeof amount === 'number' &&
    Number.isSafeInteger(amount) &&
    amount >= 0
  ) {
    return BigInt(amount);
  }

  throw new V10ReleaseLivePreflightError(
    'Admin account ALGO balance is invalid',
    { code: 'INVALID_ADMIN_BALANCE' },
  );
}

async function runRead(label, fn) {
  try {
    return await fn();
  } catch (cause) {
    throw new V10ReleaseLivePreflightError(
      `Unable to read ${label}`,
      {
        code: 'ALGOD_READ_FAILED',
        cause,
      },
    );
  }
}

export async function preflightLiveV10ReleaseHeld({
  batch,
  network = 'testnet',
  expectedRevenuePoolAppId,
  adminAddress,
  algodClient = null,
  signer = null,
  environment = process.env,
  getAlgodClientFn,
  getSignerFn,
  getTransactionParamsFn,
}) {
  const normalizedBatch = assertBatch(batch);

  if (
    normalizedBatch.status &&
    normalizedBatch.status !== 'deposited'
  ) {
    throw new V10ReleaseLivePreflightError(
      `batch.status must be "deposited"; received "${normalizedBatch.status}"`,
      { code: 'INVALID_BATCH_STATUS' },
    );
  }

  const expectedAppId = getExpectedAppId({
    expectedRevenuePoolAppId,
    environment,
  });

  const resolvedSigner =
    signer ||
    (adminAddress
      ? null
      : typeof getSignerFn === 'function'
        ? getSignerFn()
        : null);

  const resolvedAdminAddress = getSignerAddress({
    adminAddress,
    signer: resolvedSigner,
  });

  const resolvedAlgodClient = assertAlgodClient(
    algodClient ||
      (
        typeof getAlgodClientFn === 'function'
          ? getAlgodClientFn(network)
          : null
      ),
  );

  if (typeof getTransactionParamsFn !== 'function') {
    throw new V10ReleaseLivePreflightError(
      'getTransactionParamsFn is required',
      { code: 'INVALID_DEPENDENCY' },
    );
  }

  const appAddress = algosdk
    .getApplicationAddress(normalizedBatch.revenuePoolAppId)
    .toString();

  const poolBoxName = getPoolBoxName(normalizedBatch.poolKey);

  const [
    application,
    poolBoxResponse,
    adminAccount,
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
      `V10 admin account ${resolvedAdminAddress}`,
      () =>
        resolvedAlgodClient
          .accountInformation(resolvedAdminAddress)
          .do(),
    ),
    runRead(
      'Algod suggested transaction parameters',
      () => getTransactionParamsFn(),
    ),
  ]);

  // Read application intentionally verifies it remains accessible at the
  // configured app ID. Admin authorization is enforced on-chain.
  void application;

  const poolState = decodePoolBox(
    normalizedBatch.poolKey,
    poolBoxResponse?.value,
  );

  const result = preflightV10ReleaseHeld({
    revenuePoolAppId: normalizedBatch.revenuePoolAppId,
    expectedRevenuePoolAppId: expectedAppId,
    adminAddress: resolvedAdminAddress,
    poolKey: normalizedBatch.poolKey,
    suggestedParams,
    poolState,
    adminAccountBalanceMicroAlgos:
      getAccountBalance(adminAccount),
  });

  return Object.freeze({
    ...result,
    liveReadMetadata: Object.freeze({
      network,
      revenuePoolAppId: normalizedBatch.revenuePoolAppId,
      poolKey: normalizedBatch.poolKey,
      appAddress,
      adminAddress: resolvedAdminAddress,
      expectedRevenuePoolAppId: expectedAppId,
    }),
  });
}