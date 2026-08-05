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
const IP_ID = process.env.SEED_IP_ID || '6a6fb77f9f800d3fe22d7d38';
const AMOUNT = Number(process.env.SEED_USDC_AMOUNT || 1_000_000);

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
  const v = raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(raw, 'base64');
  const dv = new DataView(v.buffer, v.byteOffset, v.byteLength);
  const shCount = v[40];
  return {
    revAsaId: Number(dv.getBigUint64(0)),
    unallocatedUsdc: Number(dv.getBigUint64(8)),
    totalClaimed: Number(dv.getBigUint64(16)),
    heldUsdc: Number(dv.getBigUint64(24)),
    currentRoundId: Number(dv.getBigUint64(32)),
    shCount,
    proxyAddress: algosdk.encodeAddress(v.slice(41, 73)),
    stakeholders: Array.from({ length: shCount }, (_, i) => ({
      address: algosdk.encodeAddress(v.slice(73 + i * 35, 73 + i * 35 + 32)),
      bps: v[73 + i * 35 + 32] * 256 + v[73 + i * 35 + 33],
      claimed: v[73 + i * 35 + 34] === 1,
    })),
  };
}

function readRoundBox(raw) {
  const v = raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(raw, 'base64');
  const dv = new DataView(v.buffer, v.byteOffset, v.byteLength);
  const roundAmount = Number(dv.getBigUint64(0));
  const roundCreated = Number(dv.getBigUint64(8));
  const holderCount = dv.getUint16(16);
  const RND_ENTRIES_OFFSET = 18;
  const RND_ENTRY_SIZE = 41;
  return {
    roundAmount,
    roundCreated,
    holders: Array.from({ length: holderCount }, (_, i) => {
      const off = RND_ENTRIES_OFFSET + i * RND_ENTRY_SIZE;
      return {
        address: algosdk.encodeAddress(v.slice(off, off + 32)),
        amount: Number(dv.getBigUint64(off + 32)),
        claimed: v[off + 40] === 1,
      };
    }),
  };
}

async function getBox(algod, name) {
  const res = await algod.getApplicationBoxByName(APP_ID, name).do();
  return Buffer.from(res.value);
}

function roundMbr(ipId, holderCount) {
  return 2500 + 400 * (12 + Buffer.byteLength(ipId) + 18 + holderCount * 41);
}

async function confirm(algod, txId, maxRounds = 8) {
  try {
    return await algosdk.waitForConfirmation(algod, txId, maxRounds);
  } catch (_err) {
    await new Promise((r) => setTimeout(r, 4000));
    return await algod.pendingTransactionInformation(txId).do();
  }
}

async function sendGroup(algod, txns, signer, appCallIndex = txns.length - 1) {
  algosdk.assignGroupID(txns);
  const signed = txns.map((txn) => signer.signTxn(txn));
  await algod.sendRawTransaction(signed).do();
  return txns[appCallIndex].txID();
}

async function buildDepositHeld(algod, signer, ipId, amount) {
  const sp = await algod.getTransactionParams().do();
  const appAddr = algosdk.getApplicationAddress(APP_ID).toString();

  const usdcTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: signer.address,
    receiver: appAddr,
    assetIndex: getUsdcAssetId('testnet'),
    amount,
    suggestedParams: sp,
  });

  const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('deposit_held'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [getUsdcAssetId('testnet')],
    boxes: [{ appIndex: APP_ID, name: poolBoxName(ipId) }],
    suggestedParams: { ...sp, fee: 2000n, flatFee: true },
  });

  return [usdcTxn, appTxn];
}

async function buildReleaseHeld(algod, signer, ipId, currentRoundId, holderCount) {
  const sp = await algod.getTransactionParams().do();
  const appAddr = algosdk.getApplicationAddress(APP_ID).toString();
  const nextRoundId = currentRoundId + 1;
  const mbr = roundMbr(ipId, holderCount);

  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: signer.address,
    receiver: appAddr,
    amount: mbr,
    suggestedParams: sp,
  });

  const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('release_held'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [getUsdcAssetId('testnet')],
    boxes: [
      { appIndex: APP_ID, name: poolBoxName(ipId) },
      { appIndex: APP_ID, name: roundBoxName(ipId, nextRoundId) },
    ],
    suggestedParams: { ...sp, fee: 2000n, flatFee: true },
  });

  return [payTxn, appTxn];
}

async function main() {
  const algod = getAlgodClient('testnet');
  const signer = getSigner();
  const usdcId = getUsdcAssetId('testnet');

  log('Google DNS forced', dns.getServers().join(', '));
  log('App ID', APP_ID);
  log('IP ID', IP_ID);
  log('Amount microUSDC', AMOUNT);
  log('Amount USDC', (AMOUNT / 1_000_000).toFixed(6));
  log('Admin signer', signer.address);
  log('USDC ASA', usdcId);

  const before = readPoolBox(await getBox(algod, poolBoxName(IP_ID)));
  log('Pool before', JSON.stringify({
    revAsaId: before.revAsaId,
    unallocatedUsdc: before.unallocatedUsdc,
    heldUsdc: before.heldUsdc,
    currentRoundId: before.currentRoundId,
    shCount: before.shCount,
    proxyAddress: before.proxyAddress,
    stakeholders: before.stakeholders,
  }, null, 2));

  const depositTxns = await buildDepositHeld(algod, signer, IP_ID, AMOUNT);
  const depositTxId = await sendGroup(algod, depositTxns, signer);
  await confirm(algod, depositTxId);
  log('deposit_held confirmed', depositTxId);

  const afterDeposit = readPoolBox(await getBox(algod, poolBoxName(IP_ID)));
  log('Pool after deposit', JSON.stringify({
    heldUsdc: afterDeposit.heldUsdc,
    unallocatedUsdc: afterDeposit.unallocatedUsdc,
    currentRoundId: afterDeposit.currentRoundId,
  }, null, 2));

  const releaseTxns = await buildReleaseHeld(
    algod,
    signer,
    IP_ID,
    afterDeposit.currentRoundId,
    afterDeposit.shCount,
  );
  const releaseTxId = await sendGroup(algod, releaseTxns, signer);
  await confirm(algod, releaseTxId);
  log('release_held confirmed', releaseTxId);

  const afterRelease = readPoolBox(await getBox(algod, poolBoxName(IP_ID)));
  const newRoundId = afterRelease.currentRoundId;
  const round = readRoundBox(await getBox(algod, roundBoxName(IP_ID, newRoundId)));

  log('Pool after release', JSON.stringify({
    heldUsdc: afterRelease.heldUsdc,
    unallocatedUsdc: afterRelease.unallocatedUsdc,
    currentRoundId: afterRelease.currentRoundId,
  }, null, 2));

  log('Created round', JSON.stringify({
    roundId: newRoundId,
    roundAmount: round.roundAmount,
    roundCreated: round.roundCreated,
    holders: round.holders,
  }, null, 2));

  const outPath = path.resolve(process.cwd(), '.seed-held-release.json');
  fs.writeFileSync(outPath, JSON.stringify({
    appId: APP_ID,
    ipId: IP_ID,
    amount: AMOUNT,
    amountUsdc: AMOUNT / 1_000_000,
    usdcAssetId: usdcId,
    signer: signer.address,
    depositTxId,
    releaseTxId,
    roundId: newRoundId,
    round,
  }, null, 2));
  log('Wrote artifact', outPath);

  
  const net =
  process.env.ALGORAND_NETWORK ||
  process.env.NEXT_PUBLIC_ALGORAND_NETWORK ||
  'testnet';
  console.log('[ALGOD CLIENT]', {
    net,
    server: net === 'mainnet'
        ? (process.env.ALGORAND_MAINNET_RPC || 'https://mainnet-api.algonode.cloud')
        : (process.env.ALGORAND_TESTNET_RPC || 'https://testnet-api.algonode.cloud'),
    hasApiKey: !!process.env.ALGOD_X_API_KEY,
    });
}

main().catch((err) => {
  console.error('[seed-held-release] ERROR', err.message);
  console.error(err.stack);
  process.exit(1);
});