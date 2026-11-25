import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionStlProducts, stlProvisioningKey } from '../lib/ip-source/provision-stl-products.js';
import { isPubliclyEligible } from '../lib/public-inventory-eligibility.js';

const OWNER = 'owner-1';
const OP_KEY = '11111111-2222-3333-4444-555555555555';
const OP_ID = 'ip-upload:v1:test';

const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
function setPath(o, p, v) {
  const ks = p.split('.');
  let c = o;
  for (const k of ks.slice(0, -1)) { c[k] ??= {}; c = c[k]; }
  c[ks.at(-1)] = v;
}
function delPath(o, p) {
  const ks = p.split('.');
  const parent = getPath(o, ks.slice(0, -1).join('.')) ?? o;
  delete parent[ks.at(-1)];
}
function matches(doc, filter) {
  return Object.entries(filter).every(([k, v]) => {
    const actual = getPath(doc, k);
    if (v && typeof v === 'object' && '$exists' in v) return (actual !== undefined) === v.$exists;
    return actual === v;
  });
}

function makeWorld({ format = 'stl', status = 'active', creditStatus = 'consumed', failInsert = {} } = {}) {
  const data = {
    ip_assets: [{
      id: 'asset-1', ownerId: OWNER, tokenizationOperationKey: OP_KEY,
      uploadPreparationId: OP_ID, name: 'Dragon', description: 'A dragon', status, creditStatus,
    }],
    ip_upload_operations: [{
      _id: OP_ID, ownerId: OWNER, operationKey: OP_KEY,
      sourceDeclaration: { format, filename: 'dragon.' + format, byteLength: 10 },
    }],
    products: [],
  };
  const failures = { ...failInsert };
  const touched = new Set();

  const db = {
    collection(name) {
      const docs = data[name];
      if (!docs) throw new Error('Unexpected collection: ' + name);
      touched.add(name);
      return {
        async findOne(filter) { return docs.find(d => matches(d, filter)) ?? null; },
        async updateOne(filter, update, opts = {}) {
          const doc = docs.find(d => matches(d, filter));
          if (!doc) return { matchedCount: 0 };
          for (const [path, value] of Object.entries(update.$set)) {
            const prev = getPath(doc, path);
            opts.session?.undo.push(() => (prev === undefined ? delPath(doc, path) : setPath(doc, path, prev)));
            setPath(doc, path, value);
          }
          return { matchedCount: 1 };
        },
        async insertOne(doc, opts = {}) {
          if (failures[doc.productKind] > 0) {
            failures[doc.productKind] -= 1;
            throw new Error('simulated insert failure');
          }
          docs.push(doc);
          opts.session?.undo.push(() => docs.splice(docs.indexOf(doc), 1));
          return { insertedId: doc._id };
        },
      };
    },
  };

  const client = {
    startSession() {
      return {
        undo: [],
        async withTransaction(fn) {
          this.undo = [];
          try { await fn(); } catch (error) {
            for (const undo of this.undo.reverse()) undo();
            throw error;
          }
        },
        async endSession() {},
      };
    },
  };

  return { data, db, client, touched };
}

const run = world => provisionStlProducts({ client: world.client, db: world.db, ipAssetId: 'asset-1' });
const kindsOf = world => world.data.products.map(p => p.productKind).sort();

test('valid STL creates one STL File and one 3D Print, unlisted', async () => {
  const world = makeWorld();
  const result = await run(world);
  assert.equal(result.state, 'ok');
  assert.deepEqual(kindsOf(world), ['3d_print', 'stl_file']);
  for (const product of world.data.products) {
    assert.equal(product.isPublic, false);
    assert.equal(product.status, 'unlisted');
    assert.equal(product.isVisible, false);
    assert.equal(product.provisioningKey, stlProvisioningKey(OP_KEY, product.productKind));
    assert.equal(isPubliclyEligible(product), false);
  }
});

test('STL File states no protection; 3D Print is offline and never eligible', async () => {
  const world = makeWorld();
  await run(world);
  const stl = world.data.products.find(p => p.productKind === 'stl_file');
  const print = world.data.products.find(p => p.productKind === '3d_print');
  assert.equal(stl.delivery.fileProtection, 'none');
  assert.equal(print.fulfillment.status, 'offline');
  assert.equal(isPubliclyEligible({ ...print, isPublic: true, status: 'active' }), false);
});

test('provisions only for active and consumed (debit-then-crash window)', async () => {
  for (const creditStatus of ['pending', 'charging', 'charge_recovery_required']) {
    const world = makeWorld({ creditStatus });
    const result = await run(world);
    assert.equal(result.state, 'not_ready');
    assert.equal(world.data.products.length, 0);
  }
  const stuck = makeWorld({ creditStatus: 'charging' });
  await run(stuck);
  stuck.data.ip_assets[0].creditStatus = 'consumed';
  await run(stuck);
  assert.deepEqual(kindsOf(stuck), ['3d_print', 'stl_file']);
});

test('non-active asset and non-STL source create nothing', async () => {
  const inactive = makeWorld({ status: 'pending_nft_mint' });
  assert.equal((await run(inactive)).state, 'not_ready');
  const image = makeWorld({ format: 'png' });
  assert.equal((await run(image)).state, 'not_stl');
  assert.equal(inactive.data.products.length + image.data.products.length, 0);
});

test('failed validation path: asset never consumed means no products', async () => {
  const world = makeWorld({ status: 'pending_nft_mint', creditStatus: 'pending' });
  await run(world);
  assert.equal(world.data.products.length, 0);
});

test('retry after full success creates nothing new', async () => {
  const world = makeWorld();
  await run(world);
  const second = await run(world);
  assert.deepEqual(second.results, { stl_file: 'exists', '3d_print': 'exists' });
  assert.equal(world.data.products.length, 2);
});

test('interrupted retry creates only the missing kind and rolls back its slot', async () => {
  const world = makeWorld({ failInsert: { '3d_print': 1 } });
  const first = await run(world);
  assert.equal(first.state, 'partial');
  assert.deepEqual(kindsOf(world), ['stl_file']);
  assert.equal(world.data.ip_upload_operations[0].provisioning['3d_print'], undefined);

  const second = await run(world);
  assert.equal(second.state, 'ok');
  assert.deepEqual(second.results, { stl_file: 'exists', '3d_print': 'created' });
  assert.deepEqual(kindsOf(world), ['3d_print', 'stl_file']);
});

test('concurrent retries create each kind exactly once', async () => {
  const world = makeWorld();
  await Promise.all([run(world), run(world), run(world)]);
  assert.deepEqual(kindsOf(world), ['3d_print', 'stl_file']);
});

test('delete-then-retry never resurrects a deleted product', async () => {
  const world = makeWorld();
  await run(world);
  world.data.products.splice(world.data.products.findIndex(p => p.productKind === 'stl_file'), 1);
  const again = await run(world);
  assert.deepEqual(again.results, { stl_file: 'exists', '3d_print': 'exists' });
  assert.deepEqual(kindsOf(world), ['3d_print']);
});

test('provisioning never touches users, credits or any other collection', async () => {
  const world = makeWorld();
  await run(world);
  assert.deepEqual([...world.touched].sort(), ['ip_assets', 'ip_upload_operations', 'products']);
});
