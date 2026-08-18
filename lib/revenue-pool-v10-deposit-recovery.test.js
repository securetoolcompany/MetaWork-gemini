import assert from 'node:assert/strict';
import test from 'node:test';

import {
  V10DepositRecoveryValidationError,
  readV10DepositRecoveryState,
} from './revenue-pool-v10-deposit-recovery.js';

const APP_CALL_TX_ID =
  'XA4PYHD3BUSRCJ6O2K7FYTSKKAVVXUVI7D6ZFTXH3HIPMVDVLQPA';

const USDC_TRANSFER_TX_ID =
  'WB3X4KSDBITJBA5MMVD6AMPP3KWBDDFQHVYYGHAJN2SLXK3N23OQ';

function makeBatch(overrides = {}) {
  return {
    _id: 'batch-1',
    status: 'deposit_prepared',

    depositAttempt: {
      attemptKey: 'batch-1:deposit:v1',
      operation: 'v10_usdc_deposit',
      status: 'prepared',

      transactionIds: {
        usdcTransfer: USDC_TRANSFER_TX_ID,
        appCall: APP_CALL_TX_ID,
      },
    },

    ...overrides,
  };
}

function createAlgodClient({
  response = {
    confirmedRound: 0,
    poolError: '',
  },
  error = null,
} = {}) {
  const calls = [];

  return {
    calls,

    pendingTransactionInformation(transactionId) {
      calls.push(transactionId);

      return {
        async do() {
          if (error) {
            throw error;
          }

          return response;
        },
      };
    },
  };
}

test('reads a pending stored V10 deposit app-call transaction', async () => {
  const algodClient = createAlgodClient();

  const result = await readV10DepositRecoveryState({
    algodClient,
    batch: makeBatch(),
  });

  assert.equal(result.outcome, 'pending');
  assert.equal(result.batchId, 'batch-1');
  assert.equal(result.batchStatus, 'deposit_prepared');
  assert.equal(result.depositAttemptStatus, 'prepared');
  assert.equal(result.appCallTransactionId, APP_CALL_TX_ID);
  assert.equal(
    result.usdcTransferTransactionId,
    USDC_TRANSFER_TX_ID,
  );
  assert.equal(result.confirmedRound, null);
  assert.equal(result.poolError, null);
  assert.deepEqual(algodClient.calls, [APP_CALL_TX_ID]);
  assert.equal(Object.isFrozen(result), true);
});

test('reads a confirmed V10 deposit from the stored app-call transaction', async () => {
  const algodClient = createAlgodClient({
    response: {
      'confirmed-round': 123456,
      'pool-error': '',
    },
  });

  const result = await readV10DepositRecoveryState({
    algodClient,
    batch: makeBatch({
      status: 'deposit_submitted',
      depositAttempt: {
        ...makeBatch().depositAttempt,
        status: 'submitted',
      },
    }),
  });

  assert.equal(result.outcome, 'confirmed');
  assert.equal(result.batchStatus, 'deposit_submitted');
  assert.equal(result.depositAttemptStatus, 'submitted');
  assert.equal(result.confirmedRound, '123456');
  assert.equal(result.poolError, null);
  assert.equal(result.reason, null);
  assert.deepEqual(algodClient.calls, [APP_CALL_TX_ID]);
});

test('reads a rejected V10 deposit from pool error state', async () => {
  const algodClient = createAlgodClient({
    response: {
      confirmedRound: 0,
      poolError: 'logic eval error',
    },
  });

  const result = await readV10DepositRecoveryState({
    algodClient,
    batch: makeBatch(),
  });

  assert.equal(result.outcome, 'rejected');
  assert.equal(result.confirmedRound, null);
  assert.equal(result.poolError, 'logic eval error');
  assert.equal(result.reason, 'logic eval error');
});

test('returns unknown on an Algod not-found response', async () => {
  const notFound = new Error('transaction not found');
  notFound.status = 404;

  const algodClient = createAlgodClient({
    error: notFound,
  });

  const result = await readV10DepositRecoveryState({
    algodClient,
    batch: makeBatch(),
  });

  assert.equal(result.outcome, 'unknown');
  assert.equal(result.confirmedRound, null);
  assert.equal(result.poolError, null);
  assert.match(result.reason, /not currently available/i);
});

test('returns network_error for non-404 Algod errors', async () => {
  const algodUnavailable = new Error('Algod unavailable');
  algodUnavailable.status = 503;

  const algodClient = createAlgodClient({
    error: algodUnavailable,
  });

  const result = await readV10DepositRecoveryState({
    algodClient,
    batch: makeBatch(),
  });

  assert.equal(result.outcome, 'network_error');
  assert.equal(result.confirmedRound, null);
  assert.equal(result.poolError, null);
  assert.match(result.reason, /Algod unavailable/);
});

test('treats bigint and string confirmation rounds as confirmed', async () => {
  const bigintResult = await readV10DepositRecoveryState({
    algodClient: createAlgodClient({
      response: {
        confirmedRound: 99n,
        poolError: '',
      },
    }),
    batch: makeBatch(),
  });

  assert.equal(bigintResult.outcome, 'confirmed');
  assert.equal(bigintResult.confirmedRound, '99');

  const stringResult = await readV10DepositRecoveryState({
    algodClient: createAlgodClient({
      response: {
        confirmedRound: '100',
        poolError: '',
      },
    }),
    batch: makeBatch(),
  });

  assert.equal(stringResult.outcome, 'confirmed');
  assert.equal(stringResult.confirmedRound, '100');
});

test('rejects invalid batches before calling Algod', async () => {
  const algodClient = createAlgodClient();

  await assert.rejects(
    () =>
      readV10DepositRecoveryState({
        algodClient,
        batch: makeBatch({
          status: 'recipient_snapshot_prepared',
        }),
      }),
    (error) =>
      error instanceof V10DepositRecoveryValidationError &&
      error.code === 'INVALID_BATCH_STATUS',
  );

  await assert.rejects(
    () =>
      readV10DepositRecoveryState({
        algodClient,
        batch: makeBatch({
          depositAttempt: null,
        }),
      }),
    (error) =>
      error instanceof V10DepositRecoveryValidationError &&
      error.code === 'MISSING_DEPOSIT_ATTEMPT',
  );

  await assert.rejects(
    () =>
      readV10DepositRecoveryState({
        algodClient,
        batch: makeBatch({
          depositAttempt: {
            ...makeBatch().depositAttempt,
            operation: 'wrong_operation',
          },
        }),
      }),
    (error) =>
      error instanceof V10DepositRecoveryValidationError &&
      error.code === 'INVALID_DEPOSIT_ATTEMPT_OPERATION',
  );

  await assert.rejects(
    () =>
      readV10DepositRecoveryState({
        algodClient,
        batch: makeBatch({
          depositAttempt: {
            ...makeBatch().depositAttempt,
            transactionIds: {
              usdcTransfer: USDC_TRANSFER_TX_ID,
              appCall: '',
            },
          },
        }),
      }),
    (error) =>
      error instanceof V10DepositRecoveryValidationError &&
      error.code === 'MISSING_APP_CALL_TRANSACTION_ID',
  );

  assert.deepEqual(algodClient.calls, []);
});

test('rejects a missing or invalid Algod client', async () => {
  await assert.rejects(
    () =>
      readV10DepositRecoveryState({
        algodClient: null,
        batch: makeBatch(),
      }),
    (error) =>
      error instanceof V10DepositRecoveryValidationError &&
      error.code === 'INVALID_ALGOD_CLIENT',
  );
});