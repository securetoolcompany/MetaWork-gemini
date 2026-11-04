/** Offline route boundary tests. No Python, SDK, Docker, wallet, or network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const SOURCE = await fs.readFile(new URL('../app/api/creation/route.js', import.meta.url), 'utf8');
const TXID = 'HAQMKRU6ZAO3AI2AGFLPIHSOUIIC7RRSMC5J76SWQAJJYVQ5DEYA';
const HASH = '4cee0b8eef2197a564c62cce8885a83c60508e74f5f5186f3ccbe2f8c16e5f5d';
const CREATOR = 'BR5RLDLNCHCXHATTP7GVWGAUJTBREOXPUAYUMKHX5YDZFTVR3XEGPNQN2Y';
const TOKEN = 'test-only-operator-credential-0123456789';
const ORIGIN = 'http://127.0.0.1:3107';
const GENESIS = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

async function environment(t, settings = {}) {
  const root = settings.root || await fs.mkdtemp(path.join(os.tmpdir(), 'tokenizer-route-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true })); // Disposable fixtures only.
  const state = { modes: [], sends: 0, nodeReads: 0, spawnCalls: 0, ...settings };
  const env = { NODE_ENV: 'development', TOKENIZER_OPERATOR_MODE: 'local', TOKENIZER_OPERATOR_TOKEN: TOKEN,
    TOKENIZER_REPO_ROOT: root, TOKENIZER_EXECUTION_BINDING: TXID + ':' + HASH, ...settings.env };
  const data = { ok: true, txid: TXID, rawHash: HASH, creator: CREATOR, fee: 1000,
    firstValid: 68924333, lastValid: 68925333, unsigned: 'dGVzdC1vbmx5',
    applicationId: 123, applicationAddress: 'synthetic-app-address', confirmedRound: 68924334 };
  function spawn(_program, _args, options) {
    assert.equal(options.shell, false);
    state.spawnCalls++;
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.stdin = new EventEmitter();
    child.kill = () => {};
    child.stdin.end = text => {
      const payload = JSON.parse(text); state.modes.push(payload.mode);
      queueMicrotask(() => {
        const failure = state.failMode === payload.mode;
        const output = failure ? { ok: false, error: state.failReason || 'Synthetic validation failure' } : { ...data, ...state.validationOverride };
        child.stdout.emit('data', Buffer.from(JSON.stringify(output)));
        child.emit('close', failure ? 2 : 0);
      });
    };
    return child;
  }
  async function fetch(url, options = {}) {
    if (options.method === 'POST') {
      const events = await fs.readFile(path.join(root, '.tokenizer-operator', 'testnet-' + TXID, 'events.jsonl'), 'utf8');
      assert.ok(events.includes('submission_intent_do_not_retry'));
      assert.ok(!events.includes(TOKEN));
      state.sends++;
      assert.equal(url, 'https://testnet-api.algonode.cloud/v2/transactions');
      if (state.sendException) throw new Error('Synthetic network uncertainty');
      return Response.json({ txId: state.wrongSubmittedId ? 'wrong-id' : TXID });
    }
    state.nodeReads++;
    if (url.endsWith('/v2/transactions/params')) return Response.json({
      'genesis-id': state.wrongGenesis ? 'mainnet-v1.0' : 'testnet-v1.0', 'genesis-hash': GENESIS });
    assert.ok(url.endsWith('/v2/transactions/pending/' + TXID));
    if (state.pendingException) throw new Error('Synthetic unavailable confirmation');
    return Response.json(state.timeout ? { 'confirmed-round': 0 } : {
      'confirmed-round': 68924334, 'application-index': 123, 'pool-error': '' });
  }
  const context = vm.createContext({ Buffer, URL, Request, Response, AbortSignal,
    process: { env }, fetch, clearTimeout,
    setTimeout: (callback, delay) => setTimeout(callback, delay === 1000 ? 0 : delay) });
  const module = new vm.SourceTextModule(SOURCE, { context, identifier: 'isolated-route' });
  const libraries = { 'node:fs/promises': { default: fs }, 'node:path': { default: path },
    'node:crypto': { createHash: crypto.createHash, randomBytes: crypto.randomBytes, timingSafeEqual: crypto.timingSafeEqual },
    'node:child_process': { spawn } };
  await module.link(async specifier => {
    const values = libraries[specifier]; assert.ok(values, 'Unexpected import: ' + specifier);
    return new vm.SyntheticModule(Object.keys(values), function() {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  const api = module.namespace;
  function request(action = 'verify', body, headers = {}) {
    return new Request(ORIGIN + '/api/creation?action=' + action, {
      method: body ? 'POST' : 'GET', headers: { host: '127.0.0.1:3107', authorization: 'Bearer ' + TOKEN,
        ...(body ? { origin: ORIGIN, 'content-type': 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  async function verify() { return await (await api.GET(request())).json(); }
  async function authorize() {
    const verified = await verify();
    assert.equal(verified.status, 'verified_unsigned_not_authorized');
    return await api.POST(request('', { action: 'authorize', nonce: verified.nonce, approval: verified.approvalPhrase }));
  }
  async function submit() { return await api.POST(request('', { action: 'submit', signed: 'c3ludGhldGljLXNpZ25lZA==' })); }
  return { api, state, env, root, request, verify, authorize, submit,
    guard: path.join(root, '.tokenizer-operator', 'testnet-' + TXID) };
}

test('verification is read-only; no disk guard, submission, or signing', async t => {
  const e = await environment(t); const result = await e.verify();
  assert.equal(result.status, 'verified_unsigned_not_authorized');
  assert.deepEqual(e.state.modes, ['verify']); assert.equal(e.state.sends, 0);
  assert.deepEqual(await fs.readdir(e.root), []);
});
test('hosted/production environments are refused before validation', async t => {
  for (const env of [{ NODE_ENV: 'production' }, { VERCEL: '1' }, { TOKENIZER_OPERATOR_MODE: '' }]) {
    const e = await environment(t, { env }); const response = await e.api.GET(e.request());
    assert.equal(response.status, 403); assert.equal(e.state.spawnCalls, 0);
  }
});
test('missing or wrong operator credential is refused', async t => {
  const e = await environment(t);
  for (const authorization of ['', 'Bearer wrong']) {
    assert.equal((await e.api.GET(e.request('verify', undefined, { authorization }))).status, 403);
  }
  assert.equal(e.state.spawnCalls, 0);
});
test('cross-origin, wrong host, and proxy requests are refused', async t => {
  const e = await environment(t);
  for (const headers of [{ origin: 'https://evil.example' }, { host: 'evil.example' }, { 'x-forwarded-for': '192.0.2.1' }]) {
    assert.equal((await e.api.GET(e.request('verify', undefined, headers))).status, 403);
  }
  assert.equal(e.state.spawnCalls, 0);
});
test('execution disabled by default, even with a valid credential', async t => {
  const e = await environment(t, { env: { TOKENIZER_EXECUTION_BINDING: '' } });
  assert.equal((await e.authorize()).status, 409); assert.equal(e.state.sends, 0);
  assert.deepEqual(await fs.readdir(e.root), []);
});
test('a command or boolean is not authorization; exact phrase and challenge required', async t => {
  const e = await environment(t); const verified = await e.verify();
  const response = await e.api.POST(e.request('', { action: 'authorize', nonce: verified.nonce, approval: true }));
  assert.equal(response.status, 409); assert.deepEqual(await fs.readdir(e.root), []);
});
test('tampered candidate output is refused', async t => {
  const e = await environment(t, { validationOverride: { rawHash: 'changed' } });
  const response = await e.api.GET(e.request()); assert.equal(response.status, 403);
});
test('expired candidate, authority/balance or strict-simulation failure blocks authorization', async t => {
  for (const failReason of ['candidate expired', 'creator authority changed', 'insufficient balance', 'minimum balance failure', 'unexpected simulation override']) {
    const e = await environment(t, { failMode: 'verify', failReason });
    assert.equal((await e.api.GET(e.request())).status, 403);
    assert.deepEqual(await fs.readdir(e.root), []); assert.equal(e.state.sends, 0);
  }
});
test('post-approval validation failure creates no signing guard', async t => {
  const e = await environment(t); const verified = await e.verify(); e.state.failMode = 'verify';
  const response = await e.api.POST(e.request('', { action: 'authorize', nonce: verified.nonce, approval: verified.approvalPhrase }));
  assert.equal(response.status, 409); assert.deepEqual(await fs.readdir(e.root), []);
});
test('authorization acquires a persistent guard before releasing signing bytes', async t => {
  const e = await environment(t); assert.equal((await e.authorize()).status, 200);
  const events = await fs.readFile(path.join(e.guard, 'events.jsonl'), 'utf8');
  assert.ok(events.includes('authorized_guard_acquired_signing_may_follow_do_not_retry'));
  assert.equal(e.state.sends, 0);
});
test('existing guard blocks reauthorization, including after a process restart', async t => {
  const e = await environment(t); await e.authorize();
  assert.equal((await e.api.GET(e.request())).status, 403);
  const restarted = await environment(t, { root: e.root });
  assert.equal((await restarted.api.GET(restarted.request())).status, 403);
  assert.equal(restarted.state.spawnCalls, 0);
  const response = await e.api.POST(e.request('', { action: 'authorize', nonce: 'new', approval: 'new' }));
  assert.equal(response.status, 409); assert.equal(e.state.sends, 0);
});
test('empty/interrupted guard cannot authorize direct submission', async t => {
  const e = await environment(t); await fs.mkdir(e.guard, { recursive: true });
  const response = await e.submit(); assert.equal(response.status, 409); assert.equal(e.state.sends, 0);
});
test('concurrent authorizations produce only one successful guard owner', async t => {
  const e = await environment(t); const verified = await e.verify();
  const body = { action: 'authorize', nonce: verified.nonce, approval: verified.approvalPhrase };
  const responses = await Promise.all([e.api.POST(e.request('', body)), e.api.POST(e.request('', body))]);
  assert.equal(responses.filter(r => r.status === 200).length, 1);
});
test('signature mismatch or signed simulation failure preserves guard and never submits', async t => {
  const e = await environment(t); await e.authorize(); e.state.failMode = 'signed';
  assert.equal((await e.submit()).status, 409); assert.equal(e.state.sends, 0);
  assert.ok(await fs.stat(e.guard)); assert.equal((await e.submit()).status, 409);
  assert.equal(e.state.modes.filter(m => m === 'signed').length, 1);
});
test('wrong TestNet identity after signing prevents submission', async t => {
  const e = await environment(t); await e.authorize(); e.state.wrongGenesis = true;
  assert.equal((await e.submit()).status, 409); assert.equal(e.state.sends, 0);
});
test('submission exception makes exactly one attempt and guard survives', async t => {
  const e = await environment(t); await e.authorize(); e.state.sendException = true;
  assert.equal((await e.submit()).status, 409); assert.equal(e.state.sends, 1);
  assert.equal((await e.submit()).status, 409); assert.equal(e.state.sends, 1);
  const events = await fs.readFile(path.join(e.guard, 'events.jsonl'), 'utf8');
  assert.ok(events.includes('submission_intent_do_not_retry'));
});
test('confirmation timeout never resubmits', async t => {
  const e = await environment(t); await e.authorize(); e.state.timeout = true;
  const response = await e.submit(); const body = await response.json();
  assert.equal(body.status, 'stopped_outcome_requires_reconciliation_do_not_retry');
  assert.equal(e.state.sends, 1); assert.equal((await e.submit()).status, 409);
  assert.equal(e.state.sends, 1);
});
test('wrong returned transaction ID is uncertain, never retried', async t => {
  const e = await environment(t); await e.authorize(); e.state.wrongSubmittedId = true;
  assert.equal((await e.submit()).status, 409); assert.equal(e.state.sends, 1);
});
test('confirmed mismatch explicitly reports confirmed creation, verification failed', async t => {
  const e = await environment(t); await e.authorize(); e.state.failMode = 'confirmed';
  const body = await (await e.submit()).json();
  assert.equal(body.status, 'creation_confirmed_verification_failed');
  assert.equal(body.applicationId, 123); assert.equal(e.state.sends, 1);
});
test('verified creation is distinct from initialization', async t => {
  const e = await environment(t); await e.authorize(); const body = await (await e.submit()).json();
  assert.equal(body.status, 'creation_confirmed_verified_not_initialized');
  assert.equal(e.state.sends, 1); assert.deepEqual(e.state.modes, ['verify', 'verify', 'signed', 'confirmed']);
});
test('reconciliation is read-only and never signs, resubmits, or deletes records', async t => {
  const e = await environment(t); await e.authorize();
  const before = await fs.readFile(path.join(e.guard, 'events.jsonl'), 'utf8');
  const body = await (await e.api.GET(e.request('reconcile'))).json();
  assert.equal(body.status, 'creation_confirmed_verified_not_initialized');
  assert.equal(e.state.sends, 0); assert.ok(!e.state.modes.includes('signed'));
  assert.equal(await fs.readFile(path.join(e.guard, 'events.jsonl'), 'utf8'), before);
});
test('uncertain reconciliation leaves all evidence unchanged', async t => {
  const e = await environment(t); await e.authorize(); e.state.pendingException = true;
  const before = await fs.readFile(path.join(e.guard, 'events.jsonl'), 'utf8');
  const body = await (await e.api.GET(e.request('reconcile'))).json();
  assert.equal(body.status, 'outcome_unknown_do_not_retry'); assert.equal(e.state.sends, 0);
  assert.equal(await fs.readFile(path.join(e.guard, 'events.jsonl'), 'utf8'), before);
});

test(
  'Next internal localhost URL is accepted only with the exact loopback Host',
  async t => {
    const e = await environment(t);
    const original = e.request();

    const request = new Request(
      'http://localhost:3107/api/creation?action=verify',
      { headers: original.headers }
    );

    const response = await e.api.GET(request);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'verified_unsigned_not_authorized');
    assert.equal(e.state.sends, 0);
    assert.deepEqual(await fs.readdir(e.root), []);
  }
);

test(
  'internal URL alias does not permit a localhost browser Host or wrong port',
  async t => {
    const e = await environment(t);

    for (const host of ['localhost:3107', '127.0.0.1:3000']) {
      const original = e.request();
      const headers = new Headers(original.headers);
      headers.set('host', host);

      const response = await e.api.GET(
        new Request(
          'http://localhost:3107/api/creation?action=verify',
          { headers }
        )
      );

      assert.equal(response.status, 403);
    }

    assert.equal(e.state.spawnCalls, 0);
    assert.equal(e.state.sends, 0);
  }
);