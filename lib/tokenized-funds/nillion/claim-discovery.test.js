// lib/tokenized-funds/nillion/claim-discovery.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NILLION_CONTRACTS,
  NILLION_EXPECTED_OWNER,
  NILLION_NODES,
} from './config.js';

import {
  createEmptyNillionPayoutLedger,
} from './payouts.js';

import {
  recordNillionPayoutDraft,
} from './payout-ledger.js';

import {
  buildNillionDistributionProposal,
} from './distribution-proposal.js';

import {
  discoverNillionClaimDrafts,
} from './claim-discovery.js';

const OWNER = NILLION_EXPECTED_OWNER;
const INVESTOR = '0x2222222222222222222222222222222222222222';
const TX = `0x${'a'.repeat(64)}`;

function hash(number) {
  return `0x${number.toString(16).padStart(64, '0')}`;
}

function fixture({ withClaim = true } = {}) {
  const ledger = createEmptyNillionPayoutLedger();

  const allocationConfig = {
    version: 3,
    managementFeeBps: 5000,
    managementFeeBasis: 'gross_rewards_operator_covers_costs',
    nodes: Object.fromEntries(
      NILLION_NODES.map((node) => [
        node.id,
        {
          stakers: [
            { id: `operator-${node.id}`, wallet: OWNER, amountNil: '40' },
            { id: `investor-${node.id}`, wallet: INVESTOR, amountNil: '40' },
            { id: `pending-${node.id}`, wallet: null, amountNil: '20' },
          ],
        },
      ]),
    ),
  };

  const finalized = BigInt(NILLION_NODES[0].rewardsStartBlock) + 2500n;
  const claimBlock = BigInt(NILLION_NODES[0].rewardsStartBlock) + 1n;

  const logs = withClaim
    ? [
        {
          address: NILLION_CONTRACTS.emissions,
          transactionHash: TX,
          blockHash: hash(claimBlock),
          blockNumber: claimBlock,
          logIndex: 7,
          removed: false,
          args: {
            nodeId: 19n,
            owner: OWNER,
            amount: 12000000n,
          },
        },
      ]
    : [];

  const ranges = [];
  const reads = [];

  const client = {
    async getChainId() {
      return 1;
    },

    async getBlock({ blockTag, blockNumber }) {
      const number = blockTag === 'finalized'
        ? finalized
        : blockNumber;

      return {
        number,
        hash: hash(number),
        timestamp: 1792886400n,
      };
    },

    async readContract(request) {
      reads.push(request);

      if (request.functionName === 'ownerOf') return OWNER;
      if (request.functionName === 'stakeOf') return 100000000n;

      throw new Error('Unexpected contract read.');
    },

    async getLogs(request) {
      ranges.push(request);

      return structuredClone(
        logs.filter(
          (log) =>
            log.args.nodeId === request.args.nodeId &&
            log.blockNumber >= request.fromBlock &&
            log.blockNumber <= request.toBlock,
        ),
      );
    },
  };

  const confirmation = buildNillionDistributionProposal({
    ledger,
    allocationConfig,
    expectedOwner: OWNER,
  }).sources.allocationSha256;

  return {
    ledger,
    allocationConfig,
    confirmedAllocationSha256: confirmation,
    client,
    logs,
    ranges,
    reads,
    finalized,
  };
}

async function discover(f) {
  return discoverNillionClaimDrafts(f);
}

test('discovers a finalized claim and uses the existing allocation builder', async () => {
  const f = fixture();
  const result = await discover(f);

  assert.equal(result.drafts.length, 1);
  assert.equal(result.drafts[0].nodeId, '19');
  assert.equal(result.drafts[0].grossClaimedBaseUnits, '12000000');
  assert.equal(result.drafts[0].managementFeeBaseUnits, '6000000');
  assert.equal(result.drafts[0].walletPendingBaseUnits, '1200000');
  assert.equal(result.executionEnabled, false);
  assert.equal(result.nodeResults[1].status, 'no_new_claims');

  assert.ok(
    f.reads.every((request) => request.blockNumber === f.finalized),
  );
});

test('empty preclaim state checks both nodes without inventing drafts', async () => {
  const f = fixture({ withClaim: false });
  const result = await discover(f);

  assert.deepEqual(result.drafts, []);
  assert.equal(result.nodeResults.length, 2);
  assert.ok(
    result.nodeResults.every((node) => node.status === 'no_new_claims'),
  );
  assert.equal(
    f.reads.filter((request) => request.functionName === 'ownerOf').length,
    2,
  );
});

test('scans contiguous bounded ranges through the pinned finalized block', async () => {
  const f = fixture();
  await discover(f);

  for (const node of NILLION_NODES) {
    const ranges = f.ranges.filter(
      (request) => request.args.nodeId === BigInt(node.id),
    );

    assert.equal(ranges[0].fromBlock, BigInt(node.rewardsStartBlock));
    assert.equal(ranges.at(-1).toBlock, f.finalized);

    for (let index = 0; index < ranges.length; index += 1) {
      const range = ranges[index];

      assert.ok(range.toBlock - range.fromBlock + 1n <= 2000n);
      assert.equal(range.address, NILLION_CONTRACTS.emissions);
      assert.equal(range.strict, true);

      if (index > 0) {
        assert.equal(range.fromBlock, ranges[index - 1].toBlock + 1n);
      }
    }
  }
});

test('excludes already-recorded claims', async () => {
  const f = fixture();
  const first = await discover(f);

  f.ledger = recordNillionPayoutDraft({
    ledger: f.ledger,
    draft: first.drafts[0],
    allocationConfig: f.allocationConfig,
    expectedOwner: OWNER,
    reviewedAt: first.reviewedAt,
  });

  const second = await discover(f);

  assert.deepEqual(second.drafts, []);
  assert.equal(second.nodeResults[0].totalClaimEventsFound, 1);
  assert.equal(second.nodeResults[0].newClaimEvents, 0);
});

test('requires confirmation of the exact allocation configuration', async () => {
  const f = fixture();
  f.confirmedAllocationSha256 = '0'.repeat(64);

  await assert.rejects(discover(f), /history must be confirmed/);
});

test('rejects another chain', async () => {
  const f = fixture();
  f.client.getChainId = async () => 137;

  await assert.rejects(discover(f), /not Ethereum mainnet/);
});

test('rejects a changed owner even when there are no claims', async () => {
  const f = fixture({ withClaim: false });
  const original = f.client.readContract;

  f.client.readContract = async (request) =>
    request.functionName === 'ownerOf'
      ? INVESTOR
      : original(request);

  await assert.rejects(discover(f), /unexpected current owner/);
});

test('rejects a stake mismatch even when there are no claims', async () => {
  const f = fixture({ withClaim: false });
  const original = f.client.readContract;

  f.client.readContract = async (request) =>
    request.functionName === 'stakeOf'
      ? 99000000n
      : original(request);

  await assert.rejects(discover(f), /current stake mismatch/);
});

test('rejects duplicate and removed claim logs', async () => {
  const duplicate = fixture();
  duplicate.logs.push(structuredClone(duplicate.logs[0]));

  await assert.rejects(discover(duplicate), /duplicate claim event/);

  const removed = fixture();
  removed.logs[0].removed = true;

  await assert.rejects(discover(removed), /unexpected claim log/);
});

test('rejects claims returned outside the requested range', async () => {
  const f = fixture();
  const log = structuredClone(f.logs[0]);

  log.blockNumber = f.finalized + 1n;
  f.client.getLogs = async () => [log];

  await assert.rejects(discover(f), /outside the requested range/);
});

test('rejects a changed discovery snapshot', async () => {
  const f = fixture();
  const original = f.client.getBlock;

  f.client.getBlock = async (request) => {
    const block = await original(request);

    return request.blockNumber === f.finalized
      ? { ...block, hash: `0x${'f'.repeat(64)}` }
      : block;
  };

  await assert.rejects(discover(f), /Discovery snapshot changed/);
});

test('does not mutate source state and returns JSON-safe discovery data', async () => {
  const f = fixture();

  const before = JSON.stringify({
    ledger: f.ledger,
    allocationConfig: f.allocationConfig,
  });

  const result = await discover(f);

  assert.equal(
    JSON.stringify({
      ledger: f.ledger,
      allocationConfig: f.allocationConfig,
    }),
    before,
  );

  assert.doesNotThrow(() => JSON.stringify(result));
  assert.equal(f.ledger.entries.length, 0);
  assert.equal(result.approvalRequired, true);
});