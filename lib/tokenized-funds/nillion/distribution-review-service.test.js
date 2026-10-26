// lib/tokenized-funds/nillion/distribution-review-service.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  createNillionReviewStateLoader,
  getNillionReviewAdmin,
  createNillionReviewHandler,
} from './distribution-review-service.js';

function request({
  authorization,
  cookie,
  query = '',
} = {}) {
  return {
    url: `http://localhost/api/admin/tokenized-funds/nillion/distribution-review${query}`,
    headers: new Headers(
      authorization === undefined
        ? {}
        : { authorization },
    ),
    cookies: {
      get(name) {
        return name === 'auth_token' && cookie !== undefined
          ? { value: cookie }
          : undefined;
      },
    },
  };
}

test('loads only the fixed server-side files and rereads them each time', async () => {
  const rootDirectory = path.resolve('test-review-root');
  const reads = [];
  let version = 3;

  const loadState = createNillionReviewStateLoader({
    rootDirectory,
    readText: async (filename, encoding) => {
      reads.push({ filename, encoding });

      return filename.endsWith('stakers.json')
        ? JSON.stringify({ version })
        : JSON.stringify({ entries: [] });
    },
  });

  const first = await loadState();
  version = 4;
  const second = await loadState();

  assert.equal(first.allocationConfig.version, 3);
  assert.equal(second.allocationConfig.version, 4);
  assert.deepEqual(second.drafts, []);
  assert.equal(reads.length, 4);

  const directory = path.join(
    rootDirectory,
    'data',
    'tokenized-funds',
    'nillion',
  );

  assert.deepEqual(
    [...new Set(reads.map((item) => item.filename))].sort(),
    [
      path.join(directory, 'stakers.json'),
      path.join(directory, 'payout-ledger.json'),
    ].sort(),
  );

  assert.ok(reads.every((item) => item.encoding === 'utf8'));
});

test('does not replace missing or malformed source files with empty state', async () => {
  const missing = createNillionReviewStateLoader({
    readText: async () => {
      throw new Error('File unavailable');
    },
  });

  await assert.rejects(missing(), /File unavailable/);

  const malformed = createNillionReviewStateLoader({
    readText: async () => '{invalid',
  });

  await assert.rejects(malformed(), SyntaxError);
});

test('requires a valid token and current database administrator status', async () => {
  let lookups = 0;

  const dependencies = {
    verifyToken: async (token) =>
      token === 'valid'
        ? { userId: 'user-1', role: 'admin' }
        : null,
    findUser: async () => {
      lookups += 1;
      return { role: 'member' };
    },
  };

  assert.equal(
    await getNillionReviewAdmin(request(), dependencies),
    null,
  );
  assert.equal(lookups, 0);

  assert.equal(
    await getNillionReviewAdmin(
      request({ authorization: 'Bearer invalid' }),
      dependencies,
    ),
    null,
  );
  assert.equal(lookups, 0);

  // An admin claim in the token does not override the current DB role.
  assert.equal(
    await getNillionReviewAdmin(
      request({ authorization: 'Bearer valid' }),
      dependencies,
    ),
    null,
  );
  assert.equal(lookups, 1);

  dependencies.findUser = async () => ({ isAdmin: true });

  assert.deepEqual(
    await getNillionReviewAdmin(
      request({ authorization: 'Bearer valid' }),
      dependencies,
    ),
    { userId: 'user-1' },
  );
});

test('supports the auth cookie but rejects malformed bearer headers', async () => {
  const dependencies = {
    verifyToken: async () => ({ userId: 'user-1' }),
    findUser: async () => ({ role: 'admin' }),
  };

  assert.deepEqual(
    await getNillionReviewAdmin(
      request({ cookie: 'valid-cookie' }),
      dependencies,
    ),
    { userId: 'user-1' },
  );

  assert.equal(
    await getNillionReviewAdmin(
      request({
        authorization: 'Bearer',
        cookie: 'valid-cookie',
      }),
      dependencies,
    ),
    null,
  );
});

test('rejects unauthorized requests before performing chain review', async () => {
  let reviewCalls = 0;

  const handler = createNillionReviewHandler({
    authenticate: async () => null,
    runReview: async () => {
      reviewCalls += 1;
    },
  });

  const result = await handler(request());

  assert.equal(result.status, 403);
  assert.equal(reviewCalls, 0);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});

test('rejects browser-supplied review parameters', async () => {
  let reviewCalls = 0;

  const handler = createNillionReviewHandler({
    authenticate: async () => ({ userId: 'admin-1' }),
    runReview: async () => {
      reviewCalls += 1;
    },
  });

  const result = await handler(
    request({ query: '?ledger=other.json&owner=attacker' }),
  );

  assert.equal(result.status, 400);
  assert.equal(reviewCalls, 0);
});

test('returns a review without persisting approval or enabling execution', async () => {
  const review = {
    status: 'nothing_to_review',
    approved: false,
    executionEnabled: false,
  };

  const handler = createNillionReviewHandler({
    authenticate: async () => ({ userId: 'admin-1' }),
    runReview: async () => review,
  });

  const result = await handler(request());
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.approvalPersisted, false);
  assert.equal(body.executionEnabled, false);
  assert.deepEqual(body.review, review);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});

test('fails closed and does not disclose internal error details', async () => {
  for (const failureStage of ['authentication', 'review']) {
    const secretError = new Error(
      'private-token mongodb://private-host private-rpc-url',
    );

    const handler = createNillionReviewHandler({
      authenticate: async () => {
        if (failureStage === 'authentication') throw secretError;
        return { userId: 'admin-1' };
      },
      runReview: async () => {
        throw secretError;
      },
    });

    const result = await handler(request());
    const body = await result.json();

    assert.equal(result.status, 503);
    assert.equal(body.success, false);
    assert.ok(!JSON.stringify(body).includes('private'));
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
  }
});