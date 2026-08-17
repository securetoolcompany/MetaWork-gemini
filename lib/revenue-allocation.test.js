import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALLOCATION_CALCULATION_VERSION,
  PLATFORM_FEE_BPS,
  ROUNDING_POLICY,
  USDC_ATOMIC_UNITS_PER_USD_CENT,
  calculateIpLicenseAllocation,
} from './revenue-allocation.js';

test('calculates a fixed per-unit IP fee less the 20% platform fee', () => {
  const allocation = calculateIpLicenseAllocation({
    quantity: 2,
    licensingFeeCents: 375,
    platformFeeBps: PLATFORM_FEE_BPS,
  });

  assert.deepEqual(allocation, {
    calculationVersion: ALLOCATION_CALCULATION_VERSION,
    roundingPolicy: ROUNDING_POLICY,
    quantity: 2,
    licensingFeeCents: 375,
    platformFeeBps: 2000,
    licenseGrossCents: 750,
    platformFeeCents: 150,
    allocationCents: 600,
    usdcAtomicUnits: 6000000,
  });
});

test('floors fractional platform-fee cents in favor of the IP creator', () => {
  const allocation = calculateIpLicenseAllocation({
    quantity: 1,
    licensingFeeCents: 333,
    platformFeeBps: PLATFORM_FEE_BPS,
  });

  assert.equal(allocation.licenseGrossCents, 333);
  assert.equal(allocation.platformFeeCents, 66);
  assert.equal(allocation.allocationCents, 267);
  assert.equal(
    allocation.usdcAtomicUnits,
    267 * USDC_ATOMIC_UNITS_PER_USD_CENT
  );
  assert.equal(
    allocation.platformFeeCents + allocation.allocationCents,
    allocation.licenseGrossCents
  );
});

test('converts every whole USD cent into exactly 10000 USDC atomic units', () => {
  const allocation = calculateIpLicenseAllocation({
    quantity: 1,
    licensingFeeCents: 1,
    platformFeeBps: PLATFORM_FEE_BPS,
  });

  assert.equal(allocation.platformFeeCents, 0);
  assert.equal(allocation.allocationCents, 1);
  assert.equal(allocation.usdcAtomicUnits, 10000);
});

test('requires the MetaWork 20% frozen platform fee', () => {
  assert.throws(
    () =>
      calculateIpLicenseAllocation({
        quantity: 1,
        licensingFeeCents: 500,
        platformFeeBps: 1500,
      }),
    /platformFeeBps must be 2000/
  );
});

test('rejects invalid integer money and quantity inputs', () => {
  assert.throws(
    () =>
      calculateIpLicenseAllocation({
        quantity: 1.5,
        licensingFeeCents: 500,
      }),
    /quantity must be a safe integer/
  );

  assert.throws(
    () =>
      calculateIpLicenseAllocation({
        quantity: 1,
        licensingFeeCents: 12.5,
      }),
    /licensingFeeCents must be a safe integer/
  );

  assert.throws(
    () =>
      calculateIpLicenseAllocation({
        quantity: 0,
        licensingFeeCents: 500,
      }),
    /quantity must be at least 1/
  );
});