// lib/tokenized-funds/nillion/fee-policy.js

export const NILLION_MANAGEMENT_FEE_BPS = 5000;

export const NILLION_MANAGEMENT_FEE_BASIS =
  'gross_rewards_operator_covers_costs';

export const NILLION_FEE_DISCLOSURE =
  'MetaWork retains a 50% management fee on gross rewards and covers ' +
  'node operating costs from its share. No additional operating-cost ' +
  'deduction is applied to investor rewards.';

const BPS = 10_000n;

export function validateNillionFeePolicy(config) {
  if (
    config?.managementFeeBps !== NILLION_MANAGEMENT_FEE_BPS
  ) {
    throw new Error(
      'managementFeeBps must be 5000 under the current Nillion fee policy.',
    );
  }

  if (
    config.managementFeeBasis !== NILLION_MANAGEMENT_FEE_BASIS
  ) {
    throw new Error('Unsupported Nillion management fee basis.');
  }
}

export function calculateNillionRewardSplit(
  grossBaseUnits,
  config,
) {
  validateNillionFeePolicy(config);

  if (
    typeof grossBaseUnits !== 'string' ||
    !/^\d+$/.test(grossBaseUnits)
  ) {
    throw new Error(
      'Gross rewards must be a non-negative integer base-unit string.',
    );
  }

  const gross = BigInt(grossBaseUnits);

  const managementFee =
    (gross * BigInt(NILLION_MANAGEMENT_FEE_BPS)) / BPS;

  const investorRewards = gross - managementFee;

  return {
    managementFeeBps: NILLION_MANAGEMENT_FEE_BPS,
    managementFeeBasis: NILLION_MANAGEMENT_FEE_BASIS,
    operatingCostsCoveredByManagementFee: true,
    investorOperatingCostDeductionBaseUnits: '0',
    grossBaseUnits: gross.toString(),
    managementFeeBaseUnits: managementFee.toString(),
    investorRewardsBaseUnits: investorRewards.toString(),
  };
}