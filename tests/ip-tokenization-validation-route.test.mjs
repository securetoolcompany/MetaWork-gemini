import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(
  new URL('../app/api/ip/revenue-tokenization/route.js', import.meta.url),
  'utf8',
)
  .replace(/^import\s+[\s\S]*?;\s*/gm, '')
  .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|var)/g, '');

const operationKey = 'abcdef12-abcd-4123-8123-abcdef123456';
const trustedCid = 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m';

function harness(options = {}) {
  const calls = {
    preparation: [],
    collections: [],
    metadata: [],
    uploads: [],
    transactions: [],
    inserts: [],
  };

  const db = {
    collection(name) {
      calls.collections.push(name);
      assert.ok(['users', 'ip_assets'].includes(name));

      return {
        async findOne() {
          return name === 'users'
            ? { id: 'authenticated-owner', credits: 1000, username: 'fixture' }
            : null;
        },
        async insertOne(asset) {
          calls.inserts.push(asset);
          return { acknowledged: true };
        },
      };
    },
  };

  const dependencies = {
    NextResponse: {
      json(body, config = {}) {
        return { body, status: config.status ?? 200 };
      },
    },
    verifyToken(token) {
      assert.equal(token, 'offline-token');
      return { userId: 'authenticated-owner' };
    },
    async connectToDatabase() {
      return { db: options.realDb || db, client: options.realClient };
    },
    async prepareValidatedIpTokenization(args) {
      calls.preparation.push(args);
      if (options.preparationError) throw options.preparationError;

      return {
        operationKey,
        name: 'Validated source',
        description: 'Bound draft',
        category: '3D Model',
        walletAddress: 'fixture-wallet',
        isPublic: true,
        licensable: true,
        licenseFeeUsd: 2.5,
        stakeholders: [
          { address: 'fixture-wallet', percentage: '100' },
        ],
        image: trustedCid,
      };
    },
    getUsdcAssetId: () => 1,
    algosdk: {
      isValidAddress: value => value === 'fixture-wallet',
      makeAssetCreateTxnWithSuggestedParamsFromObject(args) {
        calls.transactions.push(args);
        return { offline: true };
      },
      encodeUnsignedTransaction: () => new Uint8Array([1, 2, 3]),
    },
    createARC3Metadata(args) {
      calls.metadata.push(args);
      return { name: args.name, image: args.imageUrl };
    },
    async uploadJsonToPinata(...args) {
      calls.uploads.push(args);
      return { ipfsUrl: 'ipfs://offline-metadata-cid' };
    },
    getTransactionParams: async () => ({ offline: true }),
    safeJson: value => value,
    crypto,
    CREDIT_COSTS: { MINT_IP: 25 },
    console: { error() {} },
    process: { env: {
      PINATA_GATEWAY: 'https://fixture.invalid/ipfs',
      METAWORK_IP_UPLOAD_V2_ENABLED: options.enabled === false ? 'false' : 'true',
    } },
    loadIpUploadOperation: async () => null,
    acquireIpTokenizationPreparation: async () => options.reservationOutcome || ({
      state: 'acquired', reservation: { ipAssetId: 'a'.repeat(24) },
    }),
    startIpTokenizationMetadata: async ({ metadata }) => ({
      metadata, correlation: 'a'.repeat(64),
      metadataHash: crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('base64'),
    }),
    uploadIpPreparationMetadata: async request => dependencies.uploadJsonToPinata(request.metadata),
    reconcileIpPreparationMetadata: async () => { throw new Error('Unexpected metadata recovery'); },
    recordIpTokenizationMetadata: async ({ reservation }) => reservation,
    persistIpTokenizationPreparation: async ({ asset }) => {
      await db.collection('ip_assets').insertOne(asset);
      return options.storedWinner || asset;
    },
    ...options.reservationDependencies,
  };

  const POST = new Function(
    ...Object.keys(dependencies),
    `${routeSource.replace('const IP_UPLOAD_V2_SERVER_ENABLED = false;', 'const IP_UPLOAD_V2_SERVER_ENABLED = true;')}\nreturn POST;`,
  )(...Object.values(dependencies));

  async function invoke({ authenticated = true, payload = {} } = {}) {
    return POST(new Request('http://localhost/api/ip/revenue-tokenization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-metawork-upload-version': '2',
        ...(authenticated
          ? { Authorization: 'Bearer offline-token' }
          : {}),
      },
      body: JSON.stringify({
        operationKey,
        sourceUpload: {
          revision: 'revision-1',
          authorizationId: 'authorization-1',
          providerFileId: 'file-1',
        },
        draft: { name: 'Bound input' },
        image: 'forged-browser-cid',
        ownerId: 'forged-owner',
        ...payload,
      }),
    }));
  }

  return { calls, invoke, db };
}

function assertNoPreparationSideEffects(calls) {
  assert.deepEqual(calls.collections, []);
  assert.deepEqual(calls.metadata, []);
  assert.deepEqual(calls.uploads, []);
  assert.deepEqual(calls.transactions, []);
  assert.deepEqual(calls.inserts, []);
}

test('tokenization authenticates before source preparation', async () => {
  const state = harness();
  const result = await state.invoke({ authenticated: false });

  assert.equal(result.status, 401);
  assert.equal(state.calls.preparation.length, 0);
  assertNoPreparationSideEffects(state.calls);
});

for (const [code, status] of [
  ['IP_UPLOAD_OPERATION_CONFLICT', 409],
  ['SOURCE_READ_FAILED', 503],
]) {
  test(`tokenization stops ${code} before metadata or transaction preparation`, async () => {
    const error = new Error('private preparation diagnostic');
    error.code = code;
    const state = harness({ preparationError: error });

    const result = await state.invoke();

    assert.equal(result.status, status);
    assert.equal(result.body.code, code);
    assert.equal(
      JSON.stringify(result.body).includes('private preparation diagnostic'),
      false,
    );
    assert.equal(state.calls.preparation.length, 1);
    assertNoPreparationSideEffects(state.calls);
  });
}

test('V2 uses authenticated owner and validated CID for shared tokenization', async () => {
  const state = harness();
  const result = await state.invoke();

  assert.equal(result.status, 200);
  assert.equal(result.body.step, 'mint_nft');
  assert.equal(state.calls.preparation.length, 1);

  const input = state.calls.preparation[0];
  assert.equal(input.db, state.db);
  assert.equal(input.ownerId, 'authenticated-owner');
  assert.equal(input.operationKey, operationKey);
  assert.deepEqual(input.sourceUpload, {
    revision: 'revision-1',
    authorizationId: 'authorization-1',
    providerFileId: 'file-1',
  });
  assert.deepEqual(input.draft, { name: 'Bound input' });
  assert.equal(Object.hasOwn(input, 'image'), false);

  assert.equal(state.calls.metadata.length, 1);
  assert.equal(state.calls.metadata[0].imageUrl, `ipfs://${trustedCid}`);
  assert.equal(state.calls.uploads.length, 1);
  assert.equal(state.calls.transactions.length, 1);
  assert.equal(state.calls.inserts.length, 1);

  const asset = state.calls.inserts[0];
  assert.equal(asset.ownerId, 'authenticated-owner');
  assert.equal(asset.tokenizationOperationKey, operationKey);
  assert.equal(asset.creditCost, 25);
  assert.equal(asset.creditStatus, 'pending');
  assert.equal(asset.status, 'pending_nft_mint');
  assert.ok(asset.imageUrl.includes(trustedCid));
  assert.equal(JSON.stringify(asset).includes('forged-browser-cid'), false);
});


test('V2 server gate rejects before preparation or side effects', async () => {
  const state = harness({ enabled: false });
  const response = await state.invoke();
  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'IP_UPLOAD_V2_DISABLED');
  assert.equal(state.calls.preparation.length, 0);
  assertNoPreparationSideEffects(state.calls);
});
test('V2 in-progress reservation never uploads metadata or prepares transactions', async () => {
  const state = harness({ reservationOutcome: { state: 'in_progress', ipAssetId: 'winner' } });
  const response = await state.invoke();
  assert.equal(response.status, 202);
  assert.equal(response.body.code, 'IP_PREPARATION_IN_PROGRESS');
  assert.deepEqual(state.calls.uploads, []);
  assert.deepEqual(state.calls.transactions, []);
  assert.deepEqual(state.calls.inserts, []);
});
test('V2 prepared repeat returns current lifecycle without side effects', async () => {
  const state = harness({ reservationOutcome: { state: 'prepared', asset: {
    id: 'winner', status: 'active', revenueTokenAssetId: 123,
  } } });
  const response = await state.invoke();
  assert.equal(response.status, 200);
  assert.equal(response.body.step, 'complete');
  assert.equal(response.body.revenueTokenId, 123);
  assert.deepEqual(state.calls.uploads, []);
  assert.deepEqual(state.calls.transactions, []);
  assert.deepEqual(state.calls.inserts, []);
});
test('V2 returns the stored transaction rather than its local candidate', async () => {
  const state = harness({ storedWinner: {
    id: 'stored-winner', status: 'pending_nft_mint',
    mbrMicroAlgos: 123, preparedNftTransaction: 'stored-transaction',
  } });
  const response = await state.invoke();
  assert.equal(response.body.ipAssetId, 'stored-winner');
  assert.equal(response.body.transaction, 'stored-transaction');
  assert.equal(response.body.mbrMicroAlgos, 123);
});

test('V2 actual route consumes real Mongo reservation under concurrent requests', async () => {
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  const { MongoClient } = await import('mongodb');
  const { canonicalIpDraft } = await import('../lib/ip-upload-draft.js');
  const { ipUploadOperationIdentity, IP_UPLOAD_OPERATIONS_COLLECTION } = await import('../lib/ip-upload-operations.js');
  const reservationDependencies = await import('../lib/ip-source/tokenization-reservation.js');
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  let client;
  try {
    client = await new MongoClient(server.getUri(), { serverSelectionTimeoutMS: 5000 }).connect();
    const db = client.db('ip_route_reservation_test');
    await db.createCollection(IP_UPLOAD_OPERATIONS_COLLECTION);
    await db.createCollection('ip_assets');
    await db.collection('users').insertOne({ id: 'authenticated-owner', credits: 1000, username: 'fixture' });
    const draft = { name: 'Bound input' };
    const source = { format: 'png', filename: 'fixture.png', byteLength: 10 };
    const inputHash = crypto.createHash('sha256').update(JSON.stringify({ draft: canonicalIpDraft(draft), source })).digest('hex');
    await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).insertOne({
      _id: ipUploadOperationIdentity({ ownerId: 'authenticated-owner', operationKey }).id,
      schemaVersion: 1, ownerId: 'authenticated-owner', operationKey,
      revision: 'revision-1', inputHash, status: 'confirmed', sourceDeclaration: source,
      authorizations: { source: {
        authorizationId: 'authorization-1', operationRevision: 'revision-1', status: 'associated',
        associatedProviderFileId: 'file-1', maxBytes: 100,
      } },
      receipts: { source: {
        authorizationId: 'authorization-1', operationRevision: 'revision-1', providerFileId: 'file-1',
        cid: trustedCid, sourceValidationStatus: 'valid', sourceValidation: {
          schemaVersion: 1, revision: 'revision-1', inputHash, authorizationId: 'authorization-1',
          providerFileId: 'file-1', cid: trustedCid, sourceDeclaration: source,
          result: { validation: { status: 'valid' } },
        },
      } },
    });
    let uploads = 0, release;
    const blocked = new Promise(resolve => { release = resolve; });
    let started;
    const uploading = new Promise(resolve => { started = resolve; });
    const state = harness({ realDb: db, realClient: client, reservationDependencies: {
      ...reservationDependencies,
      async uploadIpPreparationMetadata() {
        uploads++;
        started();
        await blocked;
        return { ipfsUrl: `ipfs://${'b'.repeat(59)}` };
      },
    } });
    const winner = state.invoke();
    await Promise.race([uploading, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Route did not reach metadata upload')), 10_000);
      timer.unref();
    })]);
    const contenders = await Promise.all(Array.from({ length: 8 }, () => state.invoke()));
    assert.ok(contenders.every(r => r.status === 202));
    release();
    const first = await winner;
    assert.equal(first.status, 200);
    assert.equal(first.body.step, 'mint_nft');
    const repeat = await state.invoke();
    assert.equal(repeat.body.ipAssetId, first.body.ipAssetId);
    assert.equal(repeat.body.transaction, first.body.transaction);
    assert.equal(uploads, 1);
    assert.equal(state.calls.transactions.length, 1);
    assert.equal(await db.collection('ip_assets').countDocuments({}), 1);
    const user = await db.collection('users').findOne({ id: 'authenticated-owner' });
    assert.equal(user.credits, 1000);
  } finally {
    await client?.close();
    await server.stop();
  }
});
