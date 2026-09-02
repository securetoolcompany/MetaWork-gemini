import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrderItemSnapshot } from './order-financial-snapshot.js';
import { createHeldRevenueLedgerEntriesForOrder } from './revenue-ledger-service.js';
import {
  transitionHeldLedgerRowsToReleaseEligible,
} from './revenue-ledger-eligibility.js';
import {
  createSettlementBatchFromEligibleRows,
} from './revenue-settlement-batches.js';

function clone(value) {
  return structuredClone(value);
}

function compareValues(left, right) {
  const leftValue = left instanceof Date ? left.getTime() : left;
  const rightValue = right instanceof Date ? right.getTime() : right;

  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

function matchesLeaseAvailability(row, now) {
  return [
    row.settlementLeaseId === null,
    row.settlementLeaseId === undefined,
    row.settlementLeaseExpiresAt &&
      new Date(row.settlementLeaseExpiresAt).getTime() <=
        new Date(now).getTime(),
  ].some(Boolean);
}

function matchesLedgerFilter(row, filter) {
  if (filter.idempotencyKey && row.idempotencyKey !== filter.idempotencyKey) {
    return false;
  }

  if (filter.orderId && row.orderId !== filter.orderId) {
    return false;
  }

  if (filter.status && row.status !== filter.status) {
    return false;
  }

  if (
    Object.prototype.hasOwnProperty.call(filter, 'settlementBatchId') &&
    row.settlementBatchId !== filter.settlementBatchId
  ) {
    return false;
  }

  if (
    filter.allocationCents?.$gt !== undefined &&
    !(row.allocationCents > filter.allocationCents.$gt)
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
    Object.prototype.hasOwnProperty.call(filter, 'poolKey') &&
    row.poolKey !== filter.poolKey
  ) {
    return false;
  }

  if (
    Object.prototype.hasOwnProperty.call(filter, 'revenueTokenAssetId') &&
    row.revenueTokenAssetId !== filter.revenueTokenAssetId
  ) {
    return false;
  }

  if (filter._id?.$in) {
    const matchedId = filter._id.$in.some(
      (id) => String(id) === String(row._id)
    );

    if (!matchedId) {
      return false;
    }
  }

  if (filter.$or && !matchesLeaseAvailability(row, filter.$or.find(
    (condition) => condition.settlementLeaseExpiresAt?.$lte
  )?.settlementLeaseExpiresAt?.$lte)) {
    return false;
  }

  return true;
}

function createFakeDb() {
  const rowsByIdempotencyKey = new Map();
  const batchesByKey = new Map();
  let nextLedgerId = 1;
  let nextBatchId = 1;

  const rows = () => [...rowsByIdempotencyKey.values()];

  return {
    rowsByIdempotencyKey,
    batchesByKey,

    collection(name) {
      if (name === 'revenue_ledger') {
        return {
          async updateOne(filter, update, options = {}) {
            if (options.upsert) {
              const idempotencyKey = String(filter.idempotencyKey);
              const existing = rowsByIdempotencyKey.get(idempotencyKey);

              if (existing) {
                return {
                  acknowledged: true,
                  matchedCount: 1,
                  modifiedCount: 0,
                  upsertedCount: 0,
                };
              }

              const row = {
                _id: `ledger-${nextLedgerId}`,
                ...clone(update.$setOnInsert),
              };

              nextLedgerId += 1;
              rowsByIdempotencyKey.set(idempotencyKey, row);

              return {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
                upsertedCount: 1,
                upsertedId: row._id,
              };
            }

            const row = rows().find(
              (candidate) =>
                String(candidate._id) === String(filter._id) &&
                candidate.status === filter.status
            );

            if (!row) {
              return {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
              };
            }

            Object.assign(row, clone(update.$set ?? {}));

            if (update.$push?.stateTransitions) {
              row.stateTransitions ??= [];
              row.stateTransitions.push(clone(update.$push.stateTransitions));
            }

            return {
              acknowledged: true,
              matchedCount: 1,
              modifiedCount: 1,
            };
          },

          async findOne(filter) {
            const row = rows().find((candidate) =>
              matchesLedgerFilter(candidate, filter)
            );

            return row ? clone(row) : null;
          },

          find(filter) {
            return {
              async toArray() {
                return rows()
                  .filter((row) => matchesLedgerFilter(row, filter))
                  .map(clone);
              },
            };
          },

          async findOneAndUpdate(filter, update, options = {}) {
            const row = rows()
              .filter((candidate) => matchesLedgerFilter(candidate, filter))
              .sort((left, right) => {
                const createdAtComparison = compareValues(
                  left.createdAt,
                  right.createdAt
                );

                if (createdAtComparison !== 0) {
                  return createdAtComparison;
                }

                return String(left._id).localeCompare(String(right._id));
              })[0];

            if (!row) {
              return null;
            }

            Object.assign(row, clone(update.$set ?? {}));

            return options.returnDocument === 'after' ? clone(row) : null;
          },

          async updateMany(filter, update) {
            const matchingRows = rows().filter((row) => {
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
              Object.assign(row, clone(update.$set ?? {}));

              if (update.$push?.stateTransitions) {
                row.stateTransitions ??= [];
                row.stateTransitions.push(clone(update.$push.stateTransitions));
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
          async findOneAndUpdate(filter, update, options = {}) {
            const batchKey = String(filter.batchKey);
            const existing = batchesByKey.get(batchKey);

            if (existing) {
              return clone(existing);
            }

            assert.equal(options.upsert, true);

            const batch = {
              _id: `batch-${nextBatchId}`,
              ...clone(update.$setOnInsert),
            };

            nextBatchId += 1;
            batchesByKey.set(batchKey, batch);

            return clone(batch);
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

function createLiveProduct() {
  return {
    id: 'product-checkout-snapshot',
    poolMetadata: {
      poolKey: 'product-level-live-pool',
      displayName: 'Original product pool metadata',
    },
    licensedRevenueTerms: [
      {
        licenseSnapshotId: 'ip-paid-a',
        ipAssetId: 'ip-paid-a',
        poolKey: 'pool-paid-a',
        licensingFeeCents: 375,
        platformFeeBps: 2000,
        requiresSettlement: true,
        revenuePoolAppId: 769218532,
        revenueTokenAssetId: 810001,
        lockedAt: '2026-08-20T16:00:00.000Z',
      },
      {
        licenseSnapshotId: 'ip-paid-b',
        ipAssetId: 'ip-paid-b',
        poolKey: 'pool-paid-b',
        licensingFeeCents: 200,
        platformFeeBps: 2000,
        requiresSettlement: true,
        revenuePoolAppId: 769218532,
        revenueTokenAssetId: 810002,
        lockedAt: '2026-08-20T16:00:00.000Z',
      },
      {
        licenseSnapshotId: 'ip-zero-fee',
        ipAssetId: 'ip-zero-fee',
        poolKey: 'pool-zero-fee',
        licensingFeeCents: 0,
        platformFeeBps: 2000,
        requiresSettlement: true,
        revenuePoolAppId: 769218532,
        revenueTokenAssetId: 810003,
        lockedAt: '2026-08-20T16:00:00.000Z',
      },
    ],
  };
}

test(
  'settles multi-IP checkout snapshots by frozen pool key after live records change',
  async () => {
    const db = createFakeDb();
    const checkoutAt = new Date('2026-08-20T16:00:00.000Z');
    const releaseAt = new Date('2026-09-04T16:00:00.000Z');
    const liveProduct = createLiveProduct();

    const checkoutItem = buildOrderItemSnapshot({
      orderItemId: 'MW-SNAPSHOT-9001:item:1',
      product: liveProduct,
      variant: {
        id: 'variant-checkout-snapshot',
        printfulCost: 12.5,
        placementCost: 1.25,
        metaWorkMarkup: 3,
        lockedIpFees: 5.75,
        cost: 22.5,
        retail_price: 35,
      },
      quantity: 2,
      unitMerchandisePrice: 35,
    });

    const order = {
      _id: 'order-checkout-snapshot-9001',
      orderNumber: 'MW-SNAPSHOT-9001',
      status: 'paid',
      financialSnapshot: {
        currency: 'USD',
        merchandiseSubtotalCents: checkoutItem.merchandiseSubtotalCents,
        shippingCents: 800,
        taxCents: 0,
        discountCents: 0,
        customerTotalCents: checkoutItem.merchandiseSubtotalCents + 800,
      },
      settlementPolicySnapshot: {
        eligibilityEvent: 'delivered',
        holdDays: 14,
      },
      items: [checkoutItem],
    };

    assert.deepEqual(
      checkoutItem.lockedLicensedRevenueTerms.map((term) => ({
        ipAssetId: term.ipAssetId,
        poolKey: term.poolKey,
        licensingFeeCents: term.licensingFeeCents,
        requiresSettlement: term.requiresSettlement,
      })),
      [
        {
          ipAssetId: 'ip-paid-a',
          poolKey: 'pool-paid-a',
          licensingFeeCents: 375,
          requiresSettlement: true,
        },
        {
          ipAssetId: 'ip-paid-b',
          poolKey: 'pool-paid-b',
          licensingFeeCents: 200,
          requiresSettlement: true,
        },
        {
          ipAssetId: 'ip-zero-fee',
          poolKey: 'pool-zero-fee',
          licensingFeeCents: 0,
          requiresSettlement: true,
        },
      ]
    );

    const firstLedgerRun = await createHeldRevenueLedgerEntriesForOrder({
      db,
      order,
      now: checkoutAt,
    });

    assert.equal(firstLedgerRun.createdCount, 2);
    assert.equal(firstLedgerRun.existingCount, 0);
    assert.equal(firstLedgerRun.rows.length, 2);

    const ledgerRowsAfterCheckout = [...db.rowsByIdempotencyKey.values()]
      .map(clone)
      .sort((left, right) => left.poolKey.localeCompare(right.poolKey));

    assert.deepEqual(
      ledgerRowsAfterCheckout.map((row) => ({
        orderId: row.orderId,
        orderItemId: row.orderItemId,
        ipAssetId: row.ipAssetId,
        poolKey: row.poolKey,
        allocationCents: row.allocationCents,
        usdcAtomicUnits: row.usdcAtomicUnits,
        status: row.status,
        licenseSnapshot: {
          ipAssetId: row.licenseSnapshot.ipAssetId,
          poolKey: row.licenseSnapshot.poolKey,
          licensingFeeCents: row.licenseSnapshot.licensingFeeCents,
        },
      })),
      [
        {
          orderId: 'order-checkout-snapshot-9001',
          orderItemId: 'MW-SNAPSHOT-9001:item:1',
          ipAssetId: 'ip-paid-a',
          poolKey: 'pool-paid-a',
          allocationCents: 600,
          usdcAtomicUnits: 6000000,
          status: 'held',
          licenseSnapshot: {
            ipAssetId: 'ip-paid-a',
            poolKey: 'pool-paid-a',
            licensingFeeCents: 375,
          },
        },
        {
          orderId: 'order-checkout-snapshot-9001',
          orderItemId: 'MW-SNAPSHOT-9001:item:1',
          ipAssetId: 'ip-paid-b',
          poolKey: 'pool-paid-b',
          allocationCents: 320,
          usdcAtomicUnits: 3200000,
          status: 'held',
          licenseSnapshot: {
            ipAssetId: 'ip-paid-b',
            poolKey: 'pool-paid-b',
            licensingFeeCents: 200,
          },
        },
      ]
    );

    assert.equal(
      checkoutItem.lockedLicensedRevenueTerms.some(
        (term) => term.poolKey === 'pool-zero-fee'
      ),
      true
    );

    assert.equal(
      [...db.rowsByIdempotencyKey.values()].some(
        (row) => row.poolKey === 'pool-zero-fee'
      ),
      false
    );

    liveProduct.licensedRevenueTerms[0].licensingFeeCents = 9999;
    liveProduct.licensedRevenueTerms.splice(1, 1);
    liveProduct.poolMetadata.poolKey = 'pool-live-record-mutated';
    liveProduct.poolMetadata.displayName = 'Mutated after checkout';

    assert.equal(
      checkoutItem.lockedLicensedRevenueTerms[0].licensingFeeCents,
      375
    );
    assert.equal(checkoutItem.lockedLicensedRevenueTerms[0].poolKey, 'pool-paid-a');
    assert.equal(checkoutItem.lockedLicensedRevenueTerms[1].poolKey, 'pool-paid-b');
    assert.equal(checkoutItem.lockedLicensedRevenueTerms.length, 3);

    const ledgerRetry = await createHeldRevenueLedgerEntriesForOrder({
      db,
      order,
      now: releaseAt,
    });

    assert.equal(ledgerRetry.createdCount, 0);
    assert.equal(ledgerRetry.existingCount, 2);
    assert.equal(db.rowsByIdempotencyKey.size, 2);

    const releaseResult = await transitionHeldLedgerRowsToReleaseEligible({
      db,
      orderId: order._id,
      actor: 'revenue-settlement-checkout-snapshot-test',
      now: releaseAt,
    });

    assert.equal(releaseResult.transitionedCount, 2);
    assert.equal(releaseResult.existingEligibleCount, 0);

    const firstBatch = await createSettlementBatchFromEligibleRows({
      db,
      orderId: order._id,
      now: releaseAt,
    });

    const secondBatch = await createSettlementBatchFromEligibleRows({
      db,
      orderId: order._id,
      now: releaseAt,
    });

    const noThirdBatch = await createSettlementBatchFromEligibleRows({
      db,
      orderId: order._id,
      now: releaseAt,
    });

    assert.deepEqual(
      [firstBatch, secondBatch]
        .sort((left, right) => left.poolKey.localeCompare(right.poolKey))
        .map((batch) => ({
          orderId: order._id,
          poolKey: batch.poolKey,
          revenuePoolAppId: batch.revenuePoolAppId,
          rowCount: batch.rowCount,
          totalAllocationCents: batch.totalAllocationCents,
          totalUsdcAtomicUnits: batch.totalUsdcAtomicUnits,
        })),
      [
        {
          orderId: 'order-checkout-snapshot-9001',
          poolKey: 'pool-paid-a',
          revenuePoolAppId: 769218532,
          rowCount: 1,
          totalAllocationCents: 600,
          totalUsdcAtomicUnits: 6000000,
        },
        {
          orderId: 'order-checkout-snapshot-9001',
          poolKey: 'pool-paid-b',
          revenuePoolAppId: 769218532,
          rowCount: 1,
          totalAllocationCents: 320,
          totalUsdcAtomicUnits: 3200000,
        },
      ]
    );

    assert.equal(noThirdBatch, null);
    assert.equal(db.batchesByKey.size, 2);

    const batchDocuments = [...db.batchesByKey.values()]
      .map(clone)
      .sort((left, right) => left.poolKey.localeCompare(right.poolKey));

    assert.equal(
      batchDocuments.reduce(
        (total, batch) => total + batch.totalAllocationCents,
        0
      ),
      920
    );

    assert.deepEqual(
      batchDocuments.map((batch) => ({
        poolKey: batch.poolKey,
        ledgerIdempotencyKeys: batch.ledgerIdempotencyKeys,
        totalAllocationCents: batch.totalAllocationCents,
      })),
      [
        {
          poolKey: 'pool-paid-a',
          ledgerIdempotencyKeys: [
            'order-checkout-snapshot-9001:MW-SNAPSHOT-9001:item:1:ip_license:ip-paid-a',
          ],
          totalAllocationCents: 600,
        },
        {
          poolKey: 'pool-paid-b',
          ledgerIdempotencyKeys: [
            'order-checkout-snapshot-9001:MW-SNAPSHOT-9001:item:1:ip_license:ip-paid-b',
          ],
          totalAllocationCents: 320,
        },
      ]
    );

    const batchedLedgerRows = [...db.rowsByIdempotencyKey.values()]
      .map(clone)
      .sort((left, right) => left.poolKey.localeCompare(right.poolKey));

    assert.deepEqual(
      batchedLedgerRows.map((row) => ({
        orderId: row.orderId,
        orderItemId: row.orderItemId,
        ipAssetId: row.ipAssetId,
        poolKey: row.poolKey,
        status: row.status,
        settlementBatchId: row.settlementBatchId,
        allocationCents: row.allocationCents,
      })),
      [
        {
          orderId: 'order-checkout-snapshot-9001',
          orderItemId: 'MW-SNAPSHOT-9001:item:1',
          ipAssetId: 'ip-paid-a',
          poolKey: 'pool-paid-a',
          status: 'batched',
          settlementBatchId: firstBatch.poolKey === 'pool-paid-a'
            ? firstBatch.batchId
            : secondBatch.batchId,
          allocationCents: 600,
        },
        {
          orderId: 'order-checkout-snapshot-9001',
          orderItemId: 'MW-SNAPSHOT-9001:item:1',
          ipAssetId: 'ip-paid-b',
          poolKey: 'pool-paid-b',
          status: 'batched',
          settlementBatchId: firstBatch.poolKey === 'pool-paid-b'
            ? firstBatch.batchId
            : secondBatch.batchId,
          allocationCents: 320,
        },
      ]
    );
  }
);