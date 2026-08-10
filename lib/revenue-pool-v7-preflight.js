import {
  buildV7ReleaseHeldGroup,
  calculateV7RoundMbrMicroAlgos,
} from './revenue-pool-v7-settlement.js';

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

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

function getGroupId(transactions) {
  const group = transactions[0]?.group;

  return group ? Buffer.from(group).toString('base64') : null;
}

export function preflightV7ReleaseHeld({
  revenuePoolAppId,
  expectedRevenuePoolAppId,
  usdcAssetId,
  adminAddress,
  ipAssetId,
  suggestedParams,
  poolState,
  releaseState,
  adminAccountBalanceMicroAlgos,
}) {
  const reasons = [];
  const balance = safeNumber(adminAccountBalanceMicroAlgos);
  const currentRoundId = safeNumber(poolState?.currentRoundId);
  const stakeholderCount = poolState?.stakeholderCount;

  if (revenuePoolAppId !== expectedRevenuePoolAppId) {
    reasons.push(
      reason(
        'APP_ID_MISMATCH',
        'The supplied revenue-pool application ID does not match the expected application ID.'
      )
    );
  }

  if (!poolState || poolState.heldUsdcAtomicUnits <= 0n) {
    reasons.push(
      reason('NO_HELD_FUNDS', 'No held USDC is available for release.')
    );
  }

  if (releaseState?.releaseStatus === 'blocked') {
    reasons.push(
      reason(
        'ROUND_STATE_BLOCKED',
        releaseState.reasons?.join(' ') ||
          'The active settlement-round state is blocked.'
      )
    );
  }

  if (currentRoundId === null) {
    reasons.push(
      reason(
        'UNSAFE_ROUND_ID',
        'The current round ID cannot be represented safely by the existing group builder.'
      )
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
        'Pool stakeholder count must be a safe integer between 1 and 100.'
      )
    );
  }

  if (!suggestedParams || typeof suggestedParams !== 'object') {
    reasons.push(
      reason('INVALID_SUGGESTED_PARAMS', 'Suggested transaction params are required.')
    );
  }

  if (balance === null) {
    reasons.push(
      reason(
        'INVALID_ADMIN_BALANCE',
        'Admin account balance must be a non-negative integer microALGO value.'
      )
    );
  }

  let requiredMbrMicroAlgos = null;
  let requiredFeesMicroAlgos = 3000;
  let requiredTotalMicroAlgos = null;

  if (
    Number.isSafeInteger(stakeholderCount) &&
    stakeholderCount >= 1 &&
    stakeholderCount <= 100
  ) {
    try {
      requiredMbrMicroAlgos = calculateV7RoundMbrMicroAlgos({
        ipAssetId,
        stakeholderCount,
      });
      requiredTotalMicroAlgos =
        requiredMbrMicroAlgos + requiredFeesMicroAlgos;
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
        } microALGOs.`
      )
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
      proposedGroup: null,
      unsignedGroup: null,
    };
  }

  try {
    const unsignedGroup = buildV7ReleaseHeldGroup({
      revenuePoolAppId,
      usdcAssetId,
      adminAddress,
      ipAssetId,
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
      requiredMbrMicroAlgos,
      requiredFeesMicroAlgos,
      requiredTotalMicroAlgos,
      adminAccountBalanceMicroAlgos: balance,
      remainingBalanceMicroAlgos: balance - requiredTotalMicroAlgos,
      proposedGroup: {
        groupId: getGroupId(unsignedGroup.transactions),
        transactionCount: unsignedGroup.transactions.length,
        companionTransactionIndex: unsignedGroup.companionTransactionIndex,
        appCallTransactionIndex: unsignedGroup.appCallTransactionIndex,
        action: 'release_held',
      },
      unsignedGroup,
    };
  } catch (error) {
    return {
      ok: false,
      reasons: [reason('GROUP_BUILD_FAILED', error.message)],
      requiredMbrMicroAlgos,
      requiredFeesMicroAlgos,
      requiredTotalMicroAlgos,
      adminAccountBalanceMicroAlgos: balance,
      proposedGroup: null,
      unsignedGroup: null,
    };
  }
}