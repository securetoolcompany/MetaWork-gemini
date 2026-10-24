// lib/tokenized-funds/nillion/payout-ledger.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from './payouts.js';

import {
  recordNillionPayoutDraft,
  recordNillionPayment,
  summarizeNillionPayoutLedger,
} from './payout-ledger.js';

import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
} from 'viem';

import {
  NILLION_CONTRACTS,
} from './config.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const WALLET = '0x2222222222222222222222222222222222222222';
const REVIEWED_AT = '2026-10-24T16:00:00.000Z';

function fixture({
  nodeId = '19',
  batchId = 'batch-1',
  hashCharacter = 'a',
} = {}) {
  const ledger = createEmptyNillionPayoutLedger();

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
    batchId,
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

  return {
    ledger,
    draft,
    allocationConfig,
    expectedOwner: OWNER,
    reviewedAt: REVIEWED_AT,
  };
}

test('recording a draft creates obligations but no payments', () => {
  const args = fixture();
  const ledger = recordNillionPayoutDraft(args);

  assert.equal(ledger.entries[0].status, 'recorded');
  assert.equal(ledger.entries[0].reviewedAt, REVIEWED_AT);
  assert.deepEqual(ledger.entries[0].payments, []);

  const summary = summarizeNillionPayoutLedger(ledger);

  assert.equal(summary.paymentTrackingEnabled, true);
  assert.equal(summary.totalRecordedPaidBaseUnits, '0');
  assert.equal(summary.totalRecordedUnpaidBaseUnits, '6000000');
});

test('wallet-pending obligations remain allocated', () => {
  const ledger = recordNillionPayoutDraft(fixture());
  const summary = summarizeNillionPayoutLedger(ledger);

  const pending = summary.positions.find(
    (position) => position.wallet === null,
  );

  assert.ok(pending);
  assert.equal(pending.recordedUnpaidBaseUnits, '2400000');
  assert.equal(pending.receivingWalletStatus, 'pending');
});

test('recording does not mutate the input ledger or draft', () => {
  const args = fixture();
  const before = JSON.stringify(args);

  recordNillionPayoutDraft(args);

  assert.equal(JSON.stringify(args), before);
});

test('refuses altered draft allocations', () => {
  const args = fixture();
  args.draft.positions[0].allocatedBaseUnits = '9999999';

  assert.throws(
    () => recordNillionPayoutDraft(args),
    /does not match/,
  );
});

test('refuses to record a batch twice', () => {
  const args = fixture();
  const ledger = recordNillionPayoutDraft(args);

  assert.throws(
    () => recordNillionPayoutDraft({ ...args, ledger }),
    /already recorded/,
  );
});

test('refuses the same claim under a different batch ID', () => {
  const args = fixture();
  const ledger = recordNillionPayoutDraft(args);

  args.draft.batchId = 'different-batch';

  assert.throws(
    () => recordNillionPayoutDraft({ ...args, ledger }),
    /already recorded/,
  );
});

test('accumulates unpaid obligations across batches', () => {
  const first = fixture();
  const ledger = recordNillionPayoutDraft(first);

  const second = fixture({
    batchId: 'batch-2',
    hashCharacter: 'c',
  });

  const updated = recordNillionPayoutDraft({
    ...second,
    ledger,
  });

  const summary = summarizeNillionPayoutLedger(updated);

  assert.equal(summary.totalRecordedUnpaidBaseUnits, '12000000');

  const position = summary.positions.find(
    (entry) => entry.positionId === 'position-a',
  );

  assert.equal(position.recordedUnpaidBaseUnits, '7200000');
  assert.equal(position.batchIds.length, 2);
});

test('keeps obligations separate by node', () => {
  const first = fixture();
  const ledger = recordNillionPayoutDraft(first);

  const second = fixture({
    nodeId: '20',
    batchId: 'node-20-batch',
    hashCharacter: 'c',
  });

  const updated = recordNillionPayoutDraft({
    ...second,
    ledger,
  });

  const summary = summarizeNillionPayoutLedger(updated);

  assert.equal(summary.positions.length, 4);
  assert.equal(summary.totalRecordedUnpaidBaseUnits, '12000000');
});

test('refuses unimplemented payment records rather than ignoring them', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  ledger.entries[0].payments.push({
    amountBaseUnits: '1000000',
  });

  assert.throws(
    () => summarizeNillionPayoutLedger(ledger),
    /Payment reconciliation is not enabled/,
  );
});

test('empty ledger produces no obligations', () => {
  const summary = summarizeNillionPayoutLedger(
    createEmptyNillionPayoutLedger(),
  );

  assert.equal(summary.totalRecordedUnpaidBaseUnits, '0');
  assert.deepEqual(summary.positions, []);
});

test('rejects corrupted recorded totals', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  ledger.entries[0].grossClaimedBaseUnits = '1';

  assert.throws(
    () => summarizeNillionPayoutLedger(ledger),
    /do not reconcile/,
  );
});

test('recorded ledger and summary are JSON-safe', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  assert.doesNotThrow(() => JSON.stringify(ledger));
  assert.doesNotThrow(
    () => JSON.stringify(summarizeNillionPayoutLedger(ledger)),
  );
});

const paymentTransferAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function paymentVerification({
  value = '1000000',
  hashCharacter = 'd',
  recipient = WALLET,
} = {}) {
  const transactionHash = `0x${hashCharacter.repeat(64)}`;
  const blockHash = `0x${'e'.repeat(64)}`;

  return {
    chainId: 1,
    transactionHash,
    logIndex: '9',
    expectedSender: OWNER,
    expectedRecipient: recipient,
    expectedAmountBaseUnits: value,

    receipt: {
      status: 'success',
      transactionHash,
      blockNumber: 200n,
      blockHash,
      logs: [
        {
          address: NILLION_CONTRACTS.nilToken,
          transactionHash,
          blockNumber: 200n,
          blockHash,
          logIndex: 9,
          removed: false,
          topics: encodeEventTopics({
            abi: paymentTransferAbi,
            eventName: 'Transfer',
            args: { from: OWNER, to: recipient },
          }),
          data: encodeAbiParameters(
            [{ type: 'uint256' }],
            [BigInt(value)],
          ),
        },
      ],
    },

    canonicalBlock: { number: 200n, hash: blockHash },
    finalizedBlock: { number: 200n, hash: blockHash },
  };
}

function paymentAllocation({
  batchId = 'batch-1',
  positionId = 'position-a',
  value = '1000000',
} = {}) {
  return {
    batchId,
    positionId,
    amountBaseUnits: value,
  };
}

test('partial payment reduces unpaid balance without mutating inputs', () => {
  const ledger = recordNillionPayoutDraft(fixture());
  const before = JSON.stringify(ledger);

  const updated = recordNillionPayment({
    ledger,
    verification: paymentVerification(),
    allocations: [paymentAllocation()],
  });

  const summary = summarizeNillionPayoutLedger(updated);

  assert.equal(summary.totalRecordedPaidBaseUnits, '1000000');
  assert.equal(summary.totalRecordedUnpaidBaseUnits, '5000000');
  assert.equal(JSON.stringify(ledger), before);

  const position = summary.positions.find(
    (entry) => entry.positionId === 'position-a',
  );

  assert.equal(position.recordedPaidBaseUnits, '1000000');
  assert.equal(position.recordedUnpaidBaseUnits, '2600000');

  assert.doesNotThrow(() => JSON.stringify(updated));
});

test('fully settling a position leaves other positions unpaid', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  const updated = recordNillionPayment({
    ledger,
    verification: paymentVerification({ value: '3600000' }),
    allocations: [paymentAllocation({ value: '3600000' })],
  });

  const summary = summarizeNillionPayoutLedger(updated);

  assert.equal(summary.totalRecordedUnpaidBaseUnits, '2400000');

  const position = summary.positions.find(
    (entry) => entry.positionId === 'position-a',
  );

  assert.equal(position.recordedUnpaidBaseUnits, '0');
});

test('refuses the same payment transfer twice', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  const first = recordNillionPayment({
    ledger,
    verification: paymentVerification(),
    allocations: [paymentAllocation()],
  });

  assert.throws(
    () => recordNillionPayment({
      ledger: first,
      verification: paymentVerification(),
      allocations: [paymentAllocation()],
    }),
    /already recorded/,
  );
});

test('refuses cumulative overpayment', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  const first = recordNillionPayment({
    ledger,
    verification: paymentVerification({ value: '3000000' }),
    allocations: [paymentAllocation({ value: '3000000' })],
  });

  assert.throws(
    () => recordNillionPayment({
      ledger: first,
      verification: paymentVerification({ hashCharacter: 'f' }),
      allocations: [paymentAllocation()],
    }),
    /exceeds the obligation unpaid balance/,
  );
});

test('refuses allocation to a wallet-pending position', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  assert.throws(
    () => recordNillionPayment({
      ledger,
      verification: paymentVerification(),
      allocations: [
        paymentAllocation({ positionId: 'position-b' }),
      ],
    }),
    /recipient does not match/,
  );
});

test('refuses unknown obligations', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  assert.throws(
    () => recordNillionPayment({
      ledger,
      verification: paymentVerification(),
      allocations: [
        paymentAllocation({ batchId: 'missing-batch' }),
      ],
    }),
    /unknown obligation/,
  );
});

test('requires assignments to account for the entire transfer', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  assert.throws(
    () => recordNillionPayment({
      ledger,
      verification: paymentVerification(),
      allocations: [paymentAllocation({ value: '500000' })],
    }),
    /equal the full transfer/,
  );
});

test('refuses duplicate obligation references within a payment', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  assert.throws(
    () => recordNillionPayment({
      ledger,
      verification: paymentVerification(),
      allocations: [
        paymentAllocation({ value: '500000' }),
        paymentAllocation({ value: '500000' }),
      ],
    }),
    /Duplicate obligation/,
  );
});

test('one transfer can settle obligations from two nodes', () => {
  const first = fixture();
  const firstLedger = recordNillionPayoutDraft(first);

  const second = fixture({
    nodeId: '20',
    batchId: 'node-20-batch',
    hashCharacter: 'c',
  });

  const ledger = recordNillionPayoutDraft({
    ...second,
    ledger: firstLedger,
  });

  const updated = recordNillionPayment({
    ledger,
    verification: paymentVerification({ value: '2000000' }),
    allocations: [
      paymentAllocation(),
      paymentAllocation({ batchId: 'node-20-batch' }),
    ],
  });

  const summary = summarizeNillionPayoutLedger(updated);

  assert.equal(summary.totalRecordedPaidBaseUnits, '2000000');
  assert.equal(summary.totalRecordedUnpaidBaseUnits, '10000000');

  for (const nodeId of ['19', '20']) {
    const position = summary.positions.find(
      (entry) =>
        entry.nodeId === nodeId &&
        entry.positionId === 'position-a',
    );

    assert.equal(position.recordedPaidBaseUnits, '1000000');
    assert.equal(position.recordedUnpaidBaseUnits, '2600000');
  }
});

test('adding another draft preserves existing payment accounting', () => {
  const firstLedger = recordNillionPayoutDraft(fixture());

  const paidLedger = recordNillionPayment({
    ledger: firstLedger,
    verification: paymentVerification(),
    allocations: [paymentAllocation()],
  });

  const next = fixture({
    batchId: 'batch-2',
    hashCharacter: 'c',
  });

  const updated = recordNillionPayoutDraft({
    ...next,
    ledger: paidLedger,
  });

  const summary = summarizeNillionPayoutLedger(updated);

  assert.equal(summary.totalRecordedAllocatedBaseUnits, '12000000');
  assert.equal(summary.totalRecordedPaidBaseUnits, '1000000');
  assert.equal(summary.totalRecordedUnpaidBaseUnits, '11000000');
});

test('summary rejects a payment allocation altered after recording', () => {
  const ledger = recordNillionPayoutDraft(fixture());

  const updated = recordNillionPayment({
    ledger,
    verification: paymentVerification(),
    allocations: [paymentAllocation()],
  });

  updated.settlements[0].allocations[0].amountBaseUnits = '9999999';

  assert.throws(
    () => summarizeNillionPayoutLedger(updated),
    /exceeds the obligation unpaid balance/,
  );
});