import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { claimIpFunding } from '../lib/ip-source/pool-funding.js';

test('concurrent submissions have one Mongo claim and one broadcast', async () => {
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(server.getUri());
  try {
    const collection = client.db('isolated_ip_funding').collection('ip_assets');
    const binding = { id: 'asset', ownerId: 'owner', tokenizationOperationKey: 'op' };
    await collection.insertOne({ ...binding, fundingAttempt: { status: 'awaiting_signature', expectedTransactionId: 'original' } });
    let sends = 0;
    const claims = await Promise.all(Array.from({ length: 8 }, () => claimIpFunding({
      collection, binding, txid: 'original', broadcast: async () => { sends++; },
    })));
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(sends, 1);
    assert.equal((await collection.findOne(binding)).fundingAttempt.status, 'submitting');
  } finally { await client.close(); await server.stop(); }
});
