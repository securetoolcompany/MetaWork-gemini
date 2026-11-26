import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import {
  OFFLINE_PRODUCT_KINDS,
  OFFLINE_PROTECTED_FIELDS,
  isOfflineProductKind,
} from '../lib/product-kinds.js';
import {
  publicProductEligibility,
  isPubliclyEligible,
} from '../lib/public-inventory-eligibility.js';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const ID = '507f1f77bcf86cd799439011';
const OWNER = 'owner-1';

function load(path, deps, names, transform = s => s) {
  const source = transform(
    readFileSync(new URL(path, root), 'utf8')
      .replace(/^import\s+[\s\S]*?;\s*/gm, '')
      .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|var)/g, ''),
  );
  return new Function(
    ...Object.keys(deps),
    `${source}\nreturn { ${names.join(', ')} };`,
  )(...Object.values(deps));
}

const NextResponse = {
  json: (body, config = {}) => ({ body, status: config.status ?? 200 }),
};
const tokens = {
  'owner-token': { userId: OWNER },
  'other-token': { userId: 'someone-else' },
};
const verifyToken = token => {
  if (!tokens[token]) throw new Error('bad token');
  return tokens[token];
};

function makeDb({ product = null } = {}) {
  const calls = { updates: [], userUpdates: [], queries: [], cartWrites: [] };
  const chain = rows => ({
    sort() { return this; },
    skip() { return this; },
    limit() { return this; },
    async toArray() { return rows; },
  });
  const collections = {
    products: {
      async findOne() { return product; },
      async updateOne(filter, update) {
        calls.updates.push([filter, update]);
        return { matchedCount: 1, modifiedCount: 1 };
      },
      find(query) { calls.queries.push(query); return chain([]); },
      async countDocuments(query) { calls.queries.push(query); return 0; },
    },
    users: {
      async findOne() { return null; },
      async updateOne(...args) { calls.userUpdates.push(args); return { matchedCount: 1 }; },
    },
    carts: {
      async findOne() { return null; },
      async findOneAndUpdate(filter, update) {
        calls.cartWrites.push([filter, update]);
        return { items: [] };
      },
    },
  };
  return {
    calls,
    db: {
      collection(name) {
        const found = collections[name];
        if (!found) throw new Error('Unexpected collection: ' + name);
        return found;
      },
    },
  };
}

const deps = db => ({
  NextResponse, verifyToken, ObjectId, require,
  connectToDatabase: async () => ({ db, client: null }),
  publicProductEligibility, isPubliclyEligible, isOfflineProductKind,
  OFFLINE_PRODUCT_KINDS, OFFLINE_PROTECTED_FIELDS,
  console: { log() {}, error() {}, warn() {} },
});

function request({ method = 'GET', url = 'http://localhost/api/test', token, cookie, body } = {}) {
  const headers = new Headers();
  if (token) headers.set('authorization', 'Bearer ' + token);
  return {
    method, url, headers,
    cookies: { get: name => (name === 'auth_token' && cookie ? { value: cookie } : undefined) },
    json: async () => structuredClone(body ?? {}),
  };
}

const product = (extra = {}) => ({
  _id: new ObjectId(ID), id: ID, userId: OWNER, title: 'Item',
  status: 'draft', isPublic: false, ...extra,
});

const writeRoutes = [
  {
    name: 'PATCH /api/products/[id]', method: 'PATCH', body: f => f,
    run: (d, req) => load('app/api/products/[id]/route.js', d, ['PATCH'])
      .PATCH(req, { params: Promise.resolve({ id: ID }) }),
  },
  {
    name: 'PUT /api/metawork/products/[id]', method: 'PUT', body: f => f,
    run: (d, req) => load('app/api/metawork/products/[id]/route.js', d, ['PUT'])
      .PUT(req, { params: Promise.resolve({ id: ID }) }),
  },
  {
    name: 'PATCH /api/metawork/products/list', method: 'PATCH', body: f => ({ id: ID, ...f }),
    run: (d, req) => load('app/api/metawork/products/list/route.js', d, ['PATCH']).PATCH(req),
  },
  {
    name: 'PUT /api/metawork/products', method: 'PUT', body: f => ({ id: ID, ...f }),
    run: (d, req) => load('app/api/metawork/products/route.js', d, ['PUT']).PUT(req),
  },
];

async function attempt(route, { product: doc, token, cookie, fields }) {
  const { db, calls } = makeDb({ product: doc });
  const response = await route.run(
    deps(db),
    request({ method: route.method, token, cookie, body: route.body(fields) }),
  );
  return { response, calls };
}

for (const route of writeRoutes) {
  test(`${route.name}: unauthenticated writes are rejected`, async () => {
    const { response, calls } = await attempt(route, { product: product(), fields: { name: 'X' } });
    assert.equal(response.status, 401);
    assert.equal(calls.updates.length, 0);
  });

  test(`${route.name}: non-owners cannot write`, async () => {
    const { response, calls } = await attempt(route, {
      product: product(), token: 'other-token', fields: { name: 'X' },
    });
    assert.equal(response.status, 403);
    assert.equal(calls.updates.length, 0);
  });

  test(`${route.name}: the owner cannot publish or list a 3d_print`, async () => {
    for (const field of OFFLINE_PROTECTED_FIELDS) {
      const value = field === 'status' ? 'live' : field === 'isDraft' ? false : true;
      const { response, calls } = await attempt(route, {
        product: product({ productKind: '3d_print' }),
        token: 'owner-token', fields: { [field]: value },
      });
      assert.equal(response.status, 409, field);
      assert.equal(response.body.code, 'PRODUCT_KIND_OFFLINE', field);
      assert.equal(calls.updates.length, 0, field);
    }
  });

  test(`${route.name}: the owner can still edit other fields of a 3d_print`, async () => {
    const { response, calls } = await attempt(route, {
      product: product({ productKind: '3d_print' }),
      token: 'owner-token', fields: { name: 'Renamed' },
    });
    assert.equal(response.status, 200);
    assert.equal(calls.updates[0][1].$set.name, 'Renamed');
  });

  test(`${route.name}: clients cannot set productKind or provisioning`, async () => {
    const { response, calls } = await attempt(route, {
      product: product(), token: 'owner-token',
      fields: { name: 'X', productKind: '3d_print', provisioning: { stl_file: {} } },
    });
    assert.equal(response.status, 200);
    const set = calls.updates[0][1].$set;
    assert.equal('productKind' in set, false);
    assert.equal('provisioning' in set, false);
  });

  test(`${route.name}: ordinary products and cookie auth are unchanged`, async () => {
    const { response, calls } = await attempt(route, {
      product: product(), cookie: 'owner-token', fields: { name: 'Edited' },
    });
    assert.equal(response.status, 200);
    assert.equal(calls.updates[0][1].$set.name, 'Edited');
  });
}

test('GET /api/products/[id]: a 3d_print is 404 for everyone except its owner', async () => {
  const offline = product({ productKind: '3d_print', isPublic: true, status: 'active', isVisible: true });
  for (const [label, options, expected] of [
    ['anonymous', {}, 404],
    ['another user', { token: 'other-token' }, 404],
    ['the owner', { token: 'owner-token' }, 200],
  ]) {
    const { db } = makeDb({ product: offline });
    const { GET } = load('app/api/products/[id]/route.js', deps(db), ['GET']);
    const response = await GET(request({ ...options }), { params: Promise.resolve({ id: ID }) });
    assert.equal(response.status, expected, label);
  }
  const publicProduct = product({ isPublic: true, status: 'active', isVisible: true });
  const { db } = makeDb({ product: publicProduct });
  const { GET } = load('app/api/products/[id]/route.js', deps(db), ['GET']);
  assert.equal((await GET(request(), { params: Promise.resolve({ id: ID }) })).status, 200);
});

test('GET /api/metawork/products: the public list query excludes offline kinds', async () => {
  const { db, calls } = makeDb();
  const { GET } = load('app/api/metawork/products/route.js', deps(db), ['GET']);
  const response = await GET(request({ url: 'http://localhost/api/metawork/products' }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.queries.at(-1).$and[0].productKind, { $nin: ['3d_print'] });
});

test('GET /api/metawork/products/list: other users never see offline kinds; owners keep them', async () => {
  for (const [label, search, expectsFilter] of [
    ['own list', '', false],
    ['own list by id', `?userId=${OWNER}`, false],
    ['another user by id', '?userId=someone-else', true],
    ['IP owner view', '?ipOwnerId=creator-1&public=true', true],
  ]) {
    const { db, calls } = makeDb();
    const { GET } = load('app/api/metawork/products/list/route.js', deps(db), ['GET']);
    const response = await GET(request({
      url: 'http://localhost/api/metawork/products/list' + search, token: 'owner-token',
    }));
    assert.equal(response.status, 200, label);
    const query = calls.queries.at(-1);
    if (expectsFilter) assert.deepEqual(query.productKind, { $nin: ['3d_print'] }, label);
    else assert.equal(query.productKind, undefined, label);
  }
});

function cartDeps(db, createCalls) {
  return {
    ...deps(db),
    CART_COLLECTION: 'carts',
    GUEST_CART_TTL_MS: 1000,
    createCartItem: (...args) => {
      createCalls.push(args);
      return {
        productId: ID, variationId: 'v1', quantity: 1, priceSnapshot: 1, price: 1,
        title: 'Item', thumbnailUrl: null, imageUrl: null, attributes: {}, selectedOptions: null,
      };
    },
    createCartDocument: () => ({}),
    mergeCartItems: (a, b) => [...a, ...b],
    normalizeCart: value => value,
    getOrCreateSessionId: async () => ({ sessionId: 's1', isNew: false }),
    setSessionCookie: async () => {},
    clearSessionCookie: async () => {},
    getSessionId: async () => null,
    getUserSession: async () => ({ userId: OWNER }),
    checkCartMerge: async () => ({ needsMerge: false }),
  };
}

test('POST /api/cart: a 3d_print cannot be added to a cart', async () => {
  const createCalls = [];
  const { db, calls } = makeDb({ product: product({ productKind: '3d_print' }) });
  const { POST } = load('app/api/cart/route.js', cartDeps(db, createCalls), ['POST']);
  const response = await POST(request({
    method: 'POST', body: { productId: ID, variationId: 'v1', quantity: 1 },
  }));
  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'PRODUCT_NOT_PURCHASABLE');
  assert.equal(createCalls.length, 0);
  assert.equal(calls.cartWrites.length, 0);
});

test('POST /api/cart: an ordinary product is added as before', async () => {
  const createCalls = [];
  const { db, calls } = makeDb({ product: product({ isPublic: true, status: 'active' }) });
  const { POST } = load('app/api/cart/route.js', cartDeps(db, createCalls), ['POST']);
  const response = await POST(request({
    method: 'POST', body: { productId: ID, variationId: 'v1', quantity: 1 },
  }));
  assert.equal(response.status, 200);
  assert.equal(createCalls.length, 1);
  assert.equal(calls.cartWrites.length, 1);
});

async function checkout(doc) {
  const { db, calls } = makeDb({ product: doc });
  const { POST } = load(
    'app/api/checkout/process/route.js',
    {
      ...deps(db),
      getUserFromToken: () => ({ userId: ID }),
      RealObjectId: ObjectId,
    },
    ['POST'],
    source => source.replace("const { ObjectId } = await import('mongodb');", ''),
  );
  const response = await POST(request({
    method: 'POST', cookie: 'owner-token',
    body: { productId: ID, shippingInfo: { name: 'A', address1: 'B' } },
  }));
  return { response, calls };
}

test('POST /api/checkout/process: a 3d_print is rejected before anything is saved', async () => {
  const { response, calls } = await checkout(product({ productKind: '3d_print' }));
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.equal(response.body.code, 'PRODUCT_NOT_PURCHASABLE');
  assert.equal(calls.userUpdates.length, 0);
});

test('POST /api/checkout/process: an ordinary product still completes', async () => {
  const { response, calls } = await checkout(product());
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(calls.userUpdates.length, 1);
});

function resolver(variantCalls) {
  return load(
    'lib/checkout-cart.js',
    {
      ObjectId,
      CART_COLLECTION: 'carts',
      findCanonicalCartVariant: (doc, id) => {
        variantCalls.push(id);
        return { retail_price: 10, printful_id: 99, sku: 'sku-1' };
      },
      getSessionId: async () => null,
      getUserSession: async () => ({}),
      isOfflineProductKind,
    },
    ['resolveCanonicalCartItems'],
  ).resolveCanonicalCartItems;
}

test('resolveCanonicalCartItems: a 3d_print is rejected before variant resolution', async () => {
  const variantCalls = [];
  const { db } = makeDb({ product: product({ productKind: '3d_print' }) });
  await assert.rejects(
    resolver(variantCalls)({ db, cartItems: [{ productId: ID, variationId: 'v1', quantity: 1 }] }),
    error => error.code === 'PRODUCT_NOT_PURCHASABLE',
  );
  assert.equal(variantCalls.length, 0);
});

test('resolveCanonicalCartItems: an ordinary product resolves as before', async () => {
  const variantCalls = [];
  const { db } = makeDb({ product: product() });
  const items = await resolver(variantCalls)({
    db, cartItems: [{ productId: ID, variationId: 'v1', quantity: 2 }],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 2);
  assert.equal(items[0].unitPrice, 10);
  assert.equal(variantCalls.length, 1);
});
