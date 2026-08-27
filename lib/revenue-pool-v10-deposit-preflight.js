import algosdk from 'algosdk';
import {
  buildV10DepositHeldUsdcGroup,
  buildV10DepositUsdcGroup,
} from './revenue-pool-v10-deposit.js';

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const V10_DEPOSIT_OUTER_FEES_MICROALGOS = 3000;

function reason(code, message) {
  return { code, message };
}

function safeNumber(value) {
  return (
    typeof value === 'bigint' &&
    value >= 0n &&
    value <= MAX_SAFE_BIGINT
  )
    ? Number(value)
    : null;
}

function assertSafePositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(
      `${fieldName} must be a positive safe integer`,
    );
  }

  return value;
}

function assertPoolKey(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('poolKey must be a non-empty string');
  }

  const poolKey = value.trim();

  if (Buffer.byteLength(poolKey) > 50) {
    throw new TypeError('poolKey must not exceed 50 UTF-8 bytes');
  }

  return poolKey;
}

function assertAlgorandAddress(value, fieldName) {
  if (typeof value !== 'string' || !algosdk.isValidAddress(value)) {
    throw new TypeError(`${fieldName} must be a valid Algorand address`);
  }

  return value;
}

function assertSuggestedParams(value) {
  if (!value || typeof value !== 'object') {
    throw new TypeError('suggestedParams is required');
  }

  const requiredFields = [
    'fee',
    'firstValid',
    'lastValid',
    'genesisHash',
  ];

  for (const fieldName of requiredFields) {
    if (
      value[fieldName] === null ||
      value[fieldName] === undefined
    ) {
      throw new TypeError(
        `suggestedParams.${fieldName} is required`,
      );
    }
  }

  return value;
}

function getGroupId(transactions) {
  const group = transactions?.[0]?.group;

  return group ? Buffer.from(group).toString('base64') : null;
}

function isZeroAddressBytes(bytes) {
  return (
    bytes instanceof Uint8Array &&
    bytes.length === 32 &&
    bytes.every((value) => value === 0)
  );
}

function decodeAddressBytes(bytes, fieldName) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) {
    throw new TypeError(`${fieldName} must be exactly 32 bytes`);
  }

  return algosdk.encodeAddress(bytes);
}

function decodePoolBox({
  poolKey,
  boxValue,
}) {
  const bytes =
    boxValue instanceof Uint8Array
      ? new Uint8Array(boxValue)
      : typeof boxValue === 'string'
        ? new Uint8Array(Buffer.from(boxValue, 'base64'))
        : null;

  if (!bytes || bytes.length < 73) {
    throw new TypeError(
      'V10 pool box must contain at least the 73-byte pool header',
    );
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const revenueTokenAssetId = view.getBigUint64(0, false);
  const unallocatedUsdcAtomicUnits = view.getBigUint64(8, false);
  const heldUsdcAtomicUnits = view.getBigUint64(24, false);
  const currentRoundId = view.getBigUint64(32, false);
  const stakeholderCount = bytes[40];
  const proxyAddressBytes = bytes.slice(41, 73);

  if (revenueTokenAssetId < 1n) {
    throw new TypeError(
      'V10 pool box revenueTokenAssetId must be greater than zero',
    );
  }

  if (stakeholderCount < 1 || stakeholderCount > 100) {
    throw new TypeError(
      'V10 pool box stakeholderCount must be between 1 and 100',
    );
  }

  const expectedLength = 73 + stakeholderCount * 35;

  if (bytes.length !== expectedLength) {
    throw new TypeError(
      `V10 pool box length mismatch: expected ${expectedLength}, received ${bytes.length}`,
    );
  }

  return Object.freeze({
    poolKey,
    revenueTokenAssetId,
    unallocatedUsdcAtomicUnits,
    heldUsdcAtomicUnits,
    currentRoundId,
    stakeholderCount,
    proxyAddress: isZeroAddressBytes(proxyAddressBytes)
      ? null
      : decodeAddressBytes(proxyAddressBytes, 'pool proxy address'),
  });
}

function decodeStateBytes(value, fieldName) {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }

  if (typeof value === 'string') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }

  throw new TypeError(
    `${fieldName} must be Uint8Array, Buffer, or base64 bytes`,
  );
}

function getGlobalStateEntry(application, key) {
  const globalState =
    application?.params?.globalState ??
    application?.params?.['global-state'] ??
    application?.['params']?.['global-state'] ??
    application?.globalState ??
    [];

  if (!Array.isArray(globalState)) {
    throw new TypeError(
      'Application global state must be an array',
    );
  }

  return globalState.find((entry) => {
    const entryKey = entry?.key;

    if (typeof entryKey === 'string') {
      return (
        entryKey === key ||
        Buffer.from(entryKey, 'base64').toString('utf8') === key
      );
    }

    try {
      return Buffer.from(
        decodeStateBytes(entryKey, 'Application global state key'),
      ).toString('utf8') === key;
    } catch (_error) {
      return false;
    }
  }) ?? null;
}

function decodeAdminAddress(application) {
  const entry = getGlobalStateEntry(application, 'admin');

  if (!entry) {
    throw new TypeError(
      'V10 application global state is missing the admin key',
    );
  }

  const value =
    entry?.value?.bytes ??
    entry?.value?.['bytes'] ??
    entry?.bytes ??
    null;

  const adminPublicKey = decodeStateBytes(
    value,
    'V10 application admin value',
  );

  if (adminPublicKey.length !== 32) {
    throw new TypeError(
      `Invalid global admin value: expected 32 bytes, received ${adminPublicKey.length}`,
    );
  }

  return algosdk.encodeAddress(adminPublicKey);
}

function getAssetHolding(account, assetId) {
  const assets =
    account?.assets ??
    account?.['assets'] ??
    [];

  if (!Array.isArray(assets)) {
    throw new TypeError('Account assets must be an array');
  }

  const holding = assets.find((entry) => {
    const index =
      entry?.['asset-id'] ??
      entry?.assetId ??
      entry?.assetIndex ??
      entry?.asset?.['index'];

    return BigInt(index) === BigInt(assetId);
  });

  if (!holding) {
    return null;
  }

  const amount =
    holding?.amount ??
    holding?.['amount'] ??
    holding?.['asset-holding']?.amount ??
    null;

  if (
    typeof amount === 'number' &&
    Number.isSafeInteger(amount) &&
    amount >= 0
  ) {
    return BigInt(amount);
  }

  if (typeof amount === 'bigint' && amount >= 0n) {
    return amount;
  }

  if (typeof amount === 'string' && /^\d+$/.test(amount)) {
    return BigInt(amount);
  }

  throw new TypeError(
    `Asset holding amount for asset ${assetId} must be a non-negative integer`,
  );
}

function getAccountAlgoBalance(account) {
  const amount =
    account?.amount ??
    account?.['amount'] ??
    null;

  if (
    typeof amount === 'number' &&
    Number.isSafeInteger(amount) &&
    amount >= 0
  ) {
    return BigInt(amount);
  }

  if (typeof amount === 'bigint' && amount >= 0n) {
    return amount;
  }

  if (typeof amount === 'string' && /^\d+$/.test(amount)) {
    return BigInt(amount);
  }

  throw new TypeError(
    'Account ALGO balance must be a non-negative integer',
  );
}

function createFreshnessSnapshot({
  revenuePoolAppId,
  expectedRevenuePoolAppId,
  usdcAssetId,
  depositorAddress,
  poolKey,
  revenueTokenAssetId,
  amountUsdcAtomicUnits,
  appAdminAddress,
  proxyAddress,
  poolState,
  depositorUsdcBalance,
  depositorAlgoBalance,
}) {
  return Object.freeze({
    revenuePoolAppId,
    expectedRevenuePoolAppId,
    usdcAssetId,
    depositorAddress,
    poolKey,
    revenueTokenAssetId,
    amountUsdcAtomicUnits: amountUsdcAtomicUnits.toString(),
    appAdminAddress,
    proxyAddress,
    poolRevenueTokenAssetId:
      poolState.revenueTokenAssetId.toString(),
    poolUnallocatedUsdcAtomicUnits:
      poolState.unallocatedUsdcAtomicUnits.toString(),
    poolHeldUsdcAtomicUnits:
      poolState.heldUsdcAtomicUnits.toString(),
    poolCurrentRoundId:
      poolState.currentRoundId.toString(),
    poolStakeholderCount: poolState.stakeholderCount,
    depositorUsdcBalance:
      depositorUsdcBalance.toString(),
    depositorAlgoBalance:
      depositorAlgoBalance.toString(),
    requiredOuterFeesMicroAlgos:
      V10_DEPOSIT_OUTER_FEES_MICROALGOS,
  });
}

/**
 * Pure V10 deposit preflight.
 *
 * All chain-derived values must already have been read by a separate
 * read-only orchestration layer. This function does not make network calls,
 * write MongoDB, sign, or submit transactions.
 */
export function preflightV10DepositUsdc({
  revenuePoolAppId,
  expectedRevenuePoolAppId,
  usdcAssetId,
  depositorAddress,
  poolKey,
  revenueTokenAssetId,
  amountUsdcAtomicUnits,
  suggestedParams,
  application,
  poolBoxValue,
  appAccount,
  depositorAccount,
  buildUnsignedGroup = true,
  depositType = 'held',
}) {
  if (depositType !== 'held' && depositType !== 'usdc') {
    throw new TypeError('depositType must be "held" or "usdc"');
  }
  const reasons = [];

  let appId = null;
  let expectedAppId = null;
  let assetId = null;
  let targetRevenueTokenAssetId = null;
  let targetPoolKey = null;
  let amount = null;
  let sender = null;
  let params = null;
  let poolState = null;
  let appAdminAddress = null;
  let depositorUsdcBalance = null;
  let depositorAlgoBalance = null;

  try {
    appId = assertSafePositiveInteger(
      revenuePoolAppId,
      'revenuePoolAppId',
    );
  } catch (error) {
    reasons.push(reason('INVALID_APP_ID', error.message));
  }

  try {
    expectedAppId = assertSafePositiveInteger(
      expectedRevenuePoolAppId,
      'expectedRevenuePoolAppId',
    );
  } catch (error) {
    reasons.push(reason('INVALID_EXPECTED_APP_ID', error.message));
  }

  try {
    assetId = assertSafePositiveInteger(
      usdcAssetId,
      'usdcAssetId',
    );
  } catch (error) {
    reasons.push(reason('INVALID_USDC_ASSET_ID', error.message));
  }

  try {
    targetRevenueTokenAssetId = assertSafePositiveInteger(
      revenueTokenAssetId,
      'revenueTokenAssetId',
    );
  } catch (error) {
    reasons.push(
      reason('INVALID_REVENUE_TOKEN_ASSET_ID', error.message),
    );
  }

  try {
    targetPoolKey = assertPoolKey(poolKey);
  } catch (error) {
    reasons.push(reason('INVALID_POOL_KEY', error.message));
  }

  try {
    amount = assertSafePositiveInteger(
      amountUsdcAtomicUnits,
      'amountUsdcAtomicUnits',
    );
  } catch (error) {
    reasons.push(reason('INVALID_DEPOSIT_AMOUNT', error.message));
  }

  try {
    sender = assertAlgorandAddress(
      depositorAddress,
      'depositorAddress',
    );
  } catch (error) {
    reasons.push(reason('INVALID_DEPOSITOR_ADDRESS', error.message));
  }

  try {
    params = assertSuggestedParams(suggestedParams);
  } catch (error) {
    reasons.push(reason('INVALID_SUGGESTED_PARAMS', error.message));
  }

  if (
    appId !== null &&
    expectedAppId !== null &&
    appId !== expectedAppId
  ) {
    reasons.push(
      reason(
        'APP_ID_MISMATCH',
        'The supplied V10 revenue-pool application ID does not match the expected application ID.',
      ),
    );
  }

  if (targetPoolKey !== null) {
    try {
      poolState = decodePoolBox({
        poolKey: targetPoolKey,
        boxValue: poolBoxValue,
      });
    } catch (error) {
      reasons.push(reason('POOL_BOX_INVALID', error.message));
    }
  }

  try {
    appAdminAddress = decodeAdminAddress(application);
  } catch (error) {
    reasons.push(reason('APP_ADMIN_INVALID', error.message));
  }

  if (
    poolState &&
    targetRevenueTokenAssetId !== null &&
    poolState.revenueTokenAssetId !==
      BigInt(targetRevenueTokenAssetId)
  ) {
    reasons.push(
      reason(
        'REVENUE_TOKEN_ASSET_MISMATCH',
        'The V10 pool box REV ASA does not match the frozen settlement batch target.',
      ),
    );
  }

  if (sender && appAdminAddress && poolState) {
    const isAuthorized =
      depositType === 'usdc'
        ? sender === appAdminAddress || sender === poolState.proxyAddress
        : sender === appAdminAddress;

    if (!isAuthorized) {
      reasons.push(
        reason(
          'UNAUTHORIZED_DEPOSITOR',
          depositType === 'usdc'
            ? 'The configured depositor is neither the current V10 application admin nor the exact pool proxy.'
            : 'deposit_held requires the depositor to be the current V10 application admin.',
        ),
      );
    }
  }

  const appUsdcBalance =
    assetId === null
      ? null
      : getAssetHolding(appAccount, assetId);

  if (appUsdcBalance === null) {
    reasons.push(
      reason(
        'APP_USDC_NOT_OPTED_IN',
        'The V10 application account is not opted into the configured USDC asset.',
      ),
    );
  }

  if (assetId !== null) {
    try {
      depositorUsdcBalance = getAssetHolding(
        depositorAccount,
        assetId,
      );
    } catch (error) {
      reasons.push(
        reason('DEPOSITOR_USDC_HOLDING_INVALID', error.message),
      );
    }
  }

  if (depositorUsdcBalance === null && assetId !== null) {
    reasons.push(
      reason(
        'DEPOSITOR_USDC_NOT_OPTED_IN',
        'The configured depositor is not opted into the configured USDC asset.',
      ),
    );
  }

  if (
    depositorUsdcBalance !== null &&
    amount !== null &&
    depositorUsdcBalance < BigInt(amount)
  ) {
    reasons.push(
      reason(
        'INSUFFICIENT_USDC',
        `Depositor USDC balance is short by ${
          BigInt(amount) - depositorUsdcBalance
        } atomic units.`,
      ),
    );
  }

  try {
    depositorAlgoBalance = getAccountAlgoBalance(depositorAccount);
  } catch (error) {
    reasons.push(
      reason('DEPOSITOR_ALGO_BALANCE_INVALID', error.message),
    );
  }

  if (
    depositorAlgoBalance !== null &&
    depositorAlgoBalance <
      BigInt(V10_DEPOSIT_OUTER_FEES_MICROALGOS)
  ) {
    reasons.push(
      reason(
        'INSUFFICIENT_ALGO',
        `Depositor ALGO balance is short by ${
          BigInt(V10_DEPOSIT_OUTER_FEES_MICROALGOS) -
          depositorAlgoBalance
        } microALGOs for outer transaction fees.`,
      ),
    );
  }

  const safeAppUsdcBalance = safeNumber(appUsdcBalance);
  const safeDepositorUsdcBalance = safeNumber(depositorUsdcBalance);
  const safeDepositorAlgoBalance = safeNumber(depositorAlgoBalance);

  if (
    appUsdcBalance !== null &&
    safeAppUsdcBalance === null
  ) {
    reasons.push(
      reason(
        'UNSAFE_APP_USDC_BALANCE',
        'V10 application USDC balance exceeds supported safe-integer range.',
      ),
    );
  }

  if (
    depositorUsdcBalance !== null &&
    safeDepositorUsdcBalance === null
  ) {
    reasons.push(
      reason(
        'UNSAFE_DEPOSITOR_USDC_BALANCE',
        'Depositor USDC balance exceeds supported safe-integer range.',
      ),
    );
  }

  if (
    depositorAlgoBalance !== null &&
    safeDepositorAlgoBalance === null
  ) {
    reasons.push(
      reason(
        'UNSAFE_DEPOSITOR_ALGO_BALANCE',
        'Depositor ALGO balance exceeds supported safe-integer range.',
      ),
    );
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      reasons,
      appUsdcBalanceAtomicUnits: safeAppUsdcBalance,
      depositorUsdcBalanceAtomicUnits:
        safeDepositorUsdcBalance,
      depositorAlgoBalanceMicroAlgos:
        safeDepositorAlgoBalance,
      requiredOuterFeesMicroAlgos:
        V10_DEPOSIT_OUTER_FEES_MICROALGOS,
      freshnessSnapshot: null,
      proposedGroup: null,
      unsignedGroup: null,
    };
  }

  const freshnessSnapshot = createFreshnessSnapshot({
    revenuePoolAppId: appId,
    expectedRevenuePoolAppId: expectedAppId,
    usdcAssetId: assetId,
    depositorAddress: sender,
    poolKey: targetPoolKey,
    revenueTokenAssetId: targetRevenueTokenAssetId,
    amountUsdcAtomicUnits: BigInt(amount),
    appAdminAddress,
    proxyAddress: poolState.proxyAddress,
    poolState,
    depositorUsdcBalance,
    depositorAlgoBalance,
  });

  if (buildUnsignedGroup !== true) {
    return {
      ok: true,
      reasons: [],
      appUsdcBalanceAtomicUnits: safeAppUsdcBalance,
      depositorUsdcBalanceAtomicUnits:
        safeDepositorUsdcBalance,
      depositorAlgoBalanceMicroAlgos:
        safeDepositorAlgoBalance,
      requiredOuterFeesMicroAlgos:
        V10_DEPOSIT_OUTER_FEES_MICROALGOS,
      freshnessSnapshot,
      proposedGroup: null,
      unsignedGroup: null,
    };
  }

  try {
    const unsignedGroup =
      depositType === 'usdc'
        ? buildV10DepositUsdcGroup({
            revenuePoolAppId: appId,
            usdcAssetId: assetId,
            depositorAddress: sender,
            poolKey: targetPoolKey,
            usdcAtomicUnits: amount,
            suggestedParams: params,
          })
        : buildV10DepositHeldUsdcGroup({
            revenuePoolAppId: appId,
            usdcAssetId: assetId,
            depositorAddress: sender,
            poolKey: targetPoolKey,
            usdcAtomicUnits: amount,
            suggestedParams: params,
          });

    return {
      ok: true,
      reasons: [],
      appUsdcBalanceAtomicUnits: safeAppUsdcBalance,
      depositorUsdcBalanceAtomicUnits:
        safeDepositorUsdcBalance,
      depositorAlgoBalanceMicroAlgos:
        safeDepositorAlgoBalance,
      requiredOuterFeesMicroAlgos:
        V10_DEPOSIT_OUTER_FEES_MICROALGOS,
      freshnessSnapshot,
      proposedGroup: {
        groupId: getGroupId(unsignedGroup.transactions),
        transactionCount: unsignedGroup.transactionCount,
        usdcTransferTransactionIndex:
          unsignedGroup.usdcTransferTransactionIndex,
        appCallTransactionIndex:
          unsignedGroup.appCallTransactionIndex,
        action: depositType === 'usdc' ? 'deposit_usdc' : 'deposit_held',
        transactionIds: unsignedGroup.transactionIds,
        unsignedTransactionHash:
          unsignedGroup.unsignedTransactionHash,
      },
      unsignedGroup,
    };
  } catch (error) {
    return {
      ok: false,
      reasons: [
        reason('GROUP_BUILD_FAILED', error.message),
      ],
      appUsdcBalanceAtomicUnits: safeAppUsdcBalance,
      depositorUsdcBalanceAtomicUnits:
        safeDepositorUsdcBalance,
      depositorAlgoBalanceMicroAlgos:
        safeDepositorAlgoBalance,
      requiredOuterFeesMicroAlgos:
        V10_DEPOSIT_OUTER_FEES_MICROALGOS,
      freshnessSnapshot,
      proposedGroup: null,
      unsignedGroup: null,
    };
  }
}