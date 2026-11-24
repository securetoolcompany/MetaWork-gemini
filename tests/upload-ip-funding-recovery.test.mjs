import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readIpFundingStatus } from '../lib/ip-source/funding-client.js';

test('empty wallet result releases only the matching pointer before funding POST', () => {
  const page = readFileSync(new URL('../app/upload-ip/page.js', import.meta.url), 'utf8');
  const start = page.indexOf('if (!signedMbr?.[0])');
  const post = page.indexOf("const mbrRes = await fetch('/api/ip/pool-funding'");
  assert.ok(start >= 0 && post > start);
  const cancellation = page.slice(start, post);
  assert.match(cancellation, /localStorage\.getItem\(resumeKey\) === savedFundingPointer/);
  assert.match(cancellation, /localStorage\.removeItem\(resumeKey\)/);
  const afterPost = page.slice(post, page.indexOf('// 6) Sign NFT mint tx', post));
  assert.doesNotMatch(afterPost, /localStorage\.removeItem/);
});

test('reloaded pointer makes only a status request without signed bytes', async () => {
  const page = readFileSync(new URL('../app/upload-ip/page.js', import.meta.url), 'utf8');
  const handler = page.slice(page.indexOf('const handleSubmit ='));
  assert.match(handler, /if \(saved\) \{[\s\S]*?await readIpFundingStatus[\s\S]*?return;\s*\}/);
  assert.ok(handler.indexOf('await readIpFundingStatus') < handler.indexOf('await signTransactionGroup'));
  for (const status of ['pending', 'confirmed', 'review_required']) {
    let calls = 0;
    assert.equal(await readIpFundingStatus({ ipAssetId: 'asset', operationKey: 'op' }, {}, async (url, options) => {
      calls++;
      assert.equal(url, '/api/ip/pool-funding?ipAssetId=asset&operationKey=op');
      assert.equal(options.body, undefined);
      return { json: async () => ({ status }) };
    }), status);
    assert.equal(calls, 1);
  }
});
