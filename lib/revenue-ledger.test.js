// lib/revenue-ledger.test.js
import assert from 'node:assert/strict';

import {
  REVENUE_LEDGER_STATUSES,
  createHeldRevenueLedgerRow,
  createRevenueLedgerIdempotencyKey,
} from './revenue-ledger.js';

assert.deepEqual(REVENUE_LEDGER_STATUSES, [
  'held',
  'release_eligible',
  'batched',
  'deposited',
  'round_created',
  'settled',
  'voided',
]);

assert.equal(
  createRevenueLedgerIdempotencyKey({
    orderId: 'order-1001',
    orderItemId: 'MW-1001:item:1',
    licenseSnapshotId: 'ip-asset-a',
  }),
  'order-1001:MW-1001:item:1:ip-asset-a'
);

const now = new Date('2026-08-09T18:57:00.000Z');

const row = createHeldRevenueLedgerRow({
  orderId: 'order-1001',
  orderNumber: 'MW-1001',
  orderItemId: 'MW-1001:item:1',
  productId: 'product-1001',
  productVariantId: 'printful-variant-1001',
  quantity: 2,
  ipAssetId: 'ip-asset-a',
  revenuePoolAppId: 123456,
  revenueTokenAssetId: 789012,
  currency: 'usd',
  grossLicenseFeeCents: 750,
  platformFeeCents: 150,
  allocationCents: 600,
  usdcAtomicUnits: 6000000,
    calculationVersion: 'fixed_license_fee_20pct_v1',
    roundingPolicy: 'platform_fee_floor_creator_favorable_v1',
    licenseSnapshot: {
    licenseSnapshotId: 'ip-asset-a',
    ipAssetId: 'ip-asset-a',
    licensingFeeCents: 375,
    platformFeeBps: 2000,
    requiresSettlement: true,
    revenuePoolAppId: 123456,
    revenueTokenAssetId: 789012,
    lockedAt: '2026-08-09T00:00:00.000Z',
  },
  orderItemFinancialSnapshot: {
    orderItemId: 'MW-1001:item:1',
    quantityOrdered: 2,
    unitMerchandisePriceCents: 3000,
    merchandiseSubtotalCents: 6000,
  },
  now,
});

assert.equal(
  row.idempotencyKey,
  'order-1001:MW-1001:item:1:ip-asset-a'
);
assert.equal(row.status, 'held');
assert.equal(row.eligibilityEvent, 'delivered');
assert.equal(row.eligibleAt, null);
assert.equal(row.settlementBatchId, null);
assert.equal(row.usdcDepositTxId, null);
assert.equal(row.revenueRoundId, null);

assert.equal(row.currency, 'USD');
assert.equal(row.quantity, 2);
assert.equal(row.grossLicenseFeeCents, 750);
assert.equal(row.platformFeeCents, 150);
assert.equal(row.allocationCents, 600);
assert.equal(row.usdcAtomicUnits, 6000000);

assert.deepEqual(row.createdAt, now);
assert.deepEqual(row.updatedAt, now);

assert.throws(
  () =>
    createHeldRevenueLedgerRow({
      orderId: 'order-1001',
      orderNumber: 'MW-1001',
      orderItemId: 'MW-1001:item:1',
      productId: 'product-1001',
      quantity: 2,
      ipAssetId: 'ip-asset-a',
      revenuePoolAppId: 123456,
      revenueTokenAssetId: 789012,
      grossLicenseFeeCents: 750,
      platformFeeCents: 150,
      allocationCents: 599,
      usdcAtomicUnits: 5990000,
      calculationVersion: 'fixed_license_fee_20pct_v1',
      roundingPolicy: 'platform_fee_floor_creator_favorable_v1',
      licenseSnapshot: {
        licenseSnapshotId: 'ip-asset-a',
        ipAssetId: 'ip-asset-a',
      },
      orderItemFinancialSnapshot: {},
    }),
  /allocationCents must equal grossLicenseFeeCents minus platformFeeCents/
);

assert.throws(
  () =>
    createHeldRevenueLedgerRow({
      orderId: 'order-1001',
      orderNumber: 'MW-1001',
      orderItemId: 'MW-1001:item:1',
      productId: 'product-1001',
      quantity: 2,
      ipAssetId: 'ip-asset-a',
      revenuePoolAppId: 123456,
      revenueTokenAssetId: 789012,
      grossLicenseFeeCents: 750,
      platformFeeCents: 150,
      allocationCents: 600,
      usdcAtomicUnits: 6000001,
      calculationVersion: 'fixed_license_fee_20pct_v1',
      roundingPolicy: 'platform_fee_floor_creator_favorable_v1',
      licenseSnapshot: {
        licenseSnapshotId: 'ip-asset-a',
        ipAssetId: 'ip-asset-a',
      },
      orderItemFinancialSnapshot: {},
    }),
  /usdcAtomicUnits must equal allocationCents multiplied by 10000/
);

console.log('✅ revenue-ledger tests passed');