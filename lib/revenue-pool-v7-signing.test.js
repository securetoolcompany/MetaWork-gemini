import assert from 'node:assert/strict';
import algosdk from 'algosdk';

import {
  signApprovedV7ReleaseHeldGroup,
  V7SigningValidationError,
  V7WalletSigningError,
} from './revenue-pool-v7-signing.js';

import {
  buildV7ReleaseHeldGroup,
} from './revenue-pool-v7-settlement.js';

const adminAddress = algosdk.generateAccount().addr.toString();

const suggestedParams = {
  fee: 1000,
  firstValid: 1,
  lastValid: 1000,
  genesisHash: new Uint8Array(32),
  genesisID: 'testnet-v1.0',
};

function createApprovedGroup() {
  return buildV7ReleaseHeldGroup({
    revenuePoolAppId: 7001,
    usdcAssetId: 10458941,
    adminAddress,
    ipAssetId: 'ip-asset-a',
    currentRoundId: 4,
    stakeholderCount: 2,
    suggestedParams,
  });
}

function getGroupId(approvedGroup) {
  return Buffer.from(
    approvedGroup.transactions[0].group
  ).toString('base64');
}

const approvedGroup = createApprovedGroup();
const expectedGroupId = getGroupId(approvedGroup);

let receivedUnsignedTransactions = null;

const successfulWalletSigner = async (encodedUnsignedTransactions) => {
  receivedUnsignedTransactions = encodedUnsignedTransactions;

  assert.equal(encodedUnsignedTransactions.length, 2);

  return encodedUnsignedTransactions.map((encodedTransaction) =>
    new Uint8Array(encodedTransaction)
  );
};

const signedResult = await signApprovedV7ReleaseHeldGroup({
  approvedGroup,
  expectedGroupId,
  signTransactionGroup: successfulWalletSigner,
});

assert.equal(signedResult.groupId, expectedGroupId);
assert.equal(signedResult.transactionCount, 2);
assert.equal(signedResult.signedTransactions.length, 2);
assert.equal(receivedUnsignedTransactions.length, 2);
assert.equal(
  algosdk.decodeUnsignedTransaction(receivedUnsignedTransactions[0]).type,
  'pay'
);
assert.equal(
  algosdk.decodeUnsignedTransaction(receivedUnsignedTransactions[1]).type,
  'appl'
);

let groupMismatchWalletCalled = false;

const rejectedWalletGroup = createApprovedGroup();

await assert.rejects(
  () =>
    signApprovedV7ReleaseHeldGroup({
      approvedGroup: rejectedWalletGroup,
      expectedGroupId: getGroupId(rejectedWalletGroup),
      signTransactionGroup: async () => {
        throw new Error(
          'Transaction cancelled - you closed the signing request'
        );
      },
    }),
  V7WalletSigningError
);

assert.equal(groupMismatchWalletCalled, false);

let wrongCountWalletCalled = false;

await assert.rejects(
  () =>
    signApprovedV7ReleaseHeldGroup({
      approvedGroup: {
        transactions: [createApprovedGroup().transactions[0]],
      },
      expectedGroupId,
      signTransactionGroup: async () => {
        wrongCountWalletCalled = true;
        return [];
      },
    }),
  /exactly two transactions/
);

assert.equal(wrongCountWalletCalled, false);

const wrongOrderingGroup = createApprovedGroup();
wrongOrderingGroup.transactions.reverse();

let wrongOrderingWalletCalled = false;

await assert.rejects(
  () =>
    signApprovedV7ReleaseHeldGroup({
      approvedGroup: wrongOrderingGroup,
      expectedGroupId: getGroupId(wrongOrderingGroup),
      signTransactionGroup: async () => {
        wrongOrderingWalletCalled = true;
        return [];
      },
    }),
  /transaction 0 must be the MBR payment/
);

assert.equal(wrongOrderingWalletCalled, false);

const wrongActionGroup = createApprovedGroup();

wrongActionGroup.transactions[1].applicationCall.appArgs[0] =
  new TextEncoder().encode('deposit_held');

let wrongActionWalletCalled = false;

await assert.rejects(
  () =>
    signApprovedV7ReleaseHeldGroup({
      approvedGroup: wrongActionGroup,
      expectedGroupId: getGroupId(wrongActionGroup),
      signTransactionGroup: async () => {
        wrongActionWalletCalled = true;
        return [];
      },
    }),
  /release_held action/
);

assert.equal(wrongActionWalletCalled, false);

await assert.rejects(
  () =>
    signApprovedV7ReleaseHeldGroup({
      approvedGroup: createApprovedGroup(),
      expectedGroupId: getGroupId(createApprovedGroup()),
      signTransactionGroup: async () => {
        throw new Error('Transaction cancelled - you closed the signing request');
      },
    }),
  V7WalletSigningError
);

const countMismatchGroup = createApprovedGroup();

await assert.rejects(
  () =>
    signApprovedV7ReleaseHeldGroup({
      approvedGroup: countMismatchGroup,
      expectedGroupId: getGroupId(countMismatchGroup),
      signTransactionGroup: async () => [
        new Uint8Array([1, 2, 3]),
      ],
    }),
  /expected 2/
);

const invalidBlobGroup = createApprovedGroup();

await assert.rejects(
  () =>
    signApprovedV7ReleaseHeldGroup({
      approvedGroup: invalidBlobGroup,
      expectedGroupId: getGroupId(invalidBlobGroup),
      signTransactionGroup: async () => [
        new Uint8Array([1, 2, 3]),
        null,
      ],
    }),
  /must be a signed Uint8Array/
);

console.log('✅ revenue-pool-v7-signing tests passed');