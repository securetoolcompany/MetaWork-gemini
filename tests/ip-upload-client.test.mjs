import assert from 'node:assert/strict';
import test from 'node:test';
import { createIpUploadClient } from '../lib/ip-upload-client.js';

function fixture(options = {}) {
  const calls = [];
  let current = true;
  let confirmations = 0;
  let validations = 0;

  const authorizationRequest = {
    action: 'authorize',
    operationKey: 'abcdef12-abcd-4123-8123-abcdef123456',
    revision: 'revision-1',
    purpose: 'source',
    confirmTokenization: true,
    draft: { name: 'Fixture' },
    source: {
      format: 'png',
      filename: 'fixture.png',
      byteLength: 3,
    },
  };

  const client = createIpUploadClient({
    file: new Blob(['png'], { type: 'image/png' }),
    authorizationRequest,
    getAuthHeaders: () => ({ Authorization: 'Bearer offline-token' }),
    isCurrent: () => current,
    async fetchImpl(url, init) {
      calls.push({ url, init });

      if (url === '/api/ipfs/key') {
        assert.equal(init.method, 'POST');
        assert.equal(init.cache, 'no-store');
        assert.equal(init.redirect, 'error');
        assert.equal(
          init.headers['x-metawork-upload-version'],
          '2',
        );
        assert.equal(
          init.headers.Authorization,
          'Bearer offline-token',
        );

        const payload = JSON.parse(init.body);

        if (payload.action === 'authorize') {
          if (options.authorizeFailure) {
            throw new Error('offline failure');
          }

          if (options.recovery) {
            return Response.json(
              { step: 'upload_recovery_required' },
              { status: 409 },
            );
          }

          if (options.staleAfterAuthorize) current = false;

          return Response.json({
            step: 'upload_authorized',
            authorization: {
              authorizationId: 'authorization-1',
              purpose: 'source',
              network: 'public',
            },
            upload: {
              method: 'POST',
              network: 'public',
              url: options.uploadUrl ||
                'https://uploads.pinata.cloud/v3/files?signature=offline',
            },
          });
        }

        if (payload.action === 'validate') {
          validations++;

          assert.deepEqual(payload, {
            action: 'validate',
            operationKey: 'abcdef12-abcd-4123-8123-abcdef123456',
            revision: 'revision-1',
            purpose: 'source',
            authorizationId: 'authorization-1',
            providerFileId: 'file-1',
          });

          if (options.failFirstValidate && validations === 1) {
            throw new Error('offline validation failure');
          }

          if (options.staleAfterValidate) current = false;

          return Response.json({
            step: 'source_validated',
            operationKey: payload.operationKey,
            revision: payload.revision,
            authorizationId: payload.authorizationId,
            providerFileId: payload.providerFileId,
            validationStatus: 'valid',
            resumed: false,
          });
        }

        assert.equal(payload.action, 'confirm');
        confirmations++;

        if (options.failFirstConfirm && confirmations === 1) {
          throw new Error('offline confirmation failure');
        }

        return Response.json({
          step: 'upload_received',
          operationKey: payload.operationKey,
          revision: payload.revision,
          purpose: 'source',
          authorizationId: payload.authorizationId,
          providerFileId: payload.providerFileId,
          network: 'public',
          validationStatus: options.alreadyValidReceipt ? 'valid' : 'pending',
        });
      }

      assert.equal(
        url,
        'https://uploads.pinata.cloud/v3/files?signature=offline',
      );

      if (options.uploadFailure) {
        throw new Error('offline upload failure');
      }

      if (options.staleAfterUpload) current = false;

      return Response.json({
        data: { id: 'file-1', cid: 'untrusted-cid' },
      });
    },
  });

  return { client, calls, authorizationRequest };
}

test('V2 authorizes, uploads, confirms identifiers, and validates', async () => {
  const { client, calls } = fixture();
  const result = await client.run();

  assert.equal(calls.length, 4);
  assert.equal(result.step, 'source_validated');
  assert.equal(result.validationStatus, 'valid');
  assert.equal(client.snapshot().phase, 'validated');

  const upload = calls[1].init;
  assert.equal(upload.body.get('network'), 'public');
  assert.ok(upload.body.get('file') instanceof Blob);
  assert.equal(upload.method, 'POST');
  assert.equal(upload.redirect, 'error');
  assert.equal(upload.credentials, 'omit');
  assert.ok(!upload.headers);

  const confirmation = JSON.parse(calls[2].init.body);
  assert.deepEqual(confirmation, {
    action: 'confirm',
    operationKey: 'abcdef12-abcd-4123-8123-abcdef123456',
    revision: 'revision-1',
    purpose: 'source',
    authorizationId: 'authorization-1',
    providerFileId: 'file-1',
  });
  assert.ok(!('cid' in result));

  await client.run();
  assert.equal(calls.length, 4);
});

test('authorization snapshot is independent of later object mutation', async () => {
  const state = fixture();
  state.authorizationRequest.draft.name = 'Changed';

  await state.client.run();

  assert.equal(
    JSON.parse(state.calls[0].init.body).draft.name,
    'Fixture',
  );
});

test('uncertain issuance or upload never automatically repeats or falls back', async () => {
  for (const options of [
    { authorizeFailure: true },
    { recovery: true },
    { uploadFailure: true },
  ]) {
    const { client, calls } = fixture(options);

    await assert.rejects(client.run());
    const before = calls.length;

    await assert.rejects(client.run(), /recovery/i);
    assert.equal(calls.length, before);
    assert.equal(client.snapshot().phase, 'recovery_required');
  }
});

test('receipt retry preserves identifiers and never uploads again', async () => {
  const { client, calls } = fixture({ failFirstConfirm: true });

  await assert.rejects(client.run());
  assert.equal(client.snapshot().phase, 'receipt_pending');

  await client.run();

  assert.equal(calls.length, 5);
  assert.deepEqual(
    JSON.parse(calls[2].init.body),
    JSON.parse(calls[3].init.body),
  );
  assert.equal(JSON.parse(calls[4].init.body).action, 'validate');
  assert.equal(client.snapshot().phase, 'validated');
});

test('stale responses cannot continue to upload or confirmation', async () => {
  for (const [options, expectedCalls] of [
    [{ staleAfterAuthorize: true }, 1],
    [{ staleAfterUpload: true }, 2],
  ]) {
    const { client, calls } = fixture(options);

    await assert.rejects(client.run(), /inputs changed/i);
    assert.equal(calls.length, expectedCalls);
  }
});

test('unexpected signed URL destinations are rejected before upload', async () => {
  const { client, calls } = fixture({
    uploadUrl: 'https://example.com/v3/files?signature=offline',
  });

  await assert.rejects(client.run(), /destination/i);
  assert.equal(calls.length, 1);
});

test('concurrent calls cannot start duplicate authorization', async () => {
  const { client, calls } = fixture();

  const first = client.run();
  await assert.rejects(client.run(), /already active/i);
  await first;

  assert.equal(calls.length, 4);
});

test('validation retry never repeats authorization, upload, or confirmation', async () => {
  const { client, calls } = fixture({ failFirstValidate: true });

  await assert.rejects(client.run(), /offline validation failure/);
  assert.equal(client.snapshot().phase, 'received');
  assert.equal(calls.length, 4);

  const result = await client.run();

  assert.equal(result.validationStatus, 'valid');
  assert.equal(client.snapshot().phase, 'validated');
  assert.equal(calls.length, 5);
  assert.deepEqual(
    JSON.parse(calls[3].init.body),
    JSON.parse(calls[4].init.body),
  );

  const routeActions = calls
    .filter(call => call.url === '/api/ipfs/key')
    .map(call => JSON.parse(call.init.body).action);

  assert.deepEqual(routeActions, [
    'authorize',
    'confirm',
    'validate',
    'validate',
  ]);

  await client.run();
  assert.equal(calls.length, 5);
});

test('already-valid receipt continues through authoritative validation', async () => {
  const { client, calls } = fixture({ alreadyValidReceipt: true });
  const result = await client.run();

  assert.equal(result.validationStatus, 'valid');
  assert.equal(client.snapshot().phase, 'validated');
  assert.equal(calls.length, 4);
  assert.equal(JSON.parse(calls[3].init.body).action, 'validate');
});

test('stale validation response cannot complete the client operation', async () => {
  const { client, calls } = fixture({ staleAfterValidate: true });

  await assert.rejects(client.run(), /inputs changed/i);
  assert.equal(calls.length, 4);
  assert.equal(client.snapshot().phase, 'received');

  await assert.rejects(client.run(), /inputs changed/i);
  assert.equal(calls.length, 4);
});
