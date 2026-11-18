import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ipUploadOperationIdentity,
  claimIpUploadAuthorization,
  recordIpUploadIssuance,
  associateVerifiedIpUploadReceipt,
  IpUploadOperationConflict,
} from '../lib/ip-upload-operations.js';

const input = {
  ownerId: 'owner-1',
  operationKey: 'abcdef12-abcd-4123-8123-abcdef123456',
  revision: 'revision-1',
  inputHash: 'ab'.repeat(32),
  purpose: 'source',
  network: 'public',
  maxBytes: 104857600,
  expiresSeconds: 900,
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

// Limited evaluator for this helper's filters, not MongoDB integration.
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

function fixture(overrides = {}) {
  const identity = ipUploadOperationIdentity(input);
  const stored = {
    _id: identity.id,
    ownerId: input.ownerId,
    operationKey: input.operationKey,
    revision: input.revision,
    inputHash: input.inputHash,
    schemaVersion: 1,
    status: 'confirmed',
    authorizations: {},
    receipts: {},
    ...structuredClone(overrides),
  };

  let writes = 0;
  const filters = [];

  const db = {
    collection(name) {
      assert.equal(name, 'ip_upload_operations');

      return {
        async findOne(query) {
          return matches(stored, query)
            ? structuredClone(stored)
            : null;
        },

        async updateOne(query, update) {
          filters.push(structuredClone(query));

          if (!matches(stored, query)) {
            return { matchedCount: 0, modifiedCount: 0 };
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
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
  };

  return {
    db,
    stored,
    filters,
    get writes() { return writes; },
  };
}

test('initial claim persists server-generated authorization and nonce', async () => {
  const state = fixture();
  const result = await claimIpUploadAuthorization({ ...input, db: state.db });

  assert.equal(result.claimed, true);
  assert.equal(state.writes, 1);
  assert.match(result.authorization.authorizationId, /^[a-f0-9-]{36}$/);
  assert.match(result.authorization.bindingNonce, /^[a-f0-9]{64}$/);
  assert.equal(result.authorization.status, 'issuing');
  assert.equal(result.authorization.operationRevision, input.revision);
  assert.deepEqual(state.stored.authorizations.source, result.authorization);
});

test('repeat claim returns existing authorization without replacing it', async () => {
  const state = fixture();
  const first = await claimIpUploadAuthorization({ ...input, db: state.db });
  const before = structuredClone(state.stored);
  const second = await claimIpUploadAuthorization({ ...input, db: state.db });

  assert.equal(second.claimed, false);
  assert.deepEqual(second.authorization, first.authorization);
  assert.deepEqual(state.stored, before);
  assert.equal(state.writes, 1);
});

test('concurrent claims have exactly one winning authorization', async () => {
  const state = fixture();
  const results = await Promise.all([
    claimIpUploadAuthorization({ ...input, db: state.db }),
    claimIpUploadAuthorization({ ...input, db: state.db }),
    claimIpUploadAuthorization({ ...input, db: state.db }),
  ]);

  assert.equal(results.filter(result => result.claimed).length, 1);
  assert.equal(state.writes, 1);
  assert.equal(
    new Set(results.map(result => result.authorization.authorizationId)).size,
    1,
  );
});

test('owner, operation, revision and input hash mismatches cannot claim', async () => {
  for (const override of [
    { ownerId: 'owner-2' },
    { operationKey: '11111111-1111-4111-8111-111111111111' },
    { revision: 'revision-2' },
    { inputHash: 'cd'.repeat(32) },
  ]) {
    const state = fixture();
    const before = structuredClone(state.stored);

    await assert.rejects(
      claimIpUploadAuthorization({ ...input, ...override, db: state.db }),
      IpUploadOperationConflict,
    );

    assert.equal(state.writes, 0);
    assert.deepEqual(state.stored, before);
  }
});

test('receipt blocks a new authorization even when the slot is absent', async () => {
  const state = fixture({
    receipts: { source: { providerFileId: 'existing-file' } },
  });
  const before = structuredClone(state.stored);

  await assert.rejects(
    claimIpUploadAuthorization({ ...input, db: state.db }),
    IpUploadOperationConflict,
  );

  assert.equal(state.writes, 0);
  assert.deepEqual(state.stored, before);
});

test('source and thumbnail use independent slots and nonces', async () => {
  const state = fixture();
  const source = await claimIpUploadAuthorization({ ...input, db: state.db });
  const thumbnail = await claimIpUploadAuthorization({
    ...input,
    db: state.db,
    purpose: 'display_thumbnail',
    maxBytes: 1024,
    allowedMimeTypes: ['image/png'],
  });

  assert.equal(source.claimed, true);
  assert.equal(thumbnail.claimed, true);
  assert.notEqual(
    source.authorization.authorizationId,
    thumbnail.authorization.authorizationId,
  );
  assert.notEqual(
    source.authorization.bindingNonce,
    thumbnail.authorization.bindingNonce,
  );
  assert.equal(state.writes, 2);
});

test('existing claim cannot be retargeted with different constraints', async () => {
  const state = fixture();
  await claimIpUploadAuthorization({ ...input, db: state.db });
  const before = structuredClone(state.stored);

  for (const override of [
    { network: 'private' },
    { maxBytes: 1024 },
    { expiresSeconds: 60 },
    { allowedMimeTypes: ['image/png'] },
  ]) {
    await assert.rejects(
      claimIpUploadAuthorization({ ...input, ...override, db: state.db }),
      IpUploadOperationConflict,
    );
  }

  assert.equal(state.writes, 1);
  assert.deepEqual(state.stored, before);
});

test('issued, unknown, associated and expired claims are never replaced', async () => {
  for (const status of ['issued', 'issuance_unknown', 'associated', 'expired']) {
    const state = fixture();
    await claimIpUploadAuthorization({ ...input, db: state.db });
    state.stored.authorizations.source.status = status;
    const before = structuredClone(state.stored);

    const result = await claimIpUploadAuthorization({ ...input, db: state.db });

    assert.equal(result.claimed, false);
    assert.equal(result.authorization.status, status);
    assert.equal(state.writes, 1);
    assert.deepEqual(state.stored, before);
  }
});

test('wrong parent state or malformed checkpoint containers cannot claim', async () => {
  for (const override of [
    { status: 'complete' },
    { authorizations: null },
    { authorizations: [] },
    { receipts: null },
    { receipts: [] },
    { schemaVersion: 2 },
  ]) {
    const state = fixture(override);
    const before = structuredClone(state.stored);

    await assert.rejects(
      claimIpUploadAuthorization({ ...input, db: state.db }),
      IpUploadOperationConflict,
    );

    assert.equal(state.writes, 0);
    assert.deepEqual(state.stored, before);
  }
});

test('invalid constraints are rejected before any write', async () => {
  const state = fixture();

  for (const override of [
    { purpose: 'stl_source' },
    { network: undefined },
    { maxBytes: 0 },
    { expiresSeconds: 901 },
    { allowedMimeTypes: [] },
    { allowedMimeTypes: ['invalid'] },
    { now: () => new Date('invalid') },
  ]) {
    await assert.rejects(
      claimIpUploadAuthorization({ ...input, ...override, db: state.db }),
      TypeError,
    );
  }

  assert.equal(state.filters.length, 0);
  assert.equal(state.writes, 0);
});

async function claimedFixture() {
  const state = fixture();
  const result = await claimIpUploadAuthorization({
    ...input,
    db: state.db,
  });

  return {
    state,
    issuance: {
      ...input,
      db: state.db,
      authorizationId: result.authorization.authorizationId,
      outcome: 'issued',
      expiresAt: '2026-11-12T17:30:00.000Z',
      now: () => new Date('2026-11-12T17:15:00.000Z'),
    },
  };
}

test('issued outcome persists expiry without storing a capability', async () => {
  const { state, issuance } = await claimedFixture();
  const result = await recordIpUploadIssuance(issuance);

  assert.equal(result.updated, true);
  assert.equal(result.authorization.status, 'issued');
  assert.equal(result.authorization.expiresAt, issuance.expiresAt);
  assert.deepEqual(
    result.authorization.issuedAt,
    new Date('2026-11-12T17:15:00.000Z'),
  );
  assert.equal(state.writes, 2);
  assert.ok(!('uploadUrl' in result.authorization));
  assert.ok(!('JWT' in result.authorization));
});

test('same issuance result is idempotent without another write', async () => {
  const { state, issuance } = await claimedFixture();
  await recordIpUploadIssuance(issuance);
  const before = structuredClone(state.stored);

  const repeated = await recordIpUploadIssuance(issuance);

  assert.equal(repeated.updated, false);
  assert.equal(state.writes, 2);
  assert.deepEqual(state.stored, before);
});

test('unknown issuance stays blocked and cannot be rewritten as issued', async () => {
  const { state, issuance } = await claimedFixture();
  const unknown = {
    ...issuance,
    outcome: 'issuance_unknown',
    expiresAt: undefined,
  };

  const first = await recordIpUploadIssuance(unknown);
  assert.equal(first.updated, true);
  assert.equal(first.authorization.status, 'issuance_unknown');
  assert.ok(!('expiresAt' in first.authorization));

  const repeated = await recordIpUploadIssuance(unknown);
  assert.equal(repeated.updated, false);

  const retry = await claimIpUploadAuthorization({
    ...input,
    db: state.db,
  });
  assert.equal(retry.claimed, false);
  assert.equal(retry.authorization.status, 'issuance_unknown');

  const before = structuredClone(state.stored);

  await assert.rejects(
    recordIpUploadIssuance(issuance),
    IpUploadOperationConflict,
  );

  assert.deepEqual(state.stored, before);
  assert.equal(state.writes, 2);
});

test('mismatched identity or purpose cannot record issuance', async () => {
  for (const override of [
    { ownerId: 'owner-2' },
    { operationKey: '11111111-1111-4111-8111-111111111111' },
    { revision: 'revision-2' },
    { inputHash: 'cd'.repeat(32) },
    { authorizationId: 'different-authorization' },
    { purpose: 'display_thumbnail' },
  ]) {
    const { state, issuance } = await claimedFixture();
    const before = structuredClone(state.stored);

    await assert.rejects(
      recordIpUploadIssuance({ ...issuance, ...override }),
      IpUploadOperationConflict,
    );

    assert.equal(state.writes, 1);
    assert.deepEqual(state.stored, before);
  }
});

test('recorded issuance cannot change expiry or overwrite an associated receipt', async () => {
  const { state, issuance } = await claimedFixture();
  await recordIpUploadIssuance(issuance);
  const before = structuredClone(state.stored);

  await assert.rejects(
    recordIpUploadIssuance({
      ...issuance,
      expiresAt: '2026-11-12T18:00:00.000Z',
    }),
    IpUploadOperationConflict,
  );

  assert.deepEqual(state.stored, before);

  state.stored.authorizations.source.status = 'associated';
  state.stored.receipts.source = { providerFileId: 'file-original' };
  const associated = structuredClone(state.stored);

  await assert.rejects(
    recordIpUploadIssuance(issuance),
    IpUploadOperationConflict,
  );

  assert.deepEqual(state.stored, associated);
});

test('competing issuance outcomes cannot overwrite each other', async () => {
  const { state, issuance } = await claimedFixture();

  const results = await Promise.allSettled([
    recordIpUploadIssuance(issuance),
    recordIpUploadIssuance({
      ...issuance,
      outcome: 'issuance_unknown',
      expiresAt: undefined,
    }),
  ]);

  assert.equal(
    results.filter(result => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    results.filter(result => result.status === 'rejected').length,
    1,
  );
  assert.equal(state.writes, 2);

  const rejected = results.find(result => result.status === 'rejected');
  assert.ok(rejected.reason instanceof IpUploadOperationConflict);
});

test('invalid issuance outcome, expiry and clock do not write', async () => {
  const { state, issuance } = await claimedFixture();
  const before = structuredClone(state.stored);

  for (const override of [
    { outcome: 'failed' },
    { expiresAt: undefined },
    { expiresAt: 'invalid-date' },
    { outcome: 'issuance_unknown' },
    { now: () => new Date('invalid') },
  ]) {
    await assert.rejects(
      recordIpUploadIssuance({ ...issuance, ...override }),
      TypeError,
    );
  }

  assert.equal(state.writes, 1);
  assert.deepEqual(state.stored, before);
});

async function receiptFixture(outcome = 'issued') {
  const { state, issuance } = await claimedFixture();

  await recordIpUploadIssuance({
    ...issuance,
    outcome,
    expiresAt: outcome === 'issued' ? issuance.expiresAt : undefined,
  });

  const receipt = {
    provider: 'pinata',
    providerFileId: 'file-original',
    network: input.network,
    cid: 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m',
    providerSize: 134,
    providerMimeType: 'application/octet-stream',
    providerNumberOfFiles: 1,
    providerGroupId: null,
    providerCreatedAt: '2026-11-12T17:20:00.000Z',
    authorizationId: issuance.authorizationId,
    operationRevision: input.revision,
    purpose: input.purpose,
    verificationMethod: 'pinata_authenticated_file_lookup',
  };

  return {
    state,
    receipt,
    args: {
      ...input,
      db: state.db,
      verifiedReceipt: receipt,
      now: () => new Date('2026-11-12T17:21:00.000Z'),
    },
  };
}

test('receipt association persists only allowlisted fields', async () => {
  const { state, receipt, args } = await receiptFixture();
  const result = await associateVerifiedIpUploadReceipt({
    ...args,
    verifiedReceipt: {
      ...receipt,
      JWT: 'must-not-store',
      uploadUrl: 'must-not-store',
      extra: 'must-not-store',
    },
  });

  assert.equal(result.associated, true);
  assert.equal(result.receipt.providerFileId, receipt.providerFileId);
  assert.equal(result.receipt.sourceValidationStatus, 'pending');
  assert.equal(state.stored.authorizations.source.status, 'associated');
  assert.equal(
    state.stored.authorizations.source.associatedProviderFileId,
    receipt.providerFileId,
  );
  assert.ok(!('JWT' in result.receipt));
  assert.ok(!('uploadUrl' in result.receipt));
  assert.ok(!('extra' in result.receipt));
  assert.equal(state.writes, 3);
});

test('same receipt retries without replacing timestamps or validation state', async () => {
  const { state, args } = await receiptFixture();
  await associateVerifiedIpUploadReceipt(args);
  state.stored.receipts.source.sourceValidationStatus = 'valid';
  const before = structuredClone(state.stored);

  const repeated = await associateVerifiedIpUploadReceipt({
    ...args,
    now: () => new Date('2026-11-12T18:00:00.000Z'),
  });

  assert.equal(repeated.associated, false);
  assert.equal(repeated.receipt.sourceValidationStatus, 'valid');
  assert.deepEqual(state.stored, before);
  assert.equal(state.writes, 3);
});

test('a different file or changed receipt cannot replace association', async () => {
  const { state, receipt, args } = await receiptFixture();
  await associateVerifiedIpUploadReceipt(args);
  const before = structuredClone(state.stored);

  for (const override of [
    { providerFileId: 'file-other' },
    { cid: 'different-provider-source-cid' },
    { providerSize: 135 },
  ]) {
    await assert.rejects(
      associateVerifiedIpUploadReceipt({
        ...args,
        verifiedReceipt: { ...receipt, ...override },
      }),
      IpUploadOperationConflict,
    );
  }

  assert.deepEqual(state.stored, before);
  assert.equal(state.writes, 3);
});

test('concurrent same-file association writes exactly once', async () => {
  const { state, args } = await receiptFixture();

  const results = await Promise.all([
    associateVerifiedIpUploadReceipt(args),
    associateVerifiedIpUploadReceipt(args),
  ]);

  assert.equal(results.filter(result => result.associated).length, 1);
  assert.equal(results.filter(result => !result.associated).length, 1);
  assert.equal(state.writes, 3);
});

test('concurrent different files cannot both associate', async () => {
  const { state, receipt, args } = await receiptFixture();

  const results = await Promise.allSettled([
    associateVerifiedIpUploadReceipt(args),
    associateVerifiedIpUploadReceipt({
      ...args,
      verifiedReceipt: { ...receipt, providerFileId: 'file-other' },
    }),
  ]);

  assert.equal(
    results.filter(result => result.status === 'fulfilled').length,
    1,
  );
  const rejected = results.filter(result => result.status === 'rejected');
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof IpUploadOperationConflict);
  assert.equal(state.writes, 3);
});

test('wrong owner, revision, authorization or network cannot associate', async () => {
  for (const override of [
    { ownerId: 'owner-2' },
    { revision: 'revision-2' },
    { inputHash: 'cd'.repeat(32) },
  ]) {
    const { state, args } = await receiptFixture();
    const before = structuredClone(state.stored);

    await assert.rejects(
      associateVerifiedIpUploadReceipt({ ...args, ...override }),
    );

    assert.deepEqual(state.stored, before);
  }

  for (const override of [
    { authorizationId: 'authorization-other' },
    { network: 'private' },
  ]) {
    const { state, receipt, args } = await receiptFixture();
    const before = structuredClone(state.stored);

    await assert.rejects(
      associateVerifiedIpUploadReceipt({
        ...args,
        verifiedReceipt: { ...receipt, ...override },
      }),
      IpUploadOperationConflict,
    );

    assert.deepEqual(state.stored, before);
  }
});

test('invalid receipt fields and excessive size do not write', async () => {
  for (const override of [
    { purpose: 'display_thumbnail' },
    { operationRevision: 'revision-other' },
    { providerNumberOfFiles: 2 },
    { providerSize: 0 },
    { providerSize: input.maxBytes + 1 },
    { verificationMethod: 'client-supplied' },
    { providerCreatedAt: 'invalid' },
  ]) {
    const { state, receipt, args } = await receiptFixture();
    const before = structuredClone(state.stored);

    await assert.rejects(
      associateVerifiedIpUploadReceipt({
        ...args,
        verifiedReceipt: { ...receipt, ...override },
      }),
    );

    assert.deepEqual(state.stored, before);
    assert.equal(state.writes, 2);
  }
});

test('unknown issuance can associate verified upload without reissuance', async () => {
  const { state, args } = await receiptFixture('issuance_unknown');
  const authorizationId =
    state.stored.authorizations.source.authorizationId;

  const result = await associateVerifiedIpUploadReceipt(args);

  assert.equal(result.associated, true);
  assert.equal(state.stored.authorizations.source.status, 'associated');
  assert.equal(
    state.stored.authorizations.source.authorizationId,
    authorizationId,
  );
  assert.equal(state.writes, 3);
});
