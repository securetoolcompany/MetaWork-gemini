// lib/tokenized-funds/nillion/distribution-approval-handler.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { NillionApprovalError } from './distribution-approval-service.js';
import { createNillionApprovalHandlers } from './distribution-approval-handler.js';

const ID = 'a'.repeat(64);

function request({
  method = 'GET',
  query = '',
  body,
  origin = 'http://localhost',
  contentType = 'application/json',
} = {}) {
  const headers = new Headers();

  if (origin !== null) headers.set('origin', origin);
  if (contentType !== null) headers.set('content-type', contentType);

  return {
    method,
    url: `http://localhost/api/admin/tokenized-funds/nillion/distribution-proposals${query}`,
    headers,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body ?? {})),
  };
}

function setup({
  admin = { userId: 'admin-1' },
  enabled = true,
  service,
} = {}) {
  const calls = [];

  const fakeService = service ?? {
    async getActive() {
      calls.push(['getActive']);
      return null;
    },
    async prepare(options) {
      calls.push(['prepare', options]);
      return { status: 'nothing_to_review', stored: false };
    },
    async approve(options) {
      calls.push(['approve', options]);
      return { status: 'approved' };
    },
    async reject(options) {
      calls.push(['reject', options]);
      return { status: 'rejected' };
    },
  };

  return {
    calls,
    handlers: createNillionApprovalHandlers({
      authenticate: async () => admin,
      isEnabled: () => enabled,
      service: fakeService,
    }),
  };
}

test('rejects unauthorized requests before touching the service', async () => {
  const f = setup({ admin: null });

  const get = await f.handlers.GET(request());
  const post = await f.handlers.POST(
    request({ method: 'POST', body: { action: 'prepare' } }),
  );

  assert.equal(get.status, 403);
  assert.equal(post.status, 403);
  assert.deepEqual(f.calls, []);
  assert.equal(get.headers.get('Cache-Control'), 'no-store');
});

test('is disabled until explicitly enabled', async () => {
  const f = setup({ enabled: false });

  const result = await f.handlers.GET(request());

  assert.equal(result.status, 503);
  assert.deepEqual(f.calls, []);
});

test('GET rejects query parameters', async () => {
  const f = setup();

  const result = await f.handlers.GET(request({ query: '?id=x' }));

  assert.equal(result.status, 400);
  assert.deepEqual(f.calls, []);
});

test('GET returns the active proposal without enabling execution', async () => {
  const f = setup();

  const result = await f.handlers.GET(request());
  const body = await result.json();

  assert.equal(result.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.executionEnabled, false);
  assert.equal(body.proposal, null);
});

test('POST requires a matching Origin header', async () => {
  const f = setup();
  const body = { action: 'prepare' };

  for (const origin of [null, 'http://evil.example']) {
    const result = await f.handlers.POST(
      request({ method: 'POST', body, origin }),
    );

    assert.equal(result.status, 403);
  }

  assert.deepEqual(f.calls, []);
});

test('POST requires a small JSON body', async () => {
  const f = setup();

  const wrongType = await f.handlers.POST(
    request({
      method: 'POST',
      body: { action: 'prepare' },
      contentType: 'text/plain',
    }),
  );

  const tooLarge = await f.handlers.POST(
    request({ method: 'POST', body: 'x'.repeat(3000) }),
  );

  const invalid = await f.handlers.POST(
    request({ method: 'POST', body: '{not-json' }),
  );

  assert.equal(wrongType.status, 415);
  assert.equal(tooLarge.status, 413);
  assert.equal(invalid.status, 400);
  assert.deepEqual(f.calls, []);
});

test('POST rejects unknown actions, extra fields, and malformed IDs', async () => {
  const f = setup();

  const bodies = [
    { action: 'execute' },
    { action: 'prepare', ledger: 'other.json' },
    { action: 'approve' },
    { action: 'approve', id: 'not-a-hash' },
    { action: 'reject', id: ID, recipient: '0x1' },
    ['approve'],
  ];

  for (const body of bodies) {
    const result = await f.handlers.POST(
      request({ method: 'POST', body }),
    );

    assert.equal(result.status, 400);
  }

  assert.deepEqual(f.calls, []);
});

test('POST dispatches each action with the authenticated actor only', async () => {
  const f = setup();

  const prepare = await f.handlers.POST(
    request({ method: 'POST', body: { action: 'prepare' } }),
  );

  const approve = await f.handlers.POST(
    request({ method: 'POST', body: { action: 'approve', id: ID } }),
  );

  const reject = await f.handlers.POST(
    request({ method: 'POST', body: { action: 'reject', id: ID } }),
  );

  assert.equal(prepare.status, 200);
  assert.equal(approve.status, 200);
  assert.equal(reject.status, 200);

  assert.deepEqual(f.calls, [
    ['prepare', { actorId: 'admin-1' }],
    ['approve', { id: ID, actorId: 'admin-1' }],
    ['reject', { id: ID, actorId: 'admin-1' }],
  ]);

  assert.equal((await approve.json()).executionEnabled, false);
});

test('maps domain errors and hides internal failures', async () => {
  const domain = setup({
    service: {
      async prepare() {
        throw new NillionApprovalError('Proposal was not found.', 404);
      },
    },
  });

  const known = await domain.handlers.POST(
    request({ method: 'POST', body: { action: 'prepare' } }),
  );

  assert.equal(known.status, 404);
  assert.equal((await known.json()).error, 'Proposal was not found.');

  const internal = setup({
    service: {
      async prepare() {
        throw new Error('mongodb://private-host private-rpc-url');
      },
    },
  });

  const hidden = await internal.handlers.POST(
    request({ method: 'POST', body: { action: 'prepare' } }),
  );

  const text = JSON.stringify(await hidden.json());

  assert.equal(hidden.status, 503);
  assert.ok(!text.includes('private'));
});