import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const prepareRoutePath =
  'app/api/products/[id]/revenue-tokenization/funding/prepare/route.js';
const submitRoutePath =
  'app/api/products/[id]/revenue-tokenization/funding/submit/route.js';

const read = (path) => readFileSync(new URL(path, root), 'utf8');
const clone = (value) => structuredClone(value);

const OWNER = 'OWNERWALLETADDRESS';
const RECEIVER = 'PLATFORMSIGNERADDRESS';
const GENESIS_HASH = new Uint8Array(32);

const richAccount = { amount: 5_000_000n, minBalance: 200_000n };

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
    if (key === '$and') return condition.every((item) => matches(record, item));
    if (key === '$or') return condition.some((item) => matches(record, item));

    const actual = field(record, key);

    if (
      condition &&
      typeof condition === 'object' &&
      !(condition instanceof Date)
    ) {
      return Object.entries(condition).every(([operator, expected]) => {
        if (operator === '$in') return expected.includes(actual.value);
        if (operator === '$exists') return actual.exists === expected;
        throw new Error('Unsupported fixture operator: ' + operator);
      });
    }

    return actual.value === condition;
  });
}

function setPath(record, path, value) {
  const keys = path.split('.');
  let target = record;

  for (const key of keys.slice(0, -1)) {
    if (target[key] === null || typeof target[key] !== 'object') {
      target[key] = {};
    }
    target = target[key];
  }

  target[keys[keys.length - 1]] = value;
}

function createProductStore(initial, beforeWrite) {
  let stored = clone(initial);
  let writes = 0;

  const apply = (query, update) => {
    writes += 1;

    if (beforeWrite && writes === 1) {
      stored = beforeWrite(clone(stored));
    }

    if (!matches(stored, query)) return false;

    for (const [path, value] of Object.entries(update.$set)) {
      setPath(stored, path, clone(value));
    }

    return true;
  };

  return {
    collection: {
      async findOne(query) {
        return matches(stored, query) ? clone(stored) : null;
      },
      async updateOne(query, update) {
        const ok = apply(query, update);
        return { matchedCount: ok ? 1 : 0, modifiedCount: ok ? 1 : 0 };
      },
      async findOneAndUpdate(query, update) {
        return apply(query, update) ? clone(stored) : null;
      },
    },
    get stored() { return clone(stored); },
    get writes() { return writes; },
  };
}

function commonDependencies(store) {
  const user = {
    id: 'owner-1',
    wallets: [{ address: OWNER, chain: 'algorand', verified: true }],
  };

  return {
    NextResponse: {
      json(body, options = {}) {
        return { status: options.status ?? 200, body };
      },
    },
    ObjectId: class {
      static isValid() { return false; }
    },
    crypto,
    connectToDatabase: async () => ({
      db: {
        collection(name) {
          if (name === 'products') return store.collection;
          if (name === 'users') {
            return { async findOne() { return clone(user); } };
          }
          throw new Error('Unexpected collection: ' + name);
        },
      },
    }),
    verifyToken(token) {
      assert.equal(token, 'owner-token');
      return { userId: 'owner-1' };
    },
    console: { log() {}, warn() {}, error() {} },
  };
}

function loadHandler(path, name, dependencies) {
  const source = read(path)
    .replace(/^import\s+[\s\S]*?;\s*/gm, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|var)/g, '');

  return new Function(
    ...Object.keys(dependencies),
    source + '\nreturn ' + name + ';',
  )(...Object.values(dependencies));
}

function makeRequest(body) {
  return {
    headers: {
      get: (name) => (name === 'authorization' ? 'Bearer owner-token' : null),
    },
    cookies: { get() { return undefined; } },
    async json() { return body; },
  };
}

const routeParams = () => ({ params: Promise.resolve({ id: 'product-1' }) });
const future = () => new Date(Date.now() + 10 * 60 * 1000);
const past = () => new Date(Date.now() - 60 * 1000);

function productWith(pool) {
  return {
    _id: 'mongo-product',
    id: 'product-1',
    userId: 'owner-1',
    name: 'Fixture product',
    productRevenuePool: clone(pool),
  };
}

const pendingPool = {
  ownerAddress: OWNER,
  tokenizationStatus: 'pending_funding',
  mbr: { totalMicroAlgos: 313000 },
  stakeholders: [{ address: OWNER }],
};

function oldAttempt(status, expiresAt = past()) {
  return {
    id: 'attempt-original',
    status,
    expiresAt,
    expectedTransactionId: 'old-tx',
    transaction: { txnBase64: 'old' },
  };
}

function awaitingPool(attempt) {
  return {
    ...pendingPool,
    tokenizationStatus: 'awaiting_funding_signature',
    fundingAttempt: attempt,
  };
}

function createPrepareHarness(
  initialProduct,
  { accountInfo = richAccount, algodError, beforeWrite } = {},
) {
  const store = createProductStore(initialProduct, beforeWrite);

  const dependencies = {
    ...commonDependencies(store),
    algosdk: {
      isValidAddress: () => true,
      makePaymentTxnWithSuggestedParamsFromObject: ({ amount }) => ({
        fee: 1000n,
        amount,
        firstValid: 10n,
        lastValid: 20n,
        genesisID: 'testnet-v1.0',
        genesisHash: GENESIS_HASH,
        txID: () => 'EXPECTEDTXID',
      }),
      encodeUnsignedTransaction: () => new Uint8Array([1, 2, 3]),
    },
    getSigner: () => ({ address: RECEIVER }),
    getTransactionParams: async () => ({}),
    getAlgodClient: () => ({
      accountInformation: () => ({
        do: async () => {
          if (algodError) throw algodError;
          return accountInfo;
        },
      }),
    }),
  };

  const POST = loadHandler(prepareRoutePath, 'POST', dependencies);

  return {
    store,
    invoke: () => POST(makeRequest({ walletAddress: OWNER }), routeParams()),
  };
}

// ---- funding/prepare: failed and expired attempts are recoverable ----

for (const status of ['failed', 'expired']) {
  test('prepare replaces a ' + status + ' attempt with a fresh one', async () => {
    const harness = createPrepareHarness(
      productWith(awaitingPool(oldAttempt(status))),
    );
    const response = await harness.invoke();
    const pool = harness.store.stored.productRevenuePool;

    assert.equal(response.status, 200);
    assert.equal(pool.tokenizationStatus, 'awaiting_funding_signature');
    assert.equal(pool.fundingAttempt.status, 'awaiting_signature');
    assert.notEqual(pool.fundingAttempt.id, 'attempt-original');
    assert.equal(response.body.funding.expectedTransactionId, 'EXPECTEDTXID');
  });
}

test('prepare still replaces a timed-out awaiting_signature attempt', async () => {
  const harness = createPrepareHarness(
    productWith(awaitingPool(oldAttempt('awaiting_signature', past()))),
  );
  const response = await harness.invoke();

  assert.equal(response.status, 200);
  assert.notEqual(
    harness.store.stored.productRevenuePool.fundingAttempt.id,
    'attempt-original',
  );
});

test('prepare keeps a live awaiting_signature attempt locked', async () => {
  const initial = productWith(
    awaitingPool(oldAttempt('awaiting_signature', future())),
  );
  const harness = createPrepareHarness(initial);
  const response = await harness.invoke();

  assert.equal(response.status, 409);
  assert.equal(harness.store.writes, 0);
  assert.deepEqual(harness.store.stored, initial);
});

for (const status of ['submitting', 'submitted', 'confirming', 'confirmed']) {
  test('prepare never resets an in-flight ' + status + ' attempt', async () => {
    const initial = productWith(awaitingPool(oldAttempt(status)));
    const harness = createPrepareHarness(initial);
    const response = await harness.invoke();

    assert.equal(response.status, 409);
    assert.equal(harness.store.writes, 0);
    assert.deepEqual(harness.store.stored, initial);
  });
}

test('prepare does not overwrite an attempt that changed after the read', async () => {
  const harness = createPrepareHarness(
    productWith(awaitingPool(oldAttempt('failed'))),
    {
      beforeWrite: (current) => {
        current.productRevenuePool.fundingAttempt.status = 'confirming';
        return current;
      },
    },
  );
  const response = await harness.invoke();

  assert.equal(response.status, 409);
  assert.equal(harness.store.writes, 1);
  assert.equal(
    harness.store.stored.productRevenuePool.fundingAttempt.status,
    'confirming',
  );
});

// ---- funding/prepare: balance check (313000 + 1000 fee + 200000 min) ----

test('prepare rejects an underfunded wallet with the exact shortfall', async () => {
  const harness = createPrepareHarness(productWith(pendingPool), {
    accountInfo: { amount: 435414n, minBalance: 200000n },
  });
  const response = await harness.invoke();
  const pool = harness.store.stored.productRevenuePool;

  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'INSUFFICIENT_ALGO_BALANCE');
  assert.match(response.body.error, /0\.078586/);
  assert.match(response.body.error, /0\.514000/);
  assert.equal(harness.store.writes, 0);
  assert.equal(pool.tokenizationStatus, 'pending_funding');
  assert.equal('fundingAttempt' in pool, false);
});

test('prepare allows a wallet with exactly the required balance', async () => {
  const harness = createPrepareHarness(productWith(pendingPool), {
    accountInfo: { amount: 514000n, minBalance: 200000n },
  });

  assert.equal((await harness.invoke()).status, 200);
});

test('prepare rejects a wallet one microAlgo short', async () => {
  const harness = createPrepareHarness(productWith(pendingPool), {
    accountInfo: { amount: 513999n, minBalance: 200000n },
  });

  assert.equal((await harness.invoke()).status, 409);
});

test('prepare reads the legacy min-balance response shape', async () => {
  const harness = createPrepareHarness(productWith(pendingPool), {
    accountInfo: { amount: 435414, 'min-balance': 200000 },
  });
  const response = await harness.invoke();

  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'INSUFFICIENT_ALGO_BALANCE');
});

test('prepare falls back to a 100000 minimum when none is reported', async () => {
  const enough = createPrepareHarness(productWith(pendingPool), {
    accountInfo: { amount: 414000 },
  });
  const short = createPrepareHarness(productWith(pendingPool), {
    accountInfo: { amount: 413999 },
  });

  assert.equal((await enough.invoke()).status, 200);
  assert.equal((await short.invoke()).status, 409);
});

test('prepare fails open when the balance lookup errors', async () => {
  const harness = createPrepareHarness(productWith(pendingPool), {
    algodError: new Error('algod unavailable'),
  });

  assert.equal((await harness.invoke()).status, 200);
});

test('prepare keeps the failure record when the balance check blocks a retry', async () => {
  const harness = createPrepareHarness(
    productWith(awaitingPool(oldAttempt('failed'))),
    { accountInfo: { amount: 100000n, minBalance: 200000n } },
  );
  const response = await harness.invoke();
  const pool = harness.store.stored.productRevenuePool;

  assert.equal(response.status, 409);
  assert.equal(pool.tokenizationStatus, 'pending_funding');
  assert.equal(pool.fundingAttempt.status, 'failed');
  assert.equal(pool.fundingAttempt.id, 'attempt-original');
});

// ---- funding/submit: a rejected broadcast must unlock the product ----

function createSubmitHarness(initialProduct, { sendError } = {}) {
  const store = createProductStore(initialProduct);

  const signedTransaction = {
    txn: {
      type: 'pay',
      txID: () => 'EXPECTEDTXID',
      sender: OWNER,
      payment: { receiver: RECEIVER, amount: 313000 },
      fee: 1000n,
      firstValid: 10n,
      lastValid: 20n,
      genesisID: 'testnet-v1.0',
      genesisHash: GENESIS_HASH,
    },
  };

  const dependencies = {
    ...commonDependencies(store),
    algosdk: {
      decodeSignedTransaction: () => signedTransaction,
      encodeAddress: (value) => String(value),
      waitForConfirmation: async () => ({ 'confirmed-round': 123 }),
    },
    getAlgodClient: () => ({
      sendRawTransaction: () => ({
        do: async () => {
          if (sendError) throw sendError;
          return { txId: 'EXPECTEDTXID' };
        },
      }),
    }),
  };

  const POST = loadHandler(submitRoutePath, 'POST', dependencies);

  return {
    store,
    invoke: () =>
      POST(
        makeRequest({
          fundingAttemptId: 'attempt-1',
          expectedTransactionId: 'EXPECTEDTXID',
          signedTransactionBase64: Buffer.from('signed').toString('base64'),
        }),
        routeParams(),
      ),
  };
}

function submittablePool() {
  return awaitingPool({
    id: 'attempt-1',
    status: 'awaiting_signature',
    expiresAt: future(),
    expectedTransactionId: 'EXPECTEDTXID',
    ownerAddress: OWNER,
    receiverAddress: RECEIVER,
    amountMicroAlgos: 313000,
    transaction: {
      feeMicroAlgos: 1000,
      firstValidRound: 10,
      lastValidRound: 20,
      genesisId: 'testnet-v1.0',
      genesisHashBase64: Buffer.from(GENESIS_HASH).toString('base64'),
    },
  });
}

test('submit returns the product to pending_funding when algod rejects the payment', async () => {
  const harness = createSubmitHarness(productWith(submittablePool()), {
    sendError: new Error('balance 121414 below min 200000'),
  });
  const response = await harness.invoke();
  const pool = harness.store.stored.productRevenuePool;

  assert.equal(response.status, 502);
  assert.equal(pool.tokenizationStatus, 'pending_funding');
  assert.equal(pool.fundingAttempt.status, 'failed');
  assert.equal(pool.fundingAttempt.failureCode, 'ALGOD_BROADCAST_FAILED');
  assert.match(pool.fundingAttempt.failureMessage, /below min 200000/);
});

test('submit still moves a confirmed payment on to creating', async () => {
  const harness = createSubmitHarness(productWith(submittablePool()));
  const response = await harness.invoke();
  const pool = harness.store.stored.productRevenuePool;

  assert.equal(response.status, 200);
  assert.equal(pool.fundingAttempt.status, 'confirmed');
  assert.equal(pool.tokenizationStatus, 'creating');
});
