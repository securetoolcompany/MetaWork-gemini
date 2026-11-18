import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  ipUploadOperationIdentity,
  IpUploadOperationConflict,
} from '../lib/ip-upload-operations.js';
import { validateIpUploadSource } from '../lib/ip-source/validate-upload.js';

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
  ownerId: 'owner-1',
  operationKey: 'abcdef12-abcd-4123-8123-abcdef123456',
  revision: 'revision-1',
  authorizationId: 'authorization-1',
  providerFileId: 'file-1',
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

function matches(record, query) {
  return Object.entries(query).every(([key, expected]) => {
    const actual = field(record, key);

    if (expected && typeof expected === 'object') {
      assert.deepEqual(Object.keys(expected), ['$exists']);
      return actual.exists === expected.$exists;
    }

    return actual.value === expected;
  });
}

function fixture(options = {}) {
  const identity = ipUploadOperationIdentity(input);
  const stored = {
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
  };

  let reads = 0;
  let writes = 0;
  const filters = [];

  const db = {
    collection(name) {
      assert.equal(name, 'ip_upload_operations');

      return {
        async findOne(query) {
          return matches(stored, query) ? structuredClone(stored) : null;
        },
        async updateOne(query, update) {
          filters.push(structuredClone(query));

          if (!matches(stored, query)) {
            return { matchedCount: 0 };
          }

          for (const [path, value] of Object.entries(update.$set)) {
            const keys = path.split('.');
            let target = stored;

            for (const key of keys.slice(0, -1)) {
              target = target[key];
            }

            target[keys.at(-1)] = structuredClone(value);
          }

          writes++;
          return { matchedCount: 1 };
        },
      };
    },
  };

  return {
    stored,
    filters,
    get reads() { return reads; },
    get writes() { return writes; },
    run(overrides = {}) {
      return validateIpUploadSource({
        ...input,
        db,
        now: () => new Date('2026-11-12T18:00:00Z'),
        async readBytes({ operation }) {
          reads++;
          assert.notEqual(operation, stored);
          if (options.readFailure) throw new Error('offline read failure');
          options.mutateOnRead?.(stored);
          return options.invalidBytes
            ? Buffer.alloc(bytes.length, 0)
            : Buffer.from(bytes);
        },
        ...overrides,
      });
    },
  };
}

test('persists a bound exact-byte validation result', async () => {
  const state = fixture();
  const result = await state.run();
  const receipt = state.stored.receipts.source;
  const validation = receipt.sourceValidation;

  assert.equal(result.step, 'source_validated');
  assert.equal(result.resumed, false);
  assert.equal(state.writes, 1);
  assert.equal(receipt.sourceValidationStatus, 'valid');
  assert.equal(validation.inputHash, state.stored.inputHash);
  assert.equal(validation.authorizationId, input.authorizationId);
  assert.equal(validation.providerFileId, input.providerFileId);
  assert.equal(validation.cid, receipt.cid);
  assert.deepEqual(validation.sourceDeclaration, state.stored.sourceDeclaration);
  assert.equal(
    validation.result.sourceHash.hex,
    createHash('sha256').update(bytes).digest('hex'),
  );
  assert.ok(!('processing' in validation.result));

  const filter = state.filters[0];
  assert.equal(filter.ownerId, input.ownerId);
  assert.equal(filter.revision, input.revision);
  assert.equal(filter['receipts.source.sourceValidationStatus'], 'pending');
  assert.deepEqual(
    filter['receipts.source.sourceValidation'],
    { $exists: false },
  );
});

test('repeat validation resumes without replacing its persisted result', async () => {
  const state = fixture();
  await state.run();
  const before = structuredClone(state.stored);

  const result = await state.run({
    now: () => new Date('2026-11-12T19:00:00Z'),
  });

  assert.equal(result.resumed, true);
  assert.equal(state.writes, 1);
  assert.deepEqual(state.stored, before);
});

test('concurrent identical validation writes only once', async () => {
  const state = fixture();
  const results = await Promise.all([state.run(), state.run()]);

  assert.equal(state.writes, 1);
  assert.equal(results.filter(result => !result.resumed).length, 1);
  assert.equal(results.filter(result => result.resumed).length, 1);
});

test('wrong owner, revision, authorization or provider file fails before reading', async () => {
  for (const override of [
    { ownerId: 'owner-2' },
    { revision: 'revision-2' },
    { authorizationId: 'authorization-other' },
    { providerFileId: 'file-other' },
  ]) {
    const state = fixture();
    const before = structuredClone(state.stored);

    await assert.rejects(state.run(override), IpUploadOperationConflict);
    assert.equal(state.reads, 0);
    assert.equal(state.writes, 0);
    assert.deepEqual(state.stored, before);
  }
});

test('invalid or stale receipt is rejected before reading', async () => {
  for (const status of ['invalid', 'stale', undefined]) {
    const state = fixture();
    state.stored.receipts.source.sourceValidationStatus = status;

    await assert.rejects(state.run(), IpUploadOperationConflict);
    assert.equal(state.reads, 0);
    assert.equal(state.writes, 0);
  }
});

test('changes during validation cannot receive a valid write', async () => {
  for (const mutateOnRead of [
    op => { op.revision = 'revision-2'; },
    op => { op.inputHash = 'cd'.repeat(32); },
    op => { op.sourceDeclaration.byteLength++; },
    op => { op.receipts.source.cid = 'different-source-cid'; },
    op => { op.receipts.source.sourceValidationStatus = 'invalid'; },
    op => { op.authorizations.source.associatedProviderFileId = 'other'; },
  ]) {
    const state = fixture({ mutateOnRead });

    await assert.rejects(state.run(), IpUploadOperationConflict);
    assert.equal(state.writes, 0);
    assert.ok(!state.stored.receipts.source.sourceValidation);
  }
});

test('read failure does not mark validation valid', async () => {
  const state = fixture({ readFailure: true });
  const before = structuredClone(state.stored);

  await assert.rejects(state.run(), /offline read failure/);

  assert.equal(state.writes, 0);
  assert.deepEqual(state.stored, before);
});

test('invalid source bytes do not mark validation valid', async () => {
  const state = fixture({ invalidBytes: true });
  const before = structuredClone(state.stored);

  await assert.rejects(state.run());

  assert.equal(state.writes, 0);
  assert.deepEqual(state.stored, before);
});

test('invalid clock cannot persist a validation result', async () => {
  const state = fixture();

  await assert.rejects(
    state.run({ now: () => new Date('invalid') }),
    TypeError,
  );

  assert.equal(state.writes, 0);
});

test('malformed request identifiers fail before reading', async () => {
  const state = fixture();

  for (const override of [
    { revision: '' },
    { authorizationId: ' padded ' },
    { providerFileId: 123 },
  ]) {
    await assert.rejects(state.run(override), TypeError);
  }

  assert.equal(state.reads, 0);
  assert.equal(state.writes, 0);
});

test('resume rejects receipt or provider binding changes during retrieval', async () => {
  for (const mutation of [
    op => { op.receipts.source.cid = 'different-source-cid'; },
    op => { op.receipts.source.providerSize++; },
    op => { op.receipts.source.providerNumberOfFiles = 2; },
    op => { op.receipts.source.provider = 'other'; },
    op => { op.receipts.source.verificationMethod = 'unverified'; },
  ]) {
    let mutate = () => {};
    const state = fixture({ mutateOnRead: op => mutate(op) });

    await state.run();
    const validation = structuredClone(
      state.stored.receipts.source.sourceValidation,
    );

    mutate = mutation;
    await assert.rejects(state.run(), IpUploadOperationConflict);

    assert.equal(state.writes, 1);
    assert.deepEqual(
      state.stored.receipts.source.sourceValidation,
      validation,
    );
  }
});

test('retrieval failure preserves state and a later retry succeeds', async () => {
  const options = { readFailure: true };
  const state = fixture(options);
  const before = structuredClone(state.stored);

  await assert.rejects(state.run(), {
    message: 'offline read failure',
  });

  assert.deepEqual(state.stored, before);
  assert.equal(state.reads, 1);
  assert.equal(state.writes, 0);
  assert.equal(state.filters.length, 0);

  options.readFailure = false;

  const result = await state.run();

  assert.equal(result.step, 'source_validated');
  assert.equal(result.resumed, false);
  assert.equal(state.reads, 2);
  assert.equal(state.writes, 1);
  assert.equal(
    state.stored.receipts.source.sourceValidationStatus,
    'valid',
  );
});

test('pending receipt retaining validation conflicts without repair', async () => {
  const state = fixture();

  await state.run();
  state.stored.receipts.source.sourceValidationStatus = 'pending';

  const before = structuredClone(state.stored);
  const writesBefore = state.writes;

  await assert.rejects(state.run(), IpUploadOperationConflict);

  assert.deepEqual(state.stored, before);
  assert.equal(state.writes, writesBefore);
  assert.equal(state.reads, 2);
});