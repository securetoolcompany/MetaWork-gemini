import assert from 'node:assert/strict';

import {
  manuallyMarkRevenueLedgerRowsReleaseEligible,
} from './revenue-ledger-transitions.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function matchesFilter(row, filter) {
  if (filter._id?.$in) {
    return filter._id.$in.some((id) => String(id) === String(row._id));
  }

  if (Object.prototype.hasOwnProperty.call(filter, 'orderId')) {
    return row.orderId === filter.orderId;
  }

  if (Object.prototype.hasOwnProperty.call(filter, '_id')) {
    return String(row._id) === String(filter._id);
  }

  return true;
}

function createFakeDb() {
  const rows = [
    {
      _id: 'ledger-a',
      orderId: 'order-1',
      status: 'held',
      eligibleAt: null,
      updatedAt: new Date('2026-08-09T19:00:00.000Z'),
    },
    {
      _id: 'ledger-b',
      orderId: 'order-1',
      status: 'held',
      eligibleAt: null,
      updatedAt: new Date('2026-08-09T19:01:00.000Z'),
    },
    {
      _id: 'ledger-c',
      orderId: 'order-2',
      status: 'batched',
      eligibleAt: null,
      updatedAt: new Date('2026-08-09T19:02:00.000Z'),
    },
  ];

  const events = [];

  return {
    rows,
    events,

    collection(name) {
      if (name === 'revenue_ledger') {
        return {
          find(filter) {
            return {
              async toArray() {
                return rows.filter((row) => matchesFilter(row, filter)).map(clone);
              },
            };
          },

          async updateOne(filter, update) {
            const row = rows.find(
              (candidate) =>
                String(candidate._id) === String(filter._id) &&
                candidate.status === filter.status
            );

            if (!row) {
              return {
                acknowledged: true,
                matchedCount: 0,
                modifiedCount: 0,
              };
            }

            Object.assign(row, clone(update.$set));

            return {
              acknowledged: true,
              matchedCount: 1,
              modifiedCount: 1,
            };
          },

          async findOne(filter) {
            const row = rows.find((candidate) => matchesFilter(candidate, filter));

            return row ? clone(row) : null;
          },
        };
      }

      if (name === 'revenue_ledger_events') {
        return {
          async insertOne(event) {
            const insertedEvent = {
              _id: `event-${events.length + 1}`,
              ...clone(event),
            };

            events.push(insertedEvent);

            return {
              acknowledged: true,
              insertedId: insertedEvent._id,
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

const db = createFakeDb();
const now = new Date('2026-08-09T19:16:00.000Z');

const firstRelease = await manuallyMarkRevenueLedgerRowsReleaseEligible({
  db,
  ledgerEntryIds: ['ledger-a'],
  actor: 'test_operator',
  now,
});

assert.equal(firstRelease.reason, 'manual_test_release');
assert.equal(firstRelease.actor, 'test_operator');
assert.equal(firstRelease.changedCount, 1);
assert.equal(firstRelease.alreadyEligibleCount, 0);
assert.deepEqual(firstRelease.rows, [
  {
    ledgerEntryId: 'ledger-a',
    orderId: 'order-1',
    changed: true,
    status: 'release_eligible',
  },
]);

const ledgerA = db.rows.find((row) => row._id === 'ledger-a');
const ledgerB = db.rows.find((row) => row._id === 'ledger-b');

assert.equal(ledgerA.status, 'release_eligible');
assert.equal(
  new Date(ledgerA.eligibleAt).toISOString(),
  '2026-08-09T19:16:00.000Z'
);
assert.equal(
  new Date(ledgerA.updatedAt).toISOString(),
  '2026-08-09T19:16:00.000Z'
);

assert.equal(ledgerB.status, 'held');
assert.equal(ledgerB.eligibleAt, null);

assert.equal(db.events.length, 1);
assert.deepEqual(db.events[0], {
  _id: 'event-1',
  ledgerEntryId: 'ledger-a',
  orderId: 'order-1',
  fromStatus: 'held',
  toStatus: 'release_eligible',
  reason: 'manual_test_release',
  actor: 'test_operator',
  occurredAt: '2026-08-09T19:16:00.000Z',
});

const retryRelease = await manuallyMarkRevenueLedgerRowsReleaseEligible({
  db,
  ledgerEntryIds: ['ledger-a'],
  actor: 'test_operator',
  now,
});

assert.equal(retryRelease.changedCount, 0);
assert.equal(retryRelease.alreadyEligibleCount, 1);
assert.equal(db.events.length, 1);

await assert.rejects(
  () =>
    manuallyMarkRevenueLedgerRowsReleaseEligible({
      db,
      actor: 'test_operator',
      now,
    }),
  /Provide exactly one selection/
);

await assert.rejects(
  () =>
    manuallyMarkRevenueLedgerRowsReleaseEligible({
      db,
      ledgerEntryIds: ['ledger-b'],
      orderId: 'order-1',
      actor: 'test_operator',
      now,
    }),
  /Provide exactly one selection/
);

await assert.rejects(
  () =>
    manuallyMarkRevenueLedgerRowsReleaseEligible({
      db,
      ledgerEntryIds: ['ledger-c'],
      actor: 'test_operator',
      now,
    }),
  /must be held or release_eligible/
);

assert.equal(db.rows.find((row) => row._id === 'ledger-c').status, 'batched');
assert.equal(db.events.length, 1);

console.log('✅ revenue-ledger-transitions tests passed');