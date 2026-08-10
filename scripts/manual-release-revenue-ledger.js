// scripts/manual-release-revenue-ledger.mjs

import dns from 'node:dns';
import { createRequire } from 'node:module';

import { MongoClient, ObjectId } from 'mongodb';

import {
  MANUAL_TEST_RELEASE_REASON,
  transitionHeldLedgerRowsToReleaseEligible,
} from '../lib/revenue-ledger-eligibility.js';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: '.env.local' });

function parseArgs(argv) {
  const ledgerIds = [];
  let orderId = null;
  let actor = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === '--ledger-id') {
      if (!value) {
        throw new Error('--ledger-id requires a value');
      }

      ledgerIds.push(value);
      index += 1;
      continue;
    }

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

  if (ledgerIds.length > 0 && orderId) {
    throw new Error(
      'Provide --ledger-id one or more times, or one --order-id, not both'
    );
  }

  if (ledgerIds.length === 0 && !orderId) {
    throw new Error(
      'Provide at least one --ledger-id or exactly one --order-id'
    );
  }

  if (!actor) {
    throw new Error('--actor is required');
  }

  return {
    ledgerIds,
    orderId,
    actor,
  };
}

function normalizeLedgerIds(ledgerIds) {
  return ledgerIds.map((ledgerId) => {
    if (!ObjectId.isValid(ledgerId)) {
      throw new Error(
        `Invalid MongoDB ledger ID: ${ledgerId}. Use --order-id for a scoped test order instead.`
      );
    }

    return new ObjectId(ledgerId);
  });
}

async function main() {
  if (process.env.METAWORK_ENABLE_MANUAL_TEST_RELEASE !== 'true') {
    throw new Error(
      'Manual test release is disabled. Set METAWORK_ENABLE_MANUAL_TEST_RELEASE=true in .env.local for a deliberate testnet-only run.'
    );
  }

  const { ledgerIds, orderId, actor } = parseArgs(process.argv.slice(2));

  const mongodbUri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || 'metawork_db';

  if (!mongodbUri) {
    throw new Error('MONGODB_URI env var is not set in .env.local');
  }

  const client = new MongoClient(mongodbUri);

  try {
    await client.connect();

    const db = client.db(dbName);

    const result = await transitionHeldLedgerRowsToReleaseEligible({
      db,
      ledgerIds:
        ledgerIds.length > 0 ? normalizeLedgerIds(ledgerIds) : null,
      orderId,
      actor,
      reason: MANUAL_TEST_RELEASE_REASON,
    });

    console.log('Manual test ledger release complete:', {
      orderId: orderId || null,
      ledgerIds: ledgerIds.length > 0 ? ledgerIds : null,
      actor: result.actor,
      reason: result.reason,
      transitionedCount: result.transitionedCount,
      existingEligibleCount: result.existingEligibleCount,
    });
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Manual test ledger release failed:', error.message);
  process.exitCode = 1;
});