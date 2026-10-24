// lib/tokenized-funds/nillion/payouts.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from './payouts.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const WALLET = '0x2222222222222222222222222222222222222222';
const TX = `0x${'a'.repeat(64)}`;
const BLOCK = `0x${'b'.repeat(64)}`;

function input() {
  return {
    batchId: 'node-19-first-draft',
    nodeId: '19',
    allocationConfig: {
      version: 2,
      managementFeeBps: 5000,
    managementFeeBasis: 'gross_rewards_operator_covers_costs',
      nodes: {
        '19': {
          stakers: [
            { id: 'position-a', wallet: WALLET, amountNil: '60' },
            { id: 'position-b', wallet: null, amountNil: '40' },
          ],
        },
      },
    },
    onChainStakeBaseUnits: '100000000',
    expectedOwner: OWNER,
    claims: [
      {
        nodeId: '19',
        owner: OWNER,
        transactionHash: TX,
        logIndex: '7',
        blockNumber: '100',
        blockHash: BLOCK,
        amountBaseUnits: '12000000',
      },
    ],
    ledger: createEmptyNillionPayoutLedger(),
  };
}

test('allocates actual claimed NIL after a 50% fee', () => {
  const result = buildNillionPayoutDraft(input());

  assert.equal(result.status, 'draft');
  assert.equal(result.grossClaimedBaseUnits, '12000000');
  assert.equal(result.managementFeeBaseUnits, '6000000');
  assert.equal(result.distributableBaseUnits, '6000000');
  assert.equal(result.positions[0].allocatedBaseUnits, '3600000');
  assert.equal(result.positions[1].allocatedBaseUnits, '2400000');
  assert.equal(result.allocationVersion, 2);
  assert.deepEqual(result.payments, []);
});

test('holds wallet-pending rewards without redistributing them', () => {
  const result = buildNillionPayoutDraft(input());

  assert.equal(result.walletPendingBaseUnits, '2400000');
  assert.equal(result.walletAssignedBaseUnits, '3600000');
  assert.equal(result.positions[1].wallet, null);
});

test('reconciles the fee, allocations, and rounding remainder', () => {
  const args = input();
  args.claims[0].amountBaseUnits = '12000003';

  const result = buildNillionPayoutDraft(args);

  assert.equal(
    BigInt(result.managementFeeBaseUnits) +
      BigInt(result.allocatedBaseUnits) +
      BigInt(result.roundingRemainderBaseUnits),
    BigInt(result.grossClaimedBaseUnits),
  );

  assert.equal(result.roundingRemainderBaseUnits, '1');
});

test('rejects duplicate claims within a draft', () => {
  const args = input();
  args.claims.push({ ...args.claims[0] });

  assert.throws(
    () => buildNillionPayoutDraft(args),
    /duplicated or already recorded/,
  );
});

test('rejects claims already recorded in the ledger', () => {
  const args = input();
  const previous = buildNillionPayoutDraft(args);

  args.batchId = 'node-19-second-draft';
  args.ledger.entries.push(previous);

  assert.throws(
    () => buildNillionPayoutDraft(args),
    /duplicated or already recorded/,
  );
});

test('rejects an existing batch ID', () => {
  const args = input();
  args.ledger.entries.push(buildNillionPayoutDraft(args));

  assert.throws(
    () => buildNillionPayoutDraft(args),
    /Batch ID is already recorded/,
  );
});

test('refuses allocation drift', () => {
  const args = input();
  args.onChainStakeBaseUnits = '99000000';

  assert.throws(
    () => buildNillionPayoutDraft(args),
    /do not match on-chain stake/,
  );
});

test('refuses the wrong node or owner', () => {
  const args = input();
  args.claims[0].nodeId = '20';

  assert.throws(
    () => buildNillionPayoutDraft(args),
    /different node/,
  );

  args.claims[0].nodeId = '19';
  args.claims[0].owner = WALLET;

  assert.throws(
    () => buildNillionPayoutDraft(args),
    /owner does not match/,
  );
});

test('refuses a fee other than 50%', () => {
  const args = input();
  args.allocationConfig.managementFeeBps = 1000;

  assert.throws(
    () => buildNillionPayoutDraft(args),
    /50% fee/,
  );
});

test('does not mutate inputs and returns JSON-safe values', () => {
  const args = input();
  const before = JSON.stringify(args);

  const result = buildNillionPayoutDraft(args);

  assert.equal(JSON.stringify(args), before);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('rejects missing and legacy fee bases for new payout drafts', () => {
  for (const basis of [undefined, 'rewards_after_operating_costs']) {
    const args = input();
    args.allocationConfig.managementFeeBasis = basis;
    assert.throws(
      () => buildNillionPayoutDraft(args),
      /Unsupported Nillion management fee basis/,
    );
  }
});

test('records the shared gross-rewards policy on new payout drafts', () => {
  const result = buildNillionPayoutDraft(input());
  assert.equal(result.managementFeeBasis, 'gross_rewards_operator_covers_costs');
  assert.equal(result.operatingCostsCoveredByManagementFee, true);
  assert.equal(result.investorOperatingCostDeductionBaseUnits, '0');
  assert.equal(result.operatingCostsDeductedFromInvestors, false);
});
