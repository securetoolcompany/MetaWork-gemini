import assert from 'node:assert/strict';

import {
  pollV7SettlementConfirmation,
  submitApprovedV7ReleaseHeldGroup,
} from './revenue-pool-v7-submission.js';

const GROUP_ID = 'deterministic-group-id';
const TRANSACTION_ID = 'DETERMINISTICTXID';

function createSignedResult() {
  return {
    groupId: GROUP_ID,
    transactionCount: 2,
    signedTransactions: [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
    ],
  };
}

function createPreflightResult({
  ok = true,
  groupId = GROUP_ID,
  reasons = [],
} = {}) {
  return {
    ok,
    reasons,
    proposedGroup: {
      groupId,
      transactionCount: 2,
    },
  };
}

function createAlgodClient({
  sendResponse = { txId: TRANSACTION_ID },
  pendingResponses = [
    {
      confirmedRound: 12345,
      poolError: '',
    },
  ],
} = {}) {
  let pendingCallCount = 0;

  return {
    submittedTransactions: null,

    sendRawTransaction(signedTransactions) {
      this.submittedTransactions = signedTransactions;

      return {
        do: async () => sendResponse,
      };
    },

    pendingTransactionInformation(transactionId) {
      assert.equal(transactionId, TRANSACTION_ID);

      return {
        do: async () => {
          const response =
            pendingResponses[
              Math.min(
                pendingCallCount,
                pendingResponses.length - 1
              )
            ];

          pendingCallCount += 1;

          if (response instanceof Error) {
            throw response;
          }

          return response;
        },
      };
    },
  };
}

const disabledAlgod = createAlgodClient();

const disabled = await submitApprovedV7ReleaseHeldGroup({
  enabled: false,
  userConfirmedSubmission: true,
  signedResult: createSignedResult(),
  preflightResult: createPreflightResult(),
  refreshPreflight: async () => createPreflightResult(),
  algodClient: disabledAlgod,
});

assert.equal(disabled.ok, false);
assert.equal(disabled.outcome, 'disabled');
assert.equal(disabledAlgod.submittedTransactions, null);

const confirmationRequired = await submitApprovedV7ReleaseHeldGroup({
  enabled: true,
  userConfirmedSubmission: false,
  signedResult: createSignedResult(),
  preflightResult: createPreflightResult(),
  refreshPreflight: async () => createPreflightResult(),
  algodClient: createAlgodClient(),
});

assert.equal(confirmationRequired.ok, false);
assert.equal(confirmationRequired.outcome, 'confirmation_required');

const initialMismatch = await submitApprovedV7ReleaseHeldGroup({
  enabled: true,
  userConfirmedSubmission: true,
  signedResult: createSignedResult(),
  preflightResult: createPreflightResult({
    groupId: 'different-group-id',
  }),
  refreshPreflight: async () => createPreflightResult(),
  algodClient: createAlgodClient(),
});

assert.equal(initialMismatch.ok, false);
assert.equal(initialMismatch.outcome, 'stale_preflight');

const staleAlgod = createAlgodClient();

const stalePreflight = await submitApprovedV7ReleaseHeldGroup({
  enabled: true,
  userConfirmedSubmission: true,
  signedResult: createSignedResult(),
  preflightResult: createPreflightResult(),
  refreshPreflight: async () =>
    createPreflightResult({
      groupId: 'changed-live-group-id',
    }),
  algodClient: staleAlgod,
});

assert.equal(stalePreflight.ok, false);
assert.equal(stalePreflight.outcome, 'stale_preflight');
assert.equal(staleAlgod.submittedTransactions, null);

const failedRefresh = await submitApprovedV7ReleaseHeldGroup({
  enabled: true,
  userConfirmedSubmission: true,
  signedResult: createSignedResult(),
  preflightResult: createPreflightResult(),
  refreshPreflight: async () => {
    throw new Error('algod unavailable');
  },
  algodClient: createAlgodClient(),
});

assert.equal(failedRefresh.ok, false);
assert.equal(failedRefresh.outcome, 'network_error');
assert.match(failedRefresh.reasons[0], /algod unavailable/);

const confirmedAlgod = createAlgodClient();

const confirmed = await submitApprovedV7ReleaseHeldGroup({
  enabled: true,
  userConfirmedSubmission: true,
  signedResult: createSignedResult(),
  preflightResult: createPreflightResult(),
  refreshPreflight: async () => createPreflightResult(),
  algodClient: confirmedAlgod,
  maxConfirmationAttempts: 1,
  confirmationPollIntervalMilliseconds: 0,
});

assert.equal(confirmed.ok, true);
assert.equal(confirmed.outcome, 'confirmed');
assert.equal(confirmed.groupId, GROUP_ID);
assert.equal(confirmed.transactionId, TRANSACTION_ID);
assert.equal(confirmed.confirmedRound, 12345);
assert.equal(confirmedAlgod.submittedTransactions.length, 2);

const pendingAlgod = createAlgodClient({
  pendingResponses: [
    {
      confirmedRound: 0,
      poolError: '',
    },
  ],
});

const pending = await submitApprovedV7ReleaseHeldGroup({
  enabled: true,
  userConfirmedSubmission: true,
  signedResult: createSignedResult(),
  preflightResult: createPreflightResult(),
  refreshPreflight: async () => createPreflightResult(),
  algodClient: pendingAlgod,
  maxConfirmationAttempts: 1,
  confirmationPollIntervalMilliseconds: 0,
});

assert.equal(pending.ok, true);
assert.equal(pending.outcome, 'pending');
assert.equal(pending.transactionId, TRANSACTION_ID);

const rejectedAlgod = createAlgodClient({
  pendingResponses: [
    {
      confirmedRound: 0,
      poolError: 'logic eval error',
    },
  ],
});

const rejected = await submitApprovedV7ReleaseHeldGroup({
  enabled: true,
  userConfirmedSubmission: true,
  signedResult: createSignedResult(),
  preflightResult: createPreflightResult(),
  refreshPreflight: async () => createPreflightResult(),
  algodClient: rejectedAlgod,
  maxConfirmationAttempts: 1,
  confirmationPollIntervalMilliseconds: 0,
});

assert.equal(rejected.ok, false);
assert.equal(rejected.outcome, 'rejected');
assert.equal(rejected.transactionId, TRANSACTION_ID);
assert.match(rejected.reasons[0], /logic eval error/);

const directPollAlgod = createAlgodClient({
  pendingResponses: [
    {
      confirmedRound: 0,
      poolError: '',
    },
  ],
});

const directPoll = await pollV7SettlementConfirmation({
  algodClient: directPollAlgod,
  transactionId: TRANSACTION_ID,
  maxAttempts: 1,
  pollIntervalMilliseconds: 0,
});

assert.equal(directPoll.outcome, 'pending');

console.log('✅ revenue-pool-v7-submission tests passed');