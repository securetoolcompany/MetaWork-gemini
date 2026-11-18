import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeUrl = new URL('../app/api/ipfs/key/route.js', import.meta.url);

function harness() {
  const source = readFileSync(routeUrl, 'utf8')
    .replace(/^import\s+[\s\S]*?;\s*/gm, '')
    .replace(
      /\bexport\s+(?=(?:async\s+)?function|const|let|var)/g,
      '',
    );

  const calls = [];

  const POST = new Function(
    'NextResponse',
    'verifyToken',
    'fetch',
    'process',
    `${source}\nreturn POST;`,
  )(
    {
      json(body, options = {}) {
        return { body, status: options.status ?? 200 };
      },
    },
    token => {
      if (token === 'valid-token') return { userId: 'owner-1' };
      if (token === 'missing-user') return {};
      if (token === 'numeric-user') return { userId: 123 };
      throw new Error('Invalid fixture token');
    },
    async (url, init) => {
      calls.push({ url, init });

      return {
        ok: true,
        async json() {
          return { JWT: 'mock-upload-capability' };
        },
      };
    },
    { env: { PINATA_JWT: 'mock-platform-secret' } },
  );

  return { POST, calls };
}

function request({ authorization, cookie } = {}) {
  return {
    headers: {
      get(name) {
        return name === 'authorization'
          ? authorization ?? null
          : null;
      },
    },
    cookies: {
      get(name) {
        return name === 'auth_token' && cookie
          ? { value: cookie }
          : undefined;
      },
    },
  };
}

test('missing authentication returns 401 without provider access', async () => {
  const { POST, calls } = harness();
  const result = await POST(request());

  assert.equal(result.status, 401);
  assert.equal(calls.length, 0);
});

test('invalid or malformed bearer tokens never reach provider', async () => {
  for (const authorization of [
    'Bearer invalid',
    'Bearer ',
    'Basic invalid',
  ]) {
    const { POST, calls } = harness();
    const result = await POST(request({ authorization }));

    assert.equal(result.status, 401);
    assert.equal(calls.length, 0);
  }
});

test('decoded authentication requires a nonempty string user ID', async () => {
  for (const token of ['missing-user', 'numeric-user']) {
    const { POST, calls } = harness();
    const result = await POST(request({
      authorization: `Bearer ${token}`,
    }));

    assert.equal(result.status, 401);
    assert.equal(calls.length, 0);
  }
});

test('valid bearer authentication preserves current caller response', async () => {
  const { POST, calls } = harness();
  const result = await POST(request({
    authorization: 'Bearer valid-token',
  }));

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { JWT: 'mock-upload-capability' });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://api.pinata.cloud/v3/pinata/keys',
  );
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(
    calls[0].init.headers.Authorization,
    'Bearer mock-platform-secret',
  );
  assert.ok(!JSON.stringify(result.body).includes('mock-platform-secret'));
});

test('valid cookie authentication is accepted', async () => {
  const { POST, calls } = harness();
  const result = await POST(request({ cookie: 'valid-token' }));

  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
});

test('invalid bearer is not silently replaced by valid cookie', async () => {
  const { POST, calls } = harness();
  const result = await POST(request({
    authorization: 'Bearer invalid',
    cookie: 'valid-token',
  }));

  assert.equal(result.status, 401);
  assert.equal(calls.length, 0);
});
