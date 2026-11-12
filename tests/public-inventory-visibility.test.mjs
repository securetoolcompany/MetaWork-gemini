import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const eligibility = await import(
  `data:text/javascript;base64,${Buffer.from(
    read('lib/public-inventory-eligibility.js'),
  ).toString('base64')}`
);

const {
  publicProductEligibility,
  showroomProductEligibility,
  publicIpEligibility,
} = eligibility;

// Deliberately limited fixture evaluator, not MongoDB integration.
function matches(record, query) {
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$and') return condition.every(q => matches(record, q));
    if (key === '$or') return condition.some(q => matches(record, q));
    if (key === '$nor') return !condition.some(q => matches(record, q));

    const value = record[key];

    if (condition && typeof condition === 'object') {
      return Object.entries(condition).every(([operator, expected]) => {
        if (operator === '$in') return expected.includes(value);
        if (operator === '$ne') return value !== expected;
        throw new Error(`Unsupported fixture operator: ${operator}`);
      });
    }

    return value === condition;
  });
}

const published = {
  _id: 'mock-record',
  id: 'mock-product',
  userId: 'owner-1',
  ownerId: 'owner-1',
  status: 'live',
  isPublic: true,
  isVisible: true,
  showroomListed: true,
  name: 'Published product',
  price: 20,
  variants: [{ id: 'variant-1', retail_price: 20 }],
};

function loadGet(path, dependencies) {
  const source = read(path)
    .replace(/^import\s+[\s\S]*?;\s*/gm, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|var)/g, '');

  return new Function(
    ...Object.keys(dependencies),
    `${source}\nreturn GET;`,
  )(...Object.values(dependencies));
}

async function invoke(path, {
  product = published,
  inventory = [published],
  bearer,
  cookie,
  params = '',
  missing = false,
} = {}) {
  const queries = {};
  let relatedReads = 0;
  let fetchCalls = 0;

  const user = {
    _id: 'owner-1',
    id: 'owner-1',
    username: 'alice',
  };

  const db = {
    collection(name) {
      if (name === 'ip_assets') {
        return {
          aggregate() {
            return {
              async toArray() {
                return missing ? [] : [{ ...product }];
              },
            };
          },
        };
      }

      if (name === 'users') {
        return {
          async findOne(query) {
            relatedReads++;
            return matches(user, query) ? { ...user } : null;
          },
        };
      }

      if (name === 'aisles') {
        return { async findOne() { relatedReads++; return null; } };
      }

      if (name === 'ip_ownership_history') {
        return {
          find() {
            relatedReads++;
            return { async toArray() { return []; } };
          },
        };
      }

      assert.equal(name, 'products');

      return {
        async findOne() {
          return missing ? null : { ...product };
        },
        find(query) {
          relatedReads++;
          queries.find = query;
          let skip = 0;
          let limit = Infinity;

          const cursor = {
            sort() { return cursor; },
            skip(value) { skip = value; return cursor; },
            limit(value) { limit = value; return cursor; },
            async toArray() {
              return inventory
                .filter(item => matches(item, query))
                .slice(skip, skip + limit)
                .map(item => ({ ...item }));
            },
          };

          return cursor;
        },
        async countDocuments(query) {
          queries.count = query;
          return inventory.filter(item => matches(item, query)).length;
        },
      };
    },
  };

  class MockObjectId {
    constructor(value) { this.value = value; }
    static isValid() { return false; }
  }

  const GET = loadGet(path, {
    NextResponse: {
      json(body, options = {}) {
        return { status: options.status ?? 200, body };
      },
    },
    connectToDatabase: async () => ({ db }),
    verifyToken(token) {
      if (token === 'owner-token') return { userId: 'owner-1' };
      if (token === 'other-token') return { userId: 'other-1' };
      return null;
    },
    ObjectId: MockObjectId,
    ...eligibility,
    require(name) {
      assert.equal(name, 'mongodb');
      return { ObjectId: MockObjectId };
    },
    async fetch() {
      fetchCalls++;
      return {
        ok: true,
        async json() {
          return { result: { product: {}, variants: [] } };
        },
      };
    },
    process: { env: { PRINTFUL_API_KEY: 'mock-key' } },
    console: { log() {}, error() {}, warn() {} },
  });

  const response = await GET({
    url: `http://localhost/api/test?${params}`,
    headers: {
      get(name) {
        return name === 'authorization' && bearer
          ? `Bearer ${bearer}`
          : null;
      },
    },
    cookies: {
      get(name) {
        return name === 'auth_token' && cookie
          ? { value: cookie }
          : undefined;
      },
    },
  }, {
    params: Promise.resolve({ id: 'mock-product' }),
  });

  return { response, queries, relatedReads, fetchCalls };
}

test('published product qualifies for aisle and showroom', () => {
  assert.equal(matches(published, publicProductEligibility()), true);
  assert.equal(matches(published, showroomProductEligibility()), true);
});

test('explicit negative states override stale positive product flags', () => {
  for (const override of [
    { status: 'draft' },
    { status: 'pending' },
    { isDraft: true },
    { isPublic: false },
    { isVisible: false },
  ]) {
    for (const filter of [
      publicProductEligibility(),
      showroomProductEligibility(),
    ]) {
      assert.equal(matches({ ...published, ...override }, filter), false);
    }
  }
});

test('showroom opt-out is surface-specific', () => {
  const record = { ...published, showroomListed: false };
  assert.equal(matches(record, publicProductEligibility()), true);
  assert.equal(matches(record, showroomProductEligibility()), false);
});

test('legacy optional flags tolerated; explicit public permission required', () => {
  const record = { status: 'active', isPublic: true };
  assert.equal(matches(record, publicProductEligibility()), true);
  assert.equal(matches(record, showroomProductEligibility()), true);
  assert.equal(matches({ status: 'active' }, publicProductEligibility()), false);
  assert.equal(matches({ isPublic: true }, publicProductEligibility()), false);
});

test('IP requires active and public, independently of licensing', () => {
  assert.equal(matches({
    status: 'active', isPublic: true, licensable: false,
  }, publicIpEligibility()), true);

  for (const record of [
    { status: 'active', isPublic: false },
    { status: 'pending_nft_mint', isPublic: true },
    { status: 'draft', isPublic: true },
    { status: 'active' },
    { isPublic: true },
  ]) {
    assert.equal(matches(record, publicIpEligibility()), false);
  }
});

test('unpublishing removes previously eligible fixtures', () => {
  const product = { ...published };
  assert.equal(matches(product, publicProductEligibility()), true);
  product.status = 'draft';
  assert.equal(matches(product, publicProductEligibility()), false);

  const ip = { status: 'active', isPublic: true };
  assert.equal(matches(ip, publicIpEligibility()), true);
  ip.isPublic = false;
  assert.equal(matches(ip, publicIpEligibility()), false);
});

test('helper calls return independent filters', () => {
  publicProductEligibility().status.$in.push('draft');
  assert.deepEqual(publicProductEligibility().status.$in, ['live', 'active']);
});

const details = [
  ['app/api/ip/[id]/route.js', true],
  ['app/api/products/[id]/route.js', false],
  ['app/api/metawork/products/[id]/route.js', false],
];

for (const [path, isIp] of details) {
  const record = {
    ...published,
    ...(isIp ? { status: 'active', tags: [] } : {}),
  };

  test(`${path}: anonymous published access`, async () => {
    const { response } = await invoke(path, {
      product: record,
      inventory: [],
    });
    assert.equal(response.status, 200);
  });

  test(`${path}: ineligible records denied before related/external reads`, async () => {
    for (const override of [
      { isPublic: false },
      { status: 'draft' },
      { status: 'pending_nft_mint' },
    ]) {
      const result = await invoke(path, {
        product: { ...record, ...override },
        inventory: [],
      });
      assert.equal(result.response.status, 404);
      assert.equal(result.relatedReads, 0);
      assert.equal(result.fetchCalls, 0);
    }
  });

  test(`${path}: owner bearer and cookie access`, async () => {
    for (const auth of [
      { bearer: 'owner-token' },
      { cookie: 'owner-token' },
    ]) {
      const { response } = await invoke(path, {
        product: { ...record, isPublic: false, status: 'draft' },
        inventory: [],
        ...auth,
      });
      assert.equal(response.status, 200);
    }
  });

  test(`${path}: other and invalid users denied`, async () => {
    for (const bearer of ['other-token', 'invalid-token']) {
      const { response } = await invoke(path, {
        product: { ...record, isPublic: false },
        bearer,
      });
      assert.equal(response.status, 404);
    }
  });
}

for (const path of [
  'app/api/ip/[id]/route.js',
  'app/api/products/[id]/route.js',
]) {
  test(`${path}: related query includes public eligibility`, async () => {
    const { response, queries } = await invoke(path, {
      product: { ...published, status: 'active', tags: [] },
      inventory: [],
    });
    assert.equal(response.status, 200);
    for (const [field, condition] of Object.entries(publicProductEligibility())) {
      assert.deepEqual(queries.find[field], condition);
    }
  });
}

const lists = [
  'app/api/products/route.js',
  'app/api/metawork/products/route.js',
];

const inventory = [
  { ...published, id: 'own-public' },
  { ...published, id: 'own-draft', status: 'draft' },
  { ...published, id: 'other-public', userId: 'other-1', ownerId: 'other-1' },
  { ...published, id: 'other-draft', userId: 'other-1',
    ownerId: 'other-1', status: 'draft' },
];

for (const path of lists) {
  const isMeta = path.includes('/metawork/');
  const ownerParams = isMeta
    ? ''
    : 'creator=owner-1&includeDrafts=true';

  test(`${path}: anonymous cannot request drafts`, async () => {
    const { response, queries } = await invoke(path, {
      inventory,
      params: 'creator=owner-1&includeDrafts=true&status=draft',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.products, []);
    assert.deepEqual(queries.find, queries.count);
  });

  test(`${path}: owner cookie retains draft access without others' drafts`, async () => {
    const { response, queries } = await invoke(path, {
      inventory,
      params: ownerParams,
      cookie: 'owner-token',
    });
    const ids = response.body.products.map(p => p.id);
    assert.ok(ids.includes('own-draft'));
    assert.ok(!ids.includes('other-draft'));
    assert.deepEqual(queries.find, queries.count);
  });

  test(`${path}: invalid authentication is public-only`, async () => {
    const { response } = await invoke(path, {
      inventory,
      params: ownerParams,
      bearer: 'invalid-token',
    });
    assert.ok(response.body.products.every(p => p.status !== 'draft'));
  });

  test(`${path}: public pagination counts eligible records only`, async () => {
    const { response, queries } = await invoke(path, {
      inventory,
      params: 'public=true&page=2&limit=1',
    });
    assert.deepEqual(response.body.products.map(p => p.id), ['other-public']);
    const pagination = response.body.pagination;
    assert.equal(pagination.totalCount ?? pagination.total, 2);
    assert.deepEqual(queries.find, queries.count);
  });
}

test('aisle/showroom sources retain eligibility helper wiring', () => {
  const aisle = read('app/api/aisle/[username]/route.js');
  assert.match(aisle, /productOwnerQuery,\s*publicProductEligibility\(\)/);
  assert.match(aisle, /ipOwnerQuery,\s*publicIpEligibility\(\)/);

  const showroom = read('app/api/showroom/route.js');
  assert.match(showroom, /\.find\(showroomProductEligibility\(\)\)/);
  assert.match(showroom, /\.find\(publicIpEligibility\(\)\)/);

  const products = read('app/api/showroom/products/route.js');
  assert.equal(
    (products.match(/\.\.\.showroomProductEligibility\(\)/g) || []).length,
    2,
  );
});
