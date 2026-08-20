import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import algosdk from 'algosdk';

import {
  buildUnsignedV10CreatePayoutRoundGroup,
} from '../lib/revenue-pool-v10-payout.js';

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

async function waitForConfirmation(algod, transactionId, attempts = 20) {
  const status = await algod.status().do();
    const lastRoundValue = status['last-round'];
    const lastRound =
    typeof lastRoundValue === 'bigint'
        ? Number(lastRoundValue)
        : Number(String(lastRoundValue));

  if (!Number.isSafeInteger(lastRound) || lastRound < 0) {
    throw new Error(
      `Algod status did not include a valid last-round. ` +
        `ALGORAND_TESTNET_RPC=${algodServer}; ` +
        `status=${JSON.stringify(
          status,
          (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
        )}`,
    );
  }

  let round = lastRound + 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const pending = await algod
      .pendingTransactionInformation(transactionId)
      .do();

    if (Number(pending['confirmed-round']) > 0) {
      return pending;
    }

    if (pending['pool-error']) {
      throw new Error(
        `Transaction rejected: ${pending['pool-error']}`,
      );
    }

    await algod.statusAfterBlock(round).do();
    round += 1;
  }

  throw new Error(
    `Transaction ${transactionId} was not confirmed after ${attempts} rounds`,
  );
}

loadEnvLocal();

// Current TestNet operational constants (local to this script only).
const appId = 769218532;
const poolKey = '6a84bf41f49bcdc863f8e4ef';
const expectedSender =
  '2F7AVO5UOVAECY5WXURXNOCYBXMSB7MVSMXCD4ZFLSAN62WIQGDERT7JTY';

// Round 2: two distinct recipients splitting the existing 1 USDC unallocated.
const recipientOne =
  'CI6UHKREVAJVODRCHSYL54RPGRBQLMWSY3TVL64MT4TJSETHX6AXHRHUEA';
const recipientTwo =
  'COYJN7VFKE4FJO4BSUSYQA56GIE6CL6MUJLA5YY2HR47Z5RX2GH27TUOTE';
const totalUsdcAtomicUnits = 1_000_000;
const nextRoundId = 2;

const mnemonic = requireEnv('METAWORK_PLATFORM_MNEMONIC');
const algodServer = requireEnv('ALGORAND_TESTNET_RPC');

const algod = new algosdk.Algodv2('', algodServer, '');
const signer = algosdk.mnemonicToSecretKey(mnemonic);
const sender = signer.addr.toString();

if (sender !== expectedSender) {
  throw new Error(
    `Mnemonic-derived sender mismatch: expected ${expectedSender}, got ${sender}`,
  );
}

const suggestedParams = await algod.getTransactionParams().do();

const group = buildUnsignedV10CreatePayoutRoundGroup({
  appId,
  poolKey,
  sender,
  roundPayees: [
    { address: recipientOne, amountUsdcAtomicUnits: 500_000 },
    { address: recipientTwo, amountUsdcAtomicUnits: 500_000 },
  ],
  totalUsdcAtomicUnits,
  nextRoundId,
  suggestedParams,
});

console.log(
  JSON.stringify(
    {
      action: group.action,
      appId,
      poolKey,
      nextRoundId,
      recipientCount: group.recipientCount,
      totalUsdcAtomicUnits,
      roundPayees: group.roundPayees,
      roundBoxMbrMicroalgos: group.roundBoxMbrMicroalgos,
      unsignedTransactionCount: group.unsignedTransactionsBase64.length,
      transactionIds: group.transactionIds,
    },
    null,
    2,
  ),
);

const transactions = group.unsignedTransactionsBase64.map(
  (encodedTransaction) =>
    algosdk.decodeUnsignedTransaction(
      new Uint8Array(Buffer.from(encodedTransaction, 'base64')),
    ),
);

const signedTransactions = transactions.map((transaction) =>
  transaction.signTxn(signer.sk),
);

console.log(
  JSON.stringify(
    {
      outcome: 'submitting',
      transactionId: group.transactionIds.appCall,
    },
    null,
    2,
  ),
);

const response = await algod.sendRawTransaction(signedTransactions).do();
const confirmation = await waitForConfirmation(algod, response.txid);

console.log(
  JSON.stringify(
    {
      outcome: 'confirmed',
      appId,
      poolKey,
      sender,
      appAddress: group.appAddress.toString(),
      totalUsdcAtomicUnits,
      nextRoundId,
      recipientCount: group.recipientCount,
      roundPayees: group.roundPayees,
      roundBoxMbrMicroalgos: group.roundBoxMbrMicroalgos,
      groupId: group.groupId,
      transactionIds: group.transactionIds,
      submittedTransactionId: response.txid,
      confirmedRound: confirmation['confirmed-round'],
      poolError: confirmation['pool-error'] || null,
    },
    null,
    2,
  ),
);