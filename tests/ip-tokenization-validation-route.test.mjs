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
      isValidAddress: value => ['fixture-wallet', 'fixture-treasury'].includes(value),
      makePaymentTxnWithSuggestedParamsFromObject({ suggestedParams }) {
        return {
          txID: () => 'fixture-funding-txid',
          fee: 1000n,
          firstValid: 10n,
          lastValid: 100n,
          genesisID: suggestedParams.genesisID,
          genesisHash: suggestedParams.genesisHash,
        };
      },
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
    getTransactionParams: async () => ({
      offline: true,
      genesisID: 'mainnet-v1.0',
      genesisHash: new Uint8Array(32),
    }),
    TextEncoder,
    safeJson: value => value,
    crypto,
    CREDIT_COSTS: { MINT_IP: 25 },
    console: { error() {} },
    process: { env: {
      PINATA_GATEWAY: 'https://fixture.invalid/ipfs',
      NEXT_PUBLIC_TREASURY_ADDRESS: 'fixture-treasury',
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

  if (options.sdk) {
    const sdk = options.sdk;
    dependencies.algosdk = {
      ...sdk,
      makeAssetCreateTxnWithSuggestedParamsFromObject(args) {
        calls.transactions.push(args);
        return sdk.makeAssetCreateTxnWithSuggestedParamsFromObject(args);
      },
    };
  }

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

  return { calls, invoke, db, dependencies };
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

for (const valid of [true, false]) {
  test(`V2 route validates receipt-bound STL bytes before mint preparation (${valid ? 'valid' : 'invalid'})`, async t => {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const { MongoClient } = await import('mongodb');
    const { canonicalIpDraft } = await import('../lib/ip-upload-draft.js');
    const { ipUploadOperationIdentity, IP_UPLOAD_OPERATIONS_COLLECTION } = await import('../lib/ip-upload-operations.js');
    const reservationDependencies = await import('../lib/ip-source/tokenization-reservation.js');
    const { prepareValidatedIpTokenization } = await import('../lib/ip-source/prepare-tokenization.js');
    const { validateIpSourceBytes } = await import('../lib/ip-source/validate-source.js');
    const { default: sdk } = await import('algosdk');
    const owner = sdk.generateAccount();
    const treasury = sdk.generateAccount();
    const platform = sdk.generateAccount();
    const sdkParams = {
      fee: 1000n, minFee: 1000n, flatFee: true,
      firstValid: 10n, lastValid: 100n,
      genesisID: 'mainnet-v1.0', genesisHash: new Uint8Array(32).fill(1),
    };

    // One nondegenerate binary STL triangle. The invalid case keeps the same
    // length but declares two triangles while supplying bytes for only one.
    const bytes = Buffer.alloc(134);
    bytes.writeUInt32LE(valid ? 1 : 2, 80);
    const floats = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    floats.forEach((value, i) => bytes.writeFloatLE(value, 84 + i * 4));

    let reads = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(String(url), `https://gateway.pinata.cloud/ipfs/${trustedCid}`);
      assert.equal(options.method, 'GET');
      reads++;
      return new Response(bytes, {
        headers: { 'content-length': String(bytes.byteLength) },
      });
    });
    const server = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    let client;
    try {
      client = await new MongoClient(server.getUri(), { serverSelectionTimeoutMS: 5000 }).connect();
      const db = client.db('ip_route_reservation_test');
      await db.createCollection(IP_UPLOAD_OPERATIONS_COLLECTION);
      await db.createCollection('ip_assets');
      await db.collection('users').insertOne({ id: 'authenticated-owner', credits: 1000, username: 'fixture' });
      const draft = {
        name: 'STL route fixture',
        walletAddress: owner.addr.toString(),
        isPublic: true,
        licensable: true,
        licenseFeeUsd: 2.5,
        stakeholders: [{ address: owner.addr.toString(), percentage: '100' }],
      };
      const source = { format: 'stl', filename: 'fixture.stl', byteLength: bytes.byteLength };
      if (valid) {
        const result = await validateIpSourceBytes({ bytes, sourceDeclaration: source });
        assert.equal(result.validation.status, 'valid');
      } else {
        await assert.rejects(validateIpSourceBytes({ bytes, sourceDeclaration: source }));
      }
      const inputHash = crypto.createHash('sha256').update(JSON.stringify({ draft: canonicalIpDraft(draft), source })).digest('hex');
      await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).insertOne({
        _id: ipUploadOperationIdentity({ ownerId: 'authenticated-owner', operationKey }).id,
        schemaVersion: 1, ownerId: 'authenticated-owner', operationKey,
        revision: 'revision-1', inputHash, status: 'confirmed', sourceDeclaration: source,
        authorizations: { source: {
          authorizationId: 'authorization-1', operationRevision: 'revision-1', status: 'associated',
          associatedProviderFileId: 'file-1', maxBytes: 1024,
          purpose: 'source', network: 'public',
        } },
        receipts: { source: {
          authorizationId: 'authorization-1', operationRevision: 'revision-1', providerFileId: 'file-1',
          cid: trustedCid, sourceValidationStatus: 'pending',
          purpose: 'source', network: 'public', provider: 'pinata',
          verificationMethod: 'pinata_authenticated_file_lookup',
          providerNumberOfFiles: 1, providerSize: bytes.byteLength,
        } },
      });
      let uploads = 0, release;
      const blocked = new Promise(resolve => { release = resolve; });
      let started;
      const uploading = new Promise(resolve => { started = resolve; });
      const state = harness({ realDb: db, realClient: client, sdk, reservationDependencies: {
        getTransactionParams: async () => ({ ...sdkParams }),
        process: { env: {
          PINATA_GATEWAY: 'https://fixture.invalid/ipfs',
          NEXT_PUBLIC_TREASURY_ADDRESS: treasury.addr.toString(),
          METAWORK_IP_UPLOAD_V2_ENABLED: 'true',
          GLOBAL_POOL_APP_ID: '1234',
        } },
        console: { error() {}, log() {} },
        ...reservationDependencies,
        prepareValidatedIpTokenization,
        async uploadIpPreparationMetadata() {
          uploads++;
          started();
          await blocked;
          return { ipfsUrl: `ipfs://${'b'.repeat(59)}` };
        },
      } });
      const invoke = () => state.invoke({ payload: { draft } });

      if (!valid) {
        const rejected = await invoke();
        assert.ok(rejected.status >= 400);
        assert.equal(reads, 1, 'the route must reach receipt-bound byte retrieval');
        assert.equal(uploads, 0);
        assert.equal(state.calls.metadata.length, 0);
        assert.equal(state.calls.transactions.length, 0);
        assert.equal(await db.collection('ip_assets').countDocuments({}), 0);
        const operation = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).findOne({ operationKey });
        assert.equal(operation.receipts.source.sourceValidationStatus, 'pending');
        assert.equal(operation.tokenizationPreparation, undefined);
        assert.equal(await db.collection('products').countDocuments({}), 0);
        return;
      }

      const winner = invoke();
      await Promise.race([uploading, winner.then(result => {
        throw new Error(`Route exited before metadata upload: ${result.status} ${JSON.stringify(result.body)}`);
      }), new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Route did not reach metadata upload')), 10_000);
        timer.unref();
      })]);
      try {
        const contenders = await Promise.all(Array.from({ length: 8 }, invoke));
        assert.ok(contenders.every(r => r.status === 202));
      } finally {
        release();
        await winner;
      }
      const first = await winner;
      assert.equal(first.status, 200);
      assert.equal(first.body.step, 'mint_nft');
      const repeat = await invoke();
      assert.equal(repeat.body.ipAssetId, first.body.ipAssetId);
      assert.equal(repeat.body.transaction, first.body.transaction);
      assert.equal(uploads, 1);
      assert.equal(state.calls.transactions.length, 1);
      assert.equal(await db.collection('ip_assets').countDocuments({}), 1);
      const asset = await db.collection('ip_assets').findOne({ id: first.body.ipAssetId });
      assert.equal(asset.status, 'pending_nft_mint');
      assert.equal(asset.preparedNftTransaction, first.body.transaction);
      assert.equal(asset.creditStatus, 'pending');
      assert.equal(asset.creditCost, 25); // Existing shared policy fixture.
      assert.ok(asset.imageUrl.includes(trustedCid));
      assert.ok(reads >= 1);
      const operation = await db.collection(IP_UPLOAD_OPERATIONS_COLLECTION).findOne({ operationKey });
      assert.equal(operation.receipts.source.sourceValidationStatus, 'valid');
      const user = await db.collection('users').findOne({ id: 'authenticated-owner' });
      assert.equal(user.credits, 1000);

      // Use the exact unsigned transactions persisted for this STL asset.
      const funding = sdk.decodeUnsignedTransaction(
        Buffer.from(asset.fundingAttempt.unsigned, 'base64'),
      );
      const mint = sdk.decodeUnsignedTransaction(
        Buffer.from(asset.preparedNftTransaction, 'base64'),
      );
      assert.equal(funding.txID(), asset.fundingAttempt.expectedTransactionId);
      assert.equal(funding.payment.receiver.toString(), treasury.addr.toString());
      assert.equal(funding.payment.amount, BigInt(asset.fundingAttempt.amount));

      const sends = [];
      const box = Buffer.alloc(41);
      box.writeBigUInt64BE(5678n);
      const fakeAlgod = {
        status: () => ({ do: async () => ({ lastRound: 20n }) }),
        accountInformation: address => ({ do: async () => {
          assert.equal(address, owner.addr.toString());
          return {};
        } }),
        sendRawTransaction: payload => ({ do: async () => {
          const transactions = (Array.isArray(payload) ? payload : [payload])
            .map(bytes => sdk.decodeSignedTransaction(bytes).txn);
          const [txn] = transactions;
          if (sends.length === 0) assert.equal(txn.txID(), funding.txID());
          if (sends.length === 1) assert.equal(txn.txID(), mint.txID());
          if (sends.length === 2) {
            assert.equal(transactions.length, 3);
            assert.deepEqual(transactions.map(t => t.type), ['pay', 'pay', 'appl']);
            assert.ok(transactions.every(t => t.sender.toString() === platform.addr.toString()));
            assert.equal(Buffer.from(transactions[2].applicationCall.appArgs[0]).toString(), 'create_pool');
            assert.equal(Buffer.from(transactions[2].applicationCall.appArgs[1]).toString(), asset.id);
          }
          sends.push(txn.txID());
          return { txid: txn.txID() };
        } }),
        pendingTransactionInformation: id => ({ do: async () => {
          assert.equal(id, funding.txID());
          assert.deepEqual(sends, [funding.txID()]);
          return { confirmedRound: 21n };
        } }),
        getApplicationBoxByName: (id, name) => ({ do: async () => {
          assert.equal(id, 1234);
          assert.equal(Buffer.from(name).toString(), `p_${asset.id}`);
          return { value: box };
        } }),
      };
      const getAlgodClient = network => {
        assert.equal(network, 'mainnet');
        return fakeAlgod;
      };
      const { default: nacl } = await import('tweetnacl');
      const { claimIpFunding, reconcileIpFunding } = await import('../lib/ip-source/pool-funding.js');
      const fundingSource = readFileSync(
        new URL('../app/api/ip/pool-funding/route.js', import.meta.url), 'utf8',
      )
        .replace(/^import .*;$/gm, '')
        .replace(/^export const (GET|POST) =/gm, 'const $1 =');
      const fundingDeps = {
        ...state.dependencies,
        algosdk: { ...sdk, waitForConfirmation: async () => ({ confirmedRound: 21n }) },
        nacl,
        getAlgodClient,
        getIndexerClient: () => { throw new Error('Unexpected indexer lookup'); },
        claimIpFunding,
        reconcileIpFunding,
      };
      const fundingPOST = new Function(
        ...Object.keys(fundingDeps), fundingSource + String.fromCharCode(10) + "return POST;",
      )(...Object.values(fundingDeps));

      const headers = {
        Authorization: 'Bearer offline-token', 'Content-Type': 'application/json',
      };
      const pointer = { ipAssetId: asset.id, operationKey };
      const funded = await fundingPOST(new Request('http://localhost/api/ip/pool-funding', {
        method: 'POST', headers,
        body: JSON.stringify({
          ...pointer, signedMbrTxn: Buffer.from(funding.signTxn(owner.sk)).toString('base64'),
        }),
      }));
      assert.equal(funded.status, 200, JSON.stringify(funded.body));
      assert.equal(funded.body.mbrPaymentTxId, funding.txID());
      assert.equal(funded.body.mbrPaidMicroAlgos, asset.fundingAttempt.amount);
      assert.equal((await db.collection('users').findOne({ id: asset.ownerId })).credits, 1000);

      const { provisionStlProducts } = await import('../lib/ip-source/provision-stl-products.js');
      const completionDeps = {
        ...state.dependencies,
        provisionStlProducts,
        getAlgodClient,
        getSigner: () => ({
          address: platform.addr.toString(), signTxn: txn => txn.signTxn(platform.sk),
        }),
        waitForConfirmation: async (id, rounds, network) => {
          assert.equal(network, 'mainnet');
          assert.equal(rounds, 10);
          assert.equal(id, sends.at(-1));
          return id === mint.txID() ? { assetIndex: 4321 } : { confirmedRound: 22 };
        },
      };
      const completePUT = new Function(
        ...Object.keys(completionDeps), routeSource + String.fromCharCode(10) + "return PUT;",
      )(...Object.values(completionDeps));
      const completed = await completePUT(new Request('http://localhost/api/ip/revenue-tokenization', {
        method: 'PUT', headers,
        body: JSON.stringify({
          ...pointer, step: 'confirm_nft',
          signedTxns: [Buffer.from(mint.signTxn(owner.sk)).toString('base64')],
        }),
      }));
      assert.equal(completed.status, 200, JSON.stringify(completed.body));
      assert.equal(completed.body.step, 'complete');
      assert.equal(completed.body.revenueTokenId, 5678);
      assert.equal(sends.length, 3, 'one funding payment, one mint, one pool group');
      assert.equal(await db.collection('ip_assets').countDocuments({}), 1);
      const active = await db.collection('ip_assets').findOne({ id: asset.id });
      assert.equal(active.tokenizationOperationKey, operationKey);
      assert.equal(active.status, 'active');
      assert.equal(active.nftAssetId, 4321);
      assert.equal(active.revenueTokenAssetId, 5678);
      assert.equal(active.mbrPaymentTxId, funding.txID());
      assert.equal(active.creditStatus, 'consumed');
      assert.equal(active.creditChargeOperationKey, operationKey);
      const charged = await db.collection('users').findOne({ id: asset.ownerId });
      assert.equal(charged.credits, 1000 - asset.creditCost);

      const provisioned = await db.collection('products').find({ ipAssetId: asset.id }).toArray();
      assert.deepEqual(provisioned.map(p => p.productKind).sort(), ['3d_print', 'stl_file']);
      assert.ok(provisioned.every(p => p.isPublic === false && p.status === 'unlisted' && p.isVisible === false));
      assert.equal(provisioned.find(p => p.productKind === 'stl_file').delivery.fileProtection, 'none');
      assert.equal(provisioned.find(p => p.productKind === '3d_print').fulfillment.status, 'offline');

      const sendsBeforeRetry = sends.length;
      const retried = await completePUT(new Request('http://localhost/api/ip/revenue-tokenization', {
        method: 'PUT', headers,
        body: JSON.stringify({
          ...pointer, step: 'confirm_nft',
          signedTxns: [Buffer.from(mint.signTxn(owner.sk)).toString('base64')],
        }),
      }));
      assert.equal(retried.status, 200, JSON.stringify(retried.body));
      assert.equal(retried.body.step, 'complete');
      assert.equal(retried.body.revenueTokenId, 5678);
      assert.equal(sends.length, sendsBeforeRetry);
      assert.equal((await db.collection('users').findOne({ id: asset.ownerId })).credits, 1000 - asset.creditCost);
      assert.equal(await db.collection('products').countDocuments({ ipAssetId: asset.id }), 2);

      await db.collection('products').deleteOne({ ipAssetId: asset.id, productKind: 'stl_file' });
      await completePUT(new Request('http://localhost/api/ip/revenue-tokenization', {
        method: 'PUT', headers,
        body: JSON.stringify({
          ...pointer, step: 'confirm_nft',
          signedTxns: [Buffer.from(mint.signTxn(owner.sk)).toString('base64')],
        }),
      }));
      assert.deepEqual(
        (await db.collection('products').find({ ipAssetId: asset.id }).toArray()).map(p => p.productKind),
        ['3d_print'],
      );
    } finally {
      await client?.close();
      await server.stop();
    }
  });
}
