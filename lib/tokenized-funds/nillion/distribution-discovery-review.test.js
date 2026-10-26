// lib/tokenized-funds/nillion/distribution-discovery-review.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NILLION_EXPECTED_OWNER,
} from './config.js';

import {
  createEmptyNillionPayoutLedger,
} from './payouts.js';

import {
  buildNillionDistributionProposal,
} from './distribution-proposal.js';

import {
  createNillionDiscoveryReviewer,
} from './distribution-discovery-review.js';

const BLOCK_HASH = `0x${'a'.repeat(64)}`;

function fixture() {
  const state = {
    ledger: createEmptyNillionPayoutLedger(),
    allocationConfig: {
      version: 3,
      managementFeeBps: 5000,
      managementFeeBasis: 'gross_rewards_operator_covers_costs',
      nodes: {},
    },
    drafts: [],
  };

  function build(current) {
    return buildNillionDistributionProposal({
      ...current,
      expectedOwner: NILLION_EXPECTED_OWNER,
    });
  }

  const initial = build(state);

  const discovery = {
    sources: structuredClone(initial.sources),
    snapshot: {
      finality: 'finalized',
      blockNumber: '100',
      blockHash: BLOCK_HASH,
      blockTimestamp: '1792886400',
    },
    reviewedAt: '2026-10-25T00:00:00.000Z',
    drafts: [],
    nodeResults: [
      { nodeId: '19', status: 'no_new_claims' },
      { nodeId: '20', status: 'no_new_claims' },
    ],
    fixedAllocationConfirmation: {
      allocationSha256: initial.sources.allocationSha256,
      assertion: 'economic_allocations_unchanged_since_node_launch',
    },
    notices: ['Synthetic discovery fixture.'],
  };

  const captured = [];

  const dependencies = {
    discover: async (options) => {
      assert.equal(
        options.confirmedAllocationSha256,
        initial.sources.allocationSha256,
      );

      return structuredClone(discovery);
    },

    review: async ({ loadState }) => {
      const first = await loadState();
      const second = await loadState();

      captured.push(first, second);

      return {
        status: 'nothing_to_review',
        approved: false,
        executionEnabled: false,
        proposal: build(second),
        verification: {
          finalizedBlockNumber: '101',
        },
      };
    },
  };

  const options = {
    loadState: async () => structuredClone(state),
    confirmedAllocationSha256: initial.sources.allocationSha256,
    client: {
      async getBlock({ blockNumber }) {
        return {
          number: blockNumber,
          hash: BLOCK_HASH,
        };
      },
    },
  };

  return {
    state,
    discovery,
    captured,
    dependencies,
    options,
  };
}

async function run(f) {
  return createNillionDiscoveryReviewer(f.dependencies)(f.options);
}

test('connects discovery to review without changing source state', async () => {
  const f = fixture();
  const before = JSON.stringify(f.state);

  const result = await run(f);

  assert.equal(result.status, 'nothing_to_review');
  assert.equal(result.approved, false);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.claimDiscovery.newDraftCount, 0);
  assert.equal(result.claimDiscovery.ledgerChanged, false);
  assert.equal(result.claimDiscovery.nodeResults.length, 2);

  assert.equal(f.captured.length, 2);
  assert.deepEqual(f.captured[0].drafts, f.discovery.drafts);
  assert.equal(
    f.captured[0].reviewedAt,
    f.discovery.reviewedAt,
  );

  assert.equal(JSON.stringify(f.state), before);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('rejects missing confirmation before discovery', async () => {
  const f = fixture();
  let calls = 0;

  f.options.confirmedAllocationSha256 = undefined;
  f.dependencies.discover = async () => {
    calls += 1;
  };

  await assert.rejects(run(f), /explicit server-side/);
  assert.equal(calls, 0);
});

test('rejects confirmation for a different allocation configuration', async () => {
  const f = fixture();
  f.options.confirmedAllocationSha256 = '0'.repeat(64);

  await assert.rejects(run(f), /does not match current allocations/);
});

test('rejects discovery produced from different source inputs', async () => {
  const f = fixture();
  f.discovery.sources.ledgerSha256 = '0'.repeat(64);

  await assert.rejects(run(f), /does not match the source snapshot/);
});

test('rejects source changes before fresh review', async () => {
  const f = fixture();
  let loads = 0;

  f.options.loadState = async () => {
    loads += 1;
    const state = structuredClone(f.state);

    if (loads > 1) state.allocationConfig.version = 4;

    return state;
  };

  await assert.rejects(run(f), /Source state changed/);
});

test('rejects source changes between the reviewers state reloads', async () => {
  const f = fixture();
  let loads = 0;

  f.options.loadState = async () => {
    loads += 1;
    const state = structuredClone(f.state);

    if (loads > 2) state.allocationConfig.version = 4;

    return state;
  };

  await assert.rejects(run(f), /Source state changed/);
});

test('rejects a review finality anchor older than discovery', async () => {
  const f = fixture();
  const original = f.dependencies.review;

  f.dependencies.review = async (options) => {
    const result = await original(options);
    result.verification.finalizedBlockNumber = '99';
    return result;
  };

  await assert.rejects(run(f), /finality does not cover/);
});

test('rejects a discovery anchor changing during review', async () => {
  const f = fixture();

  f.options.client.getBlock = async ({ blockNumber }) => ({
    number: blockNumber,
    hash: `0x${'b'.repeat(64)}`,
  });

  await assert.rejects(run(f), /Discovery anchor changed/);
});