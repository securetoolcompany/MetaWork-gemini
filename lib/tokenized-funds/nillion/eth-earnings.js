// lib/tokenized-funds/nillion/eth-earnings.js

import { calculateNillionRewardSplit } from './fee-policy.js';

// ETH job earnings (wei, 18 decimals) use the same fee split and
// stake-weighted position shares as NIL emissions.
export function calculateNillionEthEarnings(eth, rewards, allocationConfig) {
  if (
    !eth ||
    eth.available !== true ||
    typeof eth.accruedWei !== 'string' ||
    !/^\d+$/.test(eth.accruedWei)
  ) {
    return { available: false };
  }

  const split = calculateNillionRewardSplit(
    eth.accruedWei,
    allocationConfig,
  );

  const gross = BigInt(split.grossBaseUnits);
  const managementFee = BigInt(split.managementFeeBaseUnits);
  const investorPending = BigInt(split.investorRewardsBaseUnits);

  const recordedStake = BigInt(rewards.recordedStakeBaseUnits);

  const canShowInvestorEstimates =
    rewards.canShowInvestorEstimates === true && recordedStake > 0n;

  const positions = canShowInvestorEstimates
    ? rewards.positions.map((position) => {
        const stake = BigInt(position.stakeBaseUnits);
        const grossShare = (gross * stake) / recordedStake;
        const pendingShare = (investorPending * stake) / recordedStake;

        return {
          id: position.id,
          wallet: position.wallet,
          grossShareWei: grossShare.toString(),
          managementFeeShareWei: (grossShare - pendingShare).toString(),
          estimatedPendingWei: pendingShare.toString(),
        };
      })
    : [];

  return {
    available: true,
    accruedWei: gross.toString(),
    sharesPosted: eth.sharesPosted,
    managementFeeBps: split.managementFeeBps,
    estimatedManagementFeeWei: managementFee.toString(),
    estimatedInvestorPendingWei: investorPending.toString(),
    canShowInvestorEstimates,
    positions,
  };
}