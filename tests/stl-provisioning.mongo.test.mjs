import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ipUploadOperationIdentity, IP_UPLOAD_OPERATIONS_COLLECTION } from '../lib/ip-upload-operations.js';
import { provisionStlProducts } from '../lib/ip-source/provision-stl-products.js';
import { publicProductEligibility } from '../lib/public-inventory-eligibility.js';

let server, client, db;
const ownerId = 'provisioning-owner';
const operationKey = 'abcdef12-abcd-4123-8123-abcdef123456';
const identity = ipUploadOperationIdentity({ ownerId, operationKey });
const fixed = new Date('2026-11-25T17:00:00Z');
const now = () => fixed;
const run = () => provisionStlProducts({ client, db, ipAssetId: 'asset-1', now });
const kinds = async () => (await db.collection('products').find({}).toArray()).map(p => p.productKind).sort();

before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = await new MongoClient(server.getUri(), { serverSelectionTimeoutMS: 5000 }).connect();
  db = client.db('stl_provisioning');
  await db.createCollection(IP_UPLOAD_OPERATIONS_COLLECTION);
  await db.createCollection('ip_assets');
  await db.createCollection('products');
  await db.createCollection('users');
});
after(async () => { try { await client?.close(); } finally { await server?.stop(); } });

beforeEach(async () => {
  for (const name of [IP_UPLOAD_OPERATIONS_COLLECTION, 'ip_assets', 'products', 'users']) {
    await db.collection(name).deleteMany({});
  }
  await db.collection('products').dropIndexes().catch(() => {});
  await db.collection('users').insertOne({ id: ownerId, credits: 100 });
  await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).insertOne({
    _id: identity.id, schemaVersion: 1, ownerId, operationKey, status: 'confirmed',
    sourceDeclaration: { format: 'stl', filename: 'part.stl', byteLength: 10 },
  });
  await db.collection('ip_assets').insertOne({
    id: 'asset-1', ownerId, tokenizationOperationKey: operationKey,
    uploadPreparationId: identity.id, name: 'Dragon', description: 'A dragon',
    status: 'active', creditStatus: 'consumed',
  });
});

test('provisioning: valid STL creates exactly one STL File and one 3D Print', async () => {
  const result = await run();
  assert.equal(result.state, 'ok');
  assert.deepEqual(await kinds(), ['3d_print', 'stl_file']);
  const operation = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).findOne({ _id: identity.id });
  assert.equal(operation.provisioning.stl_file.phase, 'created');
  assert.equal(operation.provisioning['3d_print'].phase, 'created');
});

test('provisioning: 16 concurrent runs create each kind exactly once', async () => {
  await Promise.all(Array.from({ length: 16 }, run));
  assert.deepEqual(await kinds(), ['3d_print', 'stl_file']);
});

test('provisioning: credits and users are never touched', async () => {
  await run();
  await run();
  const user = await db.collection('users').findOne({ id: ownerId });
  assert.equal(user.credits, 100);
});

test('provisioning: debit-then-crash states create nothing until consumed', async () => {
  for (const creditStatus of ['pending', 'charging', 'charge_recovery_required']) {
    await db.collection('ip_assets').updateOne({ id: 'asset-1' }, { $set: { creditStatus } });
    assert.equal((await run()).state, 'not_ready');
    assert.equal(await db.collection('products').countDocuments({}), 0);
  }
  await db.collection('ip_assets').updateOne({ id: 'asset-1' }, { $set: { creditStatus: 'consumed' } });
  assert.equal((await run()).state, 'ok');
  assert.deepEqual(await kinds(), ['3d_print', 'stl_file']);
});

test('provisioning: interrupted insert aborts its slot and retry creates only the missing kind', async () => {
  await db.collection('products').createIndex({ externalProductId: 1 }, { unique: true });
  await db.collection('products').insertOne({ externalProductId: 'stl:' + operationKey + ':3d_print', productKind: 'blocker' });

  const first = await run();
  assert.equal(first.state, 'partial');
  assert.equal(first.results.stl_file, 'created');
  assert.equal(first.results['3d_print'], 'error');
  const afterFailure = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).findOne({ _id: identity.id });
  assert.equal(afterFailure.provisioning['3d_print'], undefined);

  await db.collection('products').deleteOne({ productKind: 'blocker' });
  const second = await run();
  assert.deepEqual(second.results, { stl_file: 'exists', '3d_print': 'created' });
  assert.deepEqual(await kinds(), ['3d_print', 'stl_file']);
});

test('provisioning: deleted product is never resurrected', async () => {
  await run();
  await db.collection('products').deleteOne({ productKind: 'stl_file' });
  const again = await run();
  assert.deepEqual(again.results, { stl_file: 'exists', '3d_print': 'exists' });
  assert.deepEqual(await kinds(), ['3d_print']);
});

test('provisioning: non-STL source creates nothing', async () => {
  await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).updateOne(
    { _id: identity.id },
    { $set: { sourceDeclaration: { format: 'png', filename: 'a.png', byteLength: 10 } } },
  );
  assert.equal((await run()).state, 'not_stl');
  assert.equal(await db.collection('products').countDocuments({}), 0);
});

test('provisioning: public inventory query never returns the 3D Print, even if published by mistake', async () => {
  await run();
  await db.collection('products').updateMany({}, { $set: { isPublic: true, status: 'active', isVisible: true } });
  const visible = await db.collection('products').find(publicProductEligibility()).toArray();
  assert.deepEqual(visible.map(p => p.productKind), ['stl_file']);
});
