import assert from 'node:assert/strict';
import algosdk from 'algosdk';

import { preflightV7ReleaseHeld } from './revenue-pool-v7-preflight.js';

const adminAddress = algosdk.generateAccount().addr.toString();

const suggestedParams = {
  fee: 1000,
  firstValid: 1,
  lastValid: 1000,
  genesisHash: new Uint8Array(32),
  genesisID: 'testnet-v1.0',
};

function createPoolState({
  currentRoundId = 4n,
  heldUsdcAtomicUnits = 8530000n,
  stakeholderCount = 2,
} = {}) {
  return {
    currentRoundId,
    heldUsdcAtomicUnits,
    stakeholderCount,
  };
}

function createReleaseState({
  releaseStatus = 'ready',
  reasons = [],
} = {}) {
  return {
    releaseStatus,
    reasons,
  };
}

function createPreflightInput(overrides = {}) {
  return {
    revenuePoolAppId: 7001,
    expectedRevenuePoolAppId: 7001,
    usdcAssetId: 10458941,
    adminAddress,
    ipAssetId: 'ip-asset-a',
    suggestedParams,
    poolState: createPoolState(),
    releaseState: createReleaseState(),
    adminAccountBalanceMicroAlgos: 100000n,
    ...overrides,
  };
}

const successfulPreflight = preflightV7ReleaseHeld(
  createPreflightInput()
);

assert.equal(successfulPreflight.ok, true);
assert.deepEqual(successfulPreflight.reasons, []);
assert.equal(successfulPreflight.currentRoundId, 4);
assert.equal(successfulPreflight.nextRoundId, 5);
assert.equal(successfulPreflight.stakeholderCount, 2);
assert.equal(successfulPreflight.requiredMbrMicroAlgos, 51300);
assert.equal(successfulPreflight.requiredFeesMicroAlgos, 3000);
assert.equal(successfulPreflight.requiredTotalMicroAlgos, 54300);
assert.equal(
  successfulPreflight.remainingBalanceMicroAlgos,
  45700
);

assert.equal(successfulPreflight.proposedGroup.action, 'release_held');
assert.equal(successfulPreflight.proposedGroup.transactionCount, 2);
assert.equal(
  successfulPreflight.proposedGroup.companionTransactionIndex,
  0
);
assert.equal(
  successfulPreflight.proposedGroup.appCallTransactionIndex,
  1
);
assert.equal(typeof successfulPreflight.proposedGroup.groupId, 'string');
assert.equal(successfulPreflight.unsignedGroup.transactions.length, 2);

const insufficientBalance = preflightV7ReleaseHeld(
  createPreflightInput({
    adminAccountBalanceMicroAlgos: 54300n - 1n,
  })
);

assert.equal(insufficientBalance.ok, false);
assert.equal(insufficientBalance.unsignedGroup, null);
assert.equal(insufficientBalance.proposedGroup, null);
assert.equal(insufficientBalance.requiredTotalMicroAlgos, 54300);
assert.equal(
  insufficientBalance.reasons.some(
    ({ code }) => code === 'INSUFFICIENT_ALGO'
  ),
  true
);
assert.match(
  insufficientBalance.reasons.find(
    ({ code }) => code === 'INSUFFICIENT_ALGO'
  ).message,
  /short by 1 microALGO/
);

const noHeldFunds = preflightV7ReleaseHeld(
  createPreflightInput({
    poolState: createPoolState({
      heldUsdcAtomicUnits: 0n,
    }),
    releaseState: createReleaseState({
      releaseStatus: 'complete',
    }),
  })
);

assert.equal(noHeldFunds.ok, false);
assert.equal(
  noHeldFunds.reasons.some(({ code }) => code === 'NO_HELD_FUNDS'),
  true
);
assert.equal(noHeldFunds.unsignedGroup, null);

const pendingRoundWithHeldFunds = preflightV7ReleaseHeld(
  createPreflightInput({
    releaseState: createReleaseState({
      releaseStatus: 'pending',
      reasons: ['Prior round has unclaimed entries.'],
    }),
  })
);

assert.equal(pendingRoundWithHeldFunds.ok, true);
assert.equal(
  pendingRoundWithHeldFunds.unsignedGroup.transactions.length,
  2
);

const completeRoundWithHeldFunds = preflightV7ReleaseHeld(
  createPreflightInput({
    releaseState: createReleaseState({
      releaseStatus: 'complete',
    }),
  })
);

assert.equal(completeRoundWithHeldFunds.ok, true);

const blockedRound = preflightV7ReleaseHeld(
  createPreflightInput({
    releaseState: createReleaseState({
      releaseStatus: 'blocked',
      reasons: ['The active round box is missing.'],
    }),
  })
);

assert.equal(blockedRound.ok, false);
assert.equal(
  blockedRound.reasons.some(
    ({ code }) => code === 'ROUND_STATE_BLOCKED'
  ),
  true
);
assert.equal(blockedRound.unsignedGroup, null);

const mismatchedAppId = preflightV7ReleaseHeld(
  createPreflightInput({
    expectedRevenuePoolAppId: 7002,
  })
);

assert.equal(mismatchedAppId.ok, false);
assert.equal(
  mismatchedAppId.reasons.some(
    ({ code }) => code === 'APP_ID_MISMATCH'
  ),
  true
);

const unsafeRoundId = preflightV7ReleaseHeld(
  createPreflightInput({
    poolState: createPoolState({
      currentRoundId: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
    }),
  })
);

assert.equal(unsafeRoundId.ok, false);
assert.equal(
  unsafeRoundId.reasons.some(
    ({ code }) => code === 'UNSAFE_ROUND_ID'
  ),
  true
);
assert.equal(unsafeRoundId.unsignedGroup, null);

const invalidStakeholderCount = preflightV7ReleaseHeld(
  createPreflightInput({
    poolState: createPoolState({
      stakeholderCount: 0,
    }),
  })
);

assert.equal(invalidStakeholderCount.ok, false);
assert.equal(
  invalidStakeholderCount.reasons.some(
    ({ code }) => code === 'INVALID_STAKEHOLDER_COUNT'
  ),
  true
);

const invalidBalance = preflightV7ReleaseHeld(
  createPreflightInput({
    adminAccountBalanceMicroAlgos: -1n,
  })
);

assert.equal(invalidBalance.ok, false);
assert.equal(
  invalidBalance.reasons.some(
    ({ code }) => code === 'INVALID_ADMIN_BALANCE'
  ),
  true
);

console.log('✅ revenue-pool-v7-preflight tests passed');