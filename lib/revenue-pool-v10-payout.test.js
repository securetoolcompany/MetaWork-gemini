import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  V10_PAYOUT_ACTION,
  buildUnsignedV10CreatePayoutRoundGroup,
  calculateV10PayoutRoundBoxMbrMicroalgos,
  createV10PoolBoxName,
  createV10RoundPayeesBytes,
} from './revenue-pool-v10-payout.js';

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

function addressByteCompare(left, right) {
  return Buffer.compare(
    Buffer.from(algosdk.decodeAddress(left).publicKey),
    Buffer.from(algosdk.decodeAddress(right).publicKey),
  );
}

test('builds the exact unsigned V10 create_payout_round group', () => {
  const sender = makeAddress();
  const first = makeAddress();
  const second = makeAddress();

  const group = buildUnsignedV10CreatePayoutRoundGroup({
    appId: 7001,
    poolKey: 'ip-a',
    sender,
    roundPayees: [
      {
        address: second,
        amountUsdcAtomicUnits: 300_000,
      },
      {
        address: first,
        amountUsdcAtomicUnits: 700_000,
      },
    ],
    totalUsdcAtomicUnits: 1_000_000,
    suggestedParams: makeSuggestedParams(),
  });

  assert.equal(group.action, V10_PAYOUT_ACTION);
  assert.equal(group.appId, 7001);
  assert.equal(group.poolKey, 'ip-a');
  assert.equal(group.sender, sender);
  assert.equal(group.totalUsdcAtomicUnits, 1_000_000);
  assert.equal(group.recipientCount, 2);
  assert.equal(group.transactionCount, 2);
  assert.equal(group.appCallTransactionIndex, 0);
  assert.equal(group.companionPaymentTransactionIndex, 1);
  assert.equal(group.companionPaymentIndex, 1);

  assert.deepEqual(
    group.roundPayees.map((payee) => payee.address),
    [first, second].sort(addressByteCompare),
  );

  assert.equal(
    group.roundPayees.reduce(
      (total, payee) => total + payee.amountUsdcAtomicUnits,
      0,
    ),
    1_000_000,
  );

  assert.equal(group.unsignedTransactionsBase64.length, 2);
  assert.match(group.groupId, /^[A-Za-z0-9+/]{43}=$/);
  assert.match(group.transactionIds.appCall, /^[A-Z2-7]{52}$/);
  assert.match(
    group.transactionIds.companionPayment,
    /^[A-Z2-7]{52}$/,
  );
  assert.match(group.unsignedTransactionHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(group.roundPayeesHash, /^sha256:[a-f0-9]{64}$/);

  assert.equal(
    group.roundBoxMbrMicroalgos,
    calculateV10PayoutRoundBoxMbrMicroalgos({
      poolKey: 'ip-a',
      recipientCount: 2,
    }),
  );
});

test('packs canonical recipient entries as address bytes plus uint64 amount', () => {
  const first = makeAddress();
  const second = makeAddress();

  const packed = createV10RoundPayeesBytes({
    roundPayees: [
      {
        address: second,
        amountUsdcAtomicUnits: 300_000,
      },
      {
        address: first,
        amountUsdcAtomicUnits: 700_000,
      },
    ],
    totalUsdcAtomicUnits: 1_000_000,
  });

  const ordered = [first, second].sort(addressByteCompare);

  assert.equal(packed.length, 80);

  assert.deepEqual(
    Buffer.from(packed.subarray(0, 32)),
    Buffer.from(algosdk.decodeAddress(ordered[0]).publicKey),
  );
  assert.equal(
    Buffer.from(packed.subarray(32, 40)).readBigUInt64BE(),
    BigInt(
      ordered[0] === first
        ? 700_000
        : 300_000,
    ),
  );

  assert.deepEqual(
    Buffer.from(packed.subarray(40, 72)),
    Buffer.from(algosdk.decodeAddress(ordered[1]).publicKey),
  );
  assert.equal(
    Buffer.from(packed.subarray(72, 80)).readBigUInt64BE(),
    BigInt(
      ordered[1] === first
        ? 700_000
        : 300_000,
    ),
  );
});

test('uses the exact pool box name and V10 payout-round MBR formula', () => {
  assert.deepEqual(
    Buffer.from(createV10PoolBoxName('ip-a')),
    Buffer.from('p_ip-a'),
  );

  assert.equal(
    calculateV10PayoutRoundBoxMbrMicroalgos({
      poolKey: 'ip-a',
      recipientCount: 1,
    }),
    32_500,
  );

  assert.equal(
    calculateV10PayoutRoundBoxMbrMicroalgos({
      poolKey: 'ip-a',
      recipientCount: 2,
    }),
    48_900,
  );
});

test('builds identical payout groups from identical frozen inputs', () => {
  const sender = makeAddress();
  const first = makeAddress();
  const second = makeAddress();

  const input = {
    appId: 7001,
    poolKey: 'ip-a',
    sender,
    roundPayees: [
      {
        address: second,
        amountUsdcAtomicUnits: 300_000,
      },
      {
        address: first,
        amountUsdcAtomicUnits: 700_000,
      },
    ],
    totalUsdcAtomicUnits: 1_000_000,
    suggestedParams: makeSuggestedParams(),
  };

  const firstGroup =
    buildUnsignedV10CreatePayoutRoundGroup(input);
  const secondGroup =
    buildUnsignedV10CreatePayoutRoundGroup(input);

  assert.equal(firstGroup.groupId, secondGroup.groupId);
  assert.deepEqual(
    firstGroup.transactionIds,
    secondGroup.transactionIds,
  );
  assert.deepEqual(
    firstGroup.unsignedTransactionsBase64,
    secondGroup.unsignedTransactionsBase64,
  );
  assert.equal(
    firstGroup.unsignedTransactionHash,
    secondGroup.unsignedTransactionHash,
  );
  assert.equal(
    firstGroup.roundPayeesHash,
    secondGroup.roundPayeesHash,
  );
});

test('rejects invalid payout inputs and non-reconciling recipients', () => {
  const sender = makeAddress();
  const recipient = makeAddress();

  assert.throws(
    () =>
      buildUnsignedV10CreatePayoutRoundGroup({
        appId: 0,
        poolKey: 'ip-a',
        sender,
        roundPayees: [
          {
            address: recipient,
            amountUsdcAtomicUnits: 1_000_000,
          },
        ],
        totalUsdcAtomicUnits: 1_000_000,
        suggestedParams: makeSuggestedParams(),
      }),
    /appId must be a safe integer/,
  );

  assert.throws(
    () =>
      buildUnsignedV10CreatePayoutRoundGroup({
        appId: 7001,
        poolKey: 'ip-a',
        sender,
        roundPayees: [
          {
            address: recipient,
            amountUsdcAtomicUnits: 999_999,
          },
        ],
        totalUsdcAtomicUnits: 1_000_000,
        suggestedParams: makeSuggestedParams(),
      }),
    /do not reconcile/,
  );

  assert.throws(
    () =>
      createV10RoundPayeesBytes({
        roundPayees: [
          {
            address: recipient,
            amountUsdcAtomicUnits: 500_000,
          },
          {
            address: recipient,
            amountUsdcAtomicUnits: 500_000,
          },
        ],
        totalUsdcAtomicUnits: 1_000_000,
      }),
    /duplicate recipient address/,
  );
});