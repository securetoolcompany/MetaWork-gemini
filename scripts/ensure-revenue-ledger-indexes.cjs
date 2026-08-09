// scripts/ensure-revenue-ledger-indexes.cjs

const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'metawork_db';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI env var is not set in .env.local');
}

async function main() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const revenueLedger = db.collection('revenue_ledger');

    const indexName = await revenueLedger.createIndex(
      { idempotencyKey: 1 },
      {
        name: 'revenue_ledger_idempotency_key_unique',
        unique: true,
      }
    );

    const indexes = await revenueLedger.indexes();
    const idempotencyIndex = indexes.find(
      (index) => index.name === 'revenue_ledger_idempotency_key_unique'
    );

    if (!idempotencyIndex) {
      throw new Error(
        'Revenue ledger idempotency index was not found after creation'
      );
    }

    console.log('Revenue ledger indexes ensured:', {
      database: DB_NAME,
      dnsServers: dns.getServers(),
      createdOrExistingIndex: indexName,
      idempotencyIndex,
    });
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Failed to ensure revenue ledger indexes:', error);
  process.exitCode = 1;
});