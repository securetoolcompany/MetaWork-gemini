// scripts/recover-revenue-ledger-order.js

import dns from 'node:dns';
import { createRequire } from 'node:module';

import { MongoClient, ObjectId } from 'mongodb';

import { createHeldRevenueLedgerEntriesForOrder } from '../lib/revenue-ledger-service.js';

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
  if (process.env.METAWORK_ENABLE_REVENUE_LEDGER_RECOVERY !== 'true') {
    throw new Error(
      'Revenue-ledger recovery is disabled. Set METAWORK_ENABLE_REVENUE_LEDGER_RECOVERY=true in .env.local for a deliberate testnet-only run.'
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
    const orders = db.collection('orders');
    const orderObjectId = new ObjectId(orderId);

    const order = await orders.findOne({
      _id: orderObjectId,
    });

    if (!order) {
      throw new Error(`Order was not found: ${orderId}`);
    }

    if (order.status !== 'paid') {
      throw new Error(
        `Order ${orderId} must have status "paid"; found "${order.status}"`
      );
    }

    const recoveredAt = new Date();

    const ledgerResult = await createHeldRevenueLedgerEntriesForOrder({
      db,
      order,
      now: recoveredAt,
    });

    await orders.updateOne(
      { _id: orderObjectId },
      {
        $set: {
          revenueLedgerStatus: 'created',
          revenueLedgerRecoveredAt: recoveredAt,
          revenueLedgerRecoveryActor: actor,
          revenueLedgerRowCount: ledgerResult.rows.length,
          revenueLedgerLastError: null,
        },
      }
    );

    console.log('Revenue-ledger recovery complete:', {
      orderId,
      actor,
      createdCount: ledgerResult.createdCount,
      existingCount: ledgerResult.existingCount,
      rowCount: ledgerResult.rows.length,
    });
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Revenue-ledger recovery failed:', error.message);
  process.exitCode = 1;
});