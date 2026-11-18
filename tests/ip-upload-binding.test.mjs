import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createIpUploadBinding,
  assertIpUploadBinding,
} from '../lib/pinata.js';

const authorization = {
  authorizationId: 'authorization-1',
  operationRevision: 'revision-1',
  purpose: 'source',
  bindingNonce: 'ab'.repeat(32),
};

test('source binding is media-independent and immutable', () => {
  const binding = createIpUploadBinding(authorization);

  assert.ok(Object.isFrozen(binding));
  assert.deepEqual(binding, {
    mw_binding_version: '1',
    mw_authorization: 'authorization-1',
    mw_revision: 'revision-1',
    mw_purpose: 'source',
    mw_binding: 'ab'.repeat(32),
  });
});

test('matching provider binding is accepted', () => {
  assert.equal(
    assertIpUploadBinding(
      createIpUploadBinding(authorization),
      authorization,
    ),
    true,
  );
});

test('every required binding value must match', () => {
  const binding = createIpUploadBinding(authorization);

  for (const key of Object.keys(binding)) {
    assert.throws(
      () => assertIpUploadBinding(
        { ...binding, [key]: 'different' },
        authorization,
      ),
      /IP upload binding verification failed/,
    );

    const missing = { ...binding };
    delete missing[key];

    assert.throws(
      () => assertIpUploadBinding(missing, authorization),
      /IP upload binding verification failed/,
    );
  }
});

test('thumbnail and source authorizations are not interchangeable', () => {
  assert.throws(
    () => assertIpUploadBinding(
      createIpUploadBinding({
        ...authorization,
        purpose: 'display_thumbnail',
      }),
      authorization,
    ),
    /IP upload binding verification failed/,
  );
});

test('CID, filename and unrelated client tags do not establish binding', () => {
  assert.throws(
    () => assertIpUploadBinding({
      cid: 'client-cid',
      filename: 'example.stl',
      operation: 'client-operation',
    }, authorization),
    /IP upload binding verification failed/,
  );
});

test('inherited binding fields are rejected', () => {
  const inherited = Object.create(
    createIpUploadBinding(authorization),
  );

  assert.throws(
    () => assertIpUploadBinding(inherited, authorization),
    /IP upload binding verification failed/,
  );
});

test('invalid provider metadata is rejected', () => {
  for (const value of [null, undefined, [], 'metadata']) {
    assert.throws(
      () => assertIpUploadBinding(value, authorization),
      /IP upload binding verification failed/,
    );
  }
});

test('unsupported purpose and malformed nonce are rejected', () => {
  assert.throws(
    () => createIpUploadBinding({
      ...authorization,
      purpose: 'stl_source',
    }),
    /Unsupported IP upload purpose/,
  );

  for (const bindingNonce of ['', 'a'.repeat(63), 'G'.repeat(64)]) {
    assert.throws(
      () => createIpUploadBinding({
        ...authorization,
        bindingNonce,
      }),
      /bindingNonce/,
    );
  }
});

test('authorization and revision must be bounded strings', () => {
  for (const key of ['authorizationId', 'operationRevision']) {
    for (const value of ['', ' padded ', 'x'.repeat(129), null]) {
      assert.throws(
        () => createIpUploadBinding({
          ...authorization,
          [key]: value,
        }),
        TypeError,
      );
    }
  }
});

test('verification errors do not disclose binding values', () => {
  assert.throws(
    () => assertIpUploadBinding({}, authorization),
    error =>
      error.message === 'IP upload binding verification failed' &&
      !error.message.includes(authorization.bindingNonce),
  );
});
