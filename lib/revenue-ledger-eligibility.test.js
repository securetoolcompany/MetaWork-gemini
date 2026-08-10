// lib/revenue-ledger-eligibility.test.js
import assert from 'node:assert/strict';

import {
  MANUAL_TEST_RELEASE_REASON,
  transitionHeldLedgerRowsToReleaseEligible,
} from './revenue-ledger-eligibility.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function matchesFilter(row, filter) {
  if (filter.orderId) {
    return row.orderId === filter.orderId;
  }

  if (filter._id?.$in) {
    return filter._id.$in.some((id) => String(id) === String(row._id));
  }

  return false;
}

function createFakeDb() {
  const rows = [
    {
      _id: 'ledger-a',
      orderId: 'order-5001',
      idempotencyKey: 'order-5001:item-1:ip-a',
      status: 'held',
      stateTransitions: [],
    },
    {
      _id: 'ledger-b',
      orderId: 'order-5001',
      idempotencyKey: 'order-5001:item-2:ip-b',
      status: 'held',
      stateTransitions: [],
    },
    {
      _id: 'ledger-c',
      orderId: 'order-5002',
      idempotencyKey: 'order-5002:item-1:ip-c',
      status: 'held',
      stateTransitions: [],
    },
    {
      _id: 'ledger-batched',
      orderId: 'order-5003',
      idempotencyKey: 'order-5003:item-1:ip-d',
      status: 'batched',
      stateTransitions: [],
    },
  ];

  return {
    rows,
    collection(name) {
      assert.equal(name, 'revenue_ledger');

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

          if (update.$push?.stateTransitions) {
            row.stateTransitions.push(clone(update.$push.stateTransitions));
          }

          return {
            acknowledged: true,
            matchedCount: 1,
            modifiedCount: 1,
          };
        },
      };
    },
  };
}

const db = createFakeDb();
const now = new Date('2026-08-09T19:11:00.000Z');

const orderScopeResult = await transitionHeldLedgerRowsToReleaseEligible({
  db,
  orderId: 'order-5001',
  actor: 'step-5-test-admin',
  now,
});

assert.equal(orderScopeResult.transitionedCount, 2);
assert.equal(orderScopeResult.existingEligibleCount, 0);
assert.equal(orderScopeResult.reason, MANUAL_TEST_RELEASE_REASON);

const rowA = db.rows.find((row) => row._id === 'ledger-a');
const rowB = db.rows.find((row) => row._id === 'ledger-b');
const rowC = db.rows.find((row) => row._id === 'ledger-c');

assert.equal(rowA.status, 'release_eligible');
assert.equal(rowB.status, 'release_eligible');
assert.equal(rowC.status, 'held');

assert.deepEqual(rowA.stateTransitions, [
  {
    fromStatus: 'held',
    toStatus: 'release_eligible',
    actor: 'step-5-test-admin',
    reason: 'manual_test_release',
    occurredAt: '2026-08-09T19:11:00.000Z',
  },
]);

const retryResult = await transitionHeldLedgerRowsToReleaseEligible({
  db,
  ledgerIds: ['ledger-a', 'ledger-b'],
  actor: 'step-5-test-admin',
  now,
});

assert.equal(retryResult.transitionedCount, 0);
assert.equal(retryResult.existingEligibleCount, 2);
assert.equal(rowA.stateTransitions.length, 1);
assert.equal(rowB.stateTransitions.length, 1);

const explicitIdResult = await transitionHeldLedgerRowsToReleaseEligible({
  db,
  ledgerIds: ['ledger-c'],
  actor: 'step-5-test-admin',
  now,
});

assert.equal(explicitIdResult.transitionedCount, 1);
assert.equal(rowC.status, 'release_eligible');

await assert.rejects(
  transitionHeldLedgerRowsToReleaseEligible({
    db,
    ledgerIds: ['ledger-batched'],
    actor: 'step-5-test-admin',
    now,
  }),
  /cannot transition from batched/
);

await assert.rejects(
  transitionHeldLedgerRowsToReleaseEligible({
    db,
    actor: 'step-5-test-admin',
    now,
  }),
  /Provide explicit ledgerIds or one tightly scoped orderId/
);

await assert.rejects(
  transitionHeldLedgerRowsToReleaseEligible({
    db,
    ledgerIds: ['ledger-a'],
    orderId: 'order-5001',
    actor: 'step-5-test-admin',
    now,
  }),
  /not both/
);

console.log('✅ revenue-ledger-eligibility tests passed');