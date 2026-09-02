// lib/revenue-ledger-service.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import { createHeldRevenueLedgerEntriesForOrder } from './revenue-ledger-service.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeDb() {
  const rowsByIdempotencyKey = new Map();

  return {
    rowsByIdempotencyKey,
    collection(name) {
      assert.equal(name, 'revenue_ledger');

      return {
        async updateOne(filter, update, options) {
          assert.equal(options?.upsert, true);

          const idempotencyKey = filter?.idempotencyKey;

          if (rowsByIdempotencyKey.has(idempotencyKey)) {
            return {
              acknowledged: true,
              matchedCount: 1,
              modifiedCount: 0,
              upsertedCount: 0,
            };
          }

          const row = clone(update.$setOnInsert);
          rowsByIdempotencyKey.set(idempotencyKey, row);

          return {
            acknowledged: true,
            matchedCount: 0,
            modifiedCount: 0,
            upsertedCount: 1,
            upsertedId: idempotencyKey,
          };
        },

        async findOne(filter) {
          const row = rowsByIdempotencyKey.get(filter?.idempotencyKey);
          return row ? clone(row) : null;
        },
      };
    },
  };
}

function createPaidOrder() {
  return {
    _id: 'order-5001',
    orderNumber: 'MW-5001',
    status: 'paid',
    financialSnapshot: {
      currency: 'USD',
      merchandiseSubtotalCents: 9000,
      shippingCents: 800,
      taxCents: 740,
      discountCents: 0,
      customerTotalCents: 10540,
    },
    settlementPolicySnapshot: {
      eligibilityEvent: 'delivered',
      holdDays: 14,
    },
    items: [
      {
        orderItemId: 'MW-5001:item:1',
        productId: 'product-a',
        productVariantId: 'variant-a',
        quantityOrdered: 2,
        unitMerchandisePriceCents: 3000,
        merchandiseSubtotalCents: 6000,
        canonicalPricing: {
          pricingVersion: 'v1',
          retailPriceCents: 3000,
        },
        lockedLicensedRevenueTerms: [
          {
            licenseSnapshotId: 'ip-a',
            ipAssetId: 'ip-a',
            licensingFeeCents: 333,
            platformFeeBps: 2000,
            requiresSettlement: true,
            revenuePoolAppId: 1001,
            revenueTokenAssetId: 2001,
            lockedAt: '2026-08-09T00:00:00.000Z',
          },
          {
            licenseSnapshotId: 'ip-b',
            ipAssetId: 'ip-b',
            licensingFeeCents: 200,
            platformFeeBps: 2000,
            requiresSettlement: true,
            revenuePoolAppId: 1002,
            revenueTokenAssetId: 2002,
            lockedAt: '2026-08-09T00:00:00.000Z',
          },
        ],
      },
      {
        orderItemId: 'MW-5001:item:2',
        productId: 'product-b',
        productVariantId: 'variant-b',
        quantityOrdered: 1,
        unitMerchandisePriceCents: 3000,
        merchandiseSubtotalCents: 3000,
        canonicalPricing: {
          pricingVersion: 'v1',
          retailPriceCents: 3000,
        },
        lockedLicensedRevenueTerms: [
          {
            licenseSnapshotId: 'ip-c',
            ipAssetId: 'ip-c',
            licensingFeeCents: 100,
            platformFeeBps: 2000,
            requiresSettlement: true,
            revenuePoolAppId: 1003,
            revenueTokenAssetId: 2003,
            lockedAt: '2026-08-09T00:00:00.000Z',
          },
        ],
      },
    ],
  };
}

const db = createFakeDb();
const order = createPaidOrder();
const now = new Date('2026-08-09T19:02:00.000Z');

const firstRun = await createHeldRevenueLedgerEntriesForOrder({
  db,
  order,
  now,
});

assert.equal(firstRun.orderId, 'order-5001');
assert.equal(firstRun.createdCount, 3);
assert.equal(firstRun.existingCount, 0);
assert.equal(firstRun.rows.length, 3);
assert.equal(db.rowsByIdempotencyKey.size, 3);

const rowA = db.rowsByIdempotencyKey.get(
  'order-5001:MW-5001:item:1:ip_license:ip-a'
);

const rowB = db.rowsByIdempotencyKey.get(
  'order-5001:MW-5001:item:1:ip_license:ip-b'
);

const rowC = db.rowsByIdempotencyKey.get(
  'order-5001:MW-5001:item:2:ip_license:ip-c'
);

assert.equal(rowA.status, 'held');
assert.equal(rowA.allocationCents, 533);
assert.equal(rowA.usdcAtomicUnits, 5330000);
assert.equal(rowA.revenuePoolAppId, 1001);
assert.equal(rowA.orderItemId, 'MW-5001:item:1');

assert.equal(rowB.status, 'held');
assert.equal(rowB.allocationCents, 320);
assert.equal(rowB.usdcAtomicUnits, 3200000);
assert.equal(rowB.revenuePoolAppId, 1002);
assert.equal(rowB.orderItemId, 'MW-5001:item:1');

assert.equal(rowC.status, 'held');
assert.equal(rowC.allocationCents, 80);
assert.equal(rowC.usdcAtomicUnits, 800000);
assert.equal(rowC.revenuePoolAppId, 1003);
assert.equal(rowC.orderItemId, 'MW-5001:item:2');

const firstRunTotalCents = firstRun.rows.reduce(
  (total, row) => total + row.allocationCents,
  0
);

assert.equal(firstRunTotalCents, 933);

const retryRun = await createHeldRevenueLedgerEntriesForOrder({
  db,
  order: clone(order),
  now,
});

assert.equal(retryRun.createdCount, 0);
assert.equal(retryRun.existingCount, 3);
assert.equal(db.rowsByIdempotencyKey.size, 3);

const mismatchedOrder = clone(order);

mismatchedOrder.items[0].lockedLicensedRevenueTerms[0].licensingFeeCents = 334;

await assert.rejects(
  createHeldRevenueLedgerEntriesForOrder({
    db,
    order: mismatchedOrder,
    now,
  }),
  /Existing row immutable field mismatch: grossLicenseFeeCents/
);

await assert.rejects(
  createHeldRevenueLedgerEntriesForOrder({
    db: createFakeDb(),
    order: {
      ...createPaidOrder(),
      status: 'pending',
    },
    now,
  }),
  /Order must be persisted with status "paid"/
);

test('creates one idempotent product revenue row per order item', async () => {
  const db = createFakeDb();

  const order = {
    _id: 'order-product-5001',
    orderNumber: 'MW-PRODUCT-5001',
    status: 'paid',
    financialSnapshot: {
      currency: 'USD',
    },
    settlementPolicySnapshot: {
      eligibilityEvent: 'delivered',
    },
    items: [
      {
        orderItemId: 'MW-PRODUCT-5001:item:1',
        productId: 'product-5001',
        productVariantId: 'variant-5001',
        quantityOrdered: 2,
        unitMerchandisePriceCents: 1250,
        merchandiseSubtotalCents: 2500,
        canonicalPricing: {
          unitMerchandisePriceCents: 1250,
          merchandiseSubtotalCents: 2500,
        },
        lockedLicensedRevenueTerms: [],
        lockedProductRevenuePool: {
          poolKey: 'product-pool-5001',
          revenuePoolAppId: 7001,
          revenueTokenAssetId: 8001,
          tokenizationStatus: 'active',
          lockedAt: '2026-09-02T17:00:00.000Z',
        },
      },
    ],
  };

  const first = await createHeldRevenueLedgerEntriesForOrder({
    db,
    order,
    now: new Date('2026-09-02T17:00:00.000Z'),
  });

  assert.equal(first.createdCount, 1);
  assert.equal(first.existingCount, 0);
  assert.equal(first.rows.length, 1);

  const productRowKey =
    'order-product-5001:MW-PRODUCT-5001:item:1:product_revenue:product-pool-5001';

  const productRow = db.rowsByIdempotencyKey.get(productRowKey);

  assert.ok(productRow);
  assert.equal(productRow.revenueType, 'product_revenue');
  assert.equal(productRow.ipAssetId, null);
  assert.equal(productRow.poolKey, 'product-pool-5001');
  assert.equal(productRow.revenuePoolAppId, 7001);
  assert.equal(productRow.revenueTokenAssetId, 8001);
  assert.equal(productRow.grossLicenseFeeCents, 2500);
  assert.equal(productRow.platformFeeCents, 0);
  assert.equal(productRow.allocationCents, 2500);
  assert.equal(productRow.usdcAtomicUnits, 25000000);
  assert.equal(productRow.licenseSnapshot, null);
  assert.deepEqual(productRow.productRevenuePoolSnapshot, {
    poolKey: 'product-pool-5001',
    revenuePoolAppId: 7001,
    revenueTokenAssetId: 8001,
    tokenizationStatus: 'active',
    lockedAt: '2026-09-02T17:00:00.000Z',
  });

  const second = await createHeldRevenueLedgerEntriesForOrder({
    db,
    order,
    now: new Date('2026-09-02T17:01:00.000Z'),
  });

  assert.equal(second.createdCount, 0);
  assert.equal(second.existingCount, 1);
  assert.equal(second.rows.length, 1);
  assert.equal(db.rowsByIdempotencyKey.size, 1);
});

console.log('✅ revenue-ledger-service tests passed');