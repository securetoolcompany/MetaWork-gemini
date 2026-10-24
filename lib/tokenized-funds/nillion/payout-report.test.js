// lib/tokenized-funds/nillion/payout-report.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from './payouts.js';

import {
  recordNillionPayoutDraft,
} from './payout-ledger.js';

import {
  buildNillionPayoutReports,
} from './payout-report.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const WALLET = '0x2222222222222222222222222222222222222222';

function addBatch(ledger, nodeId, hashCharacter) {
  const allocationConfig = {
    version: 2,
    managementFeeBps: 5000,
    managementFeeBasis: 'gross_rewards_operator_covers_costs',
    nodes: {
      [nodeId]: {
        stakers: [
          { id: 'position-a', wallet: WALLET, amountNil: '60' },
          { id: 'position-b', wallet: null, amountNil: '40' },
        ],
      },
    },
  };

  const draft = buildNillionPayoutDraft({
    batchId: `node-${nodeId}-batch`,
    nodeId,
    allocationConfig,
    onChainStakeBaseUnits: '100000000',
    expectedOwner: OWNER,
    claims: [
      {
        nodeId,
        owner: OWNER,
        transactionHash: `0x${hashCharacter.repeat(64)}`,
        logIndex: '1',
        blockNumber: '100',
        blockHash: `0x${'b'.repeat(64)}`,
        amountBaseUnits: '12000000',
      },
    ],
    ledger,
  });

  return recordNillionPayoutDraft({
    ledger,
    draft,
    allocationConfig,
    expectedOwner: OWNER,
    reviewedAt: '2026-10-24T16:00:00.000Z',
  });
}

test('empty ledger explicitly reports no recorded distributions', () => {
  const reports = buildNillionPayoutReports(
    createEmptyNillionPayoutLedger(),
    ['19', '20'],
  );

  for (const nodeId of ['19', '20']) {
    const report = reports[nodeId];

    assert.equal(report.available, true);
    assert.equal(report.status, 'empty');
    assert.equal(report.scope, 'recorded_ledger_only');
    assert.equal(report.includesLiveUnclaimedRewards, false);
    assert.equal(report.totals.recordedPaidBaseUnits, '0');
    assert.deepEqual(report.positions, []);
    assert.deepEqual(report.payments, []);
  }
});

test('reports recorded allocations separately from payments', () => {
  const ledger = addBatch(
    createEmptyNillionPayoutLedger(),
    '19',
    'a',
  );

  const report = buildNillionPayoutReports(ledger, ['19'])['19'];

  assert.equal(report.status, 'recorded');
  assert.equal(report.totals.grossClaimedBaseUnits, '12000000');
  assert.equal(report.totals.managementFeeBaseUnits, '6000000');
  assert.equal(report.totals.recordedAllocatedBaseUnits, '6000000');
  assert.equal(report.totals.recordedPaidBaseUnits, '0');
  assert.equal(report.totals.recordedUnpaidBaseUnits, '6000000');
  assert.equal(report.batches.length, 1);
  assert.deepEqual(report.payments, []);
});

test('keeps node records separate even when wallet and position IDs match', () => {
  let ledger = createEmptyNillionPayoutLedger();
  ledger = addBatch(ledger, '19', 'a');
  ledger = addBatch(ledger, '20', 'c');

  const reports = buildNillionPayoutReports(ledger, ['19', '20']);

  for (const nodeId of ['19', '20']) {
    assert.equal(
      reports[nodeId].totals.recordedAllocatedBaseUnits,
      '6000000',
    );

    assert.equal(reports[nodeId].positions.length, 2);
    assert.equal(reports[nodeId].batches.length, 1);

    assert.ok(
      reports[nodeId].positions.every(
        (position) => position.nodeId === nodeId,
      ),
    );
  }
});

test('preserves wallet-pending positions in recorded reporting', () => {
  const ledger = addBatch(
    createEmptyNillionPayoutLedger(),
    '19',
    'a',
  );

  const report = buildNillionPayoutReports(ledger, ['19'])['19'];

  const pending = report.positions.find(
    (position) => position.wallet === null,
  );

  assert.ok(pending);
  assert.equal(pending.receivingWalletStatus, 'pending');
  assert.equal(pending.recordedUnpaidBaseUnits, '2400000');
});

test('rejects invalid accounting rather than reporting zero', () => {
  const ledger = addBatch(
    createEmptyNillionPayoutLedger(),
    '19',
    'a',
  );

  ledger.entries[0].grossClaimedBaseUnits = '1';

  assert.throws(
    () => buildNillionPayoutReports(ledger, ['19']),
    /do not reconcile/,
  );
});

test('report is JSON-safe and does not mutate the ledger', () => {
  const ledger = addBatch(
    createEmptyNillionPayoutLedger(),
    '19',
    'a',
  );

  const before = JSON.stringify(ledger);
  const reports = buildNillionPayoutReports(ledger, ['19']);

  assert.doesNotThrow(() => JSON.stringify(reports));
  assert.equal(JSON.stringify(ledger), before);
});