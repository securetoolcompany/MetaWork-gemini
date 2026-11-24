import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, after, beforeEach, test } from 'node:test';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { canonicalIpDraft } from '../lib/ip-upload-draft.js';
import { ipUploadOperationIdentity, IP_UPLOAD_OPERATIONS_COLLECTION } from '../lib/ip-upload-operations.js';
import {
  acquireIpTokenizationPreparation as acquire,
  startIpTokenizationMetadata as start,
  recordIpTokenizationMetadata as record,
  persistIpTokenizationPreparation as finish,
} from '../lib/ip-source/tokenization-reservation.js';

let server, client, db;
const ownerId = 'reservation-owner';
const operationKey = 'abcdef12-abcd-4123-8123-abcdef123456';
const sourceUpload = { revision: 'r1', authorizationId: 'a1', providerFileId: 'p1' };
const draft = { name: 'Bound draft' };
const source = { format: 'png', filename: 'fixture.png', byteLength: 10 };
const cid = 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m';
const metadata = { name: 'Bound draft', image: `ipfs://${cid}`, created_at: 'fixed' };
const meta = { ipfsUrl: `ipfs://${'b'.repeat(59)}` };
const identity = ipUploadOperationIdentity({ ownerId, operationKey });
const fixed = new Date('2026-11-18T17:00:00Z');
const later = new Date(fixed.getTime() + 61_000);
const now = () => fixed;
const args = () => ({ db, ownerId, operationKey, sourceUpload, draft, expectedCid: cid, now });

before(async () => {
  server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  client = await new MongoClient(server.getUri(), { serverSelectionTimeoutMS: 5000 }).connect();
  db = client.db('ip_preparation_reservation');
  await db.createCollection(IP_UPLOAD_OPERATIONS_COLLECTION);
  await db.createCollection('ip_assets');
});
after(async () => { try { await client?.close(); } finally { await server?.stop(); } });
beforeEach(async () => {
  await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).deleteMany({});
  await db.collection('ip_assets').deleteMany({});
  const inputHash = createHash('sha256').update(JSON.stringify({ draft: canonicalIpDraft(draft), source })).digest('hex');
  await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).insertOne({
    _id: identity.id, schemaVersion: 1, ownerId, operationKey,
    revision: 'r1', inputHash, status: 'confirmed', sourceDeclaration: source,
    authorizations: { source: {
      authorizationId: 'a1', operationRevision: 'r1', status: 'associated',
      associatedProviderFileId: 'p1', maxBytes: 100,
    } },
    receipts: { source: {
      authorizationId: 'a1', operationRevision: 'r1', providerFileId: 'p1', cid,
      sourceValidationStatus: 'valid', sourceValidation: {
        schemaVersion: 1, revision: 'r1', inputHash, authorizationId: 'a1',
        providerFileId: 'p1', cid, sourceDeclaration: source,
        result: { validation: { status: 'valid' } },
      },
    } },
  });
});
async function recorded() {
  const acquired = await acquire(args());
  const request = await start({ db, reservation: acquired.reservation, metadata, now });
  const reservation = await record({ db, reservation: acquired.reservation, metadata: meta, now });
  return { reservation, asset: {
    metadataUrl: meta.ipfsUrl, metadataHash: request.metadataHash,
    preparedNftTransaction: 'transaction-a', mbrMicroAlgos: 250000,
    status: 'pending_nft_mint', creditStatus: 'pending', creditCost: 25,
  } };
}

test('reservation: exactly one concurrent acquisition wins', async () => {
  const results = await Promise.all(Array.from({ length: 16 }, () => acquire(args())));
  assert.equal(results.filter(r => r.state === 'acquired').length, 1);
  assert.equal(results.filter(r => r.state === 'in_progress').length, 15);
});
test('reservation: crash after acquisition permits fenced lease recovery', async () => {
  const first = await acquire(args());
  const second = await acquire({ ...args(), now: () => later });
  assert.equal(second.state, 'acquired');
  assert.equal(second.reservation.ipAssetId, first.reservation.ipAssetId);
  assert.notEqual(second.reservation.token, first.reservation.token);
  await assert.rejects(start({ db, reservation: first.reservation, metadata, now: () => later }));
});
test('reservation: expired worker cannot start metadata without reclaiming', async () => {
  const first = await acquire(args());
  await assert.rejects(start({ db, reservation: first.reservation, metadata, now: () => later }));
});
test('reservation: start marker survives interruption before provider invocation', async () => {
  const first = await acquire(args());
  const request = await start({ db, reservation: first.reservation, metadata, now });
  const retry = await acquire({ ...args(), now: () => later });
  assert.equal(retry.state, 'recovery_required');
  assert.deepEqual(retry.request, request);
  await assert.rejects(start({ db, reservation: first.reservation, metadata, now }));
});
test('reservation: concurrent metadata recorders have one fenced winner', async () => {
  const first = await acquire(args());
  await start({ db, reservation: first.reservation, metadata, now });
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => record({ db, reservation: first.reservation, metadata: meta, now })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('reservation: crash after metadata recording resumes without new metadata', async () => {
  const state = await recorded();
  assert.equal((await acquire(args())).state, 'in_progress');
  const retry = await acquire({ ...args(), now: () => later });
  assert.equal(retry.state, 'acquired');
  assert.equal(retry.metadata.ipfsUrl, meta.ipfsUrl);
  await assert.rejects(finish({ client, db, ...state, now: () => later }));
  const asset = await finish({ client, db, reservation: retry.reservation, asset: state.asset, now: () => later });
  assert.ok(asset._id instanceof ObjectId);
});
test('reservation: concurrent transaction finalizers return the stored winner', async () => {
  const state = await recorded();
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => finish({
    client, db, ...state, asset: { ...state.asset, preparedNftTransaction: `txn-${i}` }, now,
  })));
  assert.equal(await db.collection('ip_assets').countDocuments({}), 1);
  assert.equal(new Set(results.map(a => a.preparedNftTransaction)).size, 1);
});
test('reservation: failure inside transaction after asset insert aborts both writes', async () => {
  const state = await recorded();
  await assert.rejects(finish({ client, db, ...state, now, afterInsert() { throw new Error('interrupted'); } }));
  assert.equal(await db.collection('ip_assets').countDocuments({}), 0);
  const operation = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).findOne({ _id: identity.id });
  assert.equal(operation.tokenizationPreparation.phase, 'metadata_recorded');
  await finish({ client, db, ...state, now });
  assert.equal((await acquire(args())).state, 'prepared');
});
test('reservation: lost response after commit returns the persisted result on retry', async () => {
  const state = await recorded();
  await assert.rejects(finish({ client, db, ...state, now, afterCommit() { throw new Error('response lost'); } }));
  const result = await acquire(args());
  assert.equal(result.state, 'prepared');
  assert.equal(result.asset.preparedNftTransaction, 'transaction-a');
  assert.equal(await db.collection('ip_assets').countDocuments({}), 1);
});
test('reservation: deleted materialized asset is never resurrected', async () => {
  const state = await recorded();
  const asset = await finish({ client, db, ...state, now });
  await db.collection('ip_assets').deleteOne({ _id: asset._id });
  await assert.rejects(acquire(args()), e => e.code === 'IP_PREPARATION_ASSET_MISSING');
  assert.equal(await db.collection('ip_assets').countDocuments({}), 0);
});
test('reservation: duplicate asset key cannot select an unrelated winner', async () => {
  const state = await recorded();
  await db.collection('ip_assets').insertOne({ _id: new ObjectId(state.reservation.ipAssetId), id: 'unrelated' });
  await assert.rejects(finish({ client, db, ...state, now }), e => e.code === 'IP_PREPARATION_ASSET_COLLISION');
  const operation = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).findOne({ _id: identity.id });
  assert.equal(operation.tokenizationPreparation.phase, 'metadata_recorded');
});
test('reservation: lifecycle and shared credit updates survive repeat preparation', async () => {
  const state = await recorded();
  const asset = await finish({ client, db, ...state, now });
  await db.collection('ip_assets').updateOne({ _id: asset._id }, { $set: {
    status: 'active', creditStatus: 'consumed', creditChargedAt: fixed, revenueTokenAssetId: 123,
  } });
  const retry = await acquire(args());
  assert.equal(retry.asset.status, 'active');
  assert.equal(retry.asset.creditStatus, 'consumed');
  assert.equal(retry.asset.revenueTokenAssetId, 123);
});
test('reservation: pre-existing unreserved asset requires review', async () => {
  await db.collection('ip_assets').insertOne({ ownerId, tokenizationOperationKey: operationKey });
  await assert.rejects(acquire(args()), e => e.code === 'IP_PREPARATION_EXISTING_ASSET_REVIEW_REQUIRED');
});
for (const field of ['revision', 'inputHash', 'sourceDeclaration.filename', 'receipts.source.cid', 'authorizations.source.maxBytes']) {
  test(`reservation: changed ${field} after metadata start fences the worker`, async () => {
    const first = await acquire(args());
    await start({ db, reservation: first.reservation, metadata, now });
    await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).updateOne({ _id: identity.id }, { $set: { [field]: 'changed' } });
    await assert.rejects(record({ db, reservation: first.reservation, metadata: meta, now }));
    await assert.rejects(acquire(args()));
    assert.equal(await db.collection('ip_assets').countDocuments({}), 0);
  });
}

test('reservation: source mutation after metadata record prevents transactional materialization', async () => {
  const state = await recorded();
  await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).updateOne({ _id: identity.id }, { $set: { revision: 'changed' } });
  await assert.rejects(finish({ client, db, ...state, now }));
  assert.equal(await db.collection('ip_assets').countDocuments({}), 0);
});
test('reservation: metadata returned but not recorded remains lookup-only', async () => {
  const first = await acquire(args());
  await start({ db, reservation: first.reservation, metadata, now });
  const providerResult = meta;
  assert.ok(providerResult.ipfsUrl);
  // The simulated process stops before calling record; the next process sees
  // only the durable start marker, not the in-memory provider response.
  const next = await acquire({ ...args(), now: () => later });
  assert.equal(next.state, 'recovery_required');
  assert.equal(await db.collection('ip_assets').countDocuments({}), 0);
});
