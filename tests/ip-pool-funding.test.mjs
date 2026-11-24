import test from 'node:test';
import assert from 'node:assert/strict';
import { claimIpFunding, reconcileIpFunding } from '../lib/ip-source/pool-funding.js';

for (const scenario of ['accepted', 'unknown', 'pre-send crash']) {
  test(scenario, async () => {
    const attempt = { expectedTransactionId: 'original', status: 'awaiting_signature', amount: 42, lastValid: 100 };
    let sends = 0;
    let receipt;
    const collection = {
      async findOneAndUpdate() { attempt.status = 'submitting'; return { fundingAttempt: attempt }; },
      async updateOne(_filter, update) { receipt = update.$set; return { matchedCount: 1 }; },
    };
    if (scenario === 'pre-send crash') attempt.status = 'submitting';
    else await claimIpFunding({ collection, binding: {}, txid: 'original', broadcast: async () => { sends++; throw Error('RPC response lost'); } });
    const result = await reconcileIpFunding({ collection, binding: {}, attempt,
      round: async () => scenario === 'pre-send crash' ? 101 : 90,
      lookup: async (id) => { assert.equal(id, 'original'); return scenario === 'accepted' ? 95 : 0; },
    });
    assert.equal(result.status, { accepted: 'confirmed', unknown: 'pending', 'pre-send crash': 'review_required' }[scenario]);
    assert.equal(sends, scenario === 'pre-send crash' ? 0 : 1);
    assert.equal(receipt?.mbrPaidMicroAlgos, scenario === 'accepted' ? 42 : undefined);
  });
}
