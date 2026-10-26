// lib/tokenized-funds/nillion/distribution-proposal.js

import { createHash } from 'node:crypto';
import { isAddress } from 'viem';

import {
  NILLION_CONTRACTS,
} from './config.js';

import {
  calculateNillionRewardSplit,
  validateNillionFeePolicy,
} from './fee-policy.js';

import {
  recordNillionPayoutDraft,
  summarizeNillionPayoutLedger,
} from './payout-ledger.js';

function integer(value, field) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${field} must be a non-negative integer string.`);
  }

  return BigInt(value);
}

function address(value, field) {
  if (
    typeof value !== 'string' ||
    !isAddress(value, { strict: false }) ||
    /^0x0{40}$/i.test(value)
  ) {
    throw new Error(`Invalid ${field}.`);
  }

  return value.toLowerCase();
}

function canonical(value) {
  if (value === null) return 'null';

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }

  if (
    value &&
    typeof value === 'object' &&
    (
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null
    )
  ) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }

  throw new Error('Proposal inputs must contain JSON-safe values.');
}

function digest(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function obligationKey(batchId, positionId) {
  return JSON.stringify([batchId, positionId]);
}

export function getNillionDistributionProposalSha256(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new Error('A proposal object is required.');
  }

  const {
    proposalSha256: _storedDigest,
    ...contents
  } = proposal;

  return digest(contents);
}

export function buildNillionDistributionProposal({
  ledger,
  allocationConfig,
  expectedOwner,
  drafts = [],
  reviewedAt,
}) {
  const owner = address(expectedOwner, 'expected owner');

  validateNillionFeePolicy(allocationConfig);

  if (
    !Number.isInteger(allocationConfig.version) ||
    allocationConfig.version < 1
  ) {
    throw new Error('A versioned allocation configuration is required.');
  }

  if (!Array.isArray(drafts)) {
    throw new Error('drafts must be an array.');
  }

  // Validate the existing ledger and stored payment evidence.
  summarizeNillionPayoutLedger(ledger);

  const sources = {
    ledgerSha256: digest(ledger),
    allocationSha256: digest(allocationConfig),
    allocationVersion: allocationConfig.version,
  };

  // All updates below exist only in memory.
  let proposedLedger = structuredClone(ledger);

  for (const draft of drafts) {
    proposedLedger = recordNillionPayoutDraft({
      ledger: proposedLedger,
      draft,
      allocationConfig,
      expectedOwner: owner,
      reviewedAt,
    });
  }

  const summary = summarizeNillionPayoutLedger(proposedLedger);

  // The ledger validator has already verified these settlements.
  const paidByObligation = new Map();

  for (const settlement of proposedLedger.settlements ?? []) {
    for (const assignment of settlement.allocations) {
      const key = obligationKey(
        assignment.batchId,
        assignment.positionId,
      );

      paidByObligation.set(
        key,
        (paidByObligation.get(key) ?? 0n) +
          integer(assignment.amountBaseUnits, 'Paid assignment'),
      );
    }
  }

  const operatorRetentionCandidates = [];
  const walletPending = [];
  const recipients = new Map();
  const batches = [];

  let gross = 0n;
  let fees = 0n;
  let remainder = 0n;
  let operatorUnpaid = 0n;
  let investorUnpaid = 0n;
  let walletPendingUnpaid = 0n;

  for (const entry of proposedLedger.entries) {
    if (address(entry.owner, 'recorded owner') !== owner) {
      throw new Error('Ledger contains a different operating owner.');
    }

    validateNillionFeePolicy(entry);

    const split = calculateNillionRewardSplit(
      entry.grossClaimedBaseUnits,
      allocationConfig,
    );

    if (
      entry.managementFeeBaseUnits !== split.managementFeeBaseUnits ||
      entry.distributableBaseUnits !== split.investorRewardsBaseUnits
    ) {
      throw new Error('Recorded batch does not match the fee policy.');
    }

    gross += integer(entry.grossClaimedBaseUnits, 'Claimed amount');
    fees += integer(entry.managementFeeBaseUnits, 'Management fee');
    remainder += integer(
      entry.roundingRemainderBaseUnits,
      'Rounding remainder',
    );

    batches.push({
      batchId: entry.batchId,
      nodeId: entry.nodeId,
      allocationVersion: entry.allocationVersion,
      reviewedAt: entry.reviewedAt,
      claims: structuredClone(entry.claims),
    });

    for (const position of entry.positions) {
      const key = obligationKey(entry.batchId, position.positionId);

      const unpaid =
        integer(position.allocatedBaseUnits, 'Allocated amount') -
        (paidByObligation.get(key) ?? 0n);

      if (unpaid < 0n) {
        throw new Error('Negative outstanding obligation.');
      }

      if (unpaid === 0n) continue;

      const assignment = {
        batchId: entry.batchId,
        nodeId: entry.nodeId,
        positionId: position.positionId,
        amountBaseUnits: unpaid.toString(),
      };

      if (position.wallet === null) {
        walletPending.push(assignment);
        walletPendingUnpaid += unpaid;
        continue;
      }

      const recipient = address(position.wallet, 'receiving wallet');

      if (recipient === owner) {
        operatorRetentionCandidates.push(assignment);
        operatorUnpaid += unpaid;
        continue;
      }

      const transfer = recipients.get(recipient) ?? {
        from: owner,
        to: recipient,
        amountBaseUnits: '0',
        allocations: [],
      };

      transfer.amountBaseUnits = (
        BigInt(transfer.amountBaseUnits) + unpaid
      ).toString();

      transfer.allocations.push(assignment);
      recipients.set(recipient, transfer);
      investorUnpaid += unpaid;
    }
  }

  const paid = integer(
    summary.totalRecordedPaidBaseUnits,
    'Recorded paid amount',
  );

  if (
    gross !==
    fees +
      paid +
      operatorUnpaid +
      investorUnpaid +
      walletPendingUnpaid +
      remainder
  ) {
    throw new Error('Proposal accounting does not reconcile.');
  }

  const proposal = {
    schemaVersion: 1,
    kind: 'nillion_distribution_proposal',
    status: proposedLedger.entries.length === 0
      ? 'nothing_to_review'
      : 'review_required',

    chainId: 1,
    currency: 'NIL',
    decimals: 6,
    tokenContract: NILLION_CONTRACTS.nilToken.toLowerCase(),
    owner,

    approvalRequired: true,
    executionEnabled: false,
    freshChainVerificationPerformed: false,
    fundingBalanceChecked: false,

    sources,
    proposedLedgerSha256: digest(proposedLedger),
    newBatchIds: drafts.map((draft) => draft.batchId),
    batches,

    accounting: {
      // Cumulative across the included ledger, not new withdrawals.
      grossClaimedBaseUnits: gross.toString(),
      recordedManagementFeeBaseUnits: fees.toString(),
      alreadyPaidBaseUnits: paid.toString(),
      operatorOwnershipUnpaidBaseUnits: operatorUnpaid.toString(),
      proposedInvestorTransfersBaseUnits: investorUnpaid.toString(),
      walletPendingUnpaidBaseUnits: walletPendingUnpaid.toString(),
      roundingRemainderBaseUnits: remainder.toString(),

      // Does not establish the actual wallet balance.
      requiredOutstandingReserveBaseUnits: (
        operatorUnpaid +
        investorUnpaid +
        walletPendingUnpaid +
        remainder
      ).toString(),
    },

    operatorRetentionCandidates,
    walletPending,
    transfers: [...recipients.values()],

    notices: [
      'Prepare only. No approval, signing, broadcasting, or ledger writes.',
      'New drafts are recalculated; stored payment evidence is validated.',
      'No fresh RPC verification or wallet-balance check is performed.',
      'Management fees are accounting totals, not transfer instructions.',
      'Operator ownership remains unpaid until retention settlement is implemented.',
      'Wallet-pending obligations remain reserved and are not redistributed.',
      'Only remaining unpaid amounts appear in proposed investor transfers.',
      'The digest is not authorization or a duplicate-execution guard.',
    ],
  };

  return {
    ...proposal,
    proposalSha256: digest(proposal),
  };
}