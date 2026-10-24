// lib/tokenized-funds/nillion/payout-ledger.js

import { isDeepStrictEqual } from 'node:util';

import {
  buildNillionPayoutDraft,
} from './payouts.js';

import {
  verifyNillionPaymentTransfer,
} from './payment-receipt.js';

function amount(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error('Invalid ledger amount.');
  }

  return BigInt(value);
}

function obligationKey(batchId, positionId) {
  return JSON.stringify([batchId, positionId]);
}

function jsonSafe(value) {
  return JSON.parse(
    JSON.stringify(
      value,
      (_key, item) =>
        typeof item === 'bigint' ? item.toString() : item,
    ),
  );
}

function restoreVerification(stored) {
  if (
    !stored ||
    !stored.receipt ||
    !Array.isArray(stored.receipt.logs) ||
    !stored.canonicalBlock ||
    !stored.finalizedBlock
  ) {
    throw new Error('Invalid stored payment verification.');
  }

  return {
    ...stored,
    receipt: {
      ...stored.receipt,
      blockNumber: amount(stored.receipt.blockNumber),
      logs: stored.receipt.logs.map((log) => ({
        ...log,
        blockNumber: amount(log.blockNumber),
      })),
    },
    canonicalBlock: {
      ...stored.canonicalBlock,
      number: amount(stored.canonicalBlock.number),
    },
    finalizedBlock: {
      ...stored.finalizedBlock,
      number: amount(stored.finalizedBlock.number),
    },
  };
}

function settlementBalances(ledger) {
  const settlements = ledger.settlements ?? [];

  if (!Array.isArray(settlements)) {
    throw new Error('Invalid settlements list.');
  }

  const obligations = new Map();

  for (const entry of ledger.entries) {
    for (const position of entry.positions) {
      obligations.set(
        obligationKey(entry.batchId, position.positionId),
        { entry, position },
      );
    }
  }

  const usedEvents = new Set();
  const paid = new Map();

  for (const settlement of settlements) {
    if (
      !settlement ||
      !Array.isArray(settlement.allocations) ||
      settlement.allocations.length === 0
    ) {
      throw new Error('Settlement requires obligation allocations.');
    }

    const transfer = verifyNillionPaymentTransfer(
      restoreVerification(settlement.verification),
    );

    if (usedEvents.has(transfer.eventId)) {
      throw new Error('Payment transfer event is already recorded.');
    }

    usedEvents.add(transfer.eventId);

    const allocatedKeys = new Set();
    let totalAssigned = 0n;

    for (const allocation of settlement.allocations) {
      if (
        typeof allocation.batchId !== 'string' ||
        typeof allocation.positionId !== 'string'
      ) {
        throw new Error('Invalid payment allocation reference.');
      }

      const key = obligationKey(
        allocation.batchId,
        allocation.positionId,
      );

      if (allocatedKeys.has(key)) {
        throw new Error('Duplicate obligation within a settlement.');
      }

      allocatedKeys.add(key);

      const obligation = obligations.get(key);

      if (!obligation) {
        throw new Error('Payment references an unknown obligation.');
      }

      const { entry, position } = obligation;

      if (
        position.wallet === null ||
        position.wallet.toLowerCase() !== transfer.to
      ) {
        throw new Error('Payment recipient does not match the obligation.');
      }

      // Initial scope: direct operating-wallet distributions only.
      if (
        typeof entry.owner !== 'string' ||
        entry.owner.toLowerCase() !== transfer.from
      ) {
        throw new Error('Payment sender does not match the recorded owner.');
      }

      const paymentBlock = amount(transfer.blockNumber);

      if (
        entry.claims.some(
          (claim) => amount(claim.blockNumber) > paymentBlock,
        )
      ) {
        throw new Error('Payment predates a claim funding this obligation.');
      }

      const assigned = amount(allocation.amountBaseUnits);

      if (assigned <= 0n) {
        throw new Error('Payment allocation must be positive.');
      }

      const alreadyPaid = paid.get(key) ?? 0n;
      const nextPaid = alreadyPaid + assigned;

      if (nextPaid > amount(position.allocatedBaseUnits)) {
        throw new Error('Payment exceeds the obligation unpaid balance.');
      }

      paid.set(key, nextPaid);
      totalAssigned += assigned;
    }

    if (totalAssigned !== amount(transfer.amountBaseUnits)) {
      throw new Error('Settlement allocations must equal the full transfer.');
    }
  }

  return paid;
}

function validateLedger(ledger) {
  if (
    ledger?.schemaVersion !== 1 ||
    ledger.chainId !== 1 ||
    ledger.currency !== 'NIL' ||
    ledger.decimals !== 6 ||
    !Array.isArray(ledger.entries)
  ) {
    throw new Error('Invalid payout ledger.');
  }

  const batches = new Set();
  const claims = new Set();

  for (const entry of ledger.entries) {
    if (
      entry.status !== 'recorded' ||
      typeof entry.batchId !== 'string' ||
      batches.has(entry.batchId) ||
      !Array.isArray(entry.claims) ||
      entry.claims.length === 0 ||
      !Array.isArray(entry.positions) ||
      entry.positions.length === 0
    ) {
      throw new Error('Invalid recorded ledger entry.');
    }

    // Fail closed until receipt-verified payment recording is implemented.
    if (!Array.isArray(entry.payments) || entry.payments.length !== 0) {
      throw new Error('Payment reconciliation is not enabled in this version.');
    }

    batches.add(entry.batchId);

    let claimed = 0n;

    for (const claim of entry.claims) {
      if (
        typeof claim.eventId !== 'string' ||
        claims.has(claim.eventId)
      ) {
        throw new Error('Duplicate or invalid recorded claim.');
      }

      claims.add(claim.eventId);
      claimed += amount(claim.amountBaseUnits);
    }

    const positionIds = new Set();
    let allocated = 0n;
    let walletPending = 0n;

    for (const position of entry.positions) {
      if (
        typeof position.positionId !== 'string' ||
        positionIds.has(position.positionId) ||
        (
          position.wallet !== null &&
          (
            typeof position.wallet !== 'string' ||
            !/^0x[0-9a-fA-F]{40}$/.test(position.wallet)
          )
        )
      ) {
        throw new Error('Invalid recorded position.');
      }

      positionIds.add(position.positionId);

      const value = amount(position.allocatedBaseUnits);
      allocated += value;

      if (position.wallet === null) {
        walletPending += value;
      }
    }

    const gross = amount(entry.grossClaimedBaseUnits);
    const fee = amount(entry.managementFeeBaseUnits);
    const distributable = amount(entry.distributableBaseUnits);
    const remainder = amount(entry.roundingRemainderBaseUnits);

    if (
      gross !== claimed ||
      gross !== fee + distributable ||
      distributable !== allocated + remainder ||
      amount(entry.allocatedBaseUnits) !== allocated ||
      amount(entry.walletPendingBaseUnits) !== walletPending ||
      amount(entry.walletAssignedBaseUnits) !== allocated - walletPending
    ) {
      throw new Error('Recorded ledger totals do not reconcile.');
    }
  }
  settlementBalances(ledger);
}

export function recordNillionPayoutDraft({
  ledger,
  draft,
  allocationConfig,
  expectedOwner,
  reviewedAt,
}) {
  validateLedger(ledger);

  if (
    typeof reviewedAt !== 'string' ||
    !Number.isFinite(Date.parse(reviewedAt)) ||
    new Date(reviewedAt).toISOString() !== reviewedAt
  ) {
    throw new Error('reviewedAt must be an ISO UTC timestamp.');
  }

  if (!draft || draft.status !== 'draft') {
    throw new Error('Expected an unrecorded payout draft.');
  }

  const expected = buildNillionPayoutDraft({
    batchId: draft.batchId,
    nodeId: draft.nodeId,
    allocationConfig,
    onChainStakeBaseUnits: draft.recordedStakeBaseUnits,
    expectedOwner,
    claims: draft.claims,
    ledger,
  });

  if (!isDeepStrictEqual(draft, expected)) {
    throw new Error('Draft does not match the recalculated allocation.');
  }

  const recorded = {
    ...structuredClone(expected),
    status: 'recorded',
    reviewedAt,
  };

  const updated = {
    ...structuredClone(ledger),
    entries: [
      ...structuredClone(ledger.entries),
      recorded,
    ],
  };

  validateLedger(updated);

  return updated;
}

export function recordNillionPayment({
  ledger,
  verification,
  allocations,
}) {
  validateLedger(ledger);

  // Verify the supplied receipt before storing anything.
  verifyNillionPaymentTransfer(verification);

  const updated = structuredClone(ledger);

  updated.settlements = [
    ...(updated.settlements ?? []),
    {
      verification: jsonSafe(verification),
      allocations: structuredClone(allocations),
    },
  ];

  // Checks duplicate transfers, recipient/owner matching, assigned
  // amounts, and outstanding obligation limits across the whole ledger.
  validateLedger(updated);

  return updated;
}

export function summarizeNillionPayoutLedger(ledger) {
  validateLedger(ledger);

  const paidByObligation = settlementBalances(ledger);
  const positions = new Map();

  let totalAllocated = 0n;
  let totalPaid = 0n;
  let totalRemainder = 0n;

  for (const entry of ledger.entries) {
    totalRemainder += amount(entry.roundingRemainderBaseUnits);

    for (const position of entry.positions) {
      const key = JSON.stringify([
        entry.nodeId,
        position.positionId,
        position.wallet?.toLowerCase() ?? null,
      ]);

      const balance = positions.get(key) ?? {
        nodeId: entry.nodeId,
        positionId: position.positionId,
        wallet: position.wallet,
        allocated: 0n,
        paid: 0n,
        batchIds: [],
      };

      const allocated = amount(position.allocatedBaseUnits);
      const paid =
        paidByObligation.get(
          obligationKey(entry.batchId, position.positionId),
        ) ?? 0n;

      balance.allocated += allocated;
      balance.paid += paid;
      balance.batchIds.push(entry.batchId);

      totalAllocated += allocated;
      totalPaid += paid;

      positions.set(key, balance);
    }
  }

  return {
    currency: 'NIL',
    decimals: 6,
    paymentTrackingEnabled: true,
    totalRecordedAllocatedBaseUnits: totalAllocated.toString(),
    totalRecordedPaidBaseUnits: totalPaid.toString(),
    totalRecordedUnpaidBaseUnits:
      (totalAllocated - totalPaid).toString(),
    totalRoundingRemainderBaseUnits: totalRemainder.toString(),

    positions: [...positions.values()].map((position) => ({
      nodeId: position.nodeId,
      positionId: position.positionId,
      wallet: position.wallet,
      receivingWalletStatus:
        position.wallet === null ? 'pending' : 'provided',
      recordedAllocatedBaseUnits: position.allocated.toString(),
      recordedPaidBaseUnits: position.paid.toString(),
      recordedUnpaidBaseUnits:
        (position.allocated - position.paid).toString(),
      batchIds: position.batchIds,
    })),
  };
}