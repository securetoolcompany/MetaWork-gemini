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
  materializeConfirmedDepositIntoLedger,
  createPayoutRoundFromMaterializedDeposit,
  preparePayoutRoundDistribution,
} from './revenue-settlement-service.js';
import {
  buildV10DepositHeldUsdcGroup,
} from './revenue-pool-v10-deposit.js';

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
  const depositor = makeAddress();

  const unsignedGroup = buildV10DepositHeldUsdcGroup({
    revenuePoolAppId: batch.revenuePoolAppId,
    usdcAssetId: 10458941,
    depositorAddress: depositor,
    poolKey: batch.poolKey,
    usdcAtomicUnits: batch.totalUsdcAtomicUnits,
    suggestedParams: {
			fee: 1000,
			minFee: 1000,
			firstValid: 123456,
			lastValid: 124456,
			genesisHash: new Uint8Array(32).fill(1),
			genesisID: 'testnet-v1.0',
		},
  });

		return {
			ok: true,

			unsignedGroup,

			proposedGroup: {
				action: 'deposit_held',
				transactionCount: 2,
				usdcTransferTransactionIndex: 0,
				appCallTransactionIndex: 1,

				groupId: unsignedGroup.groupId,
				unsignedTransactionHash: unsignedGroup.unsignedTransactionHash,

				transactionIds: {
					usdcTransfer: unsignedGroup.transactionIds.usdcTransfer,
					appCall: unsignedGroup.transactionIds.appCall,
				},
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

function makeConfirmedRecovery({
  appCallTransactionId =
    'XA4PYHD3BUSRCJ6O2K7FYTSKKAVVXUVI7D6ZFTXH3HIPMVDVLQPA',
  ...overrides
} = {}) {
  return {
    outcome: 'confirmed',
    appCallTransactionId,
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
    recovery: makeConfirmedRecovery({
			appCallTransactionId:
				db.state.batch.depositAttempt.transactionIds.appCall,
		}),
    confirmedAt: new Date('2026-08-18T16:11:00.000Z'),
  });

  assert.equal(
    result.status,
    'deposit_confirmed_pending_ledger',
  );
  assert.equal(
		result.depositAttempt.transactionIds.appCall,
		db.state.batch.depositAttempt.transactionIds.appCall,
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
    recovery: makeConfirmedRecovery({
			appCallTransactionId:
				db.state.batch.depositAttempt.transactionIds.appCall,
		}),
    confirmedAt: new Date('2026-08-18T16:11:00.000Z'),
  });

  const retry = await persistConfirmedV10DepositBatch({
    db,
    batchId: 'batch-1',
    recovery: makeConfirmedRecovery({
			appCallTransactionId:
				db.state.batch.depositAttempt.transactionIds.appCall,
		}),
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

function createMaterializationTestDb(batch) {
  const state = {
    batch: clone(batch),
    materializations: [],
    batchUpdateCalls: 0,
    materializationInsertCalls: 0,
  };

  return {
    state,

    collection(name) {
      if (name === 'revenue_settlement_batches') {
        return {
          async findOne(filter) {
            if (filter._id !== state.batch?._id) {
              return null;
            }

            return clone(state.batch);
          },

          async findOneAndUpdate(filter, update) {
            state.batchUpdateCalls += 1;

            const matches =
              filter._id === state.batch?._id &&
              filter.status ===
                'deposit_confirmed_pending_ledger' &&
              state.batch.status ===
                'deposit_confirmed_pending_ledger' &&
              filter.usdcDepositTxId ===
                state.batch.usdcDepositTxId &&
              new Date(
                filter.usdcDepositConfirmedAt,
              ).getTime() ===
                new Date(
                  state.batch.usdcDepositConfirmedAt,
                ).getTime() &&
              filter.roundPayeesHash ===
                state.batch.roundPayeesHash;

            if (!matches) {
              return null;
            }

            Object.assign(state.batch, clone(update.$set));

            return clone(state.batch);
          },
        };
      }

      if (
        name ===
        'revenue_settlement_deposit_ledger_materializations'
      ) {
        return {
          async findOne(filter) {
            const materialization = state.materializations.find(
              (candidate) =>
                candidate.materializationKey ===
                filter.materializationKey,
            );

            return materialization ? clone(materialization) : null;
          },

          async insertOne(document) {
            state.materializationInsertCalls += 1;

            if (
              state.materializations.some(
                (candidate) =>
                  candidate.materializationKey ===
                  document.materializationKey,
              )
            ) {
              const error = new Error(
                'duplicate materialization key',
              );
              error.code = 11000;
              throw error;
            }

            const stored = {
              _id: `materialization-${state.materializations.length + 1}`,
              ...clone(document),
            };

            state.materializations.push(stored);

            return {
              acknowledged: true,
              insertedId: stored._id,
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

async function createConfirmedDepositBatchForMaterialization() {
  const { db } =
    await createDepositPreparedBatchForConfirmation();

  await persistConfirmedV10DepositBatch({
    db,
    batchId: 'batch-1',
    recovery: makeConfirmedRecovery({
			appCallTransactionId:
				db.state.batch.depositAttempt.transactionIds.appCall,
		}),
    confirmedAt: new Date('2026-08-18T16:11:00.000Z'),
  });

  return clone(db.state.batch);
}

test('materializes one confirmed V10 deposit into durable ledger data', async () => {
  const batch =
    await createConfirmedDepositBatchForMaterialization();
  const db = createMaterializationTestDb(batch);

  const result = await materializeConfirmedDepositIntoLedger({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:12:00.000Z'),
  });

  assert.equal(result.batchId, 'batch-1');
  assert.equal(
    result.materializationKey,
    'batch-1:confirmed-deposit-ledger:v1',
  );
  assert.equal(result.status, 'materialized');
  assert.equal(
    result.usdcDepositTxId,
    batch.usdcDepositTxId,
  );
  assert.equal(
    result.totalUsdcAtomicUnits,
    batch.totalUsdcAtomicUnits,
  );
  assert.equal(
    result.roundPayeesHash,
    batch.roundPayeesHash,
  );

  assert.equal(db.state.materializations.length, 1);
  assert.equal(db.state.materializationInsertCalls, 1);
  assert.equal(db.state.batchUpdateCalls, 1);
  assert.equal(db.state.batch.status, 'deposited');
  assert.equal(
    db.state.batch.depositLedgerMaterializationKey,
    'batch-1:confirmed-deposit-ledger:v1',
  );
  assert.equal(db.state.batch.revenueRoundId, null);
  assert.equal(db.state.batch.revenueRoundTxId, null);
});

test('returns the existing deposit ledger materialization on retry', async () => {
  const batch =
    await createConfirmedDepositBatchForMaterialization();
  const db = createMaterializationTestDb(batch);

  const first = await materializeConfirmedDepositIntoLedger({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:12:00.000Z'),
  });

  const retry = await materializeConfirmedDepositIntoLedger({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:13:00.000Z'),
  });

  assert.equal(retry.materializationKey, first.materializationKey);
  assert.equal(db.state.materializations.length, 1);
  assert.equal(db.state.materializationInsertCalls, 1);
  assert.equal(db.state.batchUpdateCalls, 1);
  assert.equal(db.state.batch.status, 'deposited');
});

test('rejects a batch that is not deposit_confirmed_pending_ledger', async () => {
  const batch =
    await createConfirmedDepositBatchForMaterialization();

  batch.status = 'deposit_prepared';

  const db = createMaterializationTestDb(batch);

  await assert.rejects(
    () =>
      materializeConfirmedDepositIntoLedger({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code ===
        'INVALID_DEPOSIT_LEDGER_MATERIALIZATION_BATCH_STATUS',
  );

  assert.equal(db.state.materializations.length, 0);
  assert.equal(db.state.materializationInsertCalls, 0);
  assert.equal(db.state.batchUpdateCalls, 0);
  assert.equal(db.state.batch.status, 'deposit_prepared');
});

test('rejects a malformed frozen recipient snapshot without writes', async () => {
  const batch =
    await createConfirmedDepositBatchForMaterialization();

  batch.roundPayees[0].amountUsdcAtomicUnits -= 1;

  const db = createMaterializationTestDb(batch);

  await assert.rejects(
    () =>
      materializeConfirmedDepositIntoLedger({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'PERSISTED_RECIPIENT_SNAPSHOT_MISMATCH',
  );

  assert.equal(db.state.materializations.length, 0);
  assert.equal(db.state.materializationInsertCalls, 0);
  assert.equal(db.state.batchUpdateCalls, 0);
  assert.equal(
    db.state.batch.status,
    'deposit_confirmed_pending_ledger',
  );
});

test('rejects a conflicting durable materialization without overwriting it', async () => {
  const batch =
    await createConfirmedDepositBatchForMaterialization();
  const db = createMaterializationTestDb(batch);

  db.state.materializations.push({
    _id: 'materialization-existing',
    materializationKey:
      'batch-1:confirmed-deposit-ledger:v1',
    batchId: 'batch-1',
    batchKey: batch.batchKey,
    status: 'materialized',
    sourceStatus: 'deposit_confirmed_pending_ledger',
    revenuePoolAppId: batch.revenuePoolAppId,
    poolKey: batch.poolKey,
    revenueTokenAssetId: batch.revenueTokenAssetId,
    totalAllocationCents: batch.totalAllocationCents,
    totalUsdcAtomicUnits:
      batch.totalUsdcAtomicUnits + 1,
    usdcDepositTxId: batch.usdcDepositTxId,
    usdcDepositConfirmedAt: batch.usdcDepositConfirmedAt,
    confirmedRound: batch.confirmedRound,
    holderSnapshot: batch.holderSnapshot,
    roundPayeesVersion: batch.roundPayeesVersion,
    holderRoundingPolicy: batch.holderRoundingPolicy,
    residualRecipientAddress:
      batch.residualRecipientAddress,
    roundPayees: batch.roundPayees,
    roundPayeesHash: batch.roundPayeesHash,
    roundPayeesFrozenAt: batch.roundPayeesFrozenAt,
    createdAt: new Date('2026-08-18T16:12:00.000Z'),
    updatedAt: new Date('2026-08-18T16:12:00.000Z'),
  });

  await assert.rejects(
    () =>
      materializeConfirmedDepositIntoLedger({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'DEPOSIT_LEDGER_MATERIALIZATION_CONFLICT',
  );

  assert.equal(db.state.materializations.length, 1);
  assert.equal(db.state.materializationInsertCalls, 0);
  assert.equal(db.state.batchUpdateCalls, 0);
  assert.equal(
    db.state.batch.status,
    'deposit_confirmed_pending_ledger',
  );
});

function createPayoutRoundTestDb({
  batch,
  materialization,
  payoutRounds = [],
} = {}) {
  const state = {
    batch: clone(batch),
    materializations: [clone(materialization)],
    payoutRounds: payoutRounds.map(clone),
    batchUpdateCalls: 0,
    payoutRoundInsertCalls: 0,
  };

  return {
    state,

    collection(name) {
      if (name === 'revenue_settlement_batches') {
        return {
          async findOne(filter) {
            if (filter._id !== state.batch?._id) {
              return null;
            }

            return clone(state.batch);
          },

          async findOneAndUpdate(filter, update) {
            state.batchUpdateCalls += 1;

            const matches =
              filter._id === state.batch?._id &&
              filter.status === 'deposited' &&
              state.batch.status === 'deposited' &&
              filter.depositLedgerMaterializationKey ===
                state.batch.depositLedgerMaterializationKey &&
              filter.roundPayeesHash === state.batch.roundPayeesHash &&
              filter.revenueRoundId === null &&
              filter.revenueRoundTxId === null &&
              filter.revenueRoundCreatedAt === null;

            if (!matches) {
              return null;
            }

            Object.assign(state.batch, clone(update.$set));

            return clone(state.batch);
          },
        };
      }

      if (
        name ===
        'revenue_settlement_deposit_ledger_materializations'
      ) {
        return {
          async findOne(filter) {
            const materialization = state.materializations.find(
              (candidate) =>
                candidate.materializationKey ===
                filter.materializationKey,
            );

            return materialization ? clone(materialization) : null;
          },
        };
      }

      if (name === 'revenue_payout_rounds') {
        return {
          async findOne(filter) {
            const payoutRound = state.payoutRounds.find(
              (candidate) =>
                candidate.payoutRoundKey === filter.payoutRoundKey,
            );

            return payoutRound ? clone(payoutRound) : null;
          },

          async insertOne(document) {
            state.payoutRoundInsertCalls += 1;

            if (
              state.payoutRounds.some(
                (candidate) =>
                  candidate.payoutRoundKey ===
                  document.payoutRoundKey,
              )
            ) {
              const error = new Error('duplicate payout round key');
              error.code = 11000;
              throw error;
            }

            const stored = {
              _id: `payout-round-${state.payoutRounds.length + 1}`,
              ...clone(document),
            };

            state.payoutRounds.push(stored);

            return {
              acknowledged: true,
              insertedId: stored._id,
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

async function createDepositedBatchAndMaterializationForRound() {
  const confirmedBatch =
    await createConfirmedDepositBatchForMaterialization();
  const materializationDb =
    createMaterializationTestDb(confirmedBatch);

  const materialization =
    await materializeConfirmedDepositIntoLedger({
      db: materializationDb,
      batchId: 'batch-1',
      now: new Date('2026-08-18T16:12:00.000Z'),
    });

  return {
    batch: clone(materializationDb.state.batch),
    materialization: clone(materializationDb.state.materializations[0]),
  };
}

test('creates one payout round from a materialized V10 deposit', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  const result = await createPayoutRoundFromMaterializedDeposit({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:13:00.000Z'),
  });

  assert.equal(
    result.payoutRoundKey,
    'batch-1:payout-round:v1',
  );
  assert.equal(result.status, 'created');
  assert.equal(result.batchId, 'batch-1');
  assert.equal(
    result.depositLedgerMaterializationKey,
    'batch-1:confirmed-deposit-ledger:v1',
  );
  assert.equal(
    result.totalUsdcAtomicUnits,
    batch.totalUsdcAtomicUnits,
  );
  assert.equal(result.roundPayeesHash, batch.roundPayeesHash);

  assert.equal(db.state.payoutRounds.length, 1);
  assert.equal(db.state.payoutRoundInsertCalls, 1);
  assert.equal(db.state.batchUpdateCalls, 1);
  assert.equal(db.state.batch.status, 'round_created');
  assert.equal(
    db.state.batch.revenueRoundId,
    'batch-1:payout-round:v1',
  );
  assert.equal(db.state.batch.revenueRoundTxId, null);
  assert.equal(
    db.state.batch.revenueRoundCreatedAt.toISOString(),
    '2026-08-18T16:13:00.000Z',
  );
});

test('returns the existing payout round on retry without duplicate writes', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  const first = await createPayoutRoundFromMaterializedDeposit({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:13:00.000Z'),
  });

  const retry = await createPayoutRoundFromMaterializedDeposit({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:14:00.000Z'),
  });

  assert.equal(retry.payoutRoundKey, first.payoutRoundKey);
  assert.equal(db.state.payoutRounds.length, 1);
  assert.equal(db.state.payoutRoundInsertCalls, 1);
  assert.equal(db.state.batchUpdateCalls, 1);
  assert.equal(db.state.batch.status, 'round_created');
});

test('rejects payout-round creation outside deposited status', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  batch.status = 'deposit_confirmed_pending_ledger';

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  await assert.rejects(
    () =>
      createPayoutRoundFromMaterializedDeposit({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'INVALID_PAYOUT_ROUND_BATCH_STATUS',
  );

  assert.equal(db.state.payoutRounds.length, 0);
  assert.equal(db.state.payoutRoundInsertCalls, 0);
  assert.equal(db.state.batchUpdateCalls, 0);
});

test('rejects a missing deposit ledger materialization without writes', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  db.state.materializations = [];

  await assert.rejects(
    () =>
      createPayoutRoundFromMaterializedDeposit({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'MISSING_DEPOSIT_LEDGER_MATERIALIZATION',
  );

  assert.equal(db.state.payoutRounds.length, 0);
  assert.equal(db.state.payoutRoundInsertCalls, 0);
  assert.equal(db.state.batchUpdateCalls, 0);
});

test('rejects a materialization that conflicts with batch facts without writes', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  materialization.totalUsdcAtomicUnits += 1;

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  await assert.rejects(
    () =>
      createPayoutRoundFromMaterializedDeposit({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'PAYOUT_ROUND_MATERIALIZATION_MISMATCH',
  );

  assert.equal(db.state.payoutRounds.length, 0);
  assert.equal(db.state.payoutRoundInsertCalls, 0);
  assert.equal(db.state.batchUpdateCalls, 0);
});

test('rejects a conflicting payout round without overwriting it', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
    payoutRounds: [
      {
        _id: 'payout-round-existing',
        payoutRoundKey: 'batch-1:payout-round:v1',
        batchId: 'batch-1',
        batchKey: batch.batchKey,
        status: 'created',
        revenuePoolAppId: batch.revenuePoolAppId,
        poolKey: batch.poolKey,
        revenueTokenAssetId: batch.revenueTokenAssetId,
        totalAllocationCents: batch.totalAllocationCents,
        totalUsdcAtomicUnits: batch.totalUsdcAtomicUnits + 1,
        depositLedgerMaterializationKey:
          batch.depositLedgerMaterializationKey,
        usdcDepositTxId: materialization.usdcDepositTxId,
        usdcDepositConfirmedAt:
          materialization.usdcDepositConfirmedAt,
        confirmedRound: materialization.confirmedRound,
        holderSnapshot: materialization.holderSnapshot,
        roundPayeesVersion:
          materialization.roundPayeesVersion,
        holderRoundingPolicy:
          materialization.holderRoundingPolicy,
        residualRecipientAddress:
          materialization.residualRecipientAddress,
        roundPayees: materialization.roundPayees,
        roundPayeesHash: materialization.roundPayeesHash,
        roundPayeesFrozenAt:
          materialization.roundPayeesFrozenAt,
        createdAt: new Date('2026-08-18T16:13:00.000Z'),
        updatedAt: new Date('2026-08-18T16:13:00.000Z'),
      },
    ],
  });

  await assert.rejects(
    () =>
      createPayoutRoundFromMaterializedDeposit({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'PAYOUT_ROUND_CONFLICT',
  );

  assert.equal(db.state.payoutRounds.length, 1);
  assert.equal(db.state.payoutRoundInsertCalls, 0);
  assert.equal(db.state.batchUpdateCalls, 0);
  assert.equal(db.state.batch.status, 'deposited');
});

test('prepares deterministic read-only payout instructions from a created round', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  await createPayoutRoundFromMaterializedDeposit({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:13:00.000Z'),
  });

  const beforeBatch = clone(db.state.batch);
  const beforeRounds = clone(db.state.payoutRounds);
  const beforeBatchUpdateCalls = db.state.batchUpdateCalls;
  const beforeRoundInsertCalls = db.state.payoutRoundInsertCalls;

  const result = await preparePayoutRoundDistribution({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:14:00.000Z'),
  });

  assert.equal(result.status, 'ready_for_distribution');
  assert.equal(result.batchId, 'batch-1');
  assert.equal(
    result.payoutRoundKey,
    'batch-1:payout-round:v1',
  );
  assert.equal(
    result.totalUsdcAtomicUnits,
    1_000_000,
  );
  assert.equal(
    result.payoutInstructions.reduce(
      (total, instruction) =>
        total + instruction.amountUsdcAtomicUnits,
      0,
    ),
    1_000_000,
  );

  assert.deepEqual(
    result.payoutInstructions,
    [
      {
        instructionIndex: 0,
        recipientAddress: batch.roundPayees[0].address,
        amountUsdcAtomicUnits:
          batch.roundPayees[0].amountUsdcAtomicUnits,
      },
    ],
  );

  assert.deepEqual(db.state.batch, beforeBatch);
  assert.deepEqual(db.state.payoutRounds, beforeRounds);
  assert.equal(
    db.state.batchUpdateCalls,
    beforeBatchUpdateCalls,
  );
  assert.equal(
    db.state.payoutRoundInsertCalls,
    beforeRoundInsertCalls,
  );
});

test('returns the same payout instructions on read-only retry', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  await createPayoutRoundFromMaterializedDeposit({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:13:00.000Z'),
  });

  const first = await preparePayoutRoundDistribution({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:14:00.000Z'),
  });

  const retry = await preparePayoutRoundDistribution({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:15:00.000Z'),
  });

  assert.deepEqual(
    retry.payoutInstructions,
    first.payoutInstructions,
  );
  assert.equal(
    retry.totalUsdcAtomicUnits,
    first.totalUsdcAtomicUnits,
  );
  assert.equal(db.state.batch.status, 'round_created');
  assert.equal(db.state.batchUpdateCalls, 1);
  assert.equal(db.state.payoutRoundInsertCalls, 1);
});

test('rejects payout distribution for a batch outside round_created', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  await assert.rejects(
    () =>
      preparePayoutRoundDistribution({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'INVALID_PAYOUT_DISTRIBUTION_BATCH_STATUS',
  );

  assert.equal(db.state.payoutRounds.length, 0);
  assert.equal(db.state.batchUpdateCalls, 0);
  assert.equal(db.state.payoutRoundInsertCalls, 0);
});

test('rejects a missing payout round without writes', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  await createPayoutRoundFromMaterializedDeposit({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:13:00.000Z'),
  });

  db.state.payoutRounds = [];

  const beforeBatch = clone(db.state.batch);

  await assert.rejects(
    () =>
      preparePayoutRoundDistribution({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'PAYOUT_ROUND_NOT_FOUND',
  );

  assert.deepEqual(db.state.batch, beforeBatch);
  assert.equal(db.state.batchUpdateCalls, 1);
  assert.equal(db.state.payoutRoundInsertCalls, 1);
});

test('rejects a payout round with a tampered recipient amount without writes', async () => {
  const { batch, materialization } =
    await createDepositedBatchAndMaterializationForRound();

  const db = createPayoutRoundTestDb({
    batch,
    materialization,
  });

  await createPayoutRoundFromMaterializedDeposit({
    db,
    batchId: 'batch-1',
    now: new Date('2026-08-18T16:13:00.000Z'),
  });

  db.state.payoutRounds[0].roundPayees[0].amountUsdcAtomicUnits -= 1;

  const beforeBatch = clone(db.state.batch);
  const beforeRounds = clone(db.state.payoutRounds);

  await assert.rejects(
    () =>
      preparePayoutRoundDistribution({
        db,
        batchId: 'batch-1',
      }),
    (error) =>
      error instanceof RevenueSettlementRecipientSnapshotValidationError &&
      error.code === 'PAYOUT_DISTRIBUTION_TOTAL_MISMATCH',
  );

  assert.deepEqual(db.state.batch, beforeBatch);
  assert.deepEqual(db.state.payoutRounds, beforeRounds);
  assert.equal(db.state.batchUpdateCalls, 1);
  assert.equal(db.state.payoutRoundInsertCalls, 1);
});