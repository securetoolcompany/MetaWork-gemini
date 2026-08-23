import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

dns.setServers(['8.8.8.8', '8.8.4.4']);

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

    const index = line.indexOf('=');

    if (index <= 0) {
      continue;
    }

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

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

const { connectToDatabase } = await import('../lib/mongodb.js');

const materializationKey =
  '6a8a0ca319e195f35aa56e5b:confirmed-deposit-ledger:v1';
const batchId = '6a8a0ca319e195f35aa56e5b';
const usdcDepositTxId =
  'MKODHDKTFC4BTOFNT6G6KU2O3GGR2T7DJMB5GRJBVEDD5PNKIBEA';
const confirmedRound = '66599988';

const { db } = await connectToDatabase();

const collection = db.collection(
  'revenue_settlement_deposit_ledger_materializations',
);

const filter = {
  materializationKey,
  batchId,
  usdcDepositTxId,
  confirmedRound: null,
};

const result = await collection.updateOne(
  filter,
  {
    $set: {
      confirmedRound,
      updatedAt: new Date(),
    },
  },
);

if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
  throw new Error(
    `Expected one null-round materialization repair; matched ${result.matchedCount}, modified ${result.modifiedCount}`,
  );
}

console.log(JSON.stringify({
  repaired: true,
  materializationKey,
  batchId,
  usdcDepositTxId,
  confirmedRound,
}, null, 2));