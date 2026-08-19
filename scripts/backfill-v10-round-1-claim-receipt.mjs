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

const {
  upsertRevenuePoolClaimReceipt,
} = await import('../lib/revenue-pool-claim-receipts.js');

const receipt = await upsertRevenuePoolClaimReceipt({
  appId: 769218532,
  poolKey: '6a84bf41f49bcdc863f8e4ef',
  roundId: 1,
  claimerAddress:
    'CI6UHKREVAJVODRCHSYL54RPGRBQLMWSY3TVL64MT4TJSETHX6AXHRHUEA',
  amountUsdcAtomicUnits: 2_000_000,
  roundCreated: null,
  claimTransactionId:
    'EHKP42TGZURNFW6BORP45KPVWWH6SG7AWUZFMBYYELTDEHY4FX7Q',
  claimedAt: new Date('2026-08-18T22:25:00.000Z'),
});

console.log(
  JSON.stringify(
    {
      outcome: 'upserted',
      receipt,
    },
    null,
    2,
  ),
);