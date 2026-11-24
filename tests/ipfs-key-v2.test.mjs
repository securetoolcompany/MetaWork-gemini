import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalIpDraft } from '../lib/ip-upload-draft.js';

const routeUrl = new URL('../app/api/ipfs/key/route.js', import.meta.url);

const body = {
  action: 'authorize',
  operationKey: 'abcdef12-abcd-4123-8123-abcdef123456',
  revision: 'revision-1',
  purpose: 'source',
  confirmTokenization: true,
  draft: {
    name: 'Fixture IP',
    description: 'Description',
    walletAddress: 'selected-wallet',
    stakeholders: [{ address: 'selected-wallet', percentage: '100' }],
    isPublic: true,
    licensable: true,
    licenseFeeUsd: 2.5,
    category: 'Illustration',
  },
  source: {
    format: 'png',
    filename: 'fixture.png',
    byteLength: 134,
  },
};

function harness(options = {}) {
  let databaseCalls = 0;
  const authorizations = [];
  const confirmations = [];
  const validations = [];
  const db = { marker: 'mock-database' };

  const source = readFileSync(routeUrl, 'utf8')
    .replace(/^import\s+[\s\S]*?;\s*/gm, '')
    .replace(
      /\bexport\s+(?=(?:async\s+)?function|const|let|var)/g,
      '',
    );

  const POST = new Function(
    'NextResponse',
    'verifyToken',
    'createHash',
    'connectToDatabase',
    'authorizeIpUpload',
    'confirmIpUpload',
    'canonicalIpDraft',
    'validateIpUploadSource',
    'fetch',
    'process',
    `${source.replace('const IP_UPLOAD_V2_SERVER_ENABLED = false;', 'const IP_UPLOAD_V2_SERVER_ENABLED = true;')}\nreturn POST;`,
  )(
    {
      json(responseBody, config = {}) {
        return {
          body: responseBody,
          status: config.status ?? 200,
          headers: config.headers || {},
        };
      },
    },
    token => {
      if (token !== 'valid-token') throw new Error('Invalid fixture token');
      return { userId: 'authenticated-owner' };
    },
    createHash,
    async () => {
      databaseCalls++;
      return { db };
    },
    async args => {
      authorizations.push(args);
      if (options.serviceError) throw options.serviceError;
      return options.recovery
        ? {
            step: 'upload_recovery_required',
            authorization: { authorizationId: 'authorization-1' },
          }
        : {
            step: 'upload_authorized',
            authorization: { authorizationId: 'authorization-1' },
            upload: {
              method: 'POST',
              url: 'https://uploads.pinata.cloud/v3/files?signature=mock',
              network: 'public',
            },
          };
    },
    async args => {
      confirmations.push(args);
      return { step: 'upload_received', validationStatus: 'pending' };
    },
    canonicalIpDraft,
    async args => {
      validations.push(args);
      if (options.serviceError) throw options.serviceError;
      return {
        step: 'source_validated',
        operationKey: args.operationKey,
        revision: args.revision,
        authorizationId: args.authorizationId,
        providerFileId: args.providerFileId,
        validationStatus: 'valid',
        resumed: false,
      };
    },
    async () => {
      throw new Error('V2 must not call the legacy key endpoint');
    },
    { env: { METAWORK_IP_UPLOAD_V2_ENABLED: options.enabled === false ? 'false' : 'true' } },
  );

  return {
    authorizations,
    confirmations,
    validations,
    get databaseCalls() { return databaseCalls; },

    async invoke(payload = body, config = {}) {
      const request = new Request('http://localhost/api/ipfs/key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-metawork-upload-version': config.version ?? '2',
          ...(config.unauthenticated
            ? {}
            : { Authorization: 'Bearer valid-token' }),
        },
        body: config.raw ?? JSON.stringify(payload),
      });

      return POST(request);
    },
  };
}

test('V2 authenticates before database or upload-service access', async () => {
  const state = harness();
  const result = await state.invoke(body, { unauthenticated: true });

  assert.equal(result.status, 401);
  assert.equal(state.databaseCalls, 0);
  assert.equal(state.authorizations.length, 0);
});

test('V2 uses authenticated owner and server-computed hash', async () => {
  const state = harness();
  const result = await state.invoke({
    ...body,
    ownerId: 'forged-owner',
    inputHash: 'forged-hash',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.step, 'upload_authorized');
  assert.equal(result.headers['Cache-Control'], 'no-store');

  const args = state.authorizations[0];
  assert.equal(args.ownerId, 'authenticated-owner');
  assert.match(args.inputHash, /^[a-f0-9]{64}$/);
  assert.notEqual(args.inputHash, 'forged-hash');
  assert.equal(args.maxBytes, 50 * 1024 * 1024);
  assert.equal(args.purpose, 'source');
});

test('draft key order does not change hash but changed inputs do', async () => {
  const state = harness();
  await state.invoke(body);

  const reordered = Object.fromEntries(
    Object.entries(body.draft).reverse(),
  );
  await state.invoke({ ...body, draft: reordered });

  await state.invoke({
    ...body,
    draft: { ...body.draft, name: 'Changed IP' },
  });

  assert.equal(
    state.authorizations[0].inputHash,
    state.authorizations[1].inputHash,
  );
  assert.notEqual(
    state.authorizations[0].inputHash,
    state.authorizations[2].inputHash,
  );
});

test('STL uses same service with approved provisional byte target', async () => {
  const state = harness();
  const result = await state.invoke({
    ...body,
    source: {
      format: 'stl',
      filename: 'fixture.stl',
      byteLength: 104857600,
    },
  });

  assert.equal(result.status, 200);
  assert.equal(state.authorizations[0].maxBytes, 104857600);
  assert.ok(
    state.authorizations[0].allowedMimeTypes.includes(
      'application/octet-stream',
    ),
  );
});

test('invalid declarations are rejected before database access', async () => {
  for (const override of [
    { confirmTokenization: false },
    { purpose: 'display_thumbnail' },
    { operationKey: 'invalid' },
    { draft: null },
    { source: { ...body.source, filename: '../fixture.png' } },
    { source: { ...body.source, filename: 'fixture.stl' } },
    { source: { ...body.source, byteLength: 50 * 1024 * 1024 + 1 } },
    { source: { ...body.source, format: 'unsupported' } },
  ]) {
    const state = harness();
    const result = await state.invoke({ ...body, ...override });

    assert.equal(result.status, 400);
    assert.equal(state.databaseCalls, 0);
    assert.equal(state.authorizations.length, 0);
  }
});

test('invalid and oversized JSON bodies do not reach persistence', async () => {
  for (const raw of ['not-json', '[]', 'x'.repeat(32769)]) {
    const state = harness();
    const result = await state.invoke(body, { raw });

    assert.equal(result.status, 400);
    assert.equal(state.databaseCalls, 0);
  }
});

test('confirmation forwards identifiers, not client receipt or CID', async () => {
  const state = harness();

  const result = await state.invoke({
    action: 'confirm',
    operationKey: body.operationKey,
    revision: body.revision,
    purpose: 'source',
    authorizationId: 'authorization-1',
    providerFileId: 'file-1',
    cid: 'forged-cid',
    verifiedReceipt: { providerFileId: 'forged-file' },
    ownerId: 'forged-owner',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.validationStatus, 'pending');
  assert.equal(state.authorizations.length, 0);
  assert.equal(state.confirmations.length, 1);

  const args = state.confirmations[0];
  assert.equal(args.ownerId, 'authenticated-owner');
  assert.equal(args.providerFileId, 'file-1');
  assert.ok(!('cid' in args));
  assert.ok(!('verifiedReceipt' in args));
});

test('existing authorization recovery returns conflict without capability', async () => {
  const state = harness({ recovery: true });
  const result = await state.invoke();

  assert.equal(result.status, 409);
  assert.equal(result.body.step, 'upload_recovery_required');
  assert.ok(!('upload' in result.body));
});

test('service failures are sanitized and operation conflicts remain distinct', async () => {
  const failure = new Error('sensitive-provider-secret');
  const state = harness({ serviceError: failure });
  const result = await state.invoke();

  assert.equal(result.status, 503);
  assert.ok(!JSON.stringify(result.body).includes('sensitive-provider-secret'));

  const conflict = new Error('internal-conflict');
  conflict.code = 'IP_UPLOAD_OPERATION_CONFLICT';

  const conflicting = harness({ serviceError: conflict });
  const response = await conflicting.invoke();

  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'IP_UPLOAD_OPERATION_CONFLICT');
});

test('unsupported version cannot fall back to legacy key issuance', async () => {
  const state = harness();
  const result = await state.invoke(body, { version: '3' });

  assert.equal(result.status, 400);
  assert.equal(state.databaseCalls, 0);
  assert.equal(state.authorizations.length, 0);
});

// Source-declaration route forwarding regression test.
test('V2 forwards only the normalized source declaration', async () => {
  const state = harness();

  const result = await state.invoke({
    ...body,
    source: {
      ...body.source,
      cid: 'untrusted-cid',
      validationStatus: 'valid',
    },
    sourceDeclaration: {
      format: 'stl',
      filename: 'forged.stl',
      byteLength: 1,
    },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(
    state.authorizations[0].sourceDeclaration,
    body.source,
  );
});

test('V2 validation forwards authenticated owner and bound identifiers only', async () => {
  const state = harness();
  const result = await state.invoke({
    action: 'validate',
    operationKey: body.operationKey,
    revision: body.revision,
    purpose: 'source',
    authorizationId: 'authorization-1',
    providerFileId: 'file-1',
    ownerId: 'forged-owner',
    cid: 'forged-cid',
    sourceValidation: { result: 'forged' },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.step, 'source_validated');
  assert.equal(result.body.validationStatus, 'valid');
  assert.equal(state.databaseCalls, 1);
  assert.equal(state.authorizations.length, 0);
  assert.equal(state.confirmations.length, 0);
  assert.equal(state.validations.length, 1);
  assert.deepEqual(state.validations[0], {
    db: { marker: 'mock-database' },
    ownerId: 'authenticated-owner',
    operationKey: body.operationKey,
    revision: body.revision,
    authorizationId: 'authorization-1',
    providerFileId: 'file-1',
  });
});

test('V2 validation authenticates before database or validator access', async () => {
  const state = harness();
  const result = await state.invoke({
    action: 'validate',
    operationKey: body.operationKey,
    revision: body.revision,
    purpose: 'source',
    authorizationId: 'authorization-1',
    providerFileId: 'file-1',
  }, { unauthenticated: true });

  assert.equal(result.status, 401);
  assert.equal(state.databaseCalls, 0);
  assert.equal(state.validations.length, 0);
});

test('V2 validation preserves binding conflicts without exposing internals', async () => {
  const serviceError = new Error('private validation diagnostic');
  serviceError.code = 'IP_UPLOAD_OPERATION_CONFLICT';

  const state = harness({ serviceError });
  const result = await state.invoke({
    action: 'validate',
    operationKey: body.operationKey,
    revision: body.revision,
    purpose: 'source',
    authorizationId: 'authorization-1',
    providerFileId: 'file-1',
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'IP_UPLOAD_OPERATION_CONFLICT');
  assert.equal(
    JSON.stringify(result.body).includes('private validation diagnostic'),
    false,
  );
  assert.equal(state.validations.length, 1);
  assert.equal(state.authorizations.length, 0);
  assert.equal(state.confirmations.length, 0);
});


test('V2 server gate rejects before database or provider access', async () => {
  const state = harness({ enabled: false });
  const response = await state.invoke();
  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'IP_UPLOAD_V2_DISABLED');
  assert.equal(state.databaseCalls, 0);
  assert.equal(state.authorizations.length, 0);
});
