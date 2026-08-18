// lib/revenue-settlement-batches.test.js
import assert from 'node:assert/strict';

import {
  REVENUE_SETTLEMENT_BATCH_STATUSES,
  createSettlementBatchFromEligibleRows,
} from './revenue-settlement-batches.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compareValues(left, right) {
  const leftTime = left instanceof Date ? left.getTime() : left;
  const rightTime = right instanceof Date ? right.getTime() : right;

  if (leftTime < rightTime) return -1;
  if (leftTime > rightTime) return 1;
  return 0;
}

function matchesLeaseAvailability(row, now) {
  const conditions = [
    row.settlementLeaseId === null,
    row.settlementLeaseId === undefined,
    row.settlementLeaseExpiresAt &&
      new Date(row.settlementLeaseExpiresAt).getTime() <=
        new Date(now).getTime(),
  ];

  return conditions.some(Boolean);
}

function matchesLedgerFilter(row, filter) {
  if (filter.status && row.status !== filter.status) {
    return false;
  }

  if (filter.orderId && row.orderId !== filter.orderId) {
    return false;
  }

  if (
    Object.prototype.hasOwnProperty.call(filter, 'settlementBatchId') &&
    row.settlementBatchId !== filter.settlementBatchId
  ) {
    return false;
  }

  if (
    Object.prototype.hasOwnProperty.call(filter, 'revenuePoolAppId') &&
    row.revenuePoolAppId !== filter.revenuePoolAppId
  ) {
    return false;
  }

  if (
    Object.prototype.hasOwnProperty.call(filter, 'ipAssetId') &&
    row.ipAssetId !== filter.ipAssetId
  ) {
    return false;
  }

  if (
    Object.prototype.hasOwnProperty.call(filter, 'revenueTokenAssetId') &&
    row.revenueTokenAssetId !== filter.revenueTokenAssetId
  ) {
    return false;
  }

  if (filter.$or) {
    const expiresCondition = filter.$or.find(
      (condition) => condition.settlementLeaseExpiresAt?.$lte
    );

    const now = expiresCondition?.settlementLeaseExpiresAt?.$lte;

    if (!matchesLeaseAvailability(row, now)) {
      return false;
    }
  }

  return true;
}

function createFakeDb() {
  const rows = [
    {
      _id: 'ledger-a',
      orderId: 'order-1',
      idempotencyKey: 'order-1:item-1:ip-a',
      status: 'release_eligible',
      settlementBatchId: null,
      settlementLeaseId: null,
      settlementLeaseExpiresAt: null,
      revenuePoolAppId: 7001,
      ipAssetId: 'ip-a',
      revenueTokenAssetId: 8001,
      allocationCents: 533,
      usdcAtomicUnits: 5330000,
      createdAt: new Date('2026-08-09T19:00:00.000Z'),
      stateTransitions: [],
    },
    {
      _id: 'ledger-b',
      orderId: 'order-1',
      idempotencyKey: 'order-1:item-2:ip-a',
      status: 'release_eligible',
      settlementBatchId: null,
      settlementLeaseId: null,
      settlementLeaseExpiresAt: null,
      revenuePoolAppId: 7001,
      ipAssetId: 'ip-a',
      revenueTokenAssetId: 8001,
      allocationCents: 320,
      usdcAtomicUnits: 3200000,
      createdAt: new Date('2026-08-09T19:01:00.000Z'),
      stateTransitions: [],
    },
    {
      _id: 'ledger-c',
      idempotencyKey: 'order-2:item-1:ip-b',
      orderId: 'order-2',
      status: 'release_eligible',
      settlementBatchId: null,
      settlementLeaseId: null,
      settlementLeaseExpiresAt: null,
      revenuePoolAppId: 7001,
      ipAssetId: 'ip-b',
      revenueTokenAssetId: 8002,
      allocationCents: 80,
      usdcAtomicUnits: 800000,
      createdAt: new Date('2026-08-09T19:02:00.000Z'),
      stateTransitions: [],
    },
  ];

  const batches = [];
  let nextBatchNumber = 1;

  return {
    rows,
    batches,

    collection(name) {
      if (name === 'revenue_ledger') {
        return {
          async findOneAndUpdate(filter, update, options) {
            const candidates = rows
              .filter((row) => matchesLedgerFilter(row, filter))
              .sort((left, right) => {
                const createdAtComparison = compareValues(
                  left.createdAt,
                  right.createdAt
                );

                if (createdAtComparison !== 0) {
                  return createdAtComparison;
                }

                return String(left._id).localeCompare(String(right._id));
              });

            const row = candidates[0];

            if (!row) {
              return null;
            }

            Object.assign(row, clone(update.$set));

            return clone(row);
          },

          async updateMany(filter, update) {
            const matchingRows = rows.filter((row) => {
              const rowIdMatches = filter._id?.$in?.some(
                (id) => String(id) === String(row._id)
              );

              return (
                rowIdMatches &&
                row.settlementLeaseId === filter.settlementLeaseId &&
                row.status === filter.status &&
                row.settlementBatchId === filter.settlementBatchId
              );
            });

            for (const row of matchingRows) {
              Object.assign(row, clone(update.$set));

              if (update.$push?.stateTransitions) {
                row.stateTransitions.push(
                  clone(update.$push.stateTransitions)
                );
              }
            }

            return {
              acknowledged: true,
              matchedCount: matchingRows.length,
              modifiedCount: matchingRows.length,
            };
          },
        };
      }

      if (name === 'revenue_settlement_batches') {
        return {
          async findOneAndUpdate(filter, update, options) {
            const existing = batches.find(
              (batch) => batch.batchKey === filter.batchKey
            );

            if (existing) {
              return clone(existing);
            }

            assert.equal(options?.upsert, true);

            const batch = {
              _id: `batch-${nextBatchNumber}`,
              ...clone(update.$setOnInsert),
            };

            nextBatchNumber += 1;
            batches.push(batch);

            return clone(batch);
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

assert.deepEqual(REVENUE_SETTLEMENT_BATCH_STATUSES, [
  'created',
  'recipient_snapshot_prepared',
  'deposit_prepared',
  'deposit_submitted',
  'deposit_confirmed_pending_ledger',
  'deposited',
  'round_created',
  'settled',
  'failed',
]);

const db = createFakeDb();
const now = new Date('2026-08-09T19:16:00.000Z');

const firstBatch = await createSettlementBatchFromEligibleRows({
  db,
  orderId: 'order-1',
  now,
});

assert.equal(firstBatch.status, 'created');
assert.equal(firstBatch.revenuePoolAppId, 7001);
assert.equal(firstBatch.poolKey, 'ip-a');
assert.equal(firstBatch.revenueTokenAssetId, 8001);
assert.equal(firstBatch.rowCount, 2);
assert.equal(firstBatch.totalAllocationCents, 853);
assert.equal(firstBatch.totalUsdcAtomicUnits, 8530000);

const ledgerA = db.rows.find((row) => row._id === 'ledger-a');
const ledgerB = db.rows.find((row) => row._id === 'ledger-b');
const ledgerC = db.rows.find((row) => row._id === 'ledger-c');

assert.equal(ledgerA.status, 'batched');
assert.equal(ledgerB.status, 'batched');
assert.equal(ledgerC.status, 'release_eligible');
assert.equal(ledgerC.orderId, 'order-2');
assert.equal(ledgerA.settlementBatchId, firstBatch.batchId);
assert.equal(ledgerB.settlementBatchId, firstBatch.batchId);
assert.equal(ledgerA.settlementLeaseId, null);
assert.equal(ledgerB.settlementLeaseId, null);

assert.equal(ledgerA.stateTransitions.length, 1);
assert.deepEqual(ledgerA.stateTransitions[0], {
  fromStatus: 'release_eligible',
  toStatus: 'batched',
  actor: 'settlement_batch_service',
  reason: 'eligible_rows_batched',
  occurredAt: '2026-08-09T19:16:00.000Z',
  settlementBatchId: 'batch-1',
});

const secondBatch = await createSettlementBatchFromEligibleRows({
  db,
  now,
});

assert.equal(secondBatch.status, 'created');
assert.equal(secondBatch.poolKey, 'ip-b');
assert.equal(secondBatch.rowCount, 1);
assert.equal(secondBatch.totalAllocationCents, 80);
assert.equal(secondBatch.totalUsdcAtomicUnits, 800000);

assert.equal(ledgerC.status, 'batched');
assert.equal(ledgerC.settlementBatchId, secondBatch.batchId);
assert.notEqual(secondBatch.batchId, firstBatch.batchId);
assert.notEqual(secondBatch.batchKey, firstBatch.batchKey);

const noEligibleRows = await createSettlementBatchFromEligibleRows({
  db,
  now,
});

assert.equal(noEligibleRows, null);
assert.equal(db.batches.length, 2);

const conflictDb = createFakeDb();

conflictDb.batches.push({
  _id: 'conflicting-batch',
  batchKey:
    'app:7001:pool:ip-a:token:8001:b97c273070b976d0189ae516a258e2ce4c592af21230addefdc7f75966fd946e',
  status: 'created',
  revenuePoolAppId: 7001,
  poolKey: 'ip-a',
  revenueTokenAssetId: 8001,
  ledgerRowIds: ['ledger-a', 'ledger-b'],
  ledgerIdempotencyKeys: [
    'order-1:item-1:ip-a',
    'order-1:item-2:ip-a',
  ],
  totalAllocationCents: 854,
  totalUsdcAtomicUnits: 8540000,
  createdAt: now,
  updatedAt: now,
});

await assert.rejects(
  () =>
    createSettlementBatchFromEligibleRows({
      db: conflictDb,
      orderId: 'order-1',
      now,
    }),
  /Existing batch immutable field mismatch: totalAllocationCents/
);

const conflictLedgerA = conflictDb.rows.find((row) => row._id === 'ledger-a');
const conflictLedgerB = conflictDb.rows.find((row) => row._id === 'ledger-b');

assert.equal(conflictLedgerA.status, 'release_eligible');
assert.equal(conflictLedgerB.status, 'release_eligible');
assert.equal(conflictLedgerA.settlementBatchId, null);
assert.equal(conflictLedgerB.settlementBatchId, null);

console.log('✅ revenue-settlement-batches tests passed');