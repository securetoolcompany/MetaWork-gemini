import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  ipUploadOperationIdentity,
  IpUploadOperationConflict,
  IP_UPLOAD_OPERATIONS_COLLECTION,
} from '../lib/ip-upload-operations.js';
import { validateIpUploadSource } from '../lib/ip-source/validate-upload.js';

let server;
let client;
let db;

before(async () => {
  server = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1' },
  });
  client = new MongoClient(server.getUri(), {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  db = client.db('ip_validation_integration');
});

after(async () => {
  try {
    await client?.close();
  } finally {
    await server?.stop();
  }
});

const bytes = Buffer.from([
  'solid fixture',
  'facet normal 0 0 1',
  'outer loop',
  'vertex 0 0 0',
  'vertex 1 0 0',
  'vertex 0 1 0',
  'endloop',
  'endfacet',
  'endsolid fixture',
  '',
].join('\n'));

const input = {
  ownerId: 'mongo-test-owner',
  operationKey: 'abcdef12-abcd-4123-8123-abcdef123456',
  revision: 'revision-1',
  authorizationId: 'authorization-1',
  providerFileId: 'file-1',
};

async function seed() {
  const identity = ipUploadOperationIdentity(input);
  const collection = db.collection(IP_UPLOAD_OPERATIONS_COLLECTION);
  await collection.deleteMany({});

  await collection.insertOne({
    _id: identity.id,
    schemaVersion: 1,
    ownerId: input.ownerId,
    operationKey: identity.operationKey,
    revision: input.revision,
    inputHash: 'ab'.repeat(32),
    status: 'confirmed',
    sourceDeclaration: {
      format: 'stl',
      filename: 'fixture.stl',
      byteLength: bytes.length,
    },
    authorizations: {
      source: {
        authorizationId: input.authorizationId,
        operationRevision: input.revision,
        purpose: 'source',
        network: 'public',
        status: 'associated',
        maxBytes: 104857600,
        associatedProviderFileId: input.providerFileId,
      },
    },
    receipts: {
      source: {
        authorizationId: input.authorizationId,
        providerFileId: input.providerFileId,
        operationRevision: input.revision,
        purpose: 'source',
        network: 'public',
        provider: 'pinata',
        verificationMethod: 'pinata_authenticated_file_lookup',
        providerNumberOfFiles: 1,
        providerSize: bytes.length,
        cid: 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m',
        sourceValidationStatus: 'pending',
      },
    },
  });

  return { collection, id: identity.id };
}

function run(readBytes) {
  return validateIpUploadSource({
    ...input,
    db,
    readBytes,
    now: () => new Date('2026-11-12T18:00:00Z'),
  });
}

test('MongoDB: equivalent concurrent validations produce one winner', async () => {
  const { collection, id } = await seed();
  let arrived = 0;
  let release;
  const barrier = new Promise(resolve => { release = resolve; });

  async function readBytes() {
    arrived++;
    if (arrived === 2) release();
    await barrier;
    return Buffer.from(bytes);
  }

  const results = await Promise.all([
    run(readBytes),
    run(readBytes),
  ]);

  assert.deepEqual(
    results.map(result => result.resumed).sort(),
    [false, true],
  );

  const stored = await collection.findOne({ _id: id });
  assert.equal(stored.receipts.source.sourceValidationStatus, 'valid');
  assert.equal(stored.receipts.source.sourceValidation.revision, input.revision);
});

test('MongoDB: revision changed during retrieval blocks validation write', async () => {
  const { collection, id } = await seed();

  await assert.rejects(
    run(async () => {
      await collection.updateOne(
        { _id: id },
        { $set: { revision: 'revision-2' } },
      );
      return Buffer.from(bytes);
    }),
    IpUploadOperationConflict,
  );

  const stored = await collection.findOne({ _id: id });
  assert.equal(stored.revision, 'revision-2');
  assert.equal(stored.receipts.source.sourceValidationStatus, 'pending');
  assert.equal(
    Object.hasOwn(stored.receipts.source, 'sourceValidation'),
    false,
  );
});

test('MongoDB: changed bindings cannot receive a validation write', async (t) => {
  const changes = [
    ['inputHash', 'cd'.repeat(32)],
    ['status', 'superseded'],
    ['sourceDeclaration.filename', 'replacement.stl'],
    ['authorizations.source.authorizationId', 'authorization-2'],
    ['receipts.source.providerFileId', 'file-2'],
    ['receipts.source.cid', 'b'.repeat(59)],
    ['receipts.source.sourceValidationStatus', 'stale'],
  ];

  for (const [path, value] of changes) {
    await t.test(path, async () => {
      const { collection, id } = await seed();

      await assert.rejects(
        run(async () => {
          await collection.updateOne(
            { _id: id },
            { $set: { [path]: value } },
          );
          return Buffer.from(bytes);
        }),
        IpUploadOperationConflict,
      );

      const stored = await collection.findOne({ _id: id });
      assert.notEqual(stored.receipts.source.sourceValidationStatus, 'valid');
      assert.equal(
        Object.hasOwn(stored.receipts.source, 'sourceValidation'),
        false,
      );
    });
  }
});

test('MongoDB: reduced authorization limit blocks validation persistence', async () => {
  const { collection, id } = await seed();

  await assert.rejects(
    run(async () => {
      const update = await collection.updateOne(
        { _id: id },
        {
          $set: {
            'authorizations.source.maxBytes': bytes.length - 1,
          },
        },
      );
      assert.equal(update.matchedCount, 1);
      return Buffer.from(bytes);
    }),
    IpUploadOperationConflict,
  );

  const stored = await collection.findOne({ _id: id });
  assert.equal(
    stored.authorizations.source.maxBytes,
    bytes.length - 1,
  );
  assert.equal(stored.receipts.source.sourceValidationStatus, 'pending');
  assert.equal(
    Object.hasOwn(stored.receipts.source, 'sourceValidation'),
    false,
  );
});
