import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  V10_CLEANUP_ACTION,
  buildUnsignedV10CleanupRoundTransaction,
} from './revenue-pool-v10-cleanup.js';

function makeAddress() {
  return algosdk.generateAccount().addr.toString();
}

function makeSuggestedParams() {
  return {
    fee: 1000,
    minFee: 1000,
    flatFee: true,
    firstValid: 1,
    lastValid: 1001,
    genesisHash: new Uint8Array(32),
    genesisID: 'testnet-v1.0',
  };
}

function decodeUnsignedTransaction(encodedTransaction) {
  return algosdk.decodeUnsignedTransaction(
    new Uint8Array(Buffer.from(encodedTransaction, 'base64')),
  );
}

test('builds the exact unsigned V10 cleanup_round application call', () => {
  const sender = makeAddress();

  const group = buildUnsignedV10CleanupRoundTransaction({
    appId: 7001,
    poolKey: 'ip-a',
    roundId: 1,
    sender,
    suggestedParams: makeSuggestedParams(),
  });

  assert.equal(group.action, V10_CLEANUP_ACTION);
  assert.equal(group.appId, 7001);
  assert.equal(group.poolKey, 'ip-a');
  assert.equal(group.roundId, 1);
  assert.equal(group.sender, sender);
  assert.equal(group.transactionCount, 1);

  assert.match(group.transactionId, /^[A-Z2-7]{52}$/);
  assert.match(group.unsignedTransactionHash, /^sha256:[a-f0-9]{64}$/);

  const appCall = decodeUnsignedTransaction(
    group.unsignedTransactionBase64,
  );

  assert.equal(appCall.fee, 2_000n);
  assert.equal(appCall.type, 'appl');
  assert.equal(appCall.applicationCall.appIndex, 7001n);

  assert.deepEqual(
    Buffer.from(appCall.applicationCall.appArgs[0]),
    Buffer.from('cleanup_round', 'utf8'),
  );
  assert.deepEqual(
    Buffer.from(appCall.applicationCall.appArgs[1]),
    Buffer.from('ip-a', 'utf8'),
  );
  assert.deepEqual(
    Buffer.from(appCall.applicationCall.appArgs[2]),
    Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
  );

  assert.equal(appCall.applicationCall.boxes.length, 1);
  assert.equal(appCall.applicationCall.boxes[0].appIndex, 0n);
  assert.deepEqual(
    Buffer.from(appCall.applicationCall.boxes[0].name),
    Buffer.concat([
      Buffer.from('rnd_ip-a', 'utf8'),
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
    ]),
  );
});

test('builds identical cleanup transactions from identical frozen inputs', () => {
  const input = Object.freeze({
    appId: 7001,
    poolKey: 'ip-a',
    roundId: 1,
    sender: makeAddress(),
    suggestedParams: Object.freeze(makeSuggestedParams()),
  });

  const firstTransaction =
    buildUnsignedV10CleanupRoundTransaction(input);
  const secondTransaction =
    buildUnsignedV10CleanupRoundTransaction(input);

  assert.equal(
    firstTransaction.transactionId,
    secondTransaction.transactionId,
  );
  assert.equal(
    firstTransaction.unsignedTransactionBase64,
    secondTransaction.unsignedTransactionBase64,
  );
  assert.equal(
    firstTransaction.unsignedTransactionHash,
    secondTransaction.unsignedTransactionHash,
  );
});

test('rejects invalid cleanup inputs', () => {
  const sender = makeAddress();

  assert.throws(
    () =>
      buildUnsignedV10CleanupRoundTransaction({
        appId: 0,
        poolKey: 'ip-a',
        roundId: 1,
        sender,
        suggestedParams: makeSuggestedParams(),
      }),
    /appId must be a safe integer/,
  );

  assert.throws(
    () =>
      buildUnsignedV10CleanupRoundTransaction({
        appId: 7001,
        poolKey: '   ',
        roundId: 1,
        sender,
        suggestedParams: makeSuggestedParams(),
      }),
    /poolKey must be a non-empty string/,
  );

  assert.throws(
    () =>
      buildUnsignedV10CleanupRoundTransaction({
        appId: 7001,
        poolKey: 'ip-a',
        roundId: 0,
        sender,
        suggestedParams: makeSuggestedParams(),
      }),
    /roundId must be a safe integer/,
  );

  assert.throws(
    () =>
      buildUnsignedV10CleanupRoundTransaction({
        appId: 7001,
        poolKey: 'ip-a',
        roundId: 1,
        sender: 'not-an-algorand-address',
        suggestedParams: makeSuggestedParams(),
      }),
    /sender must be a valid Algorand address/,
  );

  assert.throws(
    () =>
      buildUnsignedV10CleanupRoundTransaction({
        appId: 7001,
        poolKey: 'ip-a',
        roundId: 1,
        sender,
      }),
    /suggestedParams must be an object/,
  );
});