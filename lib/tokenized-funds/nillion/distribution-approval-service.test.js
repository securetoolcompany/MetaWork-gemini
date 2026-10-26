// lib/tokenized-funds/nillion/distribution-approval-service.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { NILLION_EXPECTED_OWNER } from './config.js';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from './payouts.js';

import {
  buildNillionDistributionProposal,
} from './distribution-proposal.js';

import {
  NillionApprovalError,
  createNillionApprovalService,
  rebuildNillionDraftsFromProposal,
} from './distribution-approval-service.js';

const OWNER = NILLION_EXPECTED_OWNER;
const INVESTOR = '0x2222222222222222222222222222222222222222';
const REVIEWED_AT = '2026-10-25T03:00:00.000Z';
const NOW = new Date('2026-10-25T04:00:00.000Z');

function state(version = 3) {
  return {
    ledger: createEmptyNillionPayoutLedger(),
    allocationConfig: {
      version,
      managementFeeBps: 5000,
      managementFeeBasis: 'gross_rewards_operator_covers_costs',
      nodes: {
        '19': {
          stakers: [
            { id: 'operator', wallet: OWNER, amountNil: '50' },
            { id: 'investor', wallet: INVESTOR, amountNil: '50' },
          ],
        },
      },
    },
  };
}

function draftFor(current, batchId = 'frozen-batch', hashCharacter = 'a') {
  return buildNillionPayoutDraft({
    batchId,
    nodeId: '19',
    allocationConfig: current.allocationConfig,
    onChainStakeBaseUnits: '100000000',
    expectedOwner: OWNER,
    ledger: current.ledger,
    claims: [
      {
        nodeId: '19',
        owner: OWNER,
        transactionHash: `0x${hashCharacter.repeat(64)}`,
        logIndex: '7',
        blockNumber: '26134590',
        blockHash: `0x${'b'.repeat(64)}`,
        amountBaseUnits: '12000000',
      },
    ],
  });
}

function proposalFor(current, drafts, reviewedAt = REVIEWED_AT) {
  return buildNillionDistributionProposal({
    ledger: current.ledger,
    allocationConfig: current.allocationConfig,
    expectedOwner: OWNER,
    drafts,
    reviewedAt,
  });
}

function verifiedReview(proposal) {
  const reserve = proposal.accounting.requiredOutstandingReserveBaseUnits;

  return {
    status: 'verified_for_human_review',
    approved: false,
    executionEnabled: false,
    proposal,
    verification: {
      chainId: 1,
      fundingBalanceChecked: true,
      sourcesUnchangedDuringReview: true,
      ownerNilBalanceBaseUnits: reserve,
      requiredOutstandingReserveBaseUnits: reserve,
    },
  };
}

function fakeStore(initial = null) {
  const calls = [];
  let active = initial;

  return {
    calls,

    async expirePending() {
      calls.push(['expirePending']);
    },

    async getActive() {
      return active?.active ? structuredClone(active) : null;
    },

    async get(id) {
      return active && active._id === id ? structuredClone(active) : null;
    },

    async prepare(options) {
      calls.push(['prepare', structuredClone(options)]);

      active = {
        _id: options.review.proposal.proposalSha256,
        status: 'pending',
        active: true,
        review: structuredClone(options.review),
      };

      return structuredClone(active);
    },

    async approve(options) {
      calls.push(['approve', structuredClone(options)]);
      active = { ...active, status: 'approved' };
      return structuredClone(active);
    },

    async reject(options) {
      calls.push(['reject', structuredClone(options)]);
      active = { ...active, status: 'rejected', active: false };
      return structuredClone(active);
    },
  };
}

function setup({
  store = fakeStore(),
  loadState,
  reviewWithDiscovery,
  review,
} = {}) {
  const current = state();
  const calls = { discovery: 0, review: 0 };

  const reviewedProposal = proposalFor(current, [draftFor(current)]);

  const service = createNillionApprovalService({
    getStore: async () => store,
    createClient: () => ({ marker: 'client' }),
    getConfirmedAllocationSha256: () => 'a'.repeat(64),
    loadState: loadState ?? (async () => structuredClone(current)),

    reviewWithDiscovery:
      reviewWithDiscovery ??
      (async () => {
        calls.discovery += 1;

        return {
          ...verifiedReview(reviewedProposal),
          claimDiscovery: { newDraftCount: 1 },
        };
      }),

    review:
      review ??
      (async ({ loadState: loadFrozen }) => {
        calls.review += 1;
        const frozen = await loadFrozen();

        return verifiedReview(
          proposalFor(frozen, frozen.drafts, frozen.reviewedAt),
        );
      }),

    now: () => NOW,
  });

  return { service, store, calls, current };
}

function statusError(status) {
  return (error) =>
    error instanceof NillionApprovalError && error.status === status;
}

test('rebuilds the exact reviewed drafts from a stored proposal', () => {
  const current = state();
  const original = draftFor(current);
  const proposal = proposalFor(current, [original]);

  const rebuilt = rebuildNillionDraftsFromProposal(
    proposal,
    structuredClone(current),
  );

  assert.deepEqual(rebuilt.drafts, [original]);
  assert.equal(rebuilt.reviewedAt, REVIEWED_AT);

  const again = proposalFor(current, rebuilt.drafts);
  assert.equal(again.proposalSha256, proposal.proposalSha256);
});

test('rejects stored proposals with missing or inconsistent batches', () => {
  const current = state();

  const empty = proposalFor(current, []);
  assert.throws(
    () => rebuildNillionDraftsFromProposal(empty, current),
    /does not contain reviewable drafts/,
  );

  const proposal = proposalFor(current, [draftFor(current)]);
  const missing = structuredClone(proposal);
  missing.batches = [];

  assert.throws(
    () => rebuildNillionDraftsFromProposal(missing, current),
    /missing a reviewed batch/,
  );

  const two = proposalFor(current, [
    draftFor(current, 'frozen-batch', 'a'),
    draftFor(current, 'frozen-batch-2', 'c'),
  ]);

  const mixed = structuredClone(two);
  mixed.batches[1].reviewedAt = '2026-10-25T03:00:01.000Z';

  assert.throws(
    () => rebuildNillionDraftsFromProposal(mixed, current),
    /inconsistent review times/,
  );
});

test('prepare does not store an empty review', async () => {
  const f = setup({
    reviewWithDiscovery: async () => ({
      status: 'nothing_to_review',
      claimDiscovery: { newDraftCount: 0 },
    }),
  });

  const result = await f.service.prepare({ actorId: 'admin-1' });

  assert.equal(result.status, 'nothing_to_review');
  assert.equal(result.stored, false);
  assert.ok(!f.store.calls.some((call) => call[0] === 'prepare'));
});

test('prepare stores a nonempty review with the server timestamp and actor', async () => {
  const f = setup();

  const result = await f.service.prepare({ actorId: 'admin-1' });

  assert.equal(result.status, 'pending_approval');
  assert.equal(result.stored, true);
  assert.equal(f.calls.discovery, 1);

  const call = f.store.calls.find((item) => item[0] === 'prepare');

  assert.equal(call[1].actorId, 'admin-1');
  assert.equal(call[1].reviewCompletedAt, NOW.toISOString());
  assert.equal(call[1].review.executionEnabled, false);
});

test('prepare does not scan while an approved proposal occupies the slot', async () => {
  const f = setup({
    store: fakeStore({
      _id: 'a'.repeat(64),
      status: 'approved',
      active: true,
    }),
  });

  await assert.rejects(
    f.service.prepare({ actorId: 'admin-1' }),
    statusError(409),
  );

  assert.equal(f.calls.discovery, 0);
});

test('prepare returns an existing pending proposal without scanning', async () => {
  const f = setup({
    store: fakeStore({
      _id: 'b'.repeat(64),
      status: 'pending',
      active: true,
    }),
  });

  const result = await f.service.prepare({ actorId: 'admin-1' });

  assert.equal(result.status, 'existing_pending');
  assert.equal(result.stored, false);
  assert.equal(f.calls.discovery, 0);
});

test('approve revalidates frozen drafts without rediscovering claims', async () => {
  const f = setup();
  const prepared = await f.service.prepare({ actorId: 'admin-1' });

  f.calls.discovery = 0;

  const result = await f.service.approve({
    id: prepared.proposal._id,
    actorId: 'admin-2',
  });

  assert.equal(result.status, 'approved');
  assert.equal(f.calls.discovery, 0);
  assert.equal(f.calls.review, 1);

  const call = f.store.calls.find((item) => item[0] === 'approve');

  assert.equal(call[1].actorId, 'admin-2');
  assert.equal(call[1].reviewCompletedAt, NOW.toISOString());
  assert.equal(
    call[1].freshReview.proposal.proposalSha256,
    prepared.proposal._id,
  );
});

test('approve refuses when sources changed after the proposal was prepared', async () => {
  let version = 3;

  const f = setup({
    loadState: async () => state(version),
  });

  const prepared = await f.service.prepare({ actorId: 'admin-1' });

  version = 4;

  await assert.rejects(
    f.service.approve({ id: prepared.proposal._id, actorId: 'admin-1' }),
    statusError(409),
  );

  assert.ok(!f.store.calls.some((call) => call[0] === 'approve'));
});

test('approve stops when fresh verification fails', async () => {
  const f = setup({
    review: async () => {
      throw new Error('RPC unavailable');
    },
  });

  const prepared = await f.service.prepare({ actorId: 'admin-1' });

  await assert.rejects(
    f.service.approve({ id: prepared.proposal._id, actorId: 'admin-1' }),
    /RPC unavailable/,
  );

  assert.ok(!f.store.calls.some((call) => call[0] === 'approve'));
});

test('approve reports an unknown proposal ID', async () => {
  const f = setup();

  await assert.rejects(
    f.service.approve({ id: 'c'.repeat(64), actorId: 'admin-1' }),
    statusError(404),
  );
});

test('approve is idempotent for an already approved active proposal', async () => {
  const f = setup({
    store: fakeStore({
      _id: 'd'.repeat(64),
      status: 'approved',
      active: true,
    }),
  });

  const result = await f.service.approve({
    id: 'd'.repeat(64),
    actorId: 'admin-1',
  });

  assert.equal(result.status, 'approved');
  assert.equal(f.calls.review, 0);
  assert.ok(!f.store.calls.some((call) => call[0] === 'approve'));
});

test('approve refuses proposals that are not pending', async () => {
  for (const status of ['rejected', 'expired']) {
    const f = setup({
      store: fakeStore({
        _id: 'e'.repeat(64),
        status,
        active: false,
      }),
    });

    await assert.rejects(
      f.service.approve({ id: 'e'.repeat(64), actorId: 'admin-1' }),
      statusError(409),
    );

    assert.equal(f.calls.review, 0);
  }
});

test('reject delegates the decision with the authenticated actor', async () => {
  const f = setup();
  const prepared = await f.service.prepare({ actorId: 'admin-1' });

  const result = await f.service.reject({
    id: prepared.proposal._id,
    actorId: 'admin-2',
  });

  assert.equal(result.status, 'rejected');

  const call = f.store.calls.find((item) => item[0] === 'reject');
  assert.equal(call[1].actorId, 'admin-2');
});