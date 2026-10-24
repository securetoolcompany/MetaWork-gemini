// lib/tokenized-funds/nillion/payout-report.js

import {
  summarizeNillionPayoutLedger,
} from './payout-ledger.js';

function sum(values) {
  return values.reduce(
    (total, value) => total + BigInt(value),
    0n,
  ).toString();
}

export function buildNillionPayoutReports(ledger, nodeIds) {
  // Validates accounting and stored settlement evidence.
  // Does not perform fresh RPC verification.
  const summary = summarizeNillionPayoutLedger(ledger);

  const reports = {};

  for (const inputId of nodeIds) {
    const nodeId = String(inputId);

    const entries = ledger.entries.filter(
      (entry) => entry.nodeId === nodeId,
    );

    const positions = summary.positions.filter(
      (position) => position.nodeId === nodeId,
    );

    const entriesByBatch = new Map(
      entries.map((entry) => [entry.batchId, entry]),
    );

    const payments = [];

    for (const settlement of ledger.settlements ?? []) {
      const evidence = settlement.verification;

      for (const allocation of settlement.allocations) {
        const entry = entriesByBatch.get(allocation.batchId);

        if (!entry) continue;

        const position = entry.positions.find(
          (item) => item.positionId === allocation.positionId,
        );

        payments.push({
          batchId: allocation.batchId,
          positionId: allocation.positionId,
          wallet: position.wallet,
          amountBaseUnits: allocation.amountBaseUnits,
          transactionHash: evidence.transactionHash.toLowerCase(),
          logIndex: evidence.logIndex,
          blockNumber: evidence.receipt.blockNumber,
          blockHash: evidence.receipt.blockHash,
        });
      }
    }

    payments.sort((left, right) => {
      const leftBlock = BigInt(left.blockNumber);
      const rightBlock = BigInt(right.blockNumber);

      if (leftBlock !== rightBlock) {
        return leftBlock > rightBlock ? -1 : 1;
      }

      const leftIndex = BigInt(left.logIndex);
      const rightIndex = BigInt(right.logIndex);

      if (leftIndex === rightIndex) return 0;
      return leftIndex > rightIndex ? -1 : 1;
    });

    reports[nodeId] = {
      available: true,
      status: entries.length === 0 ? 'empty' : 'recorded',
      currency: 'NIL',
      decimals: 6,
      scope: 'recorded_ledger_only',
      includesLiveUnclaimedRewards: false,
      freshChainVerificationPerformed: false,

      message:
        entries.length === 0
          ? 'No distributions recorded yet. This does not mean the node has earned no rewards.'
          : 'Recorded distributions and reconciled payments only. Live unclaimed reward estimates are separate.',

      totals: {
        grossClaimedBaseUnits: sum(
          entries.map((entry) => entry.grossClaimedBaseUnits),
        ),
        managementFeeBaseUnits: sum(
          entries.map((entry) => entry.managementFeeBaseUnits),
        ),
        recordedAllocatedBaseUnits: sum(
          positions.map(
            (position) => position.recordedAllocatedBaseUnits,
          ),
        ),
        recordedPaidBaseUnits: sum(
          positions.map(
            (position) => position.recordedPaidBaseUnits,
          ),
        ),
        recordedUnpaidBaseUnits: sum(
          positions.map(
            (position) => position.recordedUnpaidBaseUnits,
          ),
        ),
        roundingRemainderBaseUnits: sum(
          entries.map((entry) => entry.roundingRemainderBaseUnits),
        ),
      },

      positions,

      batches: entries.map((entry) => ({
        batchId: entry.batchId,
        allocationVersion: entry.allocationVersion,
        reviewedAt: entry.reviewedAt,
        grossClaimedBaseUnits: entry.grossClaimedBaseUnits,
        managementFeeBaseUnits: entry.managementFeeBaseUnits,
        allocatedBaseUnits: entry.allocatedBaseUnits,
        roundingRemainderBaseUnits: entry.roundingRemainderBaseUnits,
      })),

      // Amounts here are assigned to individual obligations.
      // One transfer can legitimately appear in multiple rows.
      payments,
    };
  }

  return reports;
}