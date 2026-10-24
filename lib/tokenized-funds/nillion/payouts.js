// lib/tokenized-funds/nillion/payouts.js

import { isAddress, parseUnits } from 'viem';

import {
  calculateNillionRewardSplit,
  validateNillionFeePolicy,
} from './fee-policy.js';
const HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function unsignedInteger(value, field) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${field} must be a non-negative integer string.`);
  }

  return BigInt(value);
}

function address(value, field) {
  if (
    typeof value !== 'string' ||
    !isAddress(value, { strict: false })
  ) {
    throw new Error(`${field} must be an Ethereum address.`);
  }

  return value.toLowerCase();
}

function transactionHash(value) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw new Error('Invalid claim transaction hash.');
  }

  return value.toLowerCase();
}

export function createEmptyNillionPayoutLedger() {
  return {
    schemaVersion: 1,
    chainId: 1,
    currency: 'NIL',
    decimals: 6,
    entries: [],
  };
}

export function buildNillionPayoutDraft({
  batchId,
  nodeId,
  allocationConfig,
  onChainStakeBaseUnits,
  expectedOwner,
  claims,
  ledger,
}) {
  if (typeof batchId !== 'string' || !ID_PATTERN.test(batchId)) {
    throw new Error('Invalid batch ID.');
  }

  const id = String(nodeId);
  const owner = address(expectedOwner, 'expectedOwner');

  if (
    !ledger ||
    ledger.schemaVersion !== 1 ||
    ledger.chainId !== 1 ||
    ledger.currency !== 'NIL' ||
    ledger.decimals !== 6 ||
    !Array.isArray(ledger.entries)
  ) {
    throw new Error('Invalid payout ledger.');
  }

  const usedClaimIds = new Set();
  const usedBatchIds = new Set();

  for (const entry of ledger.entries) {
    if (
      !entry ||
      typeof entry.batchId !== 'string' ||
      !Array.isArray(entry.claims)
    ) {
      throw new Error('Invalid existing ledger entry.');
    }

    if (usedBatchIds.has(entry.batchId)) {
      throw new Error('Duplicate batch ID in ledger.');
    }

    usedBatchIds.add(entry.batchId);

    for (const claim of entry.claims) {
      if (
        typeof claim.eventId !== 'string' ||
        usedClaimIds.has(claim.eventId)
      ) {
        throw new Error('Invalid or duplicate claim in ledger.');
      }

      usedClaimIds.add(claim.eventId);
    }
  }

  if (usedBatchIds.has(batchId)) {
    throw new Error('Batch ID is already recorded.');
  }

  if (
    !Number.isInteger(allocationConfig?.version) ||
    allocationConfig.version < 1 ||
    allocationConfig.managementFeeBps !== 5000
  ) {
    throw new Error('Expected a versioned allocation with a 50% fee.');
  }

  validateNillionFeePolicy(allocationConfig);

  const stakers = allocationConfig.nodes?.[id]?.stakers;

  if (!Array.isArray(stakers) || stakers.length === 0) {
    throw new Error(`Missing allocations for node ${id}.`);
  }

  const positionIds = new Set();
  const wallets = new Set();

  const allocations = stakers.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Invalid allocation.');
    }

    const wallet =
      entry.wallet === null
        ? null
        : address(entry.wallet, 'Receiving wallet');

    const positionId =
      entry.id ?? (wallet ? `node-${id}-${wallet}` : null);

    if (
      typeof positionId !== 'string' ||
      !ID_PATTERN.test(positionId) ||
      positionIds.has(positionId)
    ) {
      throw new Error('Missing, invalid, or duplicate position ID.');
    }

    if (wallet && wallets.has(wallet)) {
      throw new Error('Duplicate receiving wallet.');
    }

    if (
      typeof entry.amountNil !== 'string' ||
      !/^\d+(?:\.\d{1,6})?$/.test(entry.amountNil)
    ) {
      throw new Error('Invalid allocation amount.');
    }

    const stake = parseUnits(entry.amountNil, 6);

    if (stake <= 0n) {
      throw new Error('Allocation stake must be positive.');
    }

    positionIds.add(positionId);
    if (wallet) wallets.add(wallet);

    return { positionId, wallet, stake };
  });

  const recordedStake = allocations.reduce(
    (sum, allocation) => sum + allocation.stake,
    0n,
  );

  if (
    recordedStake !==
    unsignedInteger(onChainStakeBaseUnits, 'onChainStakeBaseUnits')
  ) {
    throw new Error('Recorded allocations do not match on-chain stake.');
  }

  if (!Array.isArray(claims) || claims.length === 0) {
    throw new Error('No claim events supplied. Nothing to allocate.');
  }

  const normalizedClaims = claims.map((claim) => {
    if (!claim || typeof claim !== 'object') {
      throw new Error('Invalid claim event.');
    }

    if (String(claim.nodeId) !== id) {
      throw new Error('Claim belongs to a different node.');
    }

    if (address(claim.owner, 'Claim owner') !== owner) {
      throw new Error('Claim owner does not match the expected owner.');
    }

    const hash = transactionHash(claim.transactionHash);
    const logIndex = unsignedInteger(claim.logIndex, 'logIndex');
    const eventId = `1:${hash}:${logIndex}`;

    if (usedClaimIds.has(eventId)) {
      throw new Error('Claim event is duplicated or already recorded.');
    }

    usedClaimIds.add(eventId);

    const blockNumber = unsignedInteger(
      claim.blockNumber,
      'blockNumber',
    );

    const blockHash = transactionHash(claim.blockHash);
    const amount = unsignedInteger(claim.amountBaseUnits, 'claim amount');

    return {
      eventId,
      nodeId: id,
      owner,
      transactionHash: hash,
      logIndex: logIndex.toString(),
      blockNumber: blockNumber.toString(),
      blockHash,
      amountBaseUnits: amount.toString(),
    };
  });

  const gross = normalizedClaims.reduce(
    (sum, claim) => sum + BigInt(claim.amountBaseUnits),
    0n,
  );

  const split = calculateNillionRewardSplit(gross.toString(), allocationConfig);
  const fee = BigInt(split.managementFeeBaseUnits);
  const distributable = BigInt(split.investorRewardsBaseUnits);

  const positions = allocations.map((allocation) => ({
    positionId: allocation.positionId,
    wallet: allocation.wallet,
    stakeBaseUnits: allocation.stake.toString(),
    allocatedBaseUnits: (
      (distributable * allocation.stake) / recordedStake
    ).toString(),
    receivingWalletStatus:
      allocation.wallet === null ? 'pending' : 'provided',
  }));

  const allocated = positions.reduce(
    (sum, position) => sum + BigInt(position.allocatedBaseUnits),
    0n,
  );

  const walletPending = positions
    .filter((position) => position.wallet === null)
    .reduce(
      (sum, position) => sum + BigInt(position.allocatedBaseUnits),
      0n,
    );

  return {
    schemaVersion: 1,
    batchId,
    status: 'draft',
    chainId: 1,
    currency: 'NIL',
    decimals: 6,
    nodeId: id,
    owner,
    allocationVersion: allocationConfig.version,
    managementFeeBps: allocationConfig.managementFeeBps,
    managementFeeBasis: split.managementFeeBasis,
    operatingCostsCoveredByManagementFee: true,
    investorOperatingCostDeductionBaseUnits: '0',
    feePolicy: '50_percent_of_claimed_nil_no_additional_deductions',
    operatingCostsDeductedFromInvestors: false,
    recordedStakeBaseUnits: recordedStake.toString(),
    claims: normalizedClaims,
    grossClaimedBaseUnits: gross.toString(),
    managementFeeBaseUnits: fee.toString(),
    distributableBaseUnits: distributable.toString(),
    allocatedBaseUnits: allocated.toString(),
    walletPendingBaseUnits: walletPending.toString(),
    walletAssignedBaseUnits: (allocated - walletPending).toString(),
    roundingRemainderBaseUnits: (distributable - allocated).toString(),
    roundingPolicy: 'retain_separately_pending_explicit_roll_forward',
    positions,
    payments: [],
  };
}