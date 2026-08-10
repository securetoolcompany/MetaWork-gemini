// lib/order-financial-snapshot.test.js
import assert from 'node:assert/strict';

import { buildOrderItemSnapshot } from './order-financial-snapshot.js';

function buildSnapshot(overrides = {}) {
  return buildOrderItemSnapshot({
    orderItemId: 'MW-1001:item:1',
    product: {
      id: 'product-1001',
      licensedRevenueTerms: [
        {
          ipAssetId: 'ip-asset-a',
          licensingFeeCents: 375,
          platformFeeBps: 2000,
          requiresSettlement: true,
          revenuePoolAppId: 123456,
          revenueTokenAssetId: 789012,
          lockedAt: '2026-08-09T00:00:00.000Z',
        },
      ],
      ...(overrides.product || {}),
    },
    variant: {
      id: 'printful-variant-1001',
      printfulCost: 12.5,
      placementCost: 1.25,
      metaWorkMarkup: 3,
      lockedIpFees: 3.75,
      cost: 20.5,
      retail_price: 30,
      ...(overrides.variant || {}),
    },
    quantity: 2,
    unitMerchandisePrice: 30,
    ...overrides,
  });
}

const snapshot = buildSnapshot();

assert.equal(snapshot.orderItemId, 'MW-1001:item:1');
assert.equal(snapshot.productId, 'product-1001');
assert.equal(snapshot.productVariantId, 'printful-variant-1001');
assert.equal(snapshot.quantityOrdered, 2);
assert.equal(snapshot.unitMerchandisePriceCents, 3000);
assert.equal(snapshot.merchandiseSubtotalCents, 6000);

assert.deepEqual(snapshot.lockedLicensedRevenueTerms, [
  {
    licenseSnapshotId: 'ip-asset-a',
    ipAssetId: 'ip-asset-a',
    licensingFeeCents: 375,
    platformFeeBps: 2000,
    requiresSettlement: true,
    revenuePoolAppId: 123456,
    revenueTokenAssetId: 789012,
    lockedAt: '2026-08-09T00:00:00.000Z',
  },
]);

assert.throws(
  () =>
    buildSnapshot({
      product: {
        id: 'product-1001',
        licensedRevenueTerms: [
          {
            ipAssetId: 'ip-asset-a',
            licensingFeeCents: 375,
            platformFeeBps: 2000,
            requiresSettlement: true,
            revenuePoolAppId: null,
            revenueTokenAssetId: null,
          },
        ],
      },
    }),
  /missing a valid V7 pool target/
);

const nonSettledSnapshot = buildSnapshot({
  product: {
    id: 'product-1001',
    licensedRevenueTerms: [
      {
        ipAssetId: 'ip-asset-free',
        licensingFeeCents: 0,
        platformFeeBps: 0,
        requiresSettlement: false,
      },
    ],
  },
});

assert.deepEqual(nonSettledSnapshot.lockedLicensedRevenueTerms, [
  {
    licenseSnapshotId: 'ip-asset-free',
    ipAssetId: 'ip-asset-free',
    licensingFeeCents: 0,
    platformFeeBps: 0,
    requiresSettlement: false,
    revenuePoolAppId: null,
    revenueTokenAssetId: null,
    lockedAt: null,
  },
]);

console.log('✅ order-financial-snapshot tests passed');