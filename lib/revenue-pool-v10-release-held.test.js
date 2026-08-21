import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  V10_RELEASE_HELD_ACTION,
  buildV10ReleaseHeldGroup,
  calculateV10ReleaseRoundMbrMicroAlgos,
  getV10PoolBoxName,
  getV10RoundBoxName,
} from './revenue-pool-v10-release-held.js';

const APP_ID = 769218532;
const POOL_KEY = '6a8731f9cf853e8374a571ca';
const CURRENT_ROUND_ID = 3;
const STAKEHOLDER_COUNT = 2;

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

function makeInput(overrides = {}) {
  return {
    revenuePoolAppId: APP_ID,
    adminAddress: algosdk.generateAccount().addr.toString(),
    poolKey: POOL_KEY,
    currentRoundId: CURRENT_ROUND_ID,
    stakeholderCount: STAKEHOLDER_COUNT,
    suggestedParams: makeSuggestedParams(),
    ...overrides,
  };
}

test('builds the V10 two-transaction release-held group', () => {
  const result = buildV10ReleaseHeldGroup(makeInput());

  assert.equal(result.action, V10_RELEASE_HELD_ACTION);
  assert.equal(result.transactionCount, 2);
  assert.equal(result.companionTransactionIndex, 0);
  assert.equal(result.appCallTransactionIndex, 1);
  assert.equal(result.currentRoundId, CURRENT_ROUND_ID);
  assert.equal(result.nextRoundId, CURRENT_ROUND_ID + 1);

  const [mbrPaymentTxn, appCallTxn] = result.transactions;

  assert.equal(mbrPaymentTxn.type, 'pay');
  assert.equal(appCallTxn.type, 'appl');

  assert.equal(
    mbrPaymentTxn.payment.receiver.toString(),
    algosdk.getApplicationAddress(APP_ID).toString(),
  );

  assert.equal(
    mbrPaymentTxn.payment.amount,
    BigInt(result.roundMbrMicroAlgos),
  );

  assert.equal(
    Buffer.from(appCallTxn.applicationCall.appArgs[0]).toString(),
    V10_RELEASE_HELD_ACTION,
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

  assert.deepEqual(
    Array.from(appCallTxn.applicationCall.boxes[0].name),
    Array.from(getV10PoolBoxName(POOL_KEY)),
  );

  assert.deepEqual(
    Array.from(appCallTxn.applicationCall.boxes[1].name),
    Array.from(getV10RoundBoxName(POOL_KEY, CURRENT_ROUND_ID + 1)),
  );
});

test('calculates V10 release round MBR from pool-key bytes and stakeholders', () => {
  const expectedRoundSize = 18 + STAKEHOLDER_COUNT * 41;
  const expectedMbr =
    2500 +
    400 * (
      12 +
      Buffer.byteLength(POOL_KEY, 'utf8') +
      expectedRoundSize
    );

  assert.equal(
    calculateV10ReleaseRoundMbrMicroAlgos({
      poolKey: POOL_KEY,
      stakeholderCount: STAKEHOLDER_COUNT,
    }),
    expectedMbr,
  );
});

test('rejects invalid V10 release inputs', () => {
  const invalidInputs = [
    {
      revenuePoolAppId: 0,
      message: 'revenuePoolAppId',
    },
    {
      adminAddress: 'not-an-address',
      message: 'adminAddress',
    },
    {
      poolKey: '',
      message: 'poolKey',
    },
    {
      currentRoundId: -1,
      message: 'currentRoundId',
    },
    {
      stakeholderCount: 0,
      message: 'stakeholderCount',
    },
    {
      stakeholderCount: 101,
      message: 'stakeholderCount',
    },
    {
      suggestedParams: null,
      message: 'suggestedParams',
    },
  ];

  for (const invalidInput of invalidInputs) {
    assert.throws(
      () =>
        buildV10ReleaseHeldGroup(
          makeInput(invalidInput),
        ),
      new RegExp(invalidInput.message),
    );
  }
});