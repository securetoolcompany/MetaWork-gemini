import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { uploadIpPreparationMetadata, reconcileIpPreparationMetadata } from '../lib/ip-source/tokenization-metadata.js';

const metadata = { name: 'Fixture', image: 'ipfs://fixture', properties: { created_at: 'fixed' } };
const request = {
  correlation: 'a'.repeat(64), metadata,
  metadataHash: createHash('sha256').update(JSON.stringify(metadata)).digest('base64'),
};
const cid = 'bafkreicnu2aqjkoglrlrd65giwo4l64pdajxffk6jtq2vb7yaiopc3yu7m';
const row = {
  ipfs_pin_hash: cid, date_unpinned: null,
  metadata: { name: request.correlation, keyvalues: {
    mw_preparation: request.correlation, mw_metadata_sha256: request.metadataHash,
  } },
};
const response = data => new Response(JSON.stringify(data));

test('metadata: initial upload binds exact persisted metadata and correlation', async () => {
  let calls = 0;
  const result = await uploadIpPreparationMetadata(request, { jwt: 'offline', fetchImpl: async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.pinata.cloud/pinning/pinJSONToIPFS');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer offline');
    const body = JSON.parse(init.body);
    assert.deepEqual(body.pinataContent, metadata);
    assert.deepEqual(body.pinataMetadata, row.metadata);
    return response({ IpfsHash: cid });
  } });
  assert.equal(calls, 1);
  assert.equal(result.ipfsUrl, `ipfs://${cid}`);
});
test('metadata: authenticated lookup verifies actual JSON without forwarding bearer token', async () => {
  const calls = [];
  const result = await reconcileIpPreparationMetadata(request, { jwt: 'offline', fetchImpl: async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.method, 'GET');
    if (calls.length === 1) {
      const query = new URL(url);
      assert.equal(query.origin, 'https://api.pinata.cloud');
      assert.deepEqual(JSON.parse(query.searchParams.get('metadata')), { name: request.correlation });
      assert.equal(init.headers.Authorization, 'Bearer offline');
      return response({ count: 1, rows: [row] });
    }
    assert.equal(url, `https://gateway.pinata.cloud/ipfs/${cid}`);
    assert.equal(new Headers(init.headers).has('authorization'), false);
    return response(metadata);
  } });
  assert.equal(calls.length, 2);
  assert.equal(result.ipfsUrl, `ipfs://${cid}`);
});
for (const result of [
  { count: 0, rows: [] }, { count: 2, rows: [row, row] },
  { count: 1, rows: [{ ...row, metadata: { ...row.metadata, name: 'wrong' } }] },
  { count: 1, rows: [{ ...row, ipfs_pin_hash: '../../wrong' }] },
]) {
  test(`metadata: ambiguous or unbound lookup never uploads (${JSON.stringify(result).slice(0, 55)})`, async () => {
    let calls = 0;
    await assert.rejects(reconcileIpPreparationMetadata(request, { jwt: 'offline', fetchImpl: async (_, init) => {
      calls++;
      assert.equal(init.method, 'GET');
      return response(result);
    } }), e => e.code === 'IP_PREPARATION_METADATA_RECOVERY_REQUIRED');
    assert.equal(calls, 1);
  });
}
test('metadata: mismatched recovered payload cannot resume', async () => {
  let calls = 0;
  await assert.rejects(reconcileIpPreparationMetadata(request, { jwt: 'offline', fetchImpl: async (_, init) => {
    assert.equal(init.method, 'GET');
    return ++calls === 1 ? response({ count: 1, rows: [row] }) : response({ name: 'wrong' });
  } }), e => e.code === 'IP_PREPARATION_METADATA_RECOVERY_REQUIRED');
});
test('metadata: interrupted upload yields recovery-required, without internal retry', async () => {
  let calls = 0;
  await assert.rejects(uploadIpPreparationMetadata(request, { jwt: 'offline', fetchImpl: async () => {
    calls++;
    throw new Error('private provider secret');
  } }), e => e.code === 'IP_PREPARATION_METADATA_RECOVERY_REQUIRED' && !e.message.includes('private'));
  assert.equal(calls, 1);
});
