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
    revenueType: 'ip_license',
    sourceSnapshotId: 'ip-asset-a',
  }),
  'order-1001:MW-1001:item:1:ip_license:ip-asset-a'
);

assert.equal(
  createRevenueLedgerIdempotencyKey({
    orderId: 'order-product-1001',
    orderItemId: 'MW-PRODUCT-1001:item:1',
    revenueType: 'product_revenue',
    sourceSnapshotId: 'product-pool-1001',
  }),
  'order-product-1001:MW-PRODUCT-1001:item:1:product_revenue:product-pool-1001'
);

const now = new Date('2026-08-09T18:57:00.000Z');

const ipLicenseSnapshot = {
  licenseSnapshotId: 'ip-asset-a',
  ipAssetId: 'ip-asset-a',
  licensingFeeCents: 375,
  platformFeeBps: 2000,
  requiresSettlement: true,
  revenuePoolAppId: 123456,
  revenueTokenAssetId: 789012,
  lockedAt: '2026-08-09T00:00:00.000Z',
};

const row = createHeldRevenueLedgerRow({
  orderId: 'order-1001',
  orderNumber: 'MW-1001',
  orderItemId: 'MW-1001:item:1',
  productId: 'product-1001',
  productVariantId: 'printful-variant-1001',
  quantity: 2,

  revenueType: 'ip_license',
  sourceSnapshot: ipLicenseSnapshot,

  poolKey: 'pool-ip-asset-a',
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

  licenseSnapshot: ipLicenseSnapshot,
  orderItemFinancialSnapshot: {
    orderItemId: 'MW-1001:item:1',
    productId: 'product-1001',
    productVariantId: 'printful-variant-1001',
    quantityOrdered: 2,
    unitMerchandisePriceCents: 3500,
    merchandiseSubtotalCents: 7000,
    canonicalPricing: {
      pricingVersion: 'v1',
      printfulCostCents: 1500,
      placementCostCents: 100,
      metaWorkMarkupCents: 400,
      lockedIpFeesCents: 500,
      costCents: 2000,
      retailPriceCents: 3500,
    },
  },

  now,
});

assert.equal(
  row.idempotencyKey,
  'order-1001:MW-1001:item:1:ip_license:ip-asset-a'
);
assert.equal(row.revenueType, 'ip_license');
assert.equal(row.status, 'held');
assert.equal(row.eligibilityEvent, 'delivered');
assert.equal(row.eligibleAt, null);
assert.equal(row.settlementBatchId, null);
assert.equal(row.usdcDepositTxId, null);
assert.equal(row.revenueRoundId, null);

assert.equal(row.currency, 'USD');
assert.equal(row.quantity, 2);
assert.equal(row.ipAssetId, 'ip-asset-a');
assert.equal(row.grossLicenseFeeCents, 750);
assert.equal(row.platformFeeCents, 150);
assert.equal(row.allocationCents, 600);
assert.equal(row.usdcAtomicUnits, 6000000);
assert.deepEqual(row.licenseSnapshot, ipLicenseSnapshot);
assert.equal(row.productRevenuePoolSnapshot, null);

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

      revenueType: 'ip_license',
      sourceSnapshot: {
        licenseSnapshotId: 'ip-asset-a',
        ipAssetId: 'ip-asset-a',
      },

      poolKey: 'pool-ip-asset-a',
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

      revenueType: 'ip_license',
      sourceSnapshot: {
        licenseSnapshotId: 'ip-asset-a',
        ipAssetId: 'ip-asset-a',
      },

      poolKey: 'pool-ip-asset-a',
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

const productRevenuePoolSnapshot = {
  poolKey: 'product-pool-1001',
  revenuePoolAppId: 7101,
  revenueTokenAssetId: 8101,
  tokenizationStatus: 'active',
  lockedAt: '2026-09-02T17:00:00.000Z',
};

const productRow = createHeldRevenueLedgerRow({
  orderId: 'order-product-1001',
  orderNumber: 'MW-PRODUCT-1001',
  orderItemId: 'MW-PRODUCT-1001:item:1',
  productId: 'product-product-1001',
  productVariantId: 'printful-product-variant-1001',
  quantity: 2,

  revenueType: 'product_revenue',
  sourceSnapshot: productRevenuePoolSnapshot,

  ipAssetId: null,
  poolKey: 'product-pool-1001',
  revenuePoolAppId: 7101,
  revenueTokenAssetId: 8101,

  currency: 'USD',
  grossLicenseFeeCents: 2000,
  platformFeeCents: 0,
  allocationCents: 2000,
  usdcAtomicUnits: 20000000,
  calculationVersion: 'product_revenue_creator_profit_v1',
  roundingPolicy: 'product_revenue_full_creator_profit_allocation_v1',

  licenseSnapshot: undefined,
  orderItemFinancialSnapshot: {
    orderItemId: 'MW-PRODUCT-1001:item:1',
    productId: 'product-product-1001',
    productVariantId: 'printful-product-variant-1001',
    quantityOrdered: 2,
    unitMerchandisePriceCents: 3500,
    merchandiseSubtotalCents: 7000,
    canonicalPricing: {
      pricingVersion: 'v1',
      printfulCostCents: 1500,
      placementCostCents: 100,
      metaWorkMarkupCents: 400,
      lockedIpFeesCents: 500,
      costCents: 2000,
      retailPriceCents: 3500,
    },
  },

  now,
});

assert.equal(
  productRow.idempotencyKey,
  'order-product-1001:MW-PRODUCT-1001:item:1:product_revenue:product-pool-1001'
);
assert.equal(productRow.revenueType, 'product_revenue');
assert.equal(productRow.ipAssetId, null);
assert.equal(productRow.poolKey, 'product-pool-1001');
assert.equal(productRow.revenuePoolAppId, 7101);
assert.equal(productRow.revenueTokenAssetId, 8101);
assert.equal(productRow.licenseSnapshot, null);

assert.equal(productRow.grossLicenseFeeCents, 2000);
assert.equal(productRow.platformFeeCents, 0);
assert.equal(productRow.allocationCents, 2000);
assert.equal(productRow.usdcAtomicUnits, 20000000);

assert.deepEqual(
  productRow.productRevenuePoolSnapshot,
  productRevenuePoolSnapshot
);
assert.equal(productRow.status, 'held');
assert.equal(productRow.eligibilityEvent, 'delivered');

console.log('✅ revenue-ledger tests passed');