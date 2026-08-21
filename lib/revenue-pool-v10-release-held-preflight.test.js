import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  preflightV10ReleaseHeld,
} from './revenue-pool-v10-release-held-preflight.js';

const APP_ID = 769218532;
const POOL_KEY = '6a8731f9cf853e8374a571ca';
const CURRENT_ROUND_ID = 3;
const STAKEHOLDER_COUNT = 2;
const HELD_USDC_ATOMIC_UNITS = 4_000_000n;

function makeSuggestedParams() {
  return {
    fee: 1000n,
    minFee: 1000n,
    firstValid: 100n,
    lastValid: 1100n,
    genesisHash: new Uint8Array(32).fill(1),
    genesisID: 'testnet-v1.0',
    flatFee: false,
  };
}

function makePoolState(overrides = {}) {
  return {
    heldUsdcAtomicUnits: HELD_USDC_ATOMIC_UNITS,
    currentRoundId: BigInt(CURRENT_ROUND_ID),
    stakeholderCount: STAKEHOLDER_COUNT,
    ...overrides,
  };
}

function makeInput(overrides = {}) {
  return {
    revenuePoolAppId: APP_ID,
    expectedRevenuePoolAppId: APP_ID,
    adminAddress: algosdk.generateAccount().addr.toString(),
    poolKey: POOL_KEY,
    suggestedParams: makeSuggestedParams(),
    poolState: makePoolState(),
    adminAccountBalanceMicroAlgos: 1_000_000n,
    ...overrides,
  };
}

test('preflights V10 held release and creates the exact unsigned group', () => {
  const result = preflightV10ReleaseHeld(makeInput());

  assert.equal(result.ok, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.currentRoundId, CURRENT_ROUND_ID);
  assert.equal(result.nextRoundId, CURRENT_ROUND_ID + 1);
  assert.equal(result.stakeholderCount, STAKEHOLDER_COUNT);
  assert.equal(
    result.heldUsdcAtomicUnits,
    HELD_USDC_ATOMIC_UNITS,
  );

  assert.equal(result.proposedGroup.action, 'release_held');
  assert.equal(result.proposedGroup.poolKey, POOL_KEY);
  assert.equal(
    result.proposedGroup.currentRoundId,
    CURRENT_ROUND_ID,
  );
  assert.equal(
    result.proposedGroup.nextRoundId,
    CURRENT_ROUND_ID + 1,
  );
  assert.equal(result.proposedGroup.transactionCount, 2);
  assert.equal(
    result.proposedGroup.companionTransactionIndex,
    0,
  );
  assert.equal(
    result.proposedGroup.appCallTransactionIndex,
    1,
  );

  const [mbrPaymentTxn, appCallTxn] =
    result.unsignedGroup.transactions;

  assert.equal(mbrPaymentTxn.type, 'pay');
  assert.equal(appCallTxn.type, 'appl');

  assert.equal(
    Buffer.from(appCallTxn.applicationCall.appArgs[0]).toString(),
    'release_held',
  );

  assert.equal(
    Buffer.from(appCallTxn.applicationCall.appArgs[1]).toString(),
    POOL_KEY,
  );

  assert.equal(
    new DataView(
      appCallTxn.applicationCall.appArgs[2].buffer,
      appCallTxn.applicationCall.appArgs[2].byteOffset,
      appCallTxn.applicationCall.appArgs[2].byteLength,
    ).getBigUint64(0, false),
    0n,
  );
});

test('blocks release when the V10 pool has no held funds', () => {
  const result = preflightV10ReleaseHeld(
    makeInput({
      poolState: makePoolState({
        heldUsdcAtomicUnits: 0n,
      }),
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.reasons.some(({ code }) => code === 'NO_HELD_FUNDS'),
    true,
  );
  assert.equal(result.unsignedGroup, null);
});

test('blocks release when the V10 app ID mismatches', () => {
  const result = preflightV10ReleaseHeld(
    makeInput({
      expectedRevenuePoolAppId: APP_ID + 1,
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.reasons.some(({ code }) => code === 'APP_ID_MISMATCH'),
    true,
  );
  assert.equal(result.unsignedGroup, null);
});

test('blocks release when admin ALGO cannot cover MBR plus fees', () => {
  const result = preflightV10ReleaseHeld(
    makeInput({
      adminAccountBalanceMicroAlgos: 0n,
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.reasons.some(({ code }) => code === 'INSUFFICIENT_ALGO'),
    true,
  );
  assert.equal(result.unsignedGroup, null);
});

test('refresh-only V10 release preflight returns state without a group', () => {
  const result = preflightV10ReleaseHeld(
    makeInput({
      buildUnsignedGroup: false,
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.proposedGroup, null);
  assert.equal(result.unsignedGroup, null);
  assert.equal(result.nextRoundId, CURRENT_ROUND_ID + 1);
});