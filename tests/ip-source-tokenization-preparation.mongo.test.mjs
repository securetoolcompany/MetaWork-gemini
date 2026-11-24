import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, after, test } from 'node:test';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { canonicalIpDraft } from '../lib/ip-upload-draft.js';
import {
  ipUploadOperationIdentity,
  IP_UPLOAD_OPERATIONS_COLLECTION,
  IpUploadOperationConflict,
} from '../lib/ip-upload-operations.js';
import {
  prepareValidatedIpTokenization,
} from '../lib/ip-source/prepare-tokenization.js';

let server;
let client;
let db;
const originalFetch = globalThis.fetch;

before(async () => {
  server = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1' },
  });
  client = new MongoClient(server.getUri(), {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  db = client.db('ip_tokenization_preparation_test');
});

after(async () => {
  globalThis.fetch = originalFetch;
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

const cid = 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m';
const ownerId = 'preparation-owner';
const operationKey = 'abcdef12-abcd-4123-8123-abcdef123456';
const sourceUpload = {
  revision: 'revision-1',
  authorizationId: 'authorization-1',
  providerFileId: 'file-1',
};
const draft = {
  name: 'STL fixture',
  description: 'Synthetic test source',
  walletAddress: 'fixture-wallet',
  category: '3D Model',
  isPublic: true,
  licensable: true,
  licensingFeeCents: 250,
  licenseFeeUsd: 2.5,
  stakeholders: [{ address: 'fixture-wallet', percentage: '100' }],
};
const source = {
  format: 'stl',
  filename: 'fixture.stl',
  byteLength: bytes.length,
};

async function seed() {
  const identity = ipUploadOperationIdentity({ ownerId, operationKey });
  const collection = db.collection(IP_UPLOAD_OPERATIONS_COLLECTION);
  await collection.deleteMany({});

  await collection.insertOne({
    _id: identity.id,
    schemaVersion: 1,
    ownerId,
    operationKey,
    revision: sourceUpload.revision,
    inputHash: createHash('sha256')
      .update(JSON.stringify({
        draft: canonicalIpDraft(draft),
        source,
      }))
      .digest('hex'),
    status: 'confirmed',
    sourceDeclaration: source,
    authorizations: {
      source: {
        authorizationId: sourceUpload.authorizationId,
        operationRevision: sourceUpload.revision,
        purpose: 'source',
        network: 'public',
        status: 'associated',
        associatedProviderFileId: sourceUpload.providerFileId,
        maxBytes: 104857600,
      },
    },
    receipts: {
      source: {
        authorizationId: sourceUpload.authorizationId,
        operationRevision: sourceUpload.revision,
        providerFileId: sourceUpload.providerFileId,
        purpose: 'source',
        network: 'public',
        provider: 'pinata',
        verificationMethod: 'pinata_authenticated_file_lookup',
        providerNumberOfFiles: 1,
        providerSize: bytes.length,
        cid,
        sourceValidationStatus: 'pending',
      },
    },
  });

  return {
    collection,
    load: () => collection.findOne({ _id: identity.id }),
  };
}

function prepare(overrides = {}) {
  return prepareValidatedIpTokenization({
    db,
    ownerId,
    operationKey,
    sourceUpload,
    draft,
    ...overrides,
  });
}

async function withFetch(fetchImpl, work) {
  globalThis.fetch = fetchImpl;
  try {
    return await work();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function sourceResponse(url, init) {
  assert.equal(url, `https://gateway.pinata.cloud/ipfs/${cid}`);
  assert.equal(new Headers(init.headers).has('authorization'), false);
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Length': String(bytes.length) },
  });
}

test('preparation validates stored source and derives tokenization CID', async () => {
  const state = await seed();
  await withFetch(sourceResponse, async () => {
    const result = await prepare();

    assert.deepEqual(result, {
      ...canonicalIpDraft(draft),
      operationKey,
      image: cid,
    });

    const stored = await state.load();
    assert.equal(stored.receipts.source.sourceValidationStatus, 'valid');
    assert.equal(
      stored.receipts.source.sourceValidation.result.sourceHash.hex,
      createHash('sha256').update(bytes).digest('hex'),
    );
  });
});

test('changed tokenization draft fails before source retrieval', async () => {
  const state = await seed();
  let fetches = 0;

  await withFetch(() => {
    fetches++;
    throw new Error('Unexpected network access');
  }, async () => {
    await assert.rejects(
      prepare({ draft: { ...draft, name: 'Replacement draft' } }),
      IpUploadOperationConflict,
    );
    assert.equal(fetches, 0);
    assert.equal(
      (await state.load()).receipts.source.sourceValidationStatus,
      'pending',
    );
  });
});

test('wrong owner fails before source retrieval', async () => {
  await seed();
  let fetches = 0;

  await withFetch(() => {
    fetches++;
    throw new Error('Unexpected network access');
  }, async () => {
    await assert.rejects(
      prepare({ ownerId: 'different-owner' }),
      IpUploadOperationConflict,
    );
    assert.equal(fetches, 0);
  });
});

test('retrieval failure preserves operation and preparation can retry', async () => {
  const state = await seed();
  const before = await state.load();

  await withFetch(() => {
    throw new Error('Private provider diagnostic');
  }, async () => {
    await assert.rejects(prepare(), error => {
      assert.equal(error.code, 'SOURCE_READ_FAILED');
      assert.equal(error.message.includes('Private provider diagnostic'), false);
      return true;
    });
  });

  assert.deepEqual(await state.load(), before);

  await withFetch(sourceResponse, async () => {
    const result = await prepare();
    assert.equal(result.image, cid);
    assert.equal(
      (await state.load()).receipts.source.sourceValidationStatus,
      'valid',
    );
  });
});

test('preparation rejects a source changed between its two operation loads', async () => {
  const state = await seed();
  let loads = 0;
  let fetches = 0;
  const replacementCid = 'b'.repeat(59);

  const racingDb = {
    collection(name) {
      const collection = db.collection(name);
      return {
        async findOne(...args) {
          loads++;

          if (loads === 2) {
            await collection.updateOne(
              { ownerId, operationKey },
              { $set: { 'receipts.source.cid': replacementCid } },
            );
          }

          return collection.findOne(...args);
        },
        updateOne(...args) {
          return collection.updateOne(...args);
        },
      };
    },
  };

  await withFetch((url, init) => {
    fetches++;
    return new Response(Buffer.from(bytes), {
      headers: { 'Content-Length': String(bytes.length) },
    });
  }, async () => {
    await assert.rejects(
      prepare({ db: racingDb }),
      IpUploadOperationConflict,
    );
  });

  assert.equal(loads, 2);
  assert.equal(fetches, 0);

  const stored = await state.load();
  assert.equal(stored.receipts.source.cid, replacementCid);
  assert.equal(stored.receipts.source.sourceValidationStatus, 'pending');
  assert.equal(
    Object.hasOwn(stored.receipts.source, 'sourceValidation'),
    false,
  );
});
