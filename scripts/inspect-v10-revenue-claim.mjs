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

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be set in .env.local`);
  }

  return value;
}

function decodeUtf8(value) {
  if (!value) {
    return '';
  }

  return Buffer.from(value).toString('utf8');
}

function getAddress(value) {
  if (!value) {
    return null;
  }

  try {
    return algosdk.encodeAddress(value.publicKey || value);
  } catch {
    return null;
  }
}

function normalizeInteger(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
}

loadEnvLocal();

const algodServer = requireEnv('ALGORAND_TESTNET_RPC');
const algod = new algosdk.Algodv2('', algodServer, '');

const transactionId =
  'EHKP42TGZURNFW6BORP45KPVWWH6SG7AWUZFMBYYELTDEHY4FX7Q';

const pending = await algod
  .pendingTransactionInformation(transactionId)
  .do();

const transaction = pending?.txn?.txn;
const applicationCall = transaction?.applicationCall;
const appArgs = Array.isArray(applicationCall?.appArgs)
  ? applicationCall.appArgs
  : [];

const innerTxns = Array.isArray(pending?.innerTxns)
  ? pending.innerTxns
  : [];

const innerPayments = innerTxns
  .map((entry) => entry?.txn?.txn)
  .filter((inner) => inner?.type === 'pay')
  .map((inner) => ({
    sender: getAddress(inner.sender),
    receiver: getAddress(inner.payment?.receiver),
    amountMicroalgos: normalizeInteger(inner.payment?.amount),
  }));

console.log(
  JSON.stringify(
    {
      transactionId,
      confirmedRound: normalizeInteger(pending?.confirmedRound),
      poolError: pending?.poolError || null,

      sender: getAddress(transaction?.sender),
      type: transaction?.type || null,
      feeMicroalgos: normalizeInteger(transaction?.fee),

      appId: normalizeInteger(applicationCall?.appIndex),
      action: decodeUtf8(appArgs[0]),
      poolKey: decodeUtf8(appArgs[1]),
      roundId:
        appArgs[2] && Buffer.from(appArgs[2]).length === 8
          ? Buffer.from(appArgs[2]).readBigUInt64BE().toString()
          : null,

      innerPayments,
    },
    null,
    2,
  ),
);