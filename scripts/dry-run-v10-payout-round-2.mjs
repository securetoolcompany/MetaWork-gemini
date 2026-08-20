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
const poolKey = '6a84bf41f49bcdc863f8e4ef';
const expectedSender =
  '2F7AVO5UOVAECY5WXURXNOCYBXMSB7MVSMXCD4ZFLSAN62WIQGDERT7JTY';

// Round 2: two distinct recipients splitting the existing 1 USDC unallocated.
const nextRoundId = 2;
const totalUsdcAtomicUnits = 1_000_000;
const recipientOne =
  'CI6UHKREVAJVODRCHSYL54RPGRBQLMWSY3TVL64MT4TJSETHX6AXHRHUEA';
const recipientTwo =
  'COYJN7VFKE4FJO4BSUSYQA56GIE6CL6MUJLA5YY2HR47Z5RX2GH27TUOTE';

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

const [suggestedParams, senderAccount] = await Promise.all([
  algod.getTransactionParams().do(),
  algod.accountInformation(sender).do(),
]);

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
      mode: 'dry-run',
      network: suggestedParams.genesisID,
      appId,
      poolKey,
      sender,
      senderAlgoBalanceMicroalgos: Number(senderAccount.amount),
      appAddress: group.appAddress.toString(),
      action: group.action,
      totalUsdcAtomicUnits: group.totalUsdcAtomicUnits,
      nextRoundId: group.nextRoundId,
      recipientCount: group.recipientCount,
      roundPayees: group.roundPayees,
      roundBoxMbrMicroalgos: group.roundBoxMbrMicroalgos,
      companionPaymentIndex: group.companionPaymentIndex,
      transactionCount: group.transactionCount,
      appCallTransactionIndex: group.appCallTransactionIndex,
      companionPaymentTransactionIndex:
        group.companionPaymentTransactionIndex,
      groupId: group.groupId,
      transactionIds: group.transactionIds,
      unsignedTransactionHash: group.unsignedTransactionHash,
      roundPayeesHash: group.roundPayeesHash,
      submitted: false,
    },
    null,
    2,
  ),
);