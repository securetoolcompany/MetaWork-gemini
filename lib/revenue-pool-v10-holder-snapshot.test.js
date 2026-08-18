import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  DEFAULT_MAX_INDEXER_LAG_ROUNDS,
  V10HolderSnapshotFreshnessError,
  V10HolderSnapshotNetworkError,
  V10HolderSnapshotValidationError,
  snapshotV10RevenueTokenHolders,
} from './revenue-pool-v10-holder-snapshot.js';

function makeAccount() {
  return algosdk.generateAccount().addr.toString();
}

function makeIndexerClient(pages) {
  const calls = [];

  return {
    calls,
    lookupAssetBalances(assetId) {
      let token = null;

      const request = {
        nextToken(next) {
          token = next;
          return request;
        },
        async do() {
          calls.push({ assetId, token });

          const page = pages[token || 'first'];

          if (page instanceof Error) {
            throw page;
          }

          return page;
        },
      };

      return request;
    },
  };
}

function makeAlgodClient(statusResponse) {
  return {
    status() {
      return {
        async do() {
          if (statusResponse instanceof Error) {
            throw statusResponse;
          }

          return statusResponse;
        },
      };
    },
  };
}

function response({ balances, round = 100, nextToken = null }) {
  return {
    balances,
    'current-round': round,
    ...(nextToken ? { 'next-token': nextToken } : {}),
  };
}

test('captures, sorts, and hashes a one-page 10,000-unit holder snapshot', async () => {
  const first = makeAccount();
  const second = makeAccount();

  const indexerClient = makeIndexerClient({
    first: response({
      round: 100,
      balances: [
        { address: second, amount: 3000 },
        { address: first, amount: 7000 },
      ],
    }),
  });
  const algodClient = makeAlgodClient({ 'last-round': 101 });

  const snapshot = await snapshotV10RevenueTokenHolders({
    indexerClient,
    algodClient,
    revenueTokenAssetId: 123456,
  });

  assert.equal(snapshot.assetId, 123456);
  assert.equal(snapshot.expectedTotalRevUnits, '10000');
  assert.equal(snapshot.totalRevUnits, '10000');
  assert.equal(snapshot.indexerRound, 100);
  assert.equal(snapshot.algodStatusRound, 101);
  assert.equal(snapshot.indexerLagRounds, 1);
  assert.match(snapshot.canonicalHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(snapshot.entries.length, 2);
  assert.deepEqual(
    snapshot.entries.map((entry) => entry.address),
    [first, second].sort((left, right) => {
      const leftBytes = Buffer.from(algosdk.decodeAddress(left).publicKey);
      const rightBytes = Buffer.from(algosdk.decodeAddress(right).publicKey);
      return Buffer.compare(leftBytes, rightBytes);
    }),
  );
  assert.deepEqual(
    snapshot.entries.map((entry) => entry.revUnits).sort(),
    ['3000', '7000'],
  );
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.entries), true);
  assert.equal(Object.isFrozen(snapshot.entries[0]), true);
  assert.equal(indexerClient.calls.length, 1);
});

test('paginates all holder balances and ignores zero-balance opt-ins', async () => {
  const first = makeAccount();
  const second = makeAccount();
  const zero = makeAccount();

  const indexerClient = makeIndexerClient({
    first: response({
      round: 100,
      nextToken: 'page-2',
      balances: [
        { address: first, amount: '4000' },
        { address: zero, amount: 0 },
      ],
    }),
    'page-2': response({
      round: 100,
      balances: [{ address: second, amount: 6000n }],
    }),
  });
  const algodClient = makeAlgodClient({ 'last-round': 102 });

  const snapshot = await snapshotV10RevenueTokenHolders({
    indexerClient,
    algodClient,
    revenueTokenAssetId: 123456,
  });

  assert.equal(snapshot.entries.length, 2);
  assert.equal(
    snapshot.entries.some((entry) => entry.address === zero),
    false,
  );
  assert.equal(snapshot.totalRevUnits, '10000');
  assert.deepEqual(indexerClient.calls, [
    { assetId: 123456, token: null },
    { assetId: 123456, token: 'page-2' },
  ]);
});

test('produces the same canonical hash regardless of Indexer result order', async () => {
  const first = makeAccount();
  const second = makeAccount();

  const algodClient = makeAlgodClient({ 'last-round': 100 });

  const forward = await snapshotV10RevenueTokenHolders({
    indexerClient: makeIndexerClient({
      first: response({
        balances: [
          { address: first, amount: 7000 },
          { address: second, amount: 3000 },
        ],
      }),
    }),
    algodClient,
    revenueTokenAssetId: 123456,
  });

  const reverse = await snapshotV10RevenueTokenHolders({
    indexerClient: makeIndexerClient({
      first: response({
        balances: [
          { address: second, amount: 3000 },
          { address: first, amount: 7000 },
        ],
      }),
    }),
    algodClient,
    revenueTokenAssetId: 123456,
  });

  assert.equal(forward.canonicalHash, reverse.canonicalHash);
  assert.deepEqual(forward.entries, reverse.entries);
});

test('rejects a REV supply mismatch', async () => {
  const holder = makeAccount();

  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({
          first: response({
            balances: [{ address: holder, amount: 9999 }],
          }),
        }),
        algodClient: makeAlgodClient({ 'last-round': 100 }),
        revenueTokenAssetId: 123456,
      }),
    (error) =>
      error instanceof V10HolderSnapshotValidationError &&
      error.code === 'REV_SUPPLY_MISMATCH',
  );
});

test('rejects duplicate nonzero holders across Indexer pages', async () => {
  const holder = makeAccount();

  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({
          first: response({
            nextToken: 'page-2',
            balances: [{ address: holder, amount: 5000 }],
          }),
          'page-2': response({
            balances: [{ address: holder, amount: 5000 }],
          }),
        }),
        algodClient: makeAlgodClient({ 'last-round': 100 }),
        revenueTokenAssetId: 123456,
      }),
    (error) =>
      error instanceof V10HolderSnapshotValidationError &&
      error.code === 'DUPLICATE_HOLDER',
  );
});

test('rejects invalid Algorand holder addresses', async () => {
  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({
          first: response({
            balances: [{ address: 'not-an-algorand-address', amount: 10000 }],
          }),
        }),
        algodClient: makeAlgodClient({ 'last-round': 100 }),
        revenueTokenAssetId: 123456,
      }),
    (error) =>
      error instanceof V10HolderSnapshotValidationError &&
      error.code === 'INVALID_ADDRESS',
  );
});

test('rejects unsafe or non-integer holder balances', async () => {
  const holder = makeAccount();

  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({
          first: response({
            balances: [
              {
                address: holder,
                amount: Number.MAX_SAFE_INTEGER + 1,
              },
            ],
          }),
        }),
        algodClient: makeAlgodClient({ 'last-round': 100 }),
        revenueTokenAssetId: 123456,
      }),
    (error) =>
      error instanceof V10HolderSnapshotValidationError &&
      error.code === 'INVALID_BALANCE',
  );

  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({
          first: response({
            balances: [{ address: holder, amount: '10000.5' }],
          }),
        }),
        algodClient: makeAlgodClient({ 'last-round': 100 }),
        revenueTokenAssetId: 123456,
      }),
    (error) =>
      error instanceof V10HolderSnapshotValidationError &&
      error.code === 'INVALID_BALANCE',
  );
});

test('rejects a stale Indexer response', async () => {
  const holder = makeAccount();

  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({
          first: response({
            round: 100,
            balances: [{ address: holder, amount: 10000 }],
          }),
        }),
        algodClient: makeAlgodClient({ 'last-round': 103 }),
        revenueTokenAssetId: 123456,
        maxIndexerLagRounds: DEFAULT_MAX_INDEXER_LAG_ROUNDS,
      }),
    (error) =>
      error instanceof V10HolderSnapshotFreshnessError &&
      error.code === 'INDEXER_TOO_STALE',
  );
});

test('rejects Indexer page round changes during pagination', async () => {
  const first = makeAccount();
  const second = makeAccount();

  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({
          first: response({
            round: 100,
            nextToken: 'page-2',
            balances: [{ address: first, amount: 4000 }],
          }),
          'page-2': response({
            round: 101,
            balances: [{ address: second, amount: 6000 }],
          }),
        }),
        algodClient: makeAlgodClient({ 'last-round': 101 }),
        revenueTokenAssetId: 123456,
      }),
    (error) =>
      error instanceof V10HolderSnapshotFreshnessError &&
      error.code === 'INDEXER_PAGINATION_ROUND_CHANGED',
  );
});

test('fails closed on Indexer and Algod network errors', async () => {
  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({
          first: new Error('indexer unavailable'),
        }),
        algodClient: makeAlgodClient({ 'last-round': 100 }),
        revenueTokenAssetId: 123456,
      }),
    (error) =>
      error instanceof V10HolderSnapshotNetworkError &&
      error.code === 'INDEXER_LOOKUP_FAILED',
  );

  const holder = makeAccount();

  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({
          first: response({
            balances: [{ address: holder, amount: 10000 }],
          }),
        }),
        algodClient: makeAlgodClient(new Error('algod unavailable')),
        revenueTokenAssetId: 123456,
      }),
    (error) =>
      error instanceof V10HolderSnapshotNetworkError &&
      error.code === 'ALGOD_STATUS_FAILED',
  );
});

test('rejects missing network clients and invalid asset IDs', async () => {
  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        algodClient: makeAlgodClient({ 'last-round': 100 }),
        revenueTokenAssetId: 123456,
      }),
    (error) =>
      error instanceof V10HolderSnapshotValidationError &&
      error.code === 'INVALID_INDEXER_CLIENT',
  );

  await assert.rejects(
    () =>
      snapshotV10RevenueTokenHolders({
        indexerClient: makeIndexerClient({}),
        algodClient: makeAlgodClient({ 'last-round': 100 }),
        revenueTokenAssetId: 0,
      }),
    (error) =>
      error instanceof V10HolderSnapshotValidationError &&
      error.code === 'INVALID_INPUT',
  );
});