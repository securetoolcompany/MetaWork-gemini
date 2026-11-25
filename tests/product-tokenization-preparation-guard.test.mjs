import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const routePath =
  'app/api/products/[id]/revenue-tokenization/prepare/route.js';

const read = path =>
  readFileSync(new URL(path, root), 'utf8');

const { CREDIT_COSTS } = await import(
  `data:text/javascript;base64,${Buffer.from(
    read('lib/credit-costs.js'),
  ).toString('base64')}`
);

const clone = value => structuredClone(value);
const wallet = 'verified-wallet';

function field(record, path) {
  let value = record;

  for (const key of path.split('.')) {
    if (
      value === null ||
      typeof value !== 'object' ||
      !Object.prototype.hasOwnProperty.call(value, key)
    ) {
      return { exists: false, value: undefined };
    }

    value = value[key];
  }

  return { exists: true, value };
}

// Deliberately limited fixture evaluator, not MongoDB integration.
function matches(record, query) {
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$and') {
      return condition.every(item => matches(record, item));
    }

    if (key === '$or') {
      return condition.some(item => matches(record, item));
    }

    const actual = field(record, key);

    if (condition && typeof condition === 'object') {
      return Object.entries(condition).every(([operator, expected]) => {
        if (operator === '$exists') {
          return actual.exists === expected;
        }

        if (operator === '$nin') {
          return !expected.includes(actual.value);
        }

        throw new Error(`Unsupported fixture operator: ${operator}`);
      });
    }

    return actual.value === condition;
  });
}

function product(pool) {
  return {
    _id: 'mongo-product',
    id: 'product-1',
    userId: 'owner-1',
    name: 'Fixture product',
    ...(pool === undefined
      ? {}
      : { productRevenuePool: clone(pool) }),
  };
}

const pendingPool = {
  poolKey: 'product:mongo-product',
  ownerAddress: wallet,
  displayName: 'Existing preparation',
  tokenizationStatus: 'pending_funding',
  creditStatus: 'pending',
  stakeholders: [{ address: wallet, bps: 10000 }],
  mbr: { totalMicroAlgos: 123456 },
};

function attempt(status) {
  return {
    id: 'attempt-original',
    status,
    expectedTransactionId: 'transaction-original',
    transaction: { txnBase64: 'original-bytes' },
  };
}

function createHarness(initialProduct, beforeWrite) {
  let stored = clone(initialProduct);
  let writes = 0;
  let matchedWrites = 0;
  let writeFilter;

  const products = {
    async findOne(query) {
      return matches(stored, query) ? clone(stored) : null;
    },

    async updateOne(query, update) {
      writes++;
      writeFilter = clone(query);

      if (beforeWrite) {
        stored = beforeWrite(clone(stored));
      }

      if (!matches(stored, query)) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      Object.assign(stored, clone(update.$set));
      matchedWrites++;

      return { matchedCount: 1, modifiedCount: 1 };
    },
  };

  const user = {
    id: 'owner-1',
    credits: CREDIT_COSTS.MINT_IP + 100,
    wallets: [{
      address: wallet,
      chain: 'algorand',
      verified: true,
    }],
  };

  const dependencies = {
    NextResponse: {
      json(body, options = {}) {
        return { status: options.status ?? 200, body };
      },
    },

    ObjectId: class {
      static isValid() {
        return false;
      }
    },

    connectToDatabase: async () => ({
      db: {
        collection(name) {
          if (name === 'products') return products;

          if (name === 'users') {
            return {
              async findOne() {
                return clone(user);
              },
            };
          }

          throw new Error(`Unexpected collection: ${name}`);
        },
      },
    }),

    verifyToken(token) {
      assert.equal(token, 'owner-token');
      return { userId: 'owner-1' };
    },

    buildProductRevenuePoolDraft() {
      return {
        ...clone(pendingPool),
        displayName: 'New preparation',
      };
    },

    createProductRevenuePoolKey() {
      return pendingPool.poolKey;
    },

    CREDIT_COSTS,

    console: { error() {} },
  };

  const source = read(routePath)
    .replace(/^import\s+[\s\S]*?;\s*/gm, '')
    .replace(
      /\bexport\s+(?=(?:async\s+)?function|const|let|var)/g,
      '',
    );

  const POST = new Function(
    ...Object.keys(dependencies),
    `${source}\nreturn POST;`,
  )(...Object.values(dependencies));

  return {
    async invoke() {
      return POST({
        headers: {
          get(name) {
            return name === 'authorization'
              ? 'Bearer owner-token'
              : null;
          },
        },
        cookies: { get() { return undefined; } },
        async json() {
          return {
            walletAddress: wallet,
            stakeholders: [{
              address: wallet,
              percentage: 100,
            }],
          };
        },
      }, {
        params: Promise.resolve({ id: 'product-1' }),
      });
    },

    get stored() { return clone(stored); },
    get writes() { return writes; },
    get matchedWrites() { return matchedWrites; },
    get writeFilter() { return clone(writeFilter); },
  };
}

test('initial preparation succeeds using shared credit pricing', async () => {
  const harness = createHarness(product());
  const response = await harness.invoke();

  assert.equal(response.status, 200);
  assert.equal(harness.matchedWrites, 1);
  assert.equal(
    harness.stored.productRevenuePool.creditCost,
    CREDIT_COSTS.MINT_IP,
  );
  assert.equal(response.body.credits.charged, 0);
});

test('valid pending preparation resumes without any write', async () => {
  const initial = product(pendingPool);
  const harness = createHarness(initial);
  const response = await harness.invoke();

  assert.equal(response.status, 200);
  assert.equal(response.body.resumed, true);
  assert.equal(harness.writes, 0);
  assert.deepEqual(harness.stored, initial);
});

for (const status of [
  'awaiting_signature',
  'submitting',
  'submitted',
  'confirming',
  'confirmed',
  'failed',
  'expired',
]) {
  test(`preserves existing funding attempt: ${status}`, async () => {
    const initial = product({
      ...pendingPool,
      tokenizationStatus: 'awaiting_funding_signature',
      fundingAttempt: attempt(status),
    });
    const harness = createHarness(initial);
    const response = await harness.invoke();

    assert.equal(response.status, 409);
    assert.equal(harness.writes, 0);
    assert.deepEqual(harness.stored, initial);
  });
}

test('pending resume cannot bypass an existing funding attempt', async () => {
  const initial = product({
    ...pendingPool,
    fundingAttempt: attempt('expired'),
  });
  const harness = createHarness(initial);

  assert.equal((await harness.invoke()).status, 409);
  assert.equal(harness.writes, 0);
  assert.deepEqual(harness.stored, initial);
});

test('awaiting-signature parent is protected even without an attempt', async () => {
  const initial = product({
    ...pendingPool,
    tokenizationStatus: 'awaiting_funding_signature',
  });
  const harness = createHarness(initial);

  assert.equal((await harness.invoke()).status, 409);
  assert.equal(harness.writes, 0);
  assert.deepEqual(harness.stored, initial);
});

test('null and malformed attempt fields are not erased', async () => {
  for (const fundingAttempt of [null, {}, 'legacy-attempt']) {
    const initial = product({
      ...pendingPool,
      tokenizationStatus: 'legacy',
      fundingAttempt,
    });
    const harness = createHarness(initial);

    assert.equal((await harness.invoke()).status, 409);
    assert.equal(harness.writes, 0);
    assert.deepEqual(harness.stored, initial);
  }
});

test('active and creating preparations remain protected', async () => {
  for (const tokenizationStatus of ['active', 'creating']) {
    const initial = product({ ...pendingPool, tokenizationStatus });
    const harness = createHarness(initial);

    assert.equal((await harness.invoke()).status, 409);
    assert.equal(harness.writes, 0);
    assert.deepEqual(harness.stored, initial);
  }
});

test('database filter rejects funding written after the initial read', async () => {
  const winner = {
    ...pendingPool,
    tokenizationStatus: 'awaiting_funding_signature',
    fundingAttempt: attempt('awaiting_signature'),
  };

  const harness = createHarness(product(), current => ({
    ...current,
    productRevenuePool: clone(winner),
  }));

  const response = await harness.invoke();

  assert.equal(response.status, 409);
  assert.equal(harness.writes, 1);
  assert.equal(harness.matchedWrites, 0);
  assert.deepEqual(harness.stored.productRevenuePool, winner);

  assert.equal(matches(product(winner), harness.writeFilter), false);

  assert.equal(matches(product({
    ...winner,
    tokenizationStatus: 'legacy',
  }), harness.writeFilter), false);

  const withoutAttempt = clone(winner);
  delete withoutAttempt.fundingAttempt;

  assert.equal(
    matches(product(withoutAttempt), harness.writeFilter),
    false,
  );
});

test('concurrent valid pending preparation is returned without replacement', async () => {
  const harness = createHarness(product(), current => ({
    ...current,
    productRevenuePool: clone(pendingPool),
  }));

  const response = await harness.invoke();

  assert.equal(response.status, 200);
  assert.equal(response.body.resumed, true);
  assert.equal(harness.matchedWrites, 0);
  assert.deepEqual(harness.stored.productRevenuePool, pendingPool);
});

test('fallback does not resume pending state containing a funding attempt', async () => {
  const winner = {
    ...pendingPool,
    fundingAttempt: attempt('confirmed'),
  };
  const harness = createHarness(product(), current => ({
    ...current,
    productRevenuePool: clone(winner),
  }));

  assert.equal((await harness.invoke()).status, 409);
  assert.equal(harness.matchedWrites, 0);
  assert.deepEqual(harness.stored.productRevenuePool, winner);
});
