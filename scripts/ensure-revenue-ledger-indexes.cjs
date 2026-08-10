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
    const settlementBatches = db.collection('revenue_settlement_batches');

    const indexResults = await Promise.all([
      revenueLedger.createIndex(
        { idempotencyKey: 1 },
        {
          name: 'revenue_ledger_idempotency_key_unique',
          unique: true,
        }
      ),

      revenueLedger.createIndex(
        {
          status: 1,
          settlementBatchId: 1,
          revenuePoolAppId: 1,
          ipAssetId: 1,
          revenueTokenAssetId: 1,
          settlementLeaseExpiresAt: 1,
          createdAt: 1,
        },
        {
          name: 'revenue_ledger_eligible_batch_claim',
        }
      ),

      revenueLedger.createIndex(
        {
          orderId: 1,
          orderItemId: 1,
          createdAt: 1,
        },
        {
          name: 'revenue_ledger_order_item_lookup',
        }
      ),

      settlementBatches.createIndex(
        { batchKey: 1 },
        {
          name: 'revenue_settlement_batch_key_unique',
          unique: true,
        }
      ),

      settlementBatches.createIndex(
        {
          status: 1,
          revenuePoolAppId: 1,
          poolKey: 1,
          revenueTokenAssetId: 1,
          createdAt: 1,
        },
        {
          name: 'revenue_settlement_batch_status_pool',
        }
      ),
    ]);

    const [ledgerIndexes, batchIndexes] = await Promise.all([
      revenueLedger.indexes(),
      settlementBatches.indexes(),
    ]);

    console.log('Revenue settlement indexes ensured:', {
      database: DB_NAME,
      dnsServers: dns.getServers(),
      createdOrExistingIndexes: indexResults,
      revenueLedgerIndexes: ledgerIndexes.map((index) => index.name),
      settlementBatchIndexes: batchIndexes.map((index) => index.name),
    });
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Failed to ensure revenue settlement indexes:', error);
  process.exitCode = 1;
});