import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorizeIpUpload,
  confirmIpUpload,
} from '../lib/ip-upload-service.js';
import { createIpUploadBinding } from '../lib/pinata.js';
import { IpUploadOperationConflict } from '../lib/ip-upload-operations.js';

const input = {
  ownerId: 'owner-1',
  operationKey: 'abcdef12-abcd-4123-8123-abcdef123456',
  revision: 'revision-1',
  inputHash: 'ab'.repeat(32),
  purpose: 'source',
  maxBytes: 104857600,
  allowedMimeTypes: ['application/octet-stream'],
};

function field(record, path) {
  let value = record;

  for (const key of path.split('.')) {
    if (
      value === null ||
      typeof value !== 'object' ||
      !Object.prototype.hasOwnProperty.call(value, key)
    ) {
      return { exists: false, value: undefined };
    }
    value = value[key];
  }

  return { exists: true, value };
}

// Limited fixture evaluator, not MongoDB integration.
function matches(record, query) {
  return Object.entries(query).every(([key, condition]) => {
    const actual = field(record, key);

    if (condition && typeof condition === 'object') {
      return Object.entries(condition).every(([operator, expected]) => {
        if (operator === '$exists') return actual.exists === expected;
        if (operator === '$in') return expected.includes(actual.value);
        if (operator === '$type' && expected === 'object') {
          return actual.value !== null &&
            typeof actual.value === 'object' &&
            !Array.isArray(actual.value);
        }
        throw new Error(`Unsupported fixture operator: ${operator}`);
      });
    }

    return actual.value === condition;
  });
}

function fixture(options = {}) {
  const records = new Map();
  const calls = [];

  const db = {
    collection(name) {
      assert.equal(name, 'ip_upload_operations');

      return {
        async findOne(query) {
          const record = [...records.values()].find(item => matches(item, query));
          return record ? structuredClone(record) : null;
        },

        async insertOne(record) {
          if (records.has(record._id)) {
            const error = new Error('Duplicate fixture identity');
            error.code = 11000;
            throw error;
          }
          records.set(record._id, structuredClone(record));
          return { insertedId: record._id };
        },

        async updateOne(query, update) {
          if (
            options.failIssuedWrite &&
            update.$set['authorizations.source.status'] === 'issued'
          ) {
            throw new Error('Injected persistence failure');
          }

          const record = [...records.values()].find(item => matches(item, query));

          if (!record) return { matchedCount: 0, modifiedCount: 0 };

          for (const [path, value] of Object.entries(update.$set)) {
            const keys = path.split('.');
            let target = record;

            for (const key of keys.slice(0, -1)) {
              target = target[key];
            }

            target[keys.at(-1)] = structuredClone(value);
          }

          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
  };

  const providerDependencies = {
    jwt: 'offline-platform-secret',
    async fetchImpl(url, init) {
      calls.push({ url, method: init.method });

      if (url === 'https://uploads.pinata.cloud/v3/files/sign') {
        if (options.failSigning) {
          throw new Error('Sensitive provider failure offline-platform-secret');
        }

        return Response.json({
          data: 'https://uploads.pinata.cloud/v3/files?signature=offline-secret',
        });
      }

      assert.equal(
        url,
        'https://api.pinata.cloud/v3/files/public/file-1',
      );

      const operation = [...records.values()][0];
      const authorization = operation.authorizations.source;
      const binding = createIpUploadBinding(authorization);

      return Response.json({
        data: {
          id: 'file-1',
          cid: 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m',
          size: 134,
          number_of_files: 1,
          mime_type: 'application/octet-stream',
          group_id: null,
          created_at: '2026-11-12T17:00:00.000Z',
          keyvalues: options.wrongBinding
            ? { ...binding, mw_authorization: 'wrong-authorization' }
            : binding,
        },
      });
    },
  };

  return {
    db,
    calls,
    records,
    providerDependencies,
    get operation() { return [...records.values()][0]; },
    authorize(override = {}) {
      return authorizeIpUpload({
        ...input,
        db,
        providerDependencies,
        ...override,
      });
    },
    confirm(authorization, override = {}) {
      return confirmIpUpload({
        db,
        ownerId: input.ownerId,
        operationKey: input.operationKey,
        revision: input.revision,
        purpose: input.purpose,
        authorizationId: authorization.authorizationId,
        providerFileId: 'file-1',
        providerDependencies,
        ...override,
      });
    },
  };
}

test('authorization persists issuance before returning selected capability fields', async () => {
  const state = fixture();
  const result = await state.authorize();

  assert.equal(result.step, 'upload_authorized');
  assert.equal(result.authorization.network, 'public');
  assert.equal(state.operation.authorizations.source.status, 'issued');
  assert.equal(result.upload.method, 'POST');
  assert.equal(result.upload.network, 'public');
  assert.ok(result.upload.url.includes('signature='));
  assert.ok(!JSON.stringify(result.authorization).includes('bindingNonce'));
  assert.ok(!JSON.stringify(state.operation).includes('signature='));
  assert.ok(!JSON.stringify(state.operation).includes('offline-platform-secret'));
});

test('repeat authorization does not issue another provider capability', async () => {
  const state = fixture();
  const first = await state.authorize();
  const second = await state.authorize();

  assert.equal(second.step, 'upload_recovery_required');
  assert.equal(
    second.authorization.authorizationId,
    first.authorization.authorizationId,
  );
  assert.ok(!('upload' in second));
  assert.equal(state.calls.length, 1);
});

test('concurrent authorization requests issue at most one capability', async () => {
  const state = fixture();
  const results = await Promise.all([
    state.authorize(),
    state.authorize(),
  ]);

  assert.equal(
    results.filter(result => result.step === 'upload_authorized').length,
    1,
  );
  assert.equal(state.calls.length, 1);
  assert.equal(state.records.size, 1);
});

test('confirmation performs provider lookup and leaves source validation pending', async () => {
  const state = fixture();
  const issued = await state.authorize();
  const result = await state.confirm(issued.authorization);

  assert.equal(result.step, 'upload_received');
  assert.equal(result.validationStatus, 'pending');
  assert.equal(result.resumed, false);
  assert.equal(state.operation.authorizations.source.status, 'associated');
  assert.equal(state.operation.receipts.source.providerFileId, 'file-1');
  assert.equal(state.calls.length, 2);
  assert.ok(!('cid' in result));
  assert.ok(!JSON.stringify(result).includes('bindingNonce'));
  assert.ok(!JSON.stringify(result).includes('signature='));
});

test('receipt confirmation is idempotent for the same provider file', async () => {
  const state = fixture();
  const issued = await state.authorize();
  await state.confirm(issued.authorization);
  const before = structuredClone(state.operation);

  const repeated = await state.confirm(issued.authorization);

  assert.equal(repeated.resumed, true);
  assert.deepEqual(state.operation, before);
});

test('wrong owner, revision, purpose or authorization is rejected before provider lookup', async () => {
  const state = fixture();
  const issued = await state.authorize();
  const before = structuredClone(state.operation);

  for (const override of [
    { ownerId: 'owner-2' },
    { revision: 'revision-other' },
    { purpose: 'display_thumbnail' },
    { authorizationId: 'authorization-other' },
  ]) {
    await assert.rejects(
      state.confirm(issued.authorization, override),
      IpUploadOperationConflict,
    );
  }

  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.operation, before);
});

test('provider binding mismatch cannot persist a receipt', async () => {
  const state = fixture({ wrongBinding: true });
  const issued = await state.authorize();

  await assert.rejects(
    state.confirm(issued.authorization),
    /binding verification failed/,
  );

  assert.deepEqual(state.operation.receipts, {});
  assert.equal(state.operation.authorizations.source.status, 'issued');
});

test('provider issuance error preserves uncertainty and blocks automatic reissuance', async () => {
  const state = fixture({ failSigning: true });

  await assert.rejects(
    state.authorize(),
    error => error.message === 'IP upload authorization requires recovery',
  );

  assert.equal(
    state.operation.authorizations.source.status,
    'issuance_unknown',
  );

  const retry = await state.authorize();
  assert.equal(retry.step, 'upload_recovery_required');
  assert.ok(!('upload' in retry));
  assert.equal(state.calls.length, 1);
});

test('failed issuance persistence never returns the signed capability', async () => {
  const state = fixture({ failIssuedWrite: true });

  await assert.rejects(
    state.authorize(),
    error => error.message === 'IP upload authorization requires recovery',
  );

  assert.equal(state.operation.authorizations.source.status, 'issuing');

  const retry = await state.authorize();
  assert.equal(retry.step, 'upload_recovery_required');
  assert.ok(!('upload' in retry));
  assert.equal(state.calls.length, 1);
});

test('changed operation input hash cannot obtain another capability', async () => {
  const state = fixture();
  await state.authorize();

  await assert.rejects(
    state.authorize({ inputHash: 'cd'.repeat(32) }),
    IpUploadOperationConflict,
  );

  assert.equal(state.calls.length, 1);
});

// Source-declaration service forwarding regression test.
test('authorization service persists the declared source with its operation', async () => {
  const state = fixture();
  const sourceDeclaration = {
    format: 'png',
    filename: 'fixture.png',
    byteLength: 134,
  };

  const result = await state.authorize({ sourceDeclaration });

  assert.equal(result.step, 'upload_authorized');
  assert.deepEqual(state.operation.sourceDeclaration, sourceDeclaration);

  const before = structuredClone(state.operation);

  await assert.rejects(
    state.authorize({
      sourceDeclaration: { ...sourceDeclaration, byteLength: 135 },
    }),
    IpUploadOperationConflict,
  );

  assert.deepEqual(state.operation, before);
  assert.equal(state.calls.length, 1);
});
