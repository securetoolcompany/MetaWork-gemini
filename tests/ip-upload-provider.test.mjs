import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createIpUploadBinding,
  createIpSignedUpload,
  verifyIpUploadReceipt,
} from '../lib/pinata.js';

const authorization = {
  authorizationId: 'authorization-1',
  operationRevision: 'revision-1',
  purpose: 'source',
  bindingNonce: 'ab'.repeat(32),
  maxBytes: 104857600,
  expiresSeconds: 900,
  allowedMimeTypes: ['application/octet-stream'],
};

const jwt = 'offline-secret-token';
const cid = 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m';

function file(overrides = {}) {
  return {
    id: 'file-1',
    cid,
    size: 134,
    number_of_files: 1,
    mime_type: 'application/octet-stream',
    group_id: null,
    created_at: '2026-11-12T17:00:00Z',
    keyvalues: createIpUploadBinding(authorization),
    ...overrides,
  };
}

function dependencies(responseFactory) {
  const calls = [];

  return {
    jwt,
    now: () => 1800000000000,
    calls,
    async fetchImpl(url, init) {
      calls.push({ url, init });
      return responseFactory(url, init);
    },
  };
}

function verify(record, overrides = {}) {
  const deps = dependencies(() => Response.json({ data: record }));

  return verifyIpUploadReceipt({
    authorization,
    providerFileId: 'file-1',
    network: 'public',
    ...overrides,
  }, deps);
}

test('signing sends server binding and constrained REST fields', async () => {
  const deps = dependencies(() => Response.json({
    data: 'https://uploads.pinata.cloud/v3/files?signature=offline',
  }));

  const result = await createIpSignedUpload(authorization, deps);
  const { url, init } = deps.calls[0];
  const body = JSON.parse(init.body);

  assert.equal(url, 'https://uploads.pinata.cloud/v3/files/sign');
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'error');
  assert.equal(init.cache, 'no-store');
  assert.equal(init.headers.Authorization, `Bearer ${jwt}`);
  assert.equal(body.date, 1800000000);
  assert.equal(body.expires, 900);
  assert.equal(body.max_file_size, authorization.maxBytes);
  assert.deepEqual(body.allow_mime_types, authorization.allowedMimeTypes);
  assert.deepEqual(body.keyvalues, createIpUploadBinding(authorization));
  assert.equal(result.expiresAt, '2027-01-15T08:15:00.000Z');
});

test('signing rejects invalid constraints before provider access', async () => {
  const deps = dependencies(() => {
    throw new Error('Must not call provider');
  });

  for (const override of [
    { maxBytes: 0 },
    { expiresSeconds: 901 },
    { allowedMimeTypes: [] },
    { allowedMimeTypes: ['not-a-mime'] },
    { groupId: '../group' },
  ]) {
    await assert.rejects(
      createIpSignedUpload({ ...authorization, ...override }, deps),
      TypeError,
    );
  }

  assert.equal(deps.calls.length, 0);
});

test('signing refuses unexpected capability destinations', async () => {
  for (const url of [
    'https://example.com/v3/files?signature=x',
    'https://uploads.pinata.cloud/other?signature=x',
    'http://uploads.pinata.cloud/v3/files?signature=x',
    'https://user:password@uploads.pinata.cloud/v3/files',
    'https://uploads.pinata.cloud/v3/files#fragment',
  ]) {
    const deps = dependencies(() => Response.json({ data: url }));

    await assert.rejects(
      createIpSignedUpload(authorization, deps),
      /invalid upload capability/,
    );
  }
});

test('receipt returns allowlisted provider fields without secrets', async () => {
  const receipt = await verify(file({
    internal: 'must-not-propagate',
    uploadUrl: 'must-not-propagate',
  }));

  assert.equal(receipt.cid, cid);
  assert.equal(receipt.providerFileId, 'file-1');
  assert.equal(receipt.network, 'public');
  assert.equal(receipt.authorizationId, authorization.authorizationId);
  assert.equal(receipt.verificationMethod, 'pinata_authenticated_file_lookup');
  assert.ok(Object.isFrozen(receipt));
  assert.ok(!('internal' in receipt));
  assert.ok(!('uploadUrl' in receipt));
  assert.ok(!JSON.stringify(receipt).includes(jwt));
  assert.ok(!JSON.stringify(receipt).includes(authorization.bindingNonce));
});

test('receipt lookup requires explicit network and safe provider ID', async () => {
  const deps = dependencies(() => {
    throw new Error('Must not call provider');
  });

  for (const override of [
    { network: undefined },
    { network: 'automatic' },
    { providerFileId: '../file-1' },
  ]) {
    await assert.rejects(
      verifyIpUploadReceipt({
        authorization,
        providerFileId: 'file-1',
        network: 'public',
        ...override,
      }, deps),
      TypeError,
    );
  }

  assert.equal(deps.calls.length, 0);
});

test('receipt rejects invalid file metadata', async () => {
  for (const override of [
    { id: 'other-file' },
    { cid: 'https://example.com/source' },
    { size: 0 },
    { size: authorization.maxBytes + 1 },
    { number_of_files: 2 },
    { mime_type: null },
    { created_at: 'invalid-date' },
  ]) {
    await assert.rejects(
      verify(file(override)),
      /receipt verification failed/,
    );
  }
});

test('receipt rejects mismatched authorization, revision, purpose or nonce', async () => {
  for (const key of [
    'mw_authorization',
    'mw_revision',
    'mw_purpose',
    'mw_binding',
  ]) {
    await assert.rejects(
      verify(file({
        keyvalues: {
          ...createIpUploadBinding(authorization),
          [key]: 'wrong-value',
        },
      })),
      /binding verification failed/,
    );
  }
});

test('receipt enforces configured group membership', async () => {
  await assert.rejects(
    verify(file(), {
      authorization: { ...authorization, groupId: 'group-1' },
    }),
    /receipt verification failed/,
  );

  const receipt = await verify(file({ group_id: 'group-1' }), {
    authorization: { ...authorization, groupId: 'group-1' },
  });

  assert.equal(receipt.providerGroupId, 'group-1');
});

test('provider exceptions and HTTP errors are sanitized', async () => {
  for (const factory of [
    () => { throw new Error(`Sensitive provider error ${jwt}`); },
    () => new Response(`Sensitive provider error ${jwt}`, { status: 403 }),
    () => new Response('not-json'),
  ]) {
    const deps = dependencies(factory);

    await assert.rejects(
      createIpSignedUpload(authorization, deps),
      error => error.message === 'Pinata provider request failed',
    );
  }
});

test('oversized declared and streamed provider responses are rejected', async () => {
  for (const factory of [
    () => new Response('{}', {
      headers: { 'content-length': String(65537) },
    }),
    () => new Response('x'.repeat(65537)),
  ]) {
    const deps = dependencies(factory);

    await assert.rejects(
      createIpSignedUpload(authorization, deps),
      /Pinata provider request failed/,
    );
  }
});
