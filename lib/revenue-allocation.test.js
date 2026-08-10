// lib/revenue-allocation.test.js
import assert from 'node:assert/strict';

import {
  USDC_ATOMIC_UNITS_PER_USD_CENT,
  calculateIpLicenseAllocation,
} from './revenue-allocation.js';

assert.equal(USDC_ATOMIC_UNITS_PER_USD_CENT, 10000);

assert.deepEqual(
  calculateIpLicenseAllocation({
    quantity: 2,
    licensingFeeCents: 375,
    platformFeeBps: 2000,
  }),
  {
    quantity: 2,
    licensingFeeCents: 375,
    platformFeeBps: 2000,
    grossLicenseFeeCents: 750,
    platformFeeCents: 150,
    netPoolAllocationCents: 600,
    usdcAtomicUnits: 6000000,
  }
);

assert.deepEqual(
  calculateIpLicenseAllocation({
    quantity: 1,
    licensingFeeCents: 333,
    platformFeeBps: 2000,
  }),
  {
    quantity: 1,
    licensingFeeCents: 333,
    platformFeeBps: 2000,
    grossLicenseFeeCents: 333,
    platformFeeCents: 66,
    netPoolAllocationCents: 267,
    usdcAtomicUnits: 2670000,
  }
);

assert.deepEqual(
  calculateIpLicenseAllocation({
    quantity: 3,
    licensingFeeCents: 0,
    platformFeeBps: 2000,
  }),
  {
    quantity: 3,
    licensingFeeCents: 0,
    platformFeeBps: 2000,
    grossLicenseFeeCents: 0,
    platformFeeCents: 0,
    netPoolAllocationCents: 0,
    usdcAtomicUnits: 0,
  }
);

assert.throws(
  () =>
    calculateIpLicenseAllocation({
      quantity: 1,
      licensingFeeCents: 100,
      platformFeeBps: 10001,
    }),
  /platformFeeBps/
);

assert.throws(
  () =>
    calculateIpLicenseAllocation({
      quantity: 0,
      licensingFeeCents: 100,
      platformFeeBps: 2000,
    }),
  /quantity/
);

console.log('✅ revenue-allocation tests passed');