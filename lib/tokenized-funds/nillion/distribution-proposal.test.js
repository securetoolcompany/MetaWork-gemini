// lib/tokenized-funds/nillion/distribution-proposal.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
} from 'viem';

import {
  NILLION_CONTRACTS,
} from './config.js';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from './payouts.js';

import {
  recordNillionPayoutDraft,
  recordNillionPayment,
} from './payout-ledger.js';

import {
  buildNillionDistributionProposal,
} from './distribution-proposal.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const INVESTOR = '0x2222222222222222222222222222222222222222';
const REVIEWED_AT = '2026-10-24T20:00:00.000Z';

function config() {
  return {
    version: 3,
    managementFeeBps: 5000,
    managementFeeBasis: 'gross_rewards_operator_covers_costs',
    nodes: {
      '19': {
        stakers: [
          { id: 'operator', wallet: OWNER, amountNil: '40' },
          { id: 'investor', wallet: INVESTOR, amountNil: '40' },
          { id: 'pending', wallet: null, amountNil: '20' },
        ],
      },
    },
  };
}

function draft(ledger, allocationConfig, {
  batchId = 'batch-1',
  hashCharacter = 'a',
  gross = '12000000',
} = {}) {
  return buildNillionPayoutDraft({
    batchId,
    nodeId: '19',
    allocationConfig,
    onChainStakeBaseUnits: '100000000',
    expectedOwner: OWNER,
    claims: [
      {
        nodeId: '19',
        owner: OWNER,
        transactionHash: `0x${hashCharacter.repeat(64)}`,
        logIndex: '7',
        blockNumber: '100',
        blockHash: `0x${'b'.repeat(64)}`,
        amountBaseUnits: gross,
      },
    ],
    ledger,
  });
}

function input() {
  const ledger = createEmptyNillionPayoutLedger();
  const allocationConfig = config();

  return {
    ledger,
    allocationConfig,
    expectedOwner: OWNER,
    drafts: [draft(ledger, allocationConfig)],
    reviewedAt: REVIEWED_AT,
  };
}

function recordFirstBatch(args) {
  return recordNillionPayoutDraft({
    ledger: args.ledger,
    draft: args.drafts[0],
    allocationConfig: args.allocationConfig,
    expectedOwner: args.expectedOwner,
    reviewedAt: args.reviewedAt,
  });
}

function recordPartialInvestorPayment(ledger) {
  const transactionHash = `0x${'c'.repeat(64)}`;
  const blockHash = `0x${'d'.repeat(64)}`;
  const amount = '1000000';

  const topics = encodeEventTopics({
    abi: parseAbi([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]),
    eventName: 'Transfer',
    args: {
      from: OWNER,
      to: INVESTOR,
    },
  });

  const log = {
    address: NILLION_CONTRACTS.nilToken,
    transactionHash,
    blockHash,
    blockNumber: 200n,
    logIndex: 9,
    removed: false,
    topics,
    data: encodeAbiParameters(
      [{ type: 'uint256' }],
      [BigInt(amount)],
    ),
  };

  return recordNillionPayment({
    ledger,
    verification: {
      chainId: 1,
      transactionHash,
      logIndex: '9',
      expectedSender: OWNER,
      expectedRecipient: INVESTOR,
      expectedAmountBaseUnits: amount,
      receipt: {
        status: 'success',
        transactionHash,
        blockHash,
        blockNumber: 200n,
        logs: [log],
      },
      canonicalBlock: {
        number: 200n,
        hash: blockHash,
      },
      finalizedBlock: {
        number: 200n,
        hash: blockHash,
      },
    },
    allocations: [
      {
        batchId: 'batch-1',
        positionId: 'investor',
        amountBaseUnits: amount,
      },
    ],
  });
}

test('empty ledger produces no payable funds or invented obligations', () => {
  const args = input();
  args.drafts = [];

  const result = buildNillionDistributionProposal(args);

  assert.equal(result.status, 'nothing_to_review');
  assert.equal(result.accounting.grossClaimedBaseUnits, '0');
  assert.deepEqual(result.transfers, []);
  assert.deepEqual(result.walletPending, []);
  assert.deepEqual(result.operatorRetentionCandidates, []);
});

test('separates fee, operator ownership, investor transfers, and held shares', () => {
  const result = buildNillionDistributionProposal(input());

  assert.equal(result.accounting.grossClaimedBaseUnits, '12000000');
  assert.equal(result.accounting.recordedManagementFeeBaseUnits, '6000000');
  assert.equal(result.accounting.operatorOwnershipUnpaidBaseUnits, '2400000');
  assert.equal(result.accounting.proposedInvestorTransfersBaseUnits, '2400000');
  assert.equal(result.accounting.walletPendingUnpaidBaseUnits, '1200000');
  assert.equal(result.accounting.requiredOutstandingReserveBaseUnits, '6000000');

  assert.equal(result.transfers.length, 1);
  assert.equal(result.transfers[0].to, INVESTOR);
  assert.equal(result.transfers[0].amountBaseUnits, '2400000');

  assert.equal(result.operatorRetentionCandidates[0].positionId, 'operator');
  assert.equal(result.walletPending[0].positionId, 'pending');
  assert.ok(result.transfers.every((transfer) => transfer.to !== OWNER));
});

test('aggregates previous unpaid obligations and a new batch per recipient', () => {
  const args = input();
  args.ledger = recordFirstBatch(args);
  args.drafts = [
    draft(args.ledger, args.allocationConfig, {
      batchId: 'batch-2',
      hashCharacter: 'e',
    }),
  ];

  const result = buildNillionDistributionProposal(args);

  assert.equal(result.transfers.length, 1);
  assert.equal(result.transfers[0].amountBaseUnits, '4800000');
  assert.deepEqual(
    result.transfers[0].allocations.map((item) => item.batchId),
    ['batch-1', 'batch-2'],
  );
  assert.deepEqual(result.newBatchIds, ['batch-2']);
});

test('subtracts receipt-verified partial payments from proposed transfers', () => {
  const args = input();
  args.ledger = recordPartialInvestorPayment(recordFirstBatch(args));
  args.drafts = [];

  const result = buildNillionDistributionProposal(args);

  assert.equal(result.accounting.alreadyPaidBaseUnits, '1000000');
  assert.equal(result.transfers[0].amountBaseUnits, '1400000');
  assert.equal(result.transfers[0].allocations[0].amountBaseUnits, '1400000');
  assert.equal(result.accounting.requiredOutstandingReserveBaseUnits, '5000000');
});

test('tracks rounding remainder without assigning it to a recipient', () => {
  const args = input();
  args.drafts = [
    draft(args.ledger, args.allocationConfig, {
      gross: '12000003',
    }),
  ];

  const result = buildNillionDistributionProposal(args);

  assert.equal(result.accounting.roundingRemainderBaseUnits, '2');
  assert.equal(result.accounting.proposedInvestorTransfersBaseUnits, '2400000');
});

test('rejects an already-recorded claim rather than proposing it twice', () => {
  const args = input();
  args.ledger = recordFirstBatch(args);

  args.drafts = [
    {
      ...args.drafts[0],
      batchId: 'duplicate-claim-batch',
    },
  ];

  assert.throws(
    () => buildNillionDistributionProposal(args),
    /duplicated or already recorded/,
  );
});

test('rejects altered draft allocations', () => {
  const args = input();
  args.drafts[0].positions[1].allocatedBaseUnits = '9999999';

  assert.throws(
    () => buildNillionDistributionProposal(args),
    /does not match the recalculated allocation/,
  );
});

test('rejects a different owner and the old fee policy', () => {
  const wrongOwner = input();
  wrongOwner.ledger = recordFirstBatch(wrongOwner);
  wrongOwner.drafts = [];
  wrongOwner.expectedOwner = INVESTOR;

  assert.throws(
    () => buildNillionDistributionProposal(wrongOwner),
    /different operating owner/,
  );

  const oldPolicy = input();
  oldPolicy.allocationConfig.managementFeeBasis =
    'rewards_after_operating_costs';

  assert.throws(
    () => buildNillionDistributionProposal(oldPolicy),
    /Unsupported Nillion management fee basis/,
  );
});

test('rejects corrupted ledger totals', () => {
  const args = input();
  args.ledger = recordFirstBatch(args);
  args.drafts = [];
  args.ledger.entries[0].grossClaimedBaseUnits = '99999999';

  assert.throws(
    () => buildNillionDistributionProposal(args),
    /totals do not reconcile/,
  );
});

test('does not mutate inputs and returns JSON-safe prepare-only data', () => {
  const args = input();
  const before = JSON.stringify(args);

  const result = buildNillionDistributionProposal(args);

  assert.equal(JSON.stringify(args), before);
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.equal(result.approvalRequired, true);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.freshChainVerificationPerformed, false);
  assert.equal(result.fundingBalanceChecked, false);
  assert.equal(args.ledger.entries.length, 0);
  assert.match(result.proposalSha256, /^[a-f0-9]{64}$/);
});

test('produces the same digest for the same proposal inputs', () => {
  const args = input();

  const first = buildNillionDistributionProposal(args);
  const second = buildNillionDistributionProposal(structuredClone(args));

  assert.equal(first.proposalSha256, second.proposalSha256);
  assert.equal(first.sources.ledgerSha256, second.sources.ledgerSha256);
});

test('binds the current allocation version without rewriting historical obligations', () => {
  const args = input();
  args.ledger = recordFirstBatch(args);
  args.drafts = [];

  const first = buildNillionDistributionProposal(args);

  args.allocationConfig.version = 4;

  const second = buildNillionDistributionProposal(args);

  assert.notEqual(first.proposalSha256, second.proposalSha256);
  assert.notEqual(
    first.sources.allocationSha256,
    second.sources.allocationSha256,
  );
  assert.deepEqual(first.transfers, second.transfers);
  assert.equal(second.batches[0].allocationVersion, 3);
});