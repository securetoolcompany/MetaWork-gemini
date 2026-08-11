require('dotenv').config({ path: '.env.local' });

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const algosdk = require('algosdk');
const path = require('path');
const fs = require('fs');

const {
  getAlgodClient,
  getSigner,
  getUsdcAssetId,
} = require(path.resolve(process.cwd(), 'lib/algorand.js'));

const APP_ID = Number(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID || 768287773);
const DEPOSIT_ONLY = process.argv.includes('--deposit-only');
const IP_ID = process.env.SEED_IP_ID || '';
const AMOUNT = Number(process.env.SEED_USDC_AMOUNT || 0);

function log(...args) {
  console.log('[seed-held-release]', ...args);
}

function poolBoxName(ipId) {
  return new Uint8Array(Buffer.from(`p_${ipId}`));
}

function roundBoxName(ipId, roundId) {
  const prefix = Buffer.from(`rnd_${ipId}`);
  const roundBytes = Buffer.alloc(8);
  roundBytes.writeBigUInt64BE(BigInt(roundId));
  return new Uint8Array(Buffer.concat([prefix, roundBytes]));
}

function readPoolBox(raw) {
  const value =
    raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(raw, 'base64');
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  const stakeholderCount = value[40];

  return {
    revAsaId: Number(view.getBigUint64(0)),
    unallocatedUsdc: Number(view.getBigUint64(8)),
    totalClaimed: Number(view.getBigUint64(16)),
    heldUsdc: Number(view.getBigUint64(24)),
    currentRoundId: Number(view.getBigUint64(32)),
    stakeholderCount,
    proxyAddress: algosdk.encodeAddress(value.slice(41, 73)),
    stakeholders: Array.from({ length: stakeholderCount }, (_, index) => ({
      address: algosdk.encodeAddress(
        value.slice(73 + index * 35, 73 + index * 35 + 32)
      ),
      bps: value[73 + index * 35 + 32] * 256 + value[73 + index * 35 + 33],
      claimed: value[73 + index * 35 + 34] === 1,
    })),
  };
}

function readRoundBox(raw) {
  const value =
    raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(raw, 'base64');
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  const holderCount = view.getUint16(16);
  const roundEntriesOffset = 18;
  const roundEntrySize = 41;

  return {
    roundAmount: Number(view.getBigUint64(0)),
    roundCreated: Number(view.getBigUint64(8)),
    holders: Array.from({ length: holderCount }, (_, index) => {
      const offset = roundEntriesOffset + index * roundEntrySize;

      return {
        address: algosdk.encodeAddress(value.slice(offset, offset + 32)),
        amount: Number(view.getBigUint64(offset + 32)),
        claimed: value[offset + 40] === 1,
      };
    }),
  };
}

function assertInputs() {
  if (!Number.isSafeInteger(APP_ID) || APP_ID < 1) {
    throw new Error('NEXT_PUBLIC_REVENUE_POOL_APP_ID must be a positive safe integer.');
  }

  if (!IP_ID.trim()) {
    throw new Error('SEED_IP_ID is required.');
  }

  if (!Number.isSafeInteger(AMOUNT) || AMOUNT < 1) {
    throw new Error(
      'SEED_USDC_AMOUNT is required and must be a positive integer in atomic microUSDC units.'
    );
  }

  if (DEPOSIT_ONLY && process.env.SEED_IP_ID !== IP_ID) {
    throw new Error(
      'For --deposit-only, set SEED_IP_ID explicitly instead of relying on a script default.'
    );
  }

  if (DEPOSIT_ONLY && String(process.env.SEED_USDC_AMOUNT || '') !== String(AMOUNT)) {
    throw new Error(
      'For --deposit-only, set SEED_USDC_AMOUNT explicitly in atomic microUSDC units.'
    );
  }
}

async function getBox(algod, name) {
  const response = await algod.getApplicationBoxByName(APP_ID, name).do();
  return Buffer.from(response.value);
}

function roundMbr(ipId, holderCount) {
  return 2500 + 400 * (12 + Buffer.byteLength(ipId) + 18 + holderCount * 41);
}

async function confirm(algod, txId, maxRounds = 8) {
  try {
    return await algosdk.waitForConfirmation(algod, txId, maxRounds);
  } catch (_error) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    return algod.pendingTransactionInformation(txId).do();
  }
}

async function sendGroup(algod, transactions, signer, appCallIndex = transactions.length - 1) {
  algosdk.assignGroupID(transactions);

  const signedTransactions = transactions.map((transaction) =>
    signer.signTxn(transaction)
  );

  await algod.sendRawTransaction(signedTransactions).do();

  return transactions[appCallIndex].txID();
}

async function buildDepositHeld(algod, signer, ipId, amount) {
  const suggestedParams = await algod.getTransactionParams().do();
  const appAddress = algosdk.getApplicationAddress(APP_ID).toString();
  const usdcAssetId = getUsdcAssetId('testnet');

  const usdcTransfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: signer.address,
    receiver: appAddress,
    assetIndex: usdcAssetId,
    amount,
    suggestedParams,
  });

  const depositHeldCall = algosdk.makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('deposit_held'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [usdcAssetId],
    boxes: [{ appIndex: APP_ID, name: poolBoxName(ipId) }],
    suggestedParams: {
      ...suggestedParams,
      fee: 2000n,
      flatFee: true,
    },
  });

  return [usdcTransfer, depositHeldCall];
}

async function buildReleaseHeld(
  algod,
  signer,
  ipId,
  currentRoundId,
  stakeholderCount
) {
  const suggestedParams = await algod.getTransactionParams().do();
  const appAddress = algosdk.getApplicationAddress(APP_ID).toString();
  const usdcAssetId = getUsdcAssetId('testnet');
  const nextRoundId = currentRoundId + 1;
  const mbr = roundMbr(ipId, stakeholderCount);

  const mbrPayment = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: signer.address,
    receiver: appAddress,
    amount: mbr,
    suggestedParams,
  });

  const releaseHeldCall = algosdk.makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('release_held'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [usdcAssetId],
    boxes: [
      { appIndex: APP_ID, name: poolBoxName(ipId) },
      { appIndex: APP_ID, name: roundBoxName(ipId, nextRoundId) },
    ],
    suggestedParams: {
      ...suggestedParams,
      fee: 2000n,
      flatFee: true,
    },
  });

  return [mbrPayment, releaseHeldCall];
}

function writeArtifact(data) {
  const outputPath = path.resolve(process.cwd(), '.seed-held-release.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  log('Wrote artifact', outputPath);
}

async function main() {
  assertInputs();

  const algod = getAlgodClient('testnet');
  const signer = getSigner();
  const usdcAssetId = getUsdcAssetId('testnet');

  log('Google DNS forced', dns.getServers().join(', '));
  log('Mode', DEPOSIT_ONLY ? 'deposit-only' : 'seed-and-release');
  log('Network', 'testnet');
  log('App ID', APP_ID);
  log('IP ID', IP_ID);
  log('Amount microUSDC', AMOUNT);
  log('Amount USDC', (AMOUNT / 1_000_000).toFixed(6));
  log('Admin signer', signer.address);
  log('USDC ASA', usdcAssetId);

  const before = readPoolBox(await getBox(algod, poolBoxName(IP_ID)));

  log(
    'Pool before',
    JSON.stringify(
      {
        revAsaId: before.revAsaId,
        unallocatedUsdc: before.unallocatedUsdc,
        heldUsdc: before.heldUsdc,
        currentRoundId: before.currentRoundId,
        stakeholderCount: before.stakeholderCount,
        proxyAddress: before.proxyAddress,
        stakeholders: before.stakeholders,
      },
      null,
      2
    )
  );

  const depositTransactions = await buildDepositHeld(
    algod,
    signer,
    IP_ID,
    AMOUNT
  );
  const depositTxId = await sendGroup(algod, depositTransactions, signer);

  await confirm(algod, depositTxId);
  log('deposit_held confirmed', depositTxId);

  const afterDeposit = readPoolBox(await getBox(algod, poolBoxName(IP_ID)));

  log(
    'Pool after deposit',
    JSON.stringify(
      {
        heldUsdc: afterDeposit.heldUsdc,
        unallocatedUsdc: afterDeposit.unallocatedUsdc,
        currentRoundId: afterDeposit.currentRoundId,
      },
      null,
      2
    )
  );

  if (DEPOSIT_ONLY) {
    writeArtifact({
      mode: 'deposit-only',
      network: 'testnet',
      appId: APP_ID,
      ipId: IP_ID,
      amount: AMOUNT,
      amountUsdc: AMOUNT / 1_000_000,
      usdcAssetId,
      signer: signer.address,
      depositTxId,
      heldUsdcAfterDeposit: afterDeposit.heldUsdc,
      currentRoundIdAfterDeposit: afterDeposit.currentRoundId,
      releaseTxId: null,
      roundId: null,
      round: null,
    });

    log(
      'Deposit-only mode complete. No release_held group was built, signed, or submitted.'
    );
    return;
  }

  const releaseTransactions = await buildReleaseHeld(
    algod,
    signer,
    IP_ID,
    afterDeposit.currentRoundId,
    afterDeposit.stakeholderCount
  );
  const releaseTxId = await sendGroup(algod, releaseTransactions, signer);

  await confirm(algod, releaseTxId);
  log('release_held confirmed', releaseTxId);

  const afterRelease = readPoolBox(await getBox(algod, poolBoxName(IP_ID)));
  const newRoundId = afterRelease.currentRoundId;
  const round = readRoundBox(
    await getBox(algod, roundBoxName(IP_ID, newRoundId))
  );

  log(
    'Pool after release',
    JSON.stringify(
      {
        heldUsdc: afterRelease.heldUsdc,
        unallocatedUsdc: afterRelease.unallocatedUsdc,
        currentRoundId: afterRelease.currentRoundId,
      },
      null,
      2
    )
  );

  log(
    'Created round',
    JSON.stringify(
      {
        roundId: newRoundId,
        roundAmount: round.roundAmount,
        roundCreated: round.roundCreated,
        holders: round.holders,
      },
      null,
      2
    )
  );

  writeArtifact({
    mode: 'seed-and-release',
    network: 'testnet',
    appId: APP_ID,
    ipId: IP_ID,
    amount: AMOUNT,
    amountUsdc: AMOUNT / 1_000_000,
    usdcAssetId,
    signer: signer.address,
    depositTxId,
    releaseTxId,
    roundId: newRoundId,
    round,
  });
}

main().catch((error) => {
  console.error('[seed-held-release] ERROR', error.message);
  console.error(error.stack);
  process.exit(1);
});