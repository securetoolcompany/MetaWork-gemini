// lib/tokenized-funds/nillion/rewards.js

import { isAddress, parseUnits } from 'viem';

const NIL_DECIMALS = 6;
const SCALE = 10n ** 18n;
const BPS = 10_000n;
const WEEK_SECONDS = 7n * 24n * 60n * 60n;

function unsignedInteger(value, field) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${field} must be a non-negative integer string.`);
  }

  return BigInt(value);
}

function readStakeAmount(value) {
  if (
    typeof value !== 'string' ||
    !/^\d+(?:\.\d{1,6})?$/.test(value)
  ) {
    throw new Error(
      'Investor amountNil must be a decimal string with at most 6 decimal places.',
    );
  }

  const amount = parseUnits(value, NIL_DECIMALS);

  if (amount <= 0n) {
    throw new Error('Investor amountNil must be greater than zero.');
  }

  return amount;
}

export function calculateNillionRewards(
  snapshot,
  allocationConfig,
  { pendingOperatingCostsBaseUnits = null } = {},
) {
  const feeBps = allocationConfig.managementFeeBps;

  if (
    !Number.isInteger(feeBps) ||
    feeBps < 0 ||
    feeBps > 10_000
  ) {
    throw new Error('managementFeeBps must be an integer from 0 to 10000.');
  }

  if (
    allocationConfig.managementFeeBasis !==
    'rewards_after_operating_costs'
  ) {
    throw new Error('Unsupported management fee basis.');
  }

  const nodeConfig = allocationConfig.nodes?.[snapshot.nodeId];

  if (!nodeConfig || !Array.isArray(nodeConfig.stakers)) {
    throw new Error(
      `Missing staker configuration for node ${snapshot.nodeId}.`,
    );
  }

  const seenWallets = new Set();
  const seenPositionIds = new Set();

  const allocations = nodeConfig.stakers.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid allocation on node ${snapshot.nodeId}.`);
    }

    const walletPending = entry.wallet === null;

    if (
      !walletPending &&
      (
        typeof entry.wallet !== 'string' ||
        !isAddress(entry.wallet, { strict: false })
      )
    ) {
      throw new Error(
        `Invalid investor wallet on node ${snapshot.nodeId}.`,
      );
    }

    // Existing wallet-only records remain supported.
    // Wallet-pending records require an explicit stable position ID.
    if (
      entry.id !== undefined &&
      (
        typeof entry.id !== 'string' ||
        !/^[a-zA-Z0-9_-]+$/.test(entry.id)
      )
    ) {
      throw new Error('Position IDs must contain only letters, numbers, underscores, or hyphens.');
    }

    if (walletPending && !entry.id) {
      throw new Error('A wallet-pending position requires an explicit ID.');
    }

        if (!walletPending) {
					const walletKey = entry.wallet.toLowerCase();

					if (seenWallets.has(walletKey)) {
							throw new Error(
							`Duplicate investor wallet on node ${snapshot.nodeId}: ${entry.wallet}`,
							);
					}

					seenWallets.add(walletKey);
					}

					const positionId =
					entry.id ??
					`node-${snapshot.nodeId}-${entry.wallet.toLowerCase()}`;

					if (seenPositionIds.has(positionId)) {
					throw new Error(`Duplicate position ID: ${positionId}`);
					}

					seenPositionIds.add(positionId);

    return {
      id: positionId,
      wallet: entry.wallet,
      amount: readStakeAmount(entry.amountNil),
    };
  });

  const stake = unsignedInteger(
    snapshot.stakeBaseUnits,
    'stakeBaseUnits',
  );

  const enrolledStake = unsignedInteger(
    snapshot.enrolledStakeBaseUnits,
    'enrolledStakeBaseUnits',
  );

  const now = unsignedInteger(
    snapshot.blockTimestamp,
    'blockTimestamp',
  );

  const emissions = snapshot.emissions;

  const accrued = unsignedInteger(
    emissions.accruedBaseUnits,
    'accruedBaseUnits',
  );

  const index = unsignedInteger(emissions.index, 'index');

  const snapshotIndex = unsignedInteger(
    emissions.snapshotIndex,
    'snapshotIndex',
  );

  const lastTouch = unsignedInteger(
    emissions.lastTouch,
    'lastTouch',
  );

  const totalEnrolled = unsignedInteger(
    emissions.totalEnrolledBaseUnits,
    'totalEnrolledBaseUnits',
  );

  const rate = unsignedInteger(
    emissions.rateBaseUnitsPerSecond,
    'rateBaseUnitsPerSecond',
  );

  const elapsed = now > lastTouch ? now - lastTouch : 0n;

  const liveIndex =
    totalEnrolled > 0n
      ? index + (rate * elapsed * SCALE) / totalEnrolled
      : index;

  if (snapshot.status.enrolled && liveIndex < snapshotIndex) {
    throw new Error('Emission index is behind the node snapshot index.');
  }

  const grossPending = snapshot.status.enrolled
    ? accrued + (enrolledStake * (liveIndex - snapshotIndex)) / SCALE
    : accrued;

  const costsIncluded = pendingOperatingCostsBaseUnits !== null;

  const operatingCosts = costsIncluded
    ? unsignedInteger(
        pendingOperatingCostsBaseUnits,
        'pendingOperatingCostsBaseUnits',
      )
    : 0n;

  const rewardsAfterCosts =
    grossPending > operatingCosts
      ? grossPending - operatingCosts
      : 0n;

  const managementFee =
    (rewardsAfterCosts * BigInt(feeBps)) / BPS;

  const investorPending = rewardsAfterCosts - managementFee;

  const recordedStake = allocations.reduce(
    (total, allocation) => total + allocation.amount,
    0n,
  );

  const hasAllocations = allocations.length > 0;
  const allocationsMatch = hasAllocations && recordedStake === stake;

  const warnings = [...(snapshot.warnings ?? [])];

  if (!hasAllocations) {
    warnings.push('Investor allocations have not been entered.');
  } else if (!allocationsMatch) {
    warnings.push(
      'Recorded investor allocations do not match on-chain stake.',
    );
  }

  const walletPendingCount = allocations.filter(
    (allocation) => allocation.wallet === null,
  ).length;

  if (walletPendingCount > 0) {
    warnings.push(
      `${walletPendingCount} position(s) await a receiving wallet. Their reward shares remain allocated and must not be redistributed.`,
    );
  }

  if (!costsIncluded) {
    warnings.push(
      'Earnings estimates include the management fee but exclude operating costs.',
    );
  }

  if (operatingCosts > grossPending) {
    warnings.push('Entered operating costs exceed pending rewards.');
  }

  const canShowInvestorEstimates =
    allocationsMatch &&
    snapshot.ownerMatches === true &&
    snapshot.status.stakeSynced === true;

  const positions = canShowInvestorEstimates
    ? allocations.map((allocation) => ({
        id: allocation.id,
        wallet: allocation.wallet,
        receivingWalletStatus:
          allocation.wallet === null ? 'pending' : 'provided',
        stakeBaseUnits: allocation.amount.toString(),
        participationBps: (
          (allocation.amount * BPS) /
          recordedStake
        ).toString(),
        estimatedPendingBaseUnits: (
          (investorPending * allocation.amount) /
          recordedStake
        ).toString(),
      }))
    : [];

  // Keep null wallets out of the existing address-lookup interface.
  // This list is not a payout authorization list.
  const investors = positions
    .filter((position) => position.wallet !== null)
    .map((position) => ({
      wallet: position.wallet,
      stakeBaseUnits: position.stakeBaseUnits,
      participationBps: position.participationBps,
      estimatedPendingBaseUnits: position.estimatedPendingBaseUnits,
    }));

  // Include ALL positions, not just those with receiving wallets.
  const allocatedPending = positions.reduce(
    (total, position) =>
      total + BigInt(position.estimatedPendingBaseUnits),
    0n,
  );

  const walletPendingRewards = positions
    .filter((position) => position.wallet === null)
    .reduce(
      (total, position) =>
        total + BigInt(position.estimatedPendingBaseUnits),
      0n,
    );

    const DAY_SECONDS = 24n * 60n * 60n;
		const YEAR_SECONDS = 365n * DAY_SECONDS;

		function projectGross(seconds) {
			if (!snapshot.status.earning || totalEnrolled === 0n) {
				return 0n;
			}

			return (enrolledStake * rate * seconds) / totalEnrolled;
		}

		function afterManagementFee(amount) {
			const fee = (amount * BigInt(feeBps)) / BPS;
			return amount - fee;
		}

		const projectedGrossDaily = projectGross(DAY_SECONDS);
		const projectedGrossWeekly = projectGross(WEEK_SECONDS);
		const projectedGrossYearly = projectGross(YEAR_SECONDS);

		const projectedInvestorDaily =
			afterManagementFee(projectedGrossDaily);

		const projectedInvestorWeekly =
			afterManagementFee(projectedGrossWeekly);

		const projectedInvestorYearly =
			afterManagementFee(projectedGrossYearly);

		const grossAprBps =
			stake > 0n
				? (projectedGrossYearly * BPS) / stake
				: 0n;

		const investorAprAfterFeeBps =
			stake > 0n
				? (projectedInvestorYearly * BPS) / stake
				: 0n;

  return {
    nodeId: snapshot.nodeId,
    allocationVersion: allocationConfig.version,
    managementFeeBps: feeBps,

    grossPendingBaseUnits: grossPending.toString(),
    estimatedManagementFeeBaseUnits: managementFee.toString(),
    estimatedInvestorPendingBaseUnits: investorPending.toString(),

    operatingCostsIncluded: costsIncluded,
    pendingOperatingCostsBaseUnits: costsIncluded
      ? operatingCosts.toString()
      : null,

    recordedStakeBaseUnits: recordedStake.toString(),
    onChainStakeBaseUnits: stake.toString(),
    allocationsMatch,
    canShowInvestorEstimates,

    walletPendingCount,
    estimatedWalletPendingRewardsBaseUnits:
      canShowInvestorEstimates
        ? walletPendingRewards.toString()
        : null,

        projections: {
					operatingCostsIncluded: false,
					compounding: false,
					annualizationDays: 365,

					grossAprBps: grossAprBps.toString(),
					investorAprAfterFeeBps: investorAprAfterFeeBps.toString(),

					grossDailyBaseUnits: projectedGrossDaily.toString(),
					grossWeeklyBaseUnits: projectedGrossWeekly.toString(),
					grossYearlyBaseUnits: projectedGrossYearly.toString(),

					investorDailyAfterFeeBaseUnits:
						projectedInvestorDaily.toString(),
					investorWeeklyAfterFeeBaseUnits:
						projectedInvestorWeekly.toString(),
					investorYearlyAfterFeeBaseUnits:
						projectedInvestorYearly.toString(),
				},

    positions,
    investors,

    roundingDustBaseUnits: canShowInvestorEstimates
      ? (investorPending - allocatedPending).toString()
      : null,

    warnings,
  };
}