import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import algosdk from 'algosdk';

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

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be set in .env.local`);
  }

  return value;
}

function holdingAmount(account, assetId) {
  const holding = account.assets?.find(
    (asset) => Number(asset['asset-id']) === assetId,
  );

  return Number(holding?.amount ?? 0);
}

async function maybeGetBox(algod, appId, boxName) {
  try {
    const response = await algod
      .getApplicationBoxByName(appId, boxName)
      .do();

    const value = Buffer.from(response.value);

    return {
    exists: true,
    size: value.length,
    valueBase64: value.toString('base64'),
    decoded: decodeV10PoolBox(value),
    };
  } catch (error) {
    const status = error?.response?.status ?? error?.status;

    if (status === 404) {
      return {
        exists: false,
        size: 0,
        valueBase64: null,
      };
    }

    throw error;
  }
}

function decodeV10PoolBox(value) {
  const bytes = Buffer.from(value);

  if (bytes.length !== 108) {
    return {
      decoded: false,
      reason: `Unexpected pool-box size: ${bytes.length}`,
    };
  }

  return {
    decoded: true,
    revenueTokenAssetId: bytes.readBigUInt64BE(0).toString(),
    heldUsdcAtomicUnits: bytes.readBigUInt64BE(8).toString(),
    currentRoundId: bytes.readBigUInt64BE(16).toString(),
    stakeholderCount: bytes.readUInt16BE(24),
    };
}

loadEnvLocal();

const appId = 769218532;
const poolKey = '6a84bf41f49bcdc863f8e4ef';
const usdcAssetId = 10458941;
const expectedSender =
  '2F7AVO5UOVAECY5WXURXNOCYBXMSB7MVSMXCD4ZFLSAN62WIQGDERT7JTY';

const algodServer = requireEnv('ALGORAND_TESTNET_RPC');
const mnemonic = requireEnv('METAWORK_PLATFORM_MNEMONIC');

const algod = new algosdk.Algodv2('', algodServer, '');
const signer = algosdk.mnemonicToSecretKey(mnemonic);
const sender = signer.addr.toString();

if (sender !== expectedSender) {
  throw new Error(
    `Mnemonic-derived sender mismatch: expected ${expectedSender}, got ${sender}`,
  );
}

const appAddress = algosdk.getApplicationAddress(appId).toString();
const poolBoxName = new Uint8Array(
  Buffer.from(`p_${poolKey}`, 'utf8'),
);

const [appInfo, senderAccount, appAccount, poolBox] = await Promise.all([
  algod.getApplicationByID(appId).do(),
  algod.accountInformation(sender).do(),
  algod.accountInformation(appAddress).do(),
  maybeGetBox(algod, appId, poolBoxName),
]);

console.log(
  JSON.stringify(
    {
      mode: 'read-only-preflight',
      appId,
      appAddress,
      poolKey,
      poolBoxNameUtf8: Buffer.from(poolBoxName).toString('utf8'),
      poolBox,
      appCreator: appInfo.params.creator,
      appGlobalState: appInfo.params['global-state'] ?? [],
      sender: {
        address: sender,
        algoBalanceMicroalgos: Number(senderAccount.amount),
        minBalanceMicroalgos: Number(senderAccount['min-balance']),
      },
      appAccount: {
        algoBalanceMicroalgos: Number(appAccount.amount),
        minBalanceMicroalgos: Number(appAccount['min-balance']),
        usdcAssetId,
        usdcAtomicUnits: holdingAmount(appAccount, usdcAssetId),
      },
      submitted: false,
    },
    null,
    2,
  ),
);