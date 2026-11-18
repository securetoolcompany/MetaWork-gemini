import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IP_UPLOAD_OPERATIONS_COLLECTION,
  IpUploadOperationConflict,
  ipUploadOperationIdentity,
  createOrResumeIpUploadOperation,
  loadIpUploadOperation,
} from '../lib/ip-upload-operations.js';

const input = {
  ownerId: 'owner-1',
  operationKey: 'abcdef12-abcd-4123-8123-abcdef123456',
  revision: 'revision-1',
  inputHash: 'ab'.repeat(32),
};

function fixture({ insertError, insertWinner } = {}) {
  const records = new Map();
  const queries = [];
  let inserts = 0;

  const db = {
    collection(name) {
      assert.equal(name, IP_UPLOAD_OPERATIONS_COLLECTION);

      return {
        async findOne(filter) {
          queries.push(structuredClone(filter));
          const record = records.get(filter._id);

          if (
            !record ||
            record.ownerId !== filter.ownerId ||
            record.operationKey !== filter.operationKey
          ) {
            return null;
          }

          return structuredClone(record);
        },

        async insertOne(record) {
          inserts++;

          if (insertWinner) {
            const winner = insertWinner(structuredClone(record));
            if (winner) records.set(winner._id, winner);
          }

          if (insertError) throw insertError;

          if (records.has(record._id)) {
            const error = new Error('Duplicate fixture identity');
            error.code = 11000;
            throw error;
          }

          records.set(record._id, structuredClone(record));
          return { insertedId: record._id };
        },
      };
    },
  };

  return {
    db,
    records,
    queries,
    get inserts() { return inserts; },
  };
}

test('operation identity is deterministic and owner-bound', () => {
  const first = ipUploadOperationIdentity(input);

  assert.deepEqual(ipUploadOperationIdentity(input), first);
  assert.notEqual(
    ipUploadOperationIdentity({ ...input, ownerId: 'owner-2' }).id,
    first.id,
  );
  assert.notEqual(
    ipUploadOperationIdentity({
      ...input,
      operationKey: '11111111-1111-4111-8111-111111111111',
    }).id,
    first.id,
  );
});

test('UUID casing normalizes to the same identity', () => {
  assert.deepEqual(
    ipUploadOperationIdentity({
      ...input,
      operationKey: input.operationKey.toUpperCase(),
    }),
    ipUploadOperationIdentity(input),
  );
});

test('invalid identity fields are rejected', () => {
  for (const override of [
    { ownerId: '' },
    { ownerId: ' padded ' },
    { operationKey: 'not-a-uuid' },
  ]) {
    assert.throws(
      () => ipUploadOperationIdentity({ ...input, ...override }),
      TypeError,
    );
  }
});

test('initial creation stores immutable inputs and empty checkpoints', async () => {
  const state = fixture();
  const timestamp = new Date('2026-11-12T17:00:00Z');

  const result = await createOrResumeIpUploadOperation({
    ...input,
    db: state.db,
    now: () => timestamp,
  });

  assert.equal(result.resumed, false);
  assert.equal(state.inserts, 1);
  assert.equal(result.operation.status, 'confirmed');
  assert.equal(result.operation.schemaVersion, 1);
  assert.equal(result.operation.inputHash, input.inputHash);
  assert.equal(result.operation.revision, input.revision);
  assert.deepEqual(result.operation.authorizations, {});
  assert.deepEqual(result.operation.receipts, {});
  assert.deepEqual(result.operation.createdAt, timestamp);
});

test('existing operation resumes without replacing checkpoints', async () => {
  const state = fixture();
  const created = await createOrResumeIpUploadOperation({
    ...input,
    db: state.db,
  });

  const stored = state.records.get(created.operation._id);
  stored.authorizations.source = { id: 'authorization-original' };
  stored.receipts.source = { providerFileId: 'file-original' };
  const before = structuredClone(stored);

  const resumed = await createOrResumeIpUploadOperation({
    ...input,
    db: state.db,
  });

  assert.equal(resumed.resumed, true);
  assert.equal(state.inserts, 1);
  assert.deepEqual(resumed.operation, before);
  assert.deepEqual(state.records.get(stored._id), before);
});

test('different revision or input hash cannot resume or replace operation', async () => {
  const state = fixture();

  await createOrResumeIpUploadOperation({ ...input, db: state.db });
  const before = structuredClone([...state.records.values()]);

  for (const override of [
    { revision: 'revision-2' },
    { inputHash: 'cd'.repeat(32) },
  ]) {
    await assert.rejects(
      createOrResumeIpUploadOperation({
        ...input,
        ...override,
        db: state.db,
      }),
      IpUploadOperationConflict,
    );
  }

  assert.equal(state.inserts, 1);
  assert.deepEqual([...state.records.values()], before);
});

test('concurrent creation inserts once and resumes the winning record', async () => {
  const state = fixture();

  const results = await Promise.all([
    createOrResumeIpUploadOperation({ ...input, db: state.db }),
    createOrResumeIpUploadOperation({ ...input, db: state.db }),
  ]);

  assert.equal(state.records.size, 1);
  assert.equal(results.filter(result => !result.resumed).length, 1);
  assert.equal(results.filter(result => result.resumed).length, 1);
  assert.deepEqual(results[0].operation, results[1].operation);
});

test('duplicate-key error requires a matching winning record', async () => {
  const duplicate = new Error('Duplicate fixture');
  duplicate.code = 11000;

  for (const insertWinner of [
    () => null,
    record => ({ ...record, revision: 'different-revision' }),
    record => ({ ...record, inputHash: 'cd'.repeat(32) }),
    record => ({ ...record, schemaVersion: 999 }),
  ]) {
    const state = fixture({ insertError: duplicate, insertWinner });

    await assert.rejects(
      createOrResumeIpUploadOperation({ ...input, db: state.db }),
      IpUploadOperationConflict,
    );
  }
});

test('non-duplicate database errors propagate without retrying inserts', async () => {
  const failure = new Error('Injected database failure');
  const state = fixture({ insertError: failure });

  await assert.rejects(
    createOrResumeIpUploadOperation({ ...input, db: state.db }),
    error => error === failure,
  );

  assert.equal(state.inserts, 1);
});

test('load requires matching owner and operation identity', async () => {
  const state = fixture();

  await createOrResumeIpUploadOperation({ ...input, db: state.db });

  assert.equal(
    await loadIpUploadOperation({
      ...input,
      ownerId: 'owner-2',
      db: state.db,
    }),
    null,
  );

  const loaded = await loadIpUploadOperation({ ...input, db: state.db });
  assert.equal(loaded.ownerId, input.ownerId);

  for (const query of state.queries) {
    assert.ok(query._id);
    assert.ok(query.ownerId);
    assert.ok(query.operationKey);
  }
});

test('invalid revision, hash and creation clock do not insert', async () => {
  const state = fixture();

  for (const override of [
    { revision: '' },
    { inputHash: 'invalid' },
    { now: () => new Date('invalid') },
    { now: () => 'not-a-date' },
  ]) {
    await assert.rejects(
      createOrResumeIpUploadOperation({
        ...input,
        ...override,
        db: state.db,
      }),
      TypeError,
    );
  }

  assert.equal(state.inserts, 0);
});

test('persistence helpers require an injected database', async () => {
  await assert.rejects(
    createOrResumeIpUploadOperation(input),
    TypeError,
  );

  await assert.rejects(
    loadIpUploadOperation(input),
    TypeError,
  );
});

// Source-declaration persistence regression tests.
const declaredSourceFixture = {
  format: 'png',
  filename: 'fixture.png',
  byteLength: 134,
};

test('source declaration is normalized, copied, and immutable on resume', async () => {
  const state = fixture();
  const declaration = { ...declaredSourceFixture, ignored: 'not persisted' };

  const created = await createOrResumeIpUploadOperation({
    ...input,
    db: state.db,
    sourceDeclaration: declaration,
  });

  assert.deepEqual(
    created.operation.sourceDeclaration,
    declaredSourceFixture,
  );

  declaration.filename = 'mutated.png';

  const before = structuredClone([...state.records.values()]);
  const resumed = await createOrResumeIpUploadOperation({
    ...input,
    db: state.db,
    sourceDeclaration: { ...declaredSourceFixture },
  });

  assert.equal(resumed.resumed, true);
  assert.deepEqual(resumed.operation.sourceDeclaration, declaredSourceFixture);
  assert.deepEqual([...state.records.values()], before);

  for (const sourceDeclaration of [
    undefined,
    { ...declaredSourceFixture, filename: 'changed.png' },
    { ...declaredSourceFixture, byteLength: 135 },
    { ...declaredSourceFixture, format: 'jpeg', filename: 'fixture.jpg' },
  ]) {
    await assert.rejects(
      createOrResumeIpUploadOperation({
        ...input,
        db: state.db,
        sourceDeclaration,
      }),
      IpUploadOperationConflict,
    );
  }

  assert.deepEqual([...state.records.values()], before);
  assert.equal(state.inserts, 1);
});

test('legacy operation cannot be backfilled with a source declaration', async () => {
  const state = fixture();
  await createOrResumeIpUploadOperation({ ...input, db: state.db });
  const before = structuredClone([...state.records.values()]);

  await assert.rejects(
    createOrResumeIpUploadOperation({
      ...input,
      db: state.db,
      sourceDeclaration: declaredSourceFixture,
    }),
    IpUploadOperationConflict,
  );

  assert.deepEqual([...state.records.values()], before);
  assert.equal(state.inserts, 1);
});

test('invalid source declarations fail without inserting an operation', async () => {
  const state = fixture();

  for (const sourceDeclaration of [
    null,
    [],
    {},
    { ...declaredSourceFixture, format: 'constructor' },
    { ...declaredSourceFixture, filename: '../fixture.png' },
    { ...declaredSourceFixture, filename: 'folder\\fixture.png' },
    { ...declaredSourceFixture, filename: 'bad\u0000.png' },
    { ...declaredSourceFixture, filename: 'fixture.jpg' },
    { ...declaredSourceFixture, byteLength: 0 },
    { ...declaredSourceFixture, byteLength: 1.5 },
    { ...declaredSourceFixture, byteLength: 50 * 1024 * 1024 + 1 },
  ]) {
    await assert.rejects(
      createOrResumeIpUploadOperation({
        ...input,
        db: state.db,
        sourceDeclaration,
      }),
      TypeError,
    );
  }

  assert.equal(state.inserts, 0);
  assert.equal(state.records.size, 0);
});

test('duplicate-key winner must have the same source declaration', async () => {
  const duplicate = new Error('Duplicate fixture');
  duplicate.code = 11000;

  const state = fixture({
    insertError: duplicate,
    insertWinner(record) {
      return {
        ...record,
        sourceDeclaration: {
          ...declaredSourceFixture,
          byteLength: 135,
        },
      };
    },
  });

  await assert.rejects(
    createOrResumeIpUploadOperation({
      ...input,
      db: state.db,
      sourceDeclaration: declaredSourceFixture,
    }),
    IpUploadOperationConflict,
  );

  assert.equal(state.inserts, 1);
});

test('equivalent reordered source declarations resume the same operation', async () => {
  const state = fixture();

  await createOrResumeIpUploadOperation({
    ...input,
    db: state.db,
    sourceDeclaration: declaredSourceFixture,
  });

  const resumed = await createOrResumeIpUploadOperation({
    ...input,
    db: state.db,
    sourceDeclaration: {
      byteLength: 134,
      filename: 'fixture.png',
      format: 'png',
    },
  });

  assert.equal(resumed.resumed, true);
  assert.equal(state.inserts, 1);
});
