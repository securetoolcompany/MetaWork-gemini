/** Offline operator-page flow tests. React/Pera/SDK/fetch are mocked. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const SOURCE = await fs.readFile(new URL('../app/page.js', import.meta.url), 'utf8');
const TXID = 'S373DMUTPW2IVRXOXRDOYSXIOKDBT3NCBMWJWTQSDYJ5AOI2YLVA';
const HASH = '37252b1c268d0eb75324d700af6f6a5782ca06d20dd613d1a60a1489a161e19f';
const CREATOR = 'BR5RLDLNCHCXHATTP7GVWGAUJTBREOXPUAYUMKHX5YDZFTVR3XEGPNQN2Y';

async function page(options = {}) {
  const slots = []; let cursor = 0;
  const events = []; let tree;
  const raw = new Uint8Array([1, 2, 3]);
  const verification = { status: 'verified_unsigned_not_authorized', txid: TXID, rawHash: HASH,
    fee: 1000, creator: CREATOR, firstValid: 68883196, lastValid: 68884196,
    nonce: 'synthetic-nonce', approvalPhrase: 'synthetic exact approval phrase', executionEnabled: true,
    ...options.verification };
  const element = (type, props, ...children) => ({ type, props: props || {}, children });
  const React = { createElement: element };
  const useState = initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial;
    return [slots[i], value => { slots[i] = value; }]; };
  const useRef = initial => { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; };
  class Pera {
    constructor(settings) { events.push(['pera-created', settings]); assert.equal(settings.chainId, 416002); }
    async connect() { events.push(['connect']); return options.wrongAccount ? ['different-account'] : [CREATOR]; }
    async disconnect() { events.push(['disconnect']); }
    async signTransaction(groups, signer) {
      events.push(['sign']); assert.equal(signer, CREATOR); assert.equal(groups[0][0].signers.length, 1); assert.equal(groups[0][0].signers[0], CREATOR);
      if (options.rejectSignature) throw new Error('Synthetic wallet rejection');
      return [new Uint8Array([4, 5, 6])];
    }
  }
  const txn = { txID: () => TXID, sender: { toString: () => CREATOR } };
  const sdk = { decodeUnsignedTransaction: () => txn, encodeUnsignedTransaction: () => raw,
    decodeSignedTransaction: () => ({ txn: options.changedSigned ? { ...txn, txID: () => 'changed' } : txn }) };
  async function fetch(url, init) {
    const action = new URL(url, 'http://127.0.0.1:3107').searchParams.get('action');
    events.push(['api', action]);
    if (action === 'verify') return Response.json(verification);
    if (action === 'authorize') {
      const body = JSON.parse(init.body); assert.equal(body.approval, verification.approvalPhrase);
      events.push(['guard-acquired']);
      return Response.json({ status: 'authorized_once_guard_preserved', txid: TXID, rawHash: HASH, creator: CREATOR,
        unsigned: Buffer.from(raw).toString('base64') });
    }
    if (action === 'submit') {
      assert.ok(events.some(e => e[0] === 'guard-acquired'));
      return Response.json({ status: 'creation_confirmed_verified_not_initialized', applicationId: 123 });
    }
    assert.equal(action, 'reconcile');
    return Response.json({ status: 'outcome_unknown_do_not_retry' });
  }
  const context = vm.createContext({ Uint8Array, Array, Response, atob, btoa, fetch,
    crypto: { subtle: { digest: async () => Uint8Array.from(Buffer.from(HASH, 'hex')).buffer } } });
  async function synthetic(values) {
    const module = new vm.SyntheticModule(Object.keys(values), function() {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
    await module.link(() => { throw new Error('Unexpected import'); }); await module.evaluate(); return module;
  }
  const module = new vm.SourceTextModule(SOURCE, { context, identifier: 'isolated-page',
    importModuleDynamically: async name => {
      events.push(['dynamic-import', name]);
      assert.ok(events.some(e => e[0] === 'guard-acquired'), 'Wallet/SDK imported before guard');
      if (name === '@perawallet/connect') return await synthetic({ PeraWalletConnect: Pera });
      assert.equal(name, 'algosdk'); return await synthetic({ default: sdk });
    } });
  await module.link(async name => {
    assert.equal(name, 'react');
    return new vm.SyntheticModule(['default', 'useState', 'useRef'], function() {
      this.setExport('default', React); this.setExport('useState', useState); this.setExport('useRef', useRef);
    }, { context });
  });
  await module.evaluate();
  function render() { cursor = 0; tree = module.namespace.default(); return tree; }
  function find(id, node = tree) {
    if (!node || typeof node !== 'object') return null;
    if (node.props?.['data-testid'] === id) return node;
    for (const child of (node.children || []).flat(Infinity)) { const result = find(id, child); if (result) return result; }
    return null;
  }
  async function click(id) { const found = find(id); assert.ok(found, id); await found.props.onClick(); render(); }
  function enter(id, text) { find(id).props.onChange({ target: { value: text } }); render(); }
  async function ready() { enter('token', 'test-only-operator-credential-0123456789'); await click('verify');
    enter('approval', verification.approvalPhrase); await click('authorize'); }
  render();
  return { events, find, click, enter, ready };
}

test('page load has no network call, wallet construction, import, or reconnect', async () => {
  const p = await page(); assert.deepEqual(p.events, []);
  assert.equal(p.find('connect').props.disabled, true); assert.equal(p.find('sign').props.disabled, true);
  assert.ok(!SOURCE.includes('.reconnectSession(')); assert.ok(!SOURCE.includes('useWallet'));
});
test('verification never opens or signs with a wallet', async () => {
  const p = await page(); await p.click('verify');
  assert.deepEqual(p.events, [['api', 'verify']]);
});
test('disabled execution cannot authorize or connect', async () => {
  const p = await page({ verification: { executionEnabled: false } }); await p.ready();
  assert.ok(!p.events.some(e => e[0] === 'guard-acquired'));
  assert.ok(!p.events.some(e => e[0] === 'dynamic-import'));
});
test('wrong typed approval does not acquire a guard or open Pera', async () => {
  const p = await page(); await p.click('verify'); p.enter('approval', 'no'); await p.click('authorize');
  assert.deepEqual(p.events, [['api', 'verify']]);
});
test('guard is acquired before explicit TestNet Pera connection', async () => {
  const p = await page(); await p.ready(); await p.click('connect');
  const guard = p.events.findIndex(e => e[0] === 'guard-acquired');
  const connect = p.events.findIndex(e => e[0] === 'connect');
  assert.ok(guard >= 0 && connect > guard); assert.ok(!p.events.some(e => e[0] === 'sign'));
});
test('wrong creator stops without signing or submitting', async () => {
  const p = await page({ wrongAccount: true }); await p.ready(); await p.click('connect');
  assert.ok(!p.events.some(e => e[0] === 'sign' || e[1] === 'submit'));
});
test('one explicit signing request then one server submission, never direct Algod broadcast', async () => {
  const p = await page(); await p.ready(); await p.click('connect'); await p.click('sign'); await p.click('sign');
  assert.equal(p.events.filter(e => e[0] === 'sign').length, 1);
  assert.equal(p.events.filter(e => e[0] === 'api' && e[1] === 'submit').length, 1);
});
test('wallet rejection stops without submission or automatic re-signing', async () => {
  const p = await page({ rejectSignature: true }); await p.ready(); await p.click('connect');
  await p.click('sign'); await p.click('sign');
  assert.equal(p.events.filter(e => e[0] === 'sign').length, 1);
  assert.equal(p.events.filter(e => e[0] === 'api' && e[1] === 'submit').length, 0);
});
test('changed returned transaction bytes stop without submission', async () => {
  const p = await page({ changedSigned: true }); await p.ready(); await p.click('connect'); await p.click('sign');
  assert.equal(p.events.filter(e => e[0] === 'api' && e[1] === 'submit').length, 0);
});
test('read-only reconciliation never imports Pera or signs', async () => {
  const p = await page(); await p.click('reconcile'); assert.deepEqual(p.events, [['api', 'reconcile']]);
});
