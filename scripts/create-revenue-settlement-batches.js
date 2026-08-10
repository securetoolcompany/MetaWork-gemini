// scripts/create-revenue-settlement-batches.js

import dns from 'node:dns';
import { createRequire } from 'node:module';

import { MongoClient, ObjectId } from 'mongodb';

import { createSettlementBatchFromEligibleRows } from '../lib/revenue-settlement-batches.js';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: '.env.local' });

function parseArgs(argv) {
  let orderId = null;
  let actor = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === '--order-id') {
      if (!value) {
        throw new Error('--order-id requires a value');
      }

      orderId = value;
      index += 1;
      continue;
    }

    if (argument === '--actor') {
      if (!value) {
        throw new Error('--actor requires a value');
      }

      actor = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!orderId) {
    throw new Error('--order-id is required');
  }

  if (!ObjectId.isValid(orderId)) {
    throw new Error(`Invalid MongoDB order ID: ${orderId}`);
  }

  if (!actor) {
    throw new Error('--actor is required');
  }

  return {
    orderId,
    actor,
  };
}

async function main() {
  if (process.env.METAWORK_ENABLE_MANUAL_TEST_BATCHING !== 'true') {
    throw new Error(
      'Manual test batching is disabled. Set METAWORK_ENABLE_MANUAL_TEST_BATCHING=true in .env.local for a deliberate testnet-only run.'
    );
  }

  const { orderId, actor } = parseArgs(process.argv.slice(2));
  const mongodbUri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || 'metawork_db';

  if (!mongodbUri) {
    throw new Error('MONGODB_URI env var is not set in .env.local');
  }

  const client = new MongoClient(mongodbUri);

  try {
    await client.connect();

    const db = client.db(dbName);
    const order = await db.collection('orders').findOne({
      _id: new ObjectId(orderId),
    });

    if (!order) {
      throw new Error(`Order was not found: ${orderId}`);
    }

    if (order.status !== 'paid') {
      throw new Error(
        `Order ${orderId} must have status "paid"; found "${order.status}"`
      );
    }

    const batches = [];

    while (true) {
      const batch = await createSettlementBatchFromEligibleRows({
        db,
        orderId,
      });

      if (!batch) {
        break;
      }

      batches.push(batch);
    }

    if (batches.length === 0) {
      throw new Error(
        `No release-eligible unbatched ledger rows were found for order ${orderId}`
      );
    }

    console.log('Manual test settlement batches created:', {
      orderId,
      actor,
      batchCount: batches.length,
      batches: batches.map((batch) => ({
        batchId: batch.batchId,
        batchKey: batch.batchKey,
        revenuePoolAppId: batch.revenuePoolAppId,
        poolKey: batch.poolKey,
        revenueTokenAssetId: batch.revenueTokenAssetId,
        rowCount: batch.rowCount,
        totalAllocationCents: batch.totalAllocationCents,
        totalUsdcAtomicUnits: batch.totalUsdcAtomicUnits,
      })),
    });
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Manual test settlement batching failed:', error.message);
  process.exitCode = 1;
});