import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  RevenueSettlementRecipientSnapshotValidationError,
  V10_RECIPIENT_ROUNDING_POLICY,
  V10_RECIPIENT_SNAPSHOT_VERSION,
  prepareAndPersistV10DepositAttempt,
  prepareAndPersistV10RecipientSnapshot,
  prepareV10RecipientSnapshot,
  persistConfirmedV10DepositBatch,
} from './revenue-settlement-service.js';

function makeAddress() {
  return algosdk.generateAccount().addr.toString();
}

function makeBatch(overrides = {}) {
  return {
    _id: 'batch-1',
    batchKey: 'app:7001:pool:ip-a:token:8001:example',
    status: 'created',
    revenuePoolAppId: 7001,
    poolKey: 'ip-a',
    revenueTokenAssetId: 8001,
    totalAllocationCents: 100,
    totalUsdcAtomicUnits: 1_000_000,
    usdcDepositTxId: null,
    usdcDepositConfirmedAt: null,
    revenueRoundId: null,
    revenueRoundTxId: null,
    revenueRoundCreatedAt: null,
    ...overrides,
  };
}

function makeHolderSnapshot(entries, overrides = {}) {
  return {
    assetId: 8001,
    totalRevUnits: '10000',
    capturedAt: new Date('2026-08-18T14:00:00.000Z'),
    indexerRound: 100,
    algodStatusRound: 101,
    indexerLagRounds: 1,
    entries,
    ...overrides,
  };
}

function addressByteCompare(left, right) {
  return Buffer.compare(
    Buffer.from(algosdk.decodeAddress(left).publicKey),
    Buffer.from(algosdk.decodeAddress(right).publicKey),
  );
}

test('freezes V10 payees from the batch total and holder snapshot', () => {
  const alice = makeAddress();
  const bob = makeAddress();

  const result = prepareV10RecipientSnapshot({
    batch: makeBatch(),
    holderSnapshot: makeHolderSnapshot([
      { address: bob, revUnits: '3000' },
      { address: alice, revUnits: '7000' },
    ]),
    now: new Date('2026-08-18T14:01:00.000Z'),
  });

  assert.equal(result.batchId, 'batch-1');
  assert.equal(result.fromStatus, 'created');
  assert.equal(result.toStatus, 'recipient_snapshot_prepared');
  assert.equal(result.totalAllocationCents, 100);
  assert.equal(result.totalUsdcAtomicUnits, 1_000_000);

  assert.equal(result.roundPayeesVersion, V10_RECIPIENT_SNAPSHOT_VERSION);
  assert.equal(
    result.holderRoundingPolicy,
    V10_RECIPIENT_ROUNDING_POLICY,
  );

  assert.equal(result.holderSnapshot.assetId, 8001);
  assert.equal(result.holderSnapshot.totalRevUnits, '10000');
  assert.equal(result.holderSnapshot.entries.length, 2);

  assert.deepEqual(
    result.roundPayees,
    [
      {
        address: alice,
        revUnits: '7000',
        amountUsdcAtomicUnits: 700_000,
      },
      {
        address: bob,
        revUnits: '3000',
        amountUsdcAtomicUnits: 300_000,
      },
    ].sort((left, right) => addressByteCompare(left.address, right.address)),
  );

  assert.equal(
    result.roundPayees.reduce(
      (total, payee) => total + payee.amountUsdcAtomicUnits,
      0,
    ),
    1_000_000,
  );

  assert.match(result.holderSnapshot.canonicalHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(result.roundPayeesHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.roundPayeesFrozenAt.toISOString(), '2026-08-18T14:01:00.000Z');

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.roundPayees), true);
  assert.equal(Object.isFrozen(result.roundPayees[0]), true);
});

test('assigns all rounding residual to the largest REV holder', () => {
  const largestHolder = makeAddress();
  const smallerHolder = makeAddress();

  const result = prepareV10RecipientSnapshot({
    batch: makeBatch({
      totalAllocationCents: 1,
      totalUsdcAtomicUnits: 10_000,
    }),
    holderSnapshot: makeHolderSnapshot([
      { address: smallerHolder, revUnits: '3333' },
      { address: largestHolder, revUnits: '6667' },
    ]),
  });

  const largestPayee = result.roundPayees.find(
    (payee) => payee.address === largestHolder,
  );
  const smallerPayee = result.roundPayees.find(
    (payee) => payee.address === smallerHolder,
  );

  assert.equal(result.residualRecipientAddress, largestHolder);
  assert.equal(smallerPayee.amountUsdcAtomicUnits, 3333);
  assert.equal(largestPayee.amountUsdcAtomicUnits, 6667);
  assert.equal(
    largestPayee.amountUsdcAtomicUnits +
      smallerPayee.amountUsdcAtomicUnits,
    10_000,
  );
});

test('uses address-byte ordering to choose a residual recipient on equal balances', () => {
  const first = makeAddress();
  const second = makeAddress();
  const ordered = [first, second].sort(addressByteCompare);
  const residualRecipient = ordered[0];

  const result = prepareV10RecipientSnapshot({
    batch: makeBatch({
      totalAllocationCents: 1,
      totalUsdcAtomicUnits: 10_000,
    }),
    holderSnapshot: makeHolderSnapshot([
      { address: second, revUnits: '5000' },
      { address: first, revUnits: '5000' },
    ]),
  });

  assert.equal(result.residualRecipientAddress, residualRecipient);
  assert.equal(
    result.roundPayees.reduce(
      (total, payee) => total + payee.amountUsdcAtomicUnits,
      0,
    ),
    10_000,
  );
});

test('rejects batch money that does not reconcile from cents to USDC atomic units', () => {
  const holder = makeAddress();

  assert.throws(
    () =>
      prepareV10RecipientSnapshot({
        batch: makeBatch({
          totalAllocationCents: 100,
          totalUsdcAtomicUnits: 999_999,
        }),
        holderSnapshot: makeHolderSnapshot([
          { address: holder, revUnits: '10000' },
        ]),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'BATCH_TOTAL_MISMATCH',
  );
});

test('rejects batch statuses other than created', () => {
  const holder = makeAddress();

  assert.throws(
    () =>
      prepareV10RecipientSnapshot({
        batch: makeBatch({ status: 'deposit_submitted' }),
        holderSnapshot: makeHolderSnapshot([
          { address: holder, revUnits: '10000' },
        ]),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'INVALID_BATCH_STATUS',
  );
});

test('rejects a batch that already has recipient snapshot fields', () => {
  const holder = makeAddress();

  assert.throws(
    () =>
      prepareV10RecipientSnapshot({
        batch: makeBatch({
          holderSnapshot: { entries: [] },
        }),
        holderSnapshot: makeHolderSnapshot([
          { address: holder, revUnits: '10000' },
        ]),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'RECIPIENT_SNAPSHOT_ALREADY_PRESENT',
  );
});

test('rejects a holder snapshot whose balances do not equal the fixed REV supply', () => {
  const holder = makeAddress();

  assert.throws(
    () =>
      prepareV10RecipientSnapshot({
        batch: makeBatch(),
        holderSnapshot: makeHolderSnapshot([
          { address: holder, revUnits: '9999' },
        ]),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'REV_SUPPLY_MISMATCH',
  );
});

test('rejects duplicate holder entries', () => {
  const holder = makeAddress();

  assert.throws(
    () =>
      prepareV10RecipientSnapshot({
        batch: makeBatch(),
        holderSnapshot: makeHolderSnapshot([
          { address: holder, revUnits: '5000' },
          { address: holder, revUnits: '5000' },
        ]),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'DUPLICATE_HOLDER',
  );
});

test('rejects malformed holder round metadata', () => {
  const holder = makeAddress();

  assert.throws(
    () =>
      prepareV10RecipientSnapshot({
        batch: makeBatch(),
        holderSnapshot: makeHolderSnapshot(
          [{ address: holder, revUnits: '10000' }],
          {
            indexerRound: 100,
            algodStatusRound: 103,
            indexerLagRounds: 1,
          },
        ),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'HOLDER_SNAPSHOT_ROUND_MISMATCH',
  );
});

test('creates stable hashes despite input holder ordering', () => {
  const first = makeAddress();
  const second = makeAddress();
  const batch = makeBatch();

  const firstResult = prepareV10RecipientSnapshot({
    batch,
    holderSnapshot: makeHolderSnapshot([
      { address: first, revUnits: '7000' },
      { address: second, revUnits: '3000' },
    ]),
    now: new Date('2026-08-18T14:01:00.000Z'),
  });

  const secondResult = prepareV10RecipientSnapshot({
    batch,
    holderSnapshot: makeHolderSnapshot([
      { address: second, revUnits: '3000' },
      { address: first, revUnits: '7000' },
    ]),
    now: new Date('2026-08-18T14:01:00.000Z'),
  });

  assert.equal(
    firstResult.holderSnapshot.canonicalHash,
    secondResult.holderSnapshot.canonicalHash,
  );
  assert.equal(
    firstResult.roundPayeesHash,
    secondResult.roundPayeesHash,
  );
  assert.deepEqual(firstResult.roundPayees, secondResult.roundPayees);
});

test('does not mutate the input batch or holder snapshot', () => {
  const holder = makeAddress();
  const batch = makeBatch();
  const holderSnapshot = makeHolderSnapshot([
    { address: holder, revUnits: '10000' },
  ]);

  const originalBatch = structuredClone(batch);
  const originalHolderSnapshot = structuredClone(holderSnapshot);

  prepareV10RecipientSnapshot({
    batch,
    holderSnapshot,
  });

  assert.deepEqual(batch, originalBatch);
  assert.deepEqual(holderSnapshot, originalHolderSnapshot);
});

function clone(value) {
  return structuredClone(value);
}

function matchesRecipientSnapshotFilter(batch, filter) {
  return (
    batch._id === filter._id &&
    batch.status === filter.status &&
    batch.holderSnapshot === filter.holderSnapshot &&
    batch.roundPayees === filter.roundPayees &&
    batch.roundPayeesHash === filter.roundPayeesHash &&
    batch.roundPayeesFrozenAt === filter.roundPayeesFrozenAt
  );
}

function matchesDepositAttemptFilter(batch, filter) {
  return (
    batch._id === filter._id &&
    batch.status === filter.status &&
    batch.depositAttempt === filter.depositAttempt &&
    batch.holderSnapshot !== null &&
    batch.roundPayees !== null &&
    batch.roundPayeesHash !== null &&
    batch.roundPayeesFrozenAt !== null
  );
}

function createPersistenceDb({
  batch,
  recipientRaceWinner = null,
  malformedRecipientRaceWinner = false,
  depositRaceWinner = null,
  malformedDepositRaceWinner = false,
} = {}) {
  const state = {
    batch: clone(batch),
    findOneCalls: 0,
    findOneAndUpdateCalls: 0,
    recipientUpdateCalls: 0,
    depositUpdateCalls: 0,
    confirmDepositUpdateCalls: 0,
    };

  return {
    state,
    collection(name) {
      assert.equal(name, 'revenue_settlement_batches');

      return {
        async findOne(filter) {
          state.findOneCalls += 1;

          if (filter._id !== state.batch?._id) {
            return null;
          }

          return clone(state.batch);
        },

        async findOneAndUpdate(filter, update) {
            state.findOneAndUpdateCalls += 1;

            if (filter.status === 'created') {
                state.recipientUpdateCalls += 1;

                if (recipientRaceWinner) {
                state.batch = clone(recipientRaceWinner);

                if (malformedRecipientRaceWinner) {
                    state.batch.roundPayeesHash =
                    'sha256:not-a-valid-derived-hash';
                }

                return null;
                }

                if (!matchesRecipientSnapshotFilter(state.batch, filter)) {
                return null;
                }

                Object.assign(state.batch, clone(update.$set));

                return clone(state.batch);
            }

            if (filter.status === 'recipient_snapshot_prepared') {
                state.depositUpdateCalls += 1;

                if (depositRaceWinner) {
                state.batch = clone(depositRaceWinner);

                if (malformedDepositRaceWinner) {
                    state.batch.depositAttempt.unsignedTransactionHash =
                    'sha256:not-a-valid-deposit-hash';
                }

                return null;
                }

                if (!matchesDepositAttemptFilter(state.batch, filter)) {
                return null;
                }

                Object.assign(state.batch, clone(update.$set));

                return clone(state.batch);
            }

            if (
                Array.isArray(filter.status?.$in) &&
                filter.status.$in.includes('deposit_prepared') &&
                filter.status.$in.includes('deposit_submitted')
            ) {
                state.confirmDepositUpdateCalls =
                (state.confirmDepositUpdateCalls || 0) + 1;

                const appCallTxId =
                filter['depositAttempt.transactionIds.appCall'];

                const statusMatches = filter.status.$in.includes(
                state.batch.status,
                );

                const filterMatches =
                state.batch._id === filter._id &&
                statusMatches &&
                state.batch.usdcDepositTxId === null &&
                state.batch.usdcDepositConfirmedAt === null &&
                state.batch.depositAttempt?.operation ===
                    filter['depositAttempt.operation'] &&
                state.batch.depositAttempt?.transactionIds?.appCall ===
                    appCallTxId;

                if (!filterMatches) {
                return null;
                }

                const clonedSet = clone(update.$set);

                state.batch.status = clonedSet.status;
                state.batch.usdcDepositTxId =
                clonedSet.usdcDepositTxId;
                state.batch.usdcDepositConfirmedAt =
                clonedSet.usdcDepositConfirmedAt;
                state.batch.updatedAt = clonedSet.updatedAt;

                state.batch.depositAttempt = {
                ...state.batch.depositAttempt,
                status: clonedSet['depositAttempt.status'],
                confirmedAt:
                    clonedSet['depositAttempt.confirmedAt'],
                failureCode:
                    clonedSet['depositAttempt.failureCode'],
                failureMessage:
                    clonedSet['depositAttempt.failureMessage'],
                };

                return clone(state.batch);
            }

            throw new Error(
                `Unexpected conditional-update filter: ${JSON.stringify(
                filter,
                )}`,
            );
            },
      };
    },
  };
}

function makeSnapshotIndexerClient(entries) {
  let calls = 0;

  return {
    get calls() {
      return calls;
    },

    lookupAssetBalances() {
      return {
        async do() {
          calls += 1;

          return {
            balances: entries.map((entry) => ({
              address: entry.address,
              amount: entry.revUnits,
            })),
            'current-round': 100,
          };
        },
      };
    },
  };
}

function makeSnapshotAlgodClient() {
  let calls = 0;

  return {
    get calls() {
      return calls;
    },

    status() {
      return {
        async do() {
          calls += 1;
          return { 'last-round': 101 };
        },
      };
    },
  };
}

function makePersistableBatch(overrides = {}) {
  return {
    ...makeBatch(),
    holderSnapshot: null,
    roundPayeesVersion: null,
    holderRoundingPolicy: null,
    residualRecipientAddress: null,
    roundPayees: null,
    roundPayeesHash: null,
    roundPayeesFrozenAt: null,
    depositAttempt: null,
    ...overrides,
  };
}

test('persists a recipient snapshot once and leaves ledger state outside this unit', async () => {
  const alice = makeAddress();
  const bob = makeAddress();
  const db = createPersistenceDb({
    batch: makePersistableBatch(),
  });
  const indexerClient = makeSnapshotIndexerClient([
    { address: alice, revUnits: '7000' },
    { address: bob, revUnits: '3000' },
  ]);
  const algodClient = makeSnapshotAlgodClient();

  const result = await prepareAndPersistV10RecipientSnapshot({
    db,
    batchId: 'batch-1',
    indexerClient,
    algodClient,
    now: new Date('2026-08-18T15:00:00.000Z'),
  });

  assert.equal(result.status, 'recipient_snapshot_prepared');
  assert.equal(result.totalUsdcAtomicUnits, 1_000_000);
  assert.equal(result.holderSnapshot.entries.length, 2);
  assert.equal(result.roundPayees.length, 2);
  assert.equal(
    result.roundPayees.reduce(
      (total, payee) => total + payee.amountUsdcAtomicUnits,
      0,
    ),
    1_000_000,
  );

  assert.equal(indexerClient.calls, 1);
  assert.equal(algodClient.calls, 1);
  assert.equal(db.state.findOneAndUpdateCalls, 1);

  assert.equal(
    db.state.batch.status,
    'recipient_snapshot_prepared',
  );
  assert.equal(db.state.batch.usdcDepositTxId, null);
  assert.equal(db.state.batch.revenueRoundId, null);
  assert.equal(db.state.batch.roundPayeesFrozenAt.toISOString(), '2026-08-18T15:00:00.000Z');
});

test('returns the existing frozen snapshot without Indexer or Algod calls on retry', async () => {
  const holder = makeAddress();
  const baseBatch = makePersistableBatch();

  const prepared = prepareV10RecipientSnapshot({
    batch: baseBatch,
    holderSnapshot: makeHolderSnapshot([
      { address: holder, revUnits: '10000' },
    ]),
    now: new Date('2026-08-18T15:00:00.000Z'),
  });

  const db = createPersistenceDb({
    batch: {
      ...baseBatch,
      status: 'recipient_snapshot_prepared',

      holderSnapshot: prepared.holderSnapshot,
      roundPayeesVersion: prepared.roundPayeesVersion,
      holderRoundingPolicy: prepared.holderRoundingPolicy,
      residualRecipientAddress:
        prepared.residualRecipientAddress,
      roundPayees: prepared.roundPayees,
      roundPayeesHash: prepared.roundPayeesHash,
      roundPayeesFrozenAt:
        prepared.roundPayeesFrozenAt,

      depositAttempt: null,
    },
  });

  const indexerClient = makeSnapshotIndexerClient([]);
  const algodClient = makeSnapshotAlgodClient();

  const result = await prepareAndPersistV10RecipientSnapshot({
    db,
    batchId: 'batch-1',
    indexerClient,
    algodClient,
  });

  assert.equal(result.status, 'recipient_snapshot_prepared');
  assert.equal(result.roundPayees.length, 1);
  assert.equal(result.roundPayees[0].address, holder);
  assert.equal(indexerClient.calls, 0);
  assert.equal(algodClient.calls, 0);
  assert.equal(db.state.findOneAndUpdateCalls, 0);
});

test('rejects a batch that is not created or already recipient-snapshot prepared', async () => {
  const holder = makeAddress();
  const db = createPersistenceDb({
    batch: makePersistableBatch({
      status: 'deposit_submitted',
    }),
  });
  const indexerClient = makeSnapshotIndexerClient([
    { address: holder, revUnits: '10000' },
  ]);
  const algodClient = makeSnapshotAlgodClient();

  await assert.rejects(
    () =>
      prepareAndPersistV10RecipientSnapshot({
        db,
        batchId: 'batch-1',
        indexerClient,
        algodClient,
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'INVALID_BATCH_STATUS',
  );

  assert.equal(indexerClient.calls, 0);
  assert.equal(algodClient.calls, 0);
  assert.equal(db.state.findOneAndUpdateCalls, 0);
});

test('returns a valid concurrent winner instead of overwriting it', async () => {
  const winnerHolder = makeAddress();
  const callerHolder = makeAddress();
  const baseBatch = makePersistableBatch();

  const winnerPrepared = prepareV10RecipientSnapshot({
    batch: baseBatch,
    holderSnapshot: makeHolderSnapshot([
      { address: winnerHolder, revUnits: '10000' },
    ]),
    now: new Date('2026-08-18T15:01:00.000Z'),
  });

  const raceWinner = {
    ...baseBatch,
    status: 'recipient_snapshot_prepared',
    holderSnapshot: winnerPrepared.holderSnapshot,
    roundPayeesVersion: winnerPrepared.roundPayeesVersion,
    holderRoundingPolicy: winnerPrepared.holderRoundingPolicy,
    residualRecipientAddress: winnerPrepared.residualRecipientAddress,
    roundPayees: winnerPrepared.roundPayees,
    roundPayeesHash: winnerPrepared.roundPayeesHash,
    roundPayeesFrozenAt: winnerPrepared.roundPayeesFrozenAt,
  };

  const db = createPersistenceDb({
    batch: baseBatch,
    recipientRaceWinner: raceWinner,
  });
  const indexerClient = makeSnapshotIndexerClient([
    { address: callerHolder, revUnits: '10000' },
  ]);
  const algodClient = makeSnapshotAlgodClient();

  const result = await prepareAndPersistV10RecipientSnapshot({
    db,
    batchId: 'batch-1',
    indexerClient,
    algodClient,
  });

  assert.equal(result.status, 'recipient_snapshot_prepared');
  assert.equal(result.roundPayees[0].address, winnerHolder);
  assert.notEqual(result.roundPayees[0].address, callerHolder);
  assert.equal(db.state.findOneAndUpdateCalls, 1);
});

test('fails closed when a concurrent winner contains malformed recipient data', async () => {
  const holder = makeAddress();
  const baseBatch = makePersistableBatch();
  const winnerPrepared = prepareV10RecipientSnapshot({
    batch: baseBatch,
    holderSnapshot: makeHolderSnapshot([
      { address: holder, revUnits: '10000' },
    ]),
    now: new Date('2026-08-18T15:01:00.000Z'),
  });

  const db = createPersistenceDb({
    batch: baseBatch,

    recipientRaceWinner: {
        ...baseBatch,
        status: 'recipient_snapshot_prepared',

        holderSnapshot: winnerPrepared.holderSnapshot,
        roundPayeesVersion: winnerPrepared.roundPayeesVersion,
        holderRoundingPolicy: winnerPrepared.holderRoundingPolicy,
        residualRecipientAddress:
        winnerPrepared.residualRecipientAddress,
        roundPayees: winnerPrepared.roundPayees,
        roundPayeesHash: winnerPrepared.roundPayeesHash,
        roundPayeesFrozenAt:
        winnerPrepared.roundPayeesFrozenAt,

        depositAttempt: null,
    },

    malformedRecipientRaceWinner: true,
    });
  const indexerClient = makeSnapshotIndexerClient([
    { address: holder, revUnits: '10000' },
  ]);
  const algodClient = makeSnapshotAlgodClient();

  await assert.rejects(
    () =>
      prepareAndPersistV10RecipientSnapshot({
        db,
        batchId: 'batch-1',
        indexerClient,
        algodClient,
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'PERSISTED_RECIPIENT_SNAPSHOT_MISMATCH',
  );
});

test('rejects a missing settlement batch without network calls', async () => {
  const db = {
    collection(name) {
      assert.equal(name, 'revenue_settlement_batches');

      return {
        async findOne() {
          return null;
        },
        async findOneAndUpdate() {
          throw new Error('findOneAndUpdate must not be called');
        },
      };
    },
  };

  const indexerClient = makeSnapshotIndexerClient([]);
  const algodClient = makeSnapshotAlgodClient();

  await assert.rejects(
    () =>
      prepareAndPersistV10RecipientSnapshot({
        db,
        batchId: 'missing-batch',
        indexerClient,
        algodClient,
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'BATCH_NOT_FOUND',
  );

  assert.equal(indexerClient.calls, 0);
  assert.equal(algodClient.calls, 0);
});

function makeRecipientSnapshotPreparedBatch({
  holderAddress = makeAddress(),
  overrides = {},
} = {}) {
  const baseBatch = makePersistableBatch(overrides);

  const recipientPrepared = prepareV10RecipientSnapshot({
    batch: baseBatch,
    holderSnapshot: makeHolderSnapshot([
      { address: holderAddress, revUnits: '10000' },
    ]),
    now: new Date('2026-08-18T16:00:00.000Z'),
  });

  return {
    ...baseBatch,
    status: 'recipient_snapshot_prepared',
    holderSnapshot: recipientPrepared.holderSnapshot,
    roundPayeesVersion: recipientPrepared.roundPayeesVersion,
    holderRoundingPolicy: recipientPrepared.holderRoundingPolicy,
    residualRecipientAddress:
      recipientPrepared.residualRecipientAddress,
    roundPayees: recipientPrepared.roundPayees,
    roundPayeesHash: recipientPrepared.roundPayeesHash,
    roundPayeesFrozenAt:
      recipientPrepared.roundPayeesFrozenAt,
    depositAttempt: null,
  };
}

function makeUnsignedDepositPreflight(batch) {
  return {
    ok: true,
    proposedGroup: {
      action: 'deposit_usdc',
      transactionCount: 2,
      usdcTransferTransactionIndex: 0,
      appCallTransactionIndex: 1,
      groupId: '77eDlzaYNNGGVqWwllRxEm9Z2PfPo5lWJ5riQ+R9d5E=',
      transactionIds: {
        usdcTransfer:
          'WB3X4KSDBITJBA5MMVD6AMPP3KWBDDFQHVYYGHAJN2SLXK3N23OQ',
        appCall:
          'XA4PYHD3BUSRCJ6O2K7FYTSKKAVVXUVI7D6ZFTXH3HIPMVDVLQPA',
      },
      unsignedTransactionHash:
        'sha256:ebc42a1427966bbe56c184ba5055ef0d18146637af80d95e6fd5fccce586b45e',
    },

    unsignedGroup: {
      target: {
        revenuePoolAppId: batch.revenuePoolAppId,
        poolKey: batch.poolKey,
        revenueTokenAssetId: null,
        usdcAssetId: 10458941,
      },

      amountUsdcAtomicUnits: batch.totalUsdcAtomicUnits,

      groupId: '77eDlzaYNNGGVqWwllRxEm9Z2PfPo5lWJ5riQ+R9d5E=',
      transactionCount: 2,
      usdcTransferTransactionIndex: 0,
      appCallTransactionIndex: 1,

      transactionIds: {
        usdcTransfer:
          'WB3X4KSDBITJBA5MMVD6AMPP3KWBDDFQHVYYGHAJN2SLXK3N23OQ',
        appCall:
          'XA4PYHD3BUSRCJ6O2K7FYTSKKAVVXUVI7D6ZFTXH3HIPMVDVLQPA',
      },

      unsignedTransactionsBase64: [
        'i6RhYW10zgAPQkCkYXJjdsQg1MFavE4sljyZlCBa7Fwg9A9WXDgWo8zeruLNm2qQJrWjZmVlzQPoomZ2ZKNnZW6sdGVzdG5ldC12MS4womdoxCABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAaNncnDEIO+3g5c2mDTRhlalsJZUcRJvWdj3z6OZViea4kPkfXeRomx2zQRMo3NuZMQg3LOTB+4dfXoQ5WMX/qSSvLi721g6EEQNFkC8ThPmch2kdHlwZaVheGZlcqR4YWlkzgCflz0=',
        'jKRhcGFhk8QMZGVwb3NpdF91c2RjxARpcC1hxAgAAAAAAAAAAKRhcGFzkc4An5c9pGFwYniRgaFuxAZwX2lwLWGkYXBpZM0bWaNmZWXNB9CiZnZko2dlbqx0ZXN0bmV0LXYxLjCiZ2jEIAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBo2dycMQg77eDlzaYNNGGVqWwllRxEm9Z2PfPo5lWJ5riQ+R9d5GibHbNBEyjc25kxCDcs5MH7h19ehDlYxf+pJK8uLvbWDoQRA0WQLxOE+ZyHaR0eXBlpGFwcGw=',
      ],

      unsignedTransactionHash:
        'sha256:ebc42a1427966bbe56c184ba5055ef0d18146637af80d95e6fd5fccce586b45e',
    },
  };
}

function createPreflightStub({
  resultFactory = makeUnsignedDepositPreflight,
} = {}) {
  let calls = 0;

  return {
    get calls() {
      return calls;
    },

    async preflightLive({ batch }) {
      calls += 1;
      return resultFactory(batch);
    },
  };
}

function makeConfirmedRecovery(overrides = {}) {
  return {
    outcome: 'confirmed',
    appCallTransactionId:
      'XA4PYHD3BUSRCJ6O2K7FYTSKKAVVXUVI7D6ZFTXH3HIPMVDVLQPA',
    confirmedRound: '123456',
    ...overrides,
  };
}

async function createDepositPreparedBatchForConfirmation() {
  const baseBatch = makeRecipientSnapshotPreparedBatch();
  const db = createPersistenceDb({
    batch: baseBatch,
  });
  const preflight = createPreflightStub();

  await prepareAndPersistV10DepositAttempt({
    db,
    batchId: 'batch-1',
    preflightLive: preflight.preflightLive,
    now: new Date('2026-08-18T16:10:00.000Z'),
  });

  return {
    db,
    batch: db.state.batch,
  };
}

test('persists confirmed V10 deposit facts on the batch only', async () => {
  const { db } =
    await createDepositPreparedBatchForConfirmation();

  const result = await persistConfirmedV10DepositBatch({
    db,
    batchId: 'batch-1',
    recovery: makeConfirmedRecovery(),
    confirmedAt: new Date('2026-08-18T16:11:00.000Z'),
  });

  assert.equal(
    result.status,
    'deposit_confirmed_pending_ledger',
  );
  assert.equal(
    result.usdcDepositTxId,
    'XA4PYHD3BUSRCJ6O2K7FYTSKKAVVXUVI7D6ZFTXH3HIPMVDVLQPA',
  );
  assert.equal(
    result.usdcDepositConfirmedAt.toISOString(),
    '2026-08-18T16:11:00.000Z',
  );
  assert.equal(result.confirmedRound, '123456');

  assert.equal(
    result.depositAttempt.status,
    'confirmed',
  );
  assert.equal(
    result.depositAttempt.confirmedAt.toISOString(),
    '2026-08-18T16:11:00.000Z',
  );
  assert.equal(result.depositAttempt.failureCode, null);
  assert.equal(result.depositAttempt.failureMessage, null);

  assert.equal(db.state.confirmDepositUpdateCalls, 1);
  assert.equal(
    db.state.batch.status,
    'deposit_confirmed_pending_ledger',
  );
  assert.equal(
    db.state.batch.usdcDepositTxId,
    result.usdcDepositTxId,
  );
  assert.equal(
    db.state.batch.usdcDepositConfirmedAt.toISOString(),
    '2026-08-18T16:11:00.000Z',
  );
  assert.equal(
    db.state.batch.revenueRoundId,
    null,
  );
});

test('returns the existing confirmed batch state idempotently', async () => {
  const { db } =
    await createDepositPreparedBatchForConfirmation();

  await persistConfirmedV10DepositBatch({
    db,
    batchId: 'batch-1',
    recovery: makeConfirmedRecovery(),
    confirmedAt: new Date('2026-08-18T16:11:00.000Z'),
  });

  const retry = await persistConfirmedV10DepositBatch({
    db,
    batchId: 'batch-1',
    recovery: makeConfirmedRecovery(),
    confirmedAt: new Date('2026-08-18T16:12:00.000Z'),
  });

  assert.equal(
    retry.status,
    'deposit_confirmed_pending_ledger',
  );
  assert.equal(
    retry.usdcDepositConfirmedAt.toISOString(),
    '2026-08-18T16:11:00.000Z',
  );
  assert.equal(
    db.state.confirmDepositUpdateCalls,
    1,
  );
});

test('rejects non-confirmed recovery outcomes without writing', async () => {
  const outcomes = [
    'pending',
    'unknown',
    'rejected',
    'network_error',
  ];

  for (const outcome of outcomes) {
    const { db } =
      await createDepositPreparedBatchForConfirmation();

    await assert.rejects(
      () =>
        persistConfirmedV10DepositBatch({
          db,
          batchId: 'batch-1',
          recovery: makeConfirmedRecovery({
            outcome,
          }),
        }),
      (error) =>
        error instanceof RevenueSettlementRecipientSnapshotValidationError &&
        error.code === 'DEPOSIT_NOT_CONFIRMED',
    );

    assert.equal(db.state.confirmDepositUpdateCalls, 0);
    assert.equal(db.state.batch.status, 'deposit_prepared');
    assert.equal(db.state.batch.usdcDepositTxId, null);
  }
});

test('rejects a confirmed recovery transaction ID that conflicts with the durable attempt', async () => {
  const { db } =
    await createDepositPreparedBatchForConfirmation();

  await assert.rejects(
    () =>
      persistConfirmedV10DepositBatch({
        db,
        batchId: 'batch-1',
        recovery: makeConfirmedRecovery({
          appCallTransactionId:
            'DIFFERENTCONFIRMEDAPPCALLTXID',
        }),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'CONFIRMED_DEPOSIT_TRANSACTION_MISMATCH',
  );

  assert.equal(db.state.confirmDepositUpdateCalls, 0);
  assert.equal(db.state.batch.status, 'deposit_prepared');
  assert.equal(db.state.batch.usdcDepositTxId, null);
});

test('rejects invalid confirmation source batch statuses without writing', async () => {
  const batch = makeRecipientSnapshotPreparedBatch();
  const db = createPersistenceDb({ batch });

  await assert.rejects(
    () =>
      persistConfirmedV10DepositBatch({
        db,
        batchId: 'batch-1',
        recovery: makeConfirmedRecovery(),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'INVALID_CONFIRM_DEPOSIT_BATCH_STATUS',
  );

  assert.equal(db.state.confirmDepositUpdateCalls, 0);
});

test('rejects missing confirmed round and missing batch without writing', async () => {
  const { db } =
    await createDepositPreparedBatchForConfirmation();

  await assert.rejects(
    () =>
      persistConfirmedV10DepositBatch({
        db,
        batchId: 'batch-1',
        recovery: makeConfirmedRecovery({
          confirmedRound: '0',
        }),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'INVALID_CONFIRMED_ROUND',
  );

  assert.equal(db.state.confirmDepositUpdateCalls, 0);

  const missingDb = {
    collection(name) {
      assert.equal(name, 'revenue_settlement_batches');

      return {
        async findOne() {
          return null;
        },
        async findOneAndUpdate() {
          throw new Error(
            'findOneAndUpdate must not run for missing batch',
          );
        },
      };
    },
  };

  await assert.rejects(
    () =>
      persistConfirmedV10DepositBatch({
        db: missingDb,
        batchId: 'missing-batch',
        recovery: makeConfirmedRecovery(),
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'BATCH_NOT_FOUND',
  );
});