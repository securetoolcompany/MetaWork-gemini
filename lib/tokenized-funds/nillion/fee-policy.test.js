// lib/tokenized-funds/nillion/fee-policy.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NILLION_MANAGEMENT_FEE_BASIS,
  calculateNillionRewardSplit,
  validateNillionFeePolicy,
} from './fee-policy.js';

function config() {
  return {
    managementFeeBps: 5000,
    managementFeeBasis: NILLION_MANAGEMENT_FEE_BASIS,
  };
}

test('accepts the gross-rewards policy with operating costs covered by the fee', () => {
  assert.doesNotThrow(
    () => validateNillionFeePolicy(config()),
  );
});

test('splits gross rewards equally without additional operating-cost deductions', () => {
  const result = calculateNillionRewardSplit('12000000', config());

  assert.equal(result.grossBaseUnits, '12000000');
  assert.equal(result.managementFeeBaseUnits, '6000000');
  assert.equal(result.investorRewardsBaseUnits, '6000000');
  assert.equal(result.investorOperatingCostDeductionBaseUnits, '0');
  assert.equal(result.operatingCostsCoveredByManagementFee, true);
});

test('retains the existing integer rounding convention', () => {
  const result = calculateNillionRewardSplit('12000001', config());

  assert.equal(result.managementFeeBaseUnits, '6000000');
  assert.equal(result.investorRewardsBaseUnits, '6000001');

  assert.equal(
    BigInt(result.managementFeeBaseUnits) +
      BigInt(result.investorRewardsBaseUnits),
    BigInt(result.grossBaseUnits),
  );
});

test('handles zero gross rewards', () => {
  const result = calculateNillionRewardSplit('0', config());

  assert.equal(result.managementFeeBaseUnits, '0');
  assert.equal(result.investorRewardsBaseUnits, '0');
});

test('rejects the old operating-cost-first policy', () => {
  assert.throws(
    () => validateNillionFeePolicy({
      ...config(),
      managementFeeBasis: 'rewards_after_operating_costs',
    }),
    /Unsupported Nillion management fee basis/,
  );
});

test('rejects a fee other than 50 percent', () => {
  assert.throws(
    () => validateNillionFeePolicy({
      ...config(),
      managementFeeBps: 1000,
    }),
    /managementFeeBps must be 5000/,
  );
});

test('rejects negative, decimal, and numeric base-unit inputs', () => {
  for (const value of ['-1', '1.5', 12000000, null]) {
    assert.throws(
      () => calculateNillionRewardSplit(value, config()),
      /non-negative integer base-unit string/,
    );
  }
});

test('supports large amounts without floating-point conversion or input mutation', () => {
  const policy = config();
  const before = JSON.stringify(policy);
  const gross = '9007199254740993123456789';

  const result = calculateNillionRewardSplit(gross, policy);

  assert.equal(
    BigInt(result.managementFeeBaseUnits) +
      BigInt(result.investorRewardsBaseUnits),
    BigInt(gross),
  );

  assert.equal(JSON.stringify(policy), before);
  assert.doesNotThrow(() => JSON.stringify(result));
});