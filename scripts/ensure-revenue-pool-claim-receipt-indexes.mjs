import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env.local at ${envPath}`);
  }

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');

    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const { getDatabase } = await import('../lib/mongodb.js');

const collectionName = 'revenue_pool_claim_receipts';
const db = await getDatabase();
const receipts = db.collection(collectionName);

await receipts.createIndex(
  {
    appId: 1,
    poolKey: 1,
    roundId: 1,
    claimerAddress: 1,
  },
  {
    unique: true,
    name: 'revenue_pool_claim_receipt_identity',
  },
);

await receipts.createIndex(
  {
    appId: 1,
    poolKey: 1,
    claimerAddress: 1,
    claimedAt: -1,
  },
  {
    name: 'revenue_pool_claim_receipt_history_lookup',
  },
);

console.log(
  JSON.stringify(
    {
      collection: collectionName,
      indexes: [
        'revenue_pool_claim_receipt_identity',
        'revenue_pool_claim_receipt_history_lookup',
      ],
    },
    null,
    2,
  ),
);