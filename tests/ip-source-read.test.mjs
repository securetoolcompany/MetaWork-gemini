import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IpSourceReadError,
  readIpSourceBytes,
} from '../lib/ip-source/read-source.js';

const cid = 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m';

function operation() {
  return {
    schemaVersion: 1,
    status: 'confirmed',
    revision: 'revision-1',
    inputHash: 'ab'.repeat(32),
    sourceDeclaration: {
      format: 'png',
      filename: 'fixture.png',
      byteLength: 3,
    },
    authorizations: {
      source: {
        authorizationId: 'authorization-1',
        operationRevision: 'revision-1',
        purpose: 'source',
        status: 'associated',
        network: 'public',
        maxBytes: 50 * 1024 * 1024,
        associatedProviderFileId: 'file-1',
      },
    },
    receipts: {
      source: {
        authorizationId: 'authorization-1',
        operationRevision: 'revision-1',
        purpose: 'source',
        network: 'public',
        provider: 'pinata',
        providerFileId: 'file-1',
        verificationMethod: 'pinata_authenticated_file_lookup',
        providerNumberOfFiles: 1,
        sourceValidationStatus: 'pending',
        providerSize: 3,
        cid,
      },
    },
  };
}

function isReadFailure(error) {
  return error instanceof IpSourceReadError &&
    error.code === 'SOURCE_READ_FAILED';
}

test('reads exact bytes from the fixed gateway without credentials', async () => {
  const calls = [];

  const bytes = await readIpSourceBytes({
    operation: operation(),
    async fetchImpl(url, init) {
      calls.push({ url, init });
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-length': '3' },
      });
    },
  });

  assert.deepEqual(bytes, new Uint8Array([1, 2, 3]));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://gateway.pinata.cloud/ipfs/${cid}`);

  const { init } = calls[0];
  assert.equal(init.method, 'GET');
  assert.equal(init.redirect, 'error');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.cache, 'no-store');
  assert.equal(init.headers['Accept-Encoding'], 'identity');
  assert.ok(!('Authorization' in init.headers));
  assert.equal(init.signal.aborted, true);
});

test('invalid operation bindings fail before any fetch', async () => {
  const mutations = [
    op => { op.schemaVersion = 2; },
    op => { op.status = 'complete'; },
    op => { op.inputHash = 'invalid'; },
    op => { delete op.sourceDeclaration; },
    op => { op.sourceDeclaration.format = 'svg'; },
    op => { op.sourceDeclaration.byteLength = 0; },
    op => { op.sourceDeclaration.byteLength = 4; },
    op => { op.authorizations.source.status = 'issued'; },
    op => { op.authorizations.source.operationRevision = 'other'; },
    op => { op.authorizations.source.network = 'private'; },
    op => { op.authorizations.source.associatedProviderFileId = 'other'; },
    op => { op.authorizations.source.maxBytes = 2; },
    op => { op.receipts.source.authorizationId = 'other'; },
    op => { op.receipts.source.operationRevision = 'other'; },
    op => { op.receipts.source.purpose = 'display_thumbnail'; },
    op => { op.receipts.source.provider = 'other'; },
    op => { op.receipts.source.providerNumberOfFiles = 2; },
    op => { delete op.receipts.source.sourceValidationStatus; },
    op => { op.receipts.source.sourceValidationStatus = 'invalid'; },
    op => { op.receipts.source.sourceValidationStatus = 'stale'; },
    op => { op.receipts.source.verificationMethod = 'client-supplied'; },
    op => { op.receipts.source.cid = '../../secret'; },
    op => { op.receipts.source.cid = 'https://example.com/source'; },
  ];

  let calls = 0;

  for (const mutate of mutations) {
    const op = operation();
    mutate(op);

    await assert.rejects(
      readIpSourceBytes({
        operation: op,
        async fetchImpl() {
          calls++;
          throw new Error('Must not fetch');
        },
      }),
      error =>
        error instanceof IpSourceReadError &&
        error.code === 'SOURCE_BINDING_REQUIRED',
    );
  }

  assert.equal(calls, 0);
});

test('content-length must match when present', async () => {
  for (const length of ['2', '4', 'invalid']) {
    await assert.rejects(
      readIpSourceBytes({
        operation: operation(),
        async fetchImpl() {
          return new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'content-length': length },
          });
        },
      }),
      isReadFailure,
    );
  }
});

test('missing content-length is allowed only for an exact stream', async () => {
  const bytes = await readIpSourceBytes({
    operation: operation(),
    async fetchImpl() {
      return new Response(new Uint8Array([1, 2, 3]));
    },
  });

  assert.deepEqual(bytes, new Uint8Array([1, 2, 3]));
});

test('short and oversized streams are rejected', async () => {
  for (const payload of [
    new Uint8Array([1, 2]),
    new Uint8Array([1, 2, 3, 4]),
  ]) {
    await assert.rejects(
      readIpSourceBytes({
        operation: operation(),
        async fetchImpl() {
          return new Response(payload);
        },
      }),
      isReadFailure,
    );
  }
});

test('multiple chunks preserve their exact byte order', async () => {
  const bytes = await readIpSourceBytes({
    operation: operation(),
    async fetchImpl() {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          controller.enqueue(new Uint8Array([2, 3]));
          controller.close();
        },
      }));
    },
  });

  assert.deepEqual(bytes, new Uint8Array([1, 2, 3]));
});

test('HTTP errors and redirects are not accepted as source bytes', async () => {
  for (const status of [302, 403, 404, 503]) {
    await assert.rejects(
      readIpSourceBytes({
        operation: operation(),
        async fetchImpl() {
          return new Response('sensitive-provider-body', { status });
        },
      }),
      isReadFailure,
    );
  }
});

test('provider exceptions are sanitized', async () => {
  await assert.rejects(
    readIpSourceBytes({
      operation: operation(),
      async fetchImpl() {
        throw new Error('sensitive-provider-detail');
      },
    }),
    error =>
      isReadFailure(error) &&
      !error.message.includes('sensitive-provider-detail'),
  );
});

test('oversized streamed response is cancelled', async () => {
  let cancelled = false;

  await assert.rejects(
    readIpSourceBytes({
      operation: operation(),
      async fetchImpl() {
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3, 4]));
          },
          cancel() {
            cancelled = true;
          },
        }));
      },
    }),
    isReadFailure,
  );

  assert.equal(cancelled, true);
});

test('stream failures are sanitized', async () => {
  await assert.rejects(
    readIpSourceBytes({
      operation: operation(),
      async fetchImpl() {
        return new Response(new ReadableStream({
          start(controller) {
            controller.error(new Error('sensitive-stream-detail'));
          },
        }));
      },
    }),
    error =>
      isReadFailure(error) &&
      !error.message.includes('sensitive-stream-detail'),
  );
});
