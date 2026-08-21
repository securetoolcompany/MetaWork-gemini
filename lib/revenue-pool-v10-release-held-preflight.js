import {
  buildV10ReleaseHeldGroup,
  calculateV10ReleaseRoundMbrMicroAlgos,
} from './revenue-pool-v10-release-held.js';

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const V10_RELEASE_OUTER_FEES_MICROALGOS = 3000;

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

function createFreshnessSnapshot({
  revenuePoolAppId,
  expectedRevenuePoolAppId,
  adminAddress,
  poolKey,
  poolState,
  requiredMbrMicroAlgos,
  requiredFeesMicroAlgos,
  requiredTotalMicroAlgos,
}) {
  return Object.freeze({
    revenuePoolAppId,
    expectedRevenuePoolAppId,
    adminAddress,
    poolKey,
    heldUsdcAtomicUnits:
      poolState.heldUsdcAtomicUnits.toString(),
    currentRoundId:
      poolState.currentRoundId.toString(),
    stakeholderCount: poolState.stakeholderCount,
    requiredMbrMicroAlgos,
    requiredFeesMicroAlgos,
    requiredTotalMicroAlgos,
  });
}

export function preflightV10ReleaseHeld({
  revenuePoolAppId,
  expectedRevenuePoolAppId,
  adminAddress,
  poolKey,
  suggestedParams,
  poolState,
  adminAccountBalanceMicroAlgos,
  buildUnsignedGroup = true,
}) {
  const reasons = [];

  const balance = safeNumber(adminAccountBalanceMicroAlgos);
  const currentRoundId = safeNumber(poolState?.currentRoundId);
  const stakeholderCount = poolState?.stakeholderCount;

  if (revenuePoolAppId !== expectedRevenuePoolAppId) {
    reasons.push(
      reason(
        'APP_ID_MISMATCH',
        'The supplied V10 revenue-pool application ID does not match the expected application ID.',
      ),
    );
  }

  if (!poolState || poolState.heldUsdcAtomicUnits <= 0n) {
    reasons.push(
      reason(
        'NO_HELD_FUNDS',
        'No held USDC is available for release.',
      ),
    );
  }

  if (currentRoundId === null) {
    reasons.push(
      reason(
        'UNSAFE_ROUND_ID',
        'The current V10 round ID cannot be represented safely by the release builder.',
      ),
    );
  }

  if (
    !Number.isSafeInteger(stakeholderCount) ||
    stakeholderCount < 1 ||
    stakeholderCount > 100
  ) {
    reasons.push(
      reason(
        'INVALID_STAKEHOLDER_COUNT',
        'V10 pool stakeholder count must be a safe integer between 1 and 100.',
      ),
    );
  }

  if (!suggestedParams || typeof suggestedParams !== 'object') {
    reasons.push(
      reason(
        'INVALID_SUGGESTED_PARAMS',
        'Suggested transaction params are required.',
      ),
    );
  }

  if (balance === null) {
    reasons.push(
      reason(
        'INVALID_ADMIN_BALANCE',
        'Admin account balance must be a non-negative integer microALGO value.',
      ),
    );
  }

  let requiredMbrMicroAlgos = null;
  const requiredFeesMicroAlgos =
    V10_RELEASE_OUTER_FEES_MICROALGOS;
  let requiredTotalMicroAlgos = null;

  if (
    Number.isSafeInteger(stakeholderCount) &&
    stakeholderCount >= 1 &&
    stakeholderCount <= 100
  ) {
    try {
      requiredMbrMicroAlgos =
        calculateV10ReleaseRoundMbrMicroAlgos({
          poolKey,
          stakeholderCount,
        });

      requiredTotalMicroAlgos =
        requiredMbrMicroAlgos +
        requiredFeesMicroAlgos;
    } catch (error) {
      reasons.push(reason('INVALID_POOL_INPUT', error.message));
    }
  }

  if (
    balance !== null &&
    requiredTotalMicroAlgos !== null &&
    balance < requiredTotalMicroAlgos
  ) {
    reasons.push(
      reason(
        'INSUFFICIENT_ALGO',
        `Admin balance is short by ${
          requiredTotalMicroAlgos - balance
        } microALGOs.`,
      ),
    );
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      reasons,
      requiredMbrMicroAlgos,
      requiredFeesMicroAlgos,
      requiredTotalMicroAlgos,
      adminAccountBalanceMicroAlgos: balance,
      freshnessSnapshot: null,
      proposedGroup: null,
      unsignedGroup: null,
    };
  }

  const freshnessSnapshot = createFreshnessSnapshot({
    revenuePoolAppId,
    expectedRevenuePoolAppId,
    adminAddress,
    poolKey,
    poolState,
    requiredMbrMicroAlgos,
    requiredFeesMicroAlgos,
    requiredTotalMicroAlgos,
  });

  if (buildUnsignedGroup !== true) {
    return {
      ok: true,
      reasons: [],
      currentRoundId,
      nextRoundId: currentRoundId + 1,
      stakeholderCount,
      heldUsdcAtomicUnits: poolState.heldUsdcAtomicUnits,
      requiredMbrMicroAlgos,
      requiredFeesMicroAlgos,
      requiredTotalMicroAlgos,
      adminAccountBalanceMicroAlgos: balance,
      remainingBalanceMicroAlgos:
        balance - requiredTotalMicroAlgos,
      freshnessSnapshot,
      proposedGroup: null,
      unsignedGroup: null,
    };
  }

  try {
    const unsignedGroup = buildV10ReleaseHeldGroup({
      revenuePoolAppId,
      adminAddress,
      poolKey,
      currentRoundId,
      stakeholderCount,
      suggestedParams,
    });

    return {
      ok: true,
      reasons: [],
      currentRoundId,
      nextRoundId: unsignedGroup.nextRoundId,
      stakeholderCount,
      heldUsdcAtomicUnits: poolState.heldUsdcAtomicUnits,
      requiredMbrMicroAlgos,
      requiredFeesMicroAlgos,
      requiredTotalMicroAlgos,
      adminAccountBalanceMicroAlgos: balance,
      remainingBalanceMicroAlgos:
        balance - requiredTotalMicroAlgos,
      freshnessSnapshot,
      proposedGroup: {
        groupId: Buffer.from(
          unsignedGroup.transactions[0].group,
        ).toString('base64'),
        transactionCount: unsignedGroup.transactionCount,
        companionTransactionIndex:
          unsignedGroup.companionTransactionIndex,
        appCallTransactionIndex:
          unsignedGroup.appCallTransactionIndex,
        action: unsignedGroup.action,
        poolKey: unsignedGroup.poolKey,
        currentRoundId: unsignedGroup.currentRoundId,
        nextRoundId: unsignedGroup.nextRoundId,
        roundMbrMicroAlgos:
          unsignedGroup.roundMbrMicroAlgos,
      },
      unsignedGroup,
    };
  } catch (error) {
    return {
      ok: false,
      reasons: [
        reason('GROUP_BUILD_FAILED', error.message),
      ],
      requiredMbrMicroAlgos,
      requiredFeesMicroAlgos,
      requiredTotalMicroAlgos,
      adminAccountBalanceMicroAlgos: balance,
      freshnessSnapshot,
      proposedGroup: null,
      unsignedGroup: null,
    };
  }
}