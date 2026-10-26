// lib/tokenized-funds/nillion/distribution-proposal-store.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NILLION_EXPECTED_OWNER,
} from './config.js';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from './payouts.js';

import {
  buildNillionDistributionProposal,
} from './distribution-proposal.js';

import {
  createNillionProposalStore,
} from './distribution-proposal-store.js';

function fakeCollection() {
  const documents = new Map();
  const indexes = [];

  function matches(document, filter) {
    return Object.entries(filter).every(([key, expected]) => {
      const actual = document[key];

      if (expected && typeof expected === 'object') {
        if ('$lte' in expected) return actual <= expected.$lte;
        if ('$gt' in expected) return actual > expected.$gt;
      }

      return actual === expected;
    });
  }

  return {
    documents,
    indexes,

    async createIndex(keys, options) {
      indexes.push({ keys, options });
      return options.name;
    },

    async insertOne(document) {
      const conflict =
        documents.has(document._id) ||
        [...documents.values()].some(
          (item) =>
            item.scope === document.scope &&
            item.active === true &&
            document.active === true,
        );

      if (conflict) {
        throw Object.assign(new Error('Duplicate key'), { code: 11000 });
      }

      documents.set(document._id, structuredClone(document));
      return { insertedId: document._id };
    },

    async findOne(filter) {
      const result = [...documents.values()].find(
        (document) => matches(document, filter),
      );

      return result ? structuredClone(result) : null;
    },

    async findOneAndUpdate(filter, update) {
      const document = [...documents.values()].find(
        (item) => matches(item, filter),
      );

      if (!document) return null;

      Object.assign(document, structuredClone(update.$set ?? {}));

      for (const [key, value] of Object.entries(update.$push ?? {})) {
        document[key] ??= [];
        document[key].push(structuredClone(value));
      }

      return structuredClone(document);
    },
  };
}

function verifiedReview(hashCharacter = 'a') {
  const owner = NILLION_EXPECTED_OWNER;
  const ledger = createEmptyNillionPayoutLedger();

  const allocationConfig = {
    version: 3,
    managementFeeBps: 5000,
    managementFeeBasis: 'gross_rewards_operator_covers_costs',
    nodes: {
      '19': {
        stakers: [
          { id: 'operator', wallet: owner, amountNil: '50' },
          {
            id: 'investor',
            wallet: '0x2222222222222222222222222222222222222222',
            amountNil: '50',
          },
        ],
      },
    },
  };

  const draft = buildNillionPayoutDraft({
    batchId: `batch-${hashCharacter}`,
    nodeId: '19',
    allocationConfig,
    onChainStakeBaseUnits: '100000000',
    expectedOwner: owner,
    ledger,
    claims: [
      {
        nodeId: '19',
        owner,
        transactionHash: `0x${hashCharacter.repeat(64)}`,
        logIndex: '7',
        blockNumber: '26134590',
        blockHash: `0x${'b'.repeat(64)}`,
        amountBaseUnits: '12000000',
      },
    ],
  });

  const proposal = buildNillionDistributionProposal({
    ledger,
    allocationConfig,
    expectedOwner: owner,
    drafts: [draft],
    reviewedAt: '2026-10-25T03:00:00.000Z',
  });

  return {
    status: 'verified_for_human_review',
    approved: false,
    executionEnabled: false,
    proposal,
    verification: {
      chainId: 1,
      fundingBalanceChecked: true,
      sourcesUnchangedDuringReview: true,
      ownerNilBalanceBaseUnits: '6000000',
      requiredOutstandingReserveBaseUnits: '6000000',
    },
  };
}

async function fixture() {
  let milliseconds = Date.parse('2026-10-25T04:00:00.000Z');
  const collection = fakeCollection();

  const store = createNillionProposalStore({
    collection,
    now: () => new Date(milliseconds),
  });

  await store.initialize();

  function options(review = verifiedReview()) {
    return {
      review,
      reviewCompletedAt: new Date(milliseconds).toISOString(),
      actorId: 'admin-1',
    };
  }

  return {
    collection,
    store,
    options,
    advance(ms) {
      milliseconds += ms;
    },
  };
}

test('requires initialization and requests the active-scope unique index', async () => {
  const collection = fakeCollection();
  const store = createNillionProposalStore({ collection });

  await assert.rejects(
    store.prepare({}),
    /indexes must be initialized/,
  );

  await store.initialize();

  assert.deepEqual(collection.indexes[0].keys, { scope: 1 });
  assert.equal(collection.indexes[0].options.unique, true);
  assert.deepEqual(
    collection.indexes[0].options.partialFilterExpression,
    { active: true },
  );
});

test('stores an immutable pending proposal without enabling execution', async () => {
  const f = await fixture();
  const options = f.options();
  const before = JSON.stringify(options);

  const document = await f.store.prepare(options);

  assert.equal(document.status, 'pending');
  assert.equal(document.active, true);
  assert.equal(document.executionEnabled, false);
  assert.equal(document.audit.length, 1);
  assert.equal(JSON.stringify(options), before);

  options.review.proposal.transfers[0].amountBaseUnits = '999';

  const stored = await f.collection.findOne({ _id: document._id });
  assert.equal(stored.review.proposal.transfers[0].amountBaseUnits, '3000000');
});

test('preparing the same active proposal is idempotent', async () => {
  const f = await fixture();

  const first = await f.store.prepare(f.options());
  const second = await f.store.prepare(f.options());

  assert.equal(first._id, second._id);
  assert.equal(f.collection.documents.size, 1);
  assert.equal(second.audit.length, 1);
});

test('blocks a competing active proposal', async () => {
  const f = await fixture();

  await f.store.prepare(f.options());

  await assert.rejects(
    f.store.prepare(f.options(verifiedReview('c'))),
    /Another active distribution proposal exists/,
  );
});

test('rejects empty and unverified review results', async () => {
  const f = await fixture();

  const empty = verifiedReview();
  empty.status = 'nothing_to_review';

  await assert.rejects(
    f.store.prepare(f.options(empty)),
    /nonempty verified distribution review/,
  );

  const unverified = verifiedReview();
  unverified.verification.fundingBalanceChecked = false;

  await assert.rejects(
    f.store.prepare(f.options(unverified)),
    /nonempty verified distribution review/,
  );
});

test('rejects stale review completion timestamps', async () => {
  const f = await fixture();
  const options = f.options();

  f.advance(60_001);

  await assert.rejects(
    f.store.prepare(options),
    /fresh server-side review/,
  );
});

test('rejects proposal contents altered after digest calculation', async () => {
  const f = await fixture();
  const review = verifiedReview();

  review.proposal.transfers[0].amountBaseUnits = '999';

  await assert.rejects(
    f.store.prepare(f.options(review)),
    /contents do not match their digest/,
  );
});

test('approves the exact proposal with a fresh review but leaves execution disabled', async () => {
  const f = await fixture();
  const prepared = await f.store.prepare(f.options());

  const approved = await f.store.approve({
    id: prepared._id,
    freshReview: verifiedReview(),
    reviewCompletedAt: f.options().reviewCompletedAt,
    actorId: 'admin-2',
  });

  assert.equal(approved.status, 'approved');
  assert.equal(approved.active, true);
  assert.equal(approved.executionEnabled, false);
  assert.equal(approved.approvedBy, 'admin-2');
  assert.equal(approved.audit.length, 2);
});

test('rejects approval of a different proposal', async () => {
  const f = await fixture();
  const prepared = await f.store.prepare(f.options());

  await assert.rejects(
    f.store.approve({
      id: prepared._id,
      freshReview: verifiedReview('c'),
      reviewCompletedAt: f.options().reviewCompletedAt,
      actorId: 'admin-1',
    }),
    /does not match the stored proposal/,
  );
});

test('expires pending proposals and does not reopen their IDs', async () => {
  const f = await fixture();
  const prepared = await f.store.prepare(f.options());

  f.advance(10 * 60_000 + 1);
  await f.store.expirePending();

  const expired = await f.collection.findOne({ _id: prepared._id });

  assert.equal(expired.status, 'expired');
  assert.equal(expired.active, false);

  await assert.rejects(
    f.store.prepare(f.options()),
    /terminal decision/,
  );

  const next = await f.store.prepare(f.options(verifiedReview('c')));
  assert.equal(next.status, 'pending');
});

test('rejects a pending proposal and releases the active slot', async () => {
  const f = await fixture();
  const prepared = await f.store.prepare(f.options());

  const rejected = await f.store.reject({
    id: prepared._id,
    actorId: 'admin-2',
  });

  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.active, false);
  assert.equal(rejected.audit.length, 2);

  const next = await f.store.prepare(f.options(verifiedReview('c')));
  assert.equal(next.status, 'pending');
});

test('approved proposals cannot be rejected or automatically expired', async () => {
  const f = await fixture();
  const prepared = await f.store.prepare(f.options());

  await f.store.approve({
    id: prepared._id,
    freshReview: verifiedReview(),
    reviewCompletedAt: f.options().reviewCompletedAt,
    actorId: 'admin-1',
  });

  f.advance(20 * 60_000);
  await f.store.expirePending();

  await assert.rejects(
    f.store.reject({
      id: prepared._id,
      actorId: 'admin-1',
    }),
    /Only a pending proposal/,
  );

  await assert.rejects(
    f.store.prepare(f.options(verifiedReview('c'))),
    /Another active distribution proposal exists/,
  );

  const stored = await f.collection.findOne({ _id: prepared._id });
  assert.equal(stored.status, 'approved');
  assert.equal(stored.active, true);
});

test('reads the active proposal and individual proposals by ID', async () => {
  const f = await fixture();

  assert.equal(await f.store.getActive(), null);

  const prepared = await f.store.prepare(f.options());

  assert.equal((await f.store.getActive())._id, prepared._id);
  assert.equal((await f.store.get(prepared._id))._id, prepared._id);
  assert.equal(await f.store.get('0'.repeat(64)), null);

  await f.store.reject({ id: prepared._id, actorId: 'admin-1' });

  assert.equal(await f.store.getActive(), null);
  assert.equal((await f.store.get(prepared._id)).status, 'rejected');
});

test('rejects malformed proposal IDs on reads', async () => {
  const f = await fixture();

  await assert.rejects(f.store.get('not-a-hash'), /Invalid proposal ID/);
});