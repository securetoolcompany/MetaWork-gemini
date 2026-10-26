// tests/integration/nillion-proposal-store.mongo.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

import {
  NILLION_EXPECTED_OWNER,
} from '../../lib/tokenized-funds/nillion/config.js';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from '../../lib/tokenized-funds/nillion/payouts.js';

import {
  buildNillionDistributionProposal,
} from '../../lib/tokenized-funds/nillion/distribution-proposal.js';

import {
  createNillionProposalStore,
} from '../../lib/tokenized-funds/nillion/distribution-proposal-store.js';

const TEST_URI = process.env.NILLION_TEST_MONGO_URL?.trim();

function reviewFixture(batchSuffix = 'a') {
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
    batchId: `integration-batch-${batchSuffix}`,
    nodeId: '19',
    allocationConfig,
    onChainStakeBaseUnits: '100000000',
    expectedOwner: owner,
    ledger,
    claims: [
      {
        nodeId: '19',
        owner,
        // Deliberately the same claim for competing-proposal tests.
        transactionHash: `0x${'a'.repeat(64)}`,
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

async function createFixture(db, collectionName) {
  let milliseconds = Date.parse('2026-10-25T04:00:00.000Z');

  const collection = db.collection(collectionName, {
    writeConcern: { w: 'majority' },
  });

  const now = () => new Date(milliseconds);
  const store = createNillionProposalStore({ collection, now });

  await store.initialize();

  return {
    collection,
    store,
    now,

    options(review = reviewFixture()) {
      return {
        review,
        reviewCompletedAt: now().toISOString(),
        actorId: 'integration-admin-1',
      };
    },

    advance(ms) {
      milliseconds += ms;
    },
  };
}

test(
  'Nillion proposal store: real MongoDB integration',
  {
    skip: !TEST_URI,
    timeout: 120_000,
  },
  async (t) => {
    const databaseName =
      `metawork_nillion_test_${randomUUID().replaceAll('-', '')}`;

    assert.match(
      databaseName,
      /^metawork_nillion_test_[0-9a-f]{32}$/,
    );

    const client = new MongoClient(TEST_URI, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 5,
    });

    let connected = false;

    try {
      await client.connect();
      connected = true;

      // Always use the internally generated database name,
      // not any default database named in the connection URI.
      const db = client.db(databaseName);

      await t.test('creates the actual unique partial index', async () => {
        const f = await createFixture(db, 'index_check');
        const indexes = await f.collection.indexes();

        const index = indexes.find(
          (item) =>
            item.name === 'one_active_nillion_proposal_per_owner',
        );

        assert.ok(index);
        assert.deepEqual(index.key, { scope: 1 });
        assert.equal(index.unique, true);
        assert.deepEqual(
          index.partialFilterExpression,
          { active: true },
        );
      });

      await t.test('concurrent preparation of the same proposal is idempotent', async () => {
        const f = await createFixture(db, 'same_proposal');

        const results = await Promise.all(
          Array.from(
            { length: 8 },
            () => f.store.prepare(f.options()),
          ),
        );

        assert.equal(
          new Set(results.map((item) => item._id)).size,
          1,
        );

        assert.equal(await f.collection.countDocuments({}), 1);

        const stored = await f.collection.findOne({
          _id: results[0]._id,
        });

        assert.equal(stored.status, 'pending');
        assert.equal(stored.active, true);
        assert.equal(stored.executionEnabled, false);
        assert.equal(stored.audit.length, 1);
      });

      await t.test('concurrent competing proposals cannot both become active', async () => {
        const f = await createFixture(db, 'competing_proposals');

        const results = await Promise.allSettled([
          f.store.prepare(f.options(reviewFixture('a'))),
          f.store.prepare(f.options(reviewFixture('c'))),
        ]);

        assert.equal(
          results.filter((item) => item.status === 'fulfilled').length,
          1,
        );

        assert.equal(
          results.filter((item) => item.status === 'rejected').length,
          1,
        );

        assert.equal(
          await f.collection.countDocuments({ active: true }),
          1,
        );

        assert.equal(await f.collection.countDocuments({}), 1);
      });

      await t.test('a second store instance reads and approves the persisted proposal', async () => {
        const f = await createFixture(db, 'store_restart');
        const prepared = await f.store.prepare(f.options());

        const secondStore = createNillionProposalStore({
          collection: f.collection,
          now: f.now,
        });

        await secondStore.initialize();

        const approved = await secondStore.approve({
          id: prepared._id,
          freshReview: reviewFixture(),
          reviewCompletedAt: f.now().toISOString(),
          actorId: 'integration-admin-2',
        });

        assert.equal(approved.status, 'approved');
        assert.equal(approved.approvedBy, 'integration-admin-2');
        assert.equal(approved.executionEnabled, false);

        const repeated = await secondStore.approve({
          id: prepared._id,
          freshReview: reviewFixture(),
          reviewCompletedAt: f.now().toISOString(),
          actorId: 'integration-admin-3',
        });

        assert.equal(repeated.approvedBy, 'integration-admin-2');
        assert.equal(repeated.audit.length, 2);
      });

      await t.test('approval and rejection cannot both win the pending-state transition', async () => {
        const f = await createFixture(db, 'decision_race');
        const prepared = await f.store.prepare(f.options());

        const results = await Promise.allSettled([
          f.store.approve({
            id: prepared._id,
            freshReview: reviewFixture(),
            reviewCompletedAt: f.now().toISOString(),
            actorId: 'integration-approver',
          }),

          f.store.reject({
            id: prepared._id,
            actorId: 'integration-rejector',
          }),
        ]);

        assert.equal(
          results.filter((item) => item.status === 'fulfilled').length,
          1,
        );

        assert.equal(
          results.filter((item) => item.status === 'rejected').length,
          1,
        );

        const stored = await f.collection.findOne({
          _id: prepared._id,
        });

        assert.ok(['approved', 'rejected'].includes(stored.status));
        assert.equal(stored.audit.length, 2);
        assert.equal(stored.executionEnabled, false);
        assert.equal(stored.active, stored.status === 'approved');
      });

      await t.test('pending expiry prevents approval and releases the active slot', async () => {
        const f = await createFixture(db, 'pending_expiry');
        const prepared = await f.store.prepare(f.options());

        f.advance(10 * 60_000 + 1);

        await f.store.expirePending();
        await f.store.expirePending();

        const expired = await f.collection.findOne({
          _id: prepared._id,
        });

        assert.equal(expired.status, 'expired');
        assert.equal(expired.active, false);
        assert.equal(expired.audit.length, 2);

        await assert.rejects(
          f.store.approve({
            id: prepared._id,
            freshReview: reviewFixture(),
            reviewCompletedAt: f.now().toISOString(),
            actorId: 'integration-admin-1',
          }),
          /missing, expired, or no longer pending/,
        );

        const replacement = await f.store.prepare(
          f.options(reviewFixture('c')),
        );

        assert.equal(replacement.status, 'pending');
        assert.equal(
          await f.collection.countDocuments({ active: true }),
          1,
        );
      });

      await t.test('approved proposals retain the slot after pending expiry time', async () => {
        const f = await createFixture(db, 'approved_reservation');
        const prepared = await f.store.prepare(f.options());

        await f.store.approve({
          id: prepared._id,
          freshReview: reviewFixture(),
          reviewCompletedAt: f.now().toISOString(),
          actorId: 'integration-admin-1',
        });

        f.advance(20 * 60_000);
        await f.store.expirePending();

        await assert.rejects(
          f.store.prepare(f.options(reviewFixture('c'))),
          /Another active distribution proposal exists/,
        );

        const stored = await f.collection.findOne({
          _id: prepared._id,
        });

        assert.equal(stored.status, 'approved');
        assert.equal(stored.active, true);
        assert.equal(stored.executionEnabled, false);
      });

      await t.test('index initialization fails closed when duplicate active scopes exist', async () => {
        const collection = db.collection('invalid_existing_data');

        await collection.insertMany([
          { _id: 'seed-1', scope: 'duplicate-test', active: true },
          { _id: 'seed-2', scope: 'duplicate-test', active: true },
        ]);

        const store = createNillionProposalStore({ collection });

        await assert.rejects(store.initialize());

        await assert.rejects(
          store.prepare({}),
          /indexes must be initialized/,
        );
      });
    } finally {
      try {
        if (connected) {
          // This name was generated internally above.
          await client.db(databaseName).dropDatabase();
        }
      } finally {
        await client.close();
      }
    }
  },
);