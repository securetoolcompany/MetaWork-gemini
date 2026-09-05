import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import algosdk from 'algosdk';

// --- Read-only V10 revenue-pool state inspection ----------------------------
// This script performs NO signing, NO submission, NO MongoDB writes, and NO
// TestNet state changes. It only reads application boxes and account balances.
// Structure reused from scripts/dry-run-v10-payout-round.mjs; box encoders and
// decoders are kept local and mirror app/api/revenue-pool/claim/route.js.

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env.local at ${envPath}`);
  }

  const contents = fs.readFileSync(envPath, 'utf8');

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');

    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

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

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be set in .env.local`);
  }

  return value;
}

loadEnvLocal();

// Current TestNet operational constants (local to this script only).
const appId = 769218532;
const poolKey = process.argv[2]?.trim();

if (!poolKey) {
  throw new Error(
    'Usage: node scripts/inspect-v10-pool-state.mjs <poolKey>'
  );
}
const expectedSender =
  '2F7AVO5UOVAECY5WXURXNOCYBXMSB7MVSMXCD4ZFLSAN62WIQGDERT7JTY';
const usdcAssetId = 10458941;

const mnemonic = requireEnv('METAWORK_PLATFORM_MNEMONIC');
const algodServer = requireEnv('ALGORAND_TESTNET_RPC');
const algod = new algosdk.Algodv2('', algodServer, '');

const platformAccount = algosdk.mnemonicToSecretKey(mnemonic);
const sender = platformAccount.addr.toString();

if (sender !== expectedSender) {
  throw new Error(
    [
      'METAWORK_PLATFORM_MNEMONIC does not derive the configured platform wallet.',
      `Expected: ${expectedSender}`,
      `Derived:  ${sender}`,
    ].join('\n'),
  );
}

// --- Local box-name encoders (mirror claim-route layout) --------------------

function encodePoolBoxName(key) {
  return new Uint8Array(
    Buffer.concat([
      Buffer.from('p_', 'utf8'),
      Buffer.from(key, 'utf8'),
    ]),
  );
}

function encodeRoundBoxName(key, roundId) {
  const roundBytes = Buffer.alloc(8);
  roundBytes.writeBigUInt64BE(BigInt(roundId));

  return new Uint8Array(
    Buffer.concat([
      Buffer.from(`rnd_${key}`, 'utf8'),
      roundBytes,
    ]),
  );
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  return new Uint8Array(value);
}

// Pool box layout (matches app/api/revenue-pool/claim/route.js readPoolBox):
//   bytes 0..7   revenueTokenId  uint64 BE
//   bytes 8..15  unallocatedUsdc uint64 BE
//   bytes 16..23 totalClaimed    uint64 BE
//   bytes 24..31 heldUsdc        uint64 BE
//   bytes 32..39 currentRoundId  uint64 BE
//   byte 40      stakeholder count
function readPoolBox(value) {
  const rawValue = toUint8Array(value);

  if (rawValue.byteLength < 73) {
    throw new Error(
      `Malformed pool box: expected at least 73 bytes, received ${rawValue.byteLength}.`,
    );
  }

  const stakeholderCount = rawValue[40] ?? 0;
  const expectedPoolBoxLength = 73 + stakeholderCount * 35;

  if (rawValue.byteLength !== expectedPoolBoxLength) {
    throw new Error(
      `Malformed pool box: expected ${expectedPoolBoxLength} bytes for ` +
        `${stakeholderCount} stakeholder(s), received ${rawValue.byteLength}.`,
    );
  }

  const view = new DataView(
    rawValue.buffer,
    rawValue.byteOffset,
    rawValue.byteLength,
  );

  return {
    revenueTokenId: Number(view.getBigUint64(0, false)),
    unallocatedUsdc: Number(view.getBigUint64(8, false)),
    totalClaimed: Number(view.getBigUint64(16, false)),
    heldUsdc: Number(view.getBigUint64(24, false)),
    currentRoundId: Number(view.getBigUint64(32, false)),
    stakeholderCount,
  };
}

// Round box layout (matches claim-route readRoundBox):
//   bytes 0..7   roundAmount   uint64 BE
//   bytes 8..15  roundCreated  uint64 BE
//   bytes 16..17 holderCount   uint16 BE
function readRoundBox(value) {
  const rawValue = toUint8Array(value);
  const view = new DataView(rawValue.buffer, rawValue.byteOffset, rawValue.byteLength);
  const holderCount = view.getUint16(16, false);

  return {
    roundAmount: Number(view.getBigUint64(0, false)),
    roundCreated: Number(view.getBigUint64(8, false)),
    holderCount,
  };
}

// Returns the box value (Uint8Array/base64) or null when the box is absent.
async function readApplicationBox(boxName) {
  try {
    const box = await algod.getApplicationBoxByName(appId, boxName).do();
    if (!box) return null;
    return box.value ?? box;
  } catch (_err) {
    return null;
  }
}

// --- Gather state -----------------------------------------------------------

const suggestedParams = await algod.getTransactionParams().do();
const appAddress = algosdk.getApplicationAddress(appId).toString();

const [poolBoxValue, appAccount] = await Promise.all([
  readApplicationBox(encodePoolBoxName(poolKey)),
  algod.accountInformation(appAddress).do(),
]);

if (!poolBoxValue) {
  throw new Error(
    `Pool box not found for appId ${appId} / poolKey ${poolKey}. Has the pool been initialized?`,
  );
}

const pool = readPoolBox(poolBoxValue);

// Physical application-account USDC ASA balance (kept separate from ledger
// buckets — do not equate this with unallocatedUsdc).
const usdcHolding = (appAccount.assets || []).find(
  (asset) => Number(asset['asset-id'] ?? asset.assetId ?? 0) === usdcAssetId,
);
const appAccountUsdcAtomicUnits = Number(usdcHolding?.amount || 0);

// Probe rounds 1..currentRoundId. Missing boxes are normal after cleanup and
// are not treated as errors — only existing rounds are reported.
const existingRounds = [];

for (let roundId = 1; roundId <= pool.currentRoundId; roundId += 1) {
  const roundBoxName = encodeRoundBoxName(poolKey, roundId);
  const roundBoxValue = await readApplicationBox(roundBoxName);

  if (!roundBoxValue) {
    continue;
  }

  const round = readRoundBox(roundBoxValue);

  existingRounds.push({
    roundId,
    boxNameBase64: Buffer.from(roundBoxName).toString('base64'),
    roundAmountUsdcAtomicUnits: round.roundAmount,
    roundCreated: round.roundCreated,
    holderCount: round.holderCount,
  });
}

console.log(
  JSON.stringify(
    {
      mode: 'inspect-pool-state',
      network: suggestedParams.genesisID,
      appId,
      poolKey,
      appAddress,
      sender,
      pool: {
        revenueTokenId: pool.revenueTokenId.toString(),
        unallocatedUsdcAtomicUnits: pool.unallocatedUsdc.toString(),
        heldUsdcAtomicUnits: pool.heldUsdc.toString(),
        totalClaimedUsdcAtomicUnits: pool.totalClaimed.toString(),
        currentRoundId: pool.currentRoundId.toString(),
        stakeholderCount: pool.stakeholderCount,
      },
      appAccount: {
        algoBalanceMicroalgos: Number(appAccount.amount),
        usdcAssetId,
        usdcAtomicUnits: appAccountUsdcAtomicUnits,
      },
      existingRounds,
      submitted: false,
    },
    null,
    2,
  ),
);