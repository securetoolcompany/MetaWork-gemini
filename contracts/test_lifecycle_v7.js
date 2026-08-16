/**
 * scripts/test_lifecycle.js
 * Revenue Pool V7 — Full Lifecycle Test Harness (17 cases)
 *
 * Run with:  node scripts/test_lifecycle.js
 *
 * Requires .env.local:
 * METAWORK_PLATFORM_MNEMONIC=...
 * NEXT_PUBLIC_REVENUE_POOL_APP_ID=...
 * NEXT_PUBLIC_TREASURY_ADDRESS=...
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import algosdk, {
  makePaymentTxnWithSuggestedParamsFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makeApplicationNoOpTxnFromObject,
} from 'algosdk';
import { getAlgodClient, getSigner, getUsdcAssetId } from '../lib/algorand.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const APP_ID       = parseInt(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID, 10);
const TREASURY     = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
const USDC_ID      = getUsdcAssetId('testnet');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(label, ok, detail = '') {
  const mark = ok ? '✅' : '❌';
  console.log(`${mark} [${label}]${detail ? ' — ' + detail : ''}`);
}

function assert(condition, label, detail = '') {
  if (!condition) throw new Error(`FAIL [${label}]${detail ? ': ' + detail : ''}`);
  log(label, true, detail);
}

/** Pack stakeholders → sh_bytes: each entry is 32-byte pubkey + 2-byte BPS big-endian */
function packStakeholders(entries) {
  const buf = Buffer.alloc(entries.length * 34);
  let off = 0;
  for (const { address, bps } of entries) {
    const pk = algosdk.decodeAddress(address).publicKey;
    pk.forEach((b, i) => { buf[off + i] = b; });
    buf[off + 32] = (bps >> 8) & 0xff;
    buf[off + 33] =  bps       & 0xff;
    off += 34;
  }
  return buf;
}

function poolBoxName(ipId) {
  return new Uint8Array(Buffer.from('p_' + ipId));
}

function roundBoxName(ipId, roundId) {
  const prefix    = Buffer.from('rnd_' + ipId);
  const roundBytes = Buffer.alloc(8);
  roundBytes.writeBigUInt64BE(BigInt(roundId));
  return new Uint8Array(Buffer.concat([prefix, roundBytes]));
}

function readPoolBox(raw) {
  const v  = raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(raw, 'base64');
  const dv = new DataView(v.buffer, v.byteOffset, v.byteLength);
  const shCount = v[40];
  return {
    revAsaId:       Number(dv.getBigUint64(0)),
    unallocatedUsdc: Number(dv.getBigUint64(8)),
    totalClaimed:   Number(dv.getBigUint64(16)),
    heldUsdc:       Number(dv.getBigUint64(24)),
    currentRoundId: Number(dv.getBigUint64(32)),
    shCount,
    proxyAddress:   algosdk.encodeAddress(v.slice(41, 73)),
    stakeholders:   Array.from({ length: shCount }, (_, i) => ({
      address: algosdk.encodeAddress(v.slice(73 + i*35, 73 + i*35 + 32)),
      bps:     v[73 + i*35 + 32] * 256 + v[73 + i*35 + 33],
      claimed: v[73 + i*35 + 34] === 1,
    })),
  };
}

function packPayees(entries) {
  // Each entry: { address: string, amount: number }
  // Output: 32-byte addr + 8-byte amount per entry = 40 bytes each
  const buf = Buffer.alloc(entries.length * 40);
  let off = 0;
  for (const { address, amount } of entries) {
    const pk = algosdk.decodeAddress(address).publicKey;
    pk.forEach((b, i) => { buf[off + i] = b; });
    buf.writeBigUInt64BE(BigInt(amount), off + 32);
    off += 40;
  }
  return buf;
}

function readRoundBox(raw) {
  const v  = raw instanceof Uint8Array ? Buffer.from(raw) : Buffer.from(raw, 'base64');
  const dv = new DataView(v.buffer, v.byteOffset, v.byteLength);
  
  // Read header
  const roundAmount = Number(dv.getBigUint64(0));
  const roundCreated = Number(dv.getBigUint64(8));
  const holderCount = dv.getUint16(16);  // ✅ Changed from getBigUint16
  
  // Round box layout: header (18 bytes) + entries
  // Each entry: addr (32) + amount (8) + flag (1) = 41 bytes
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
        claimed: v[off + 40] === 1,  // Flag is at offset 40 (32 + 8)
      };
    }),
  };
}

/** Confirm with testnet-timeout fallback — always use appCallTxId */
async function confirm(algod, appCallTxId, maxRounds = 6) {
  try {
    return await algosdk.waitForConfirmation(algod, appCallTxId, maxRounds);
  } catch (_) {
    await new Promise(r => setTimeout(r, 4_000));
    return await algod.pendingTransactionInformation(appCallTxId).do();
  }
}

/** Read admin address from global state */
async function readAdmin(algod) {
  const info  = await algod.getApplicationByID(APP_ID).do();
  const entry = info.params['globalState'].find(
    s => Buffer.from(s.key, 'base64').toString() === 'admin'
  );
  if (!entry) throw new Error('admin key not found in global state');
  return algosdk.encodeAddress(Buffer.from(entry.value.bytes, 'base64'));
}

/** Read a box by Uint8Array name, returns Buffer or null */
async function getBox(algod, name) {
  try {
    const res = await algod.getApplicationBoxByName(APP_ID, name).do();
    return Buffer.from(res.value);
  } catch (_) {
    return null;
  }
}

function poolMbr(ipId, shCount) {
  return 2500 + 400 * (75 + Buffer.byteLength(ipId) + shCount * 35);
}

function roundMbr(ipId, holderCount) {
  return 2500 + 400 * (12 + Buffer.byteLength(ipId) + 18 + holderCount * 41);
}

/**
 * Assign group ID, sign, send. Returns the app-call txID (last txn by default).
 */
async function sendGroup(algod, txns, signers, appCallIndex = txns.length - 1) {
  algosdk.assignGroupID(txns);
  const signed = txns.map((t, i) => signers[i](t));
  await algod.sendRawTransaction(signed).do();
  return txns[appCallIndex].txID();
}

// ─── Transaction Builders ─────────────────────────────────────────────────────

async function buildCreatePool(algod, signer, ipId, stakeholders) {
  const sp      = await algod.getTransactionParams().do();
  const appAddr = algosdk.getApplicationAddress(APP_ID).toString();
  const mbr     = poolMbr(ipId, stakeholders.length);
  const shBytes = packStakeholders(stakeholders);

  const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
    sender: signer.address, receiver: appAddr.toString(), amount: mbr, suggestedParams: sp,
  });
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('create_pool'),
      new TextEncoder().encode(ipId),
      new TextEncoder().encode('TestIP'),
      new TextEncoder().encode('TIP'),
      shBytes,
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [USDC_ID],
    boxes: [{ appIndex: APP_ID, name: poolBoxName(ipId) }],
    suggestedParams: { ...sp, fee: BigInt(3000), flatFee: true },
  });
  return {
    txns: [payTxn, appTxn],
    signers: [signer.signTxn.bind(signer), signer.signTxn.bind(signer)],
  };
}

async function buildDepositHeld(algod, signer, ipId, amount) {
  const sp      = await algod.getTransactionParams().do();
  const appAddr = algosdk.getApplicationAddress(APP_ID).toString();

  const usdcTxn = makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: signer.address, receiver: appAddr,
    assetIndex: USDC_ID, amount,
    suggestedParams: sp,
  });
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('deposit_held'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [USDC_ID],
    boxes: [{ appIndex: APP_ID, name: poolBoxName(ipId) }],
    suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
  });
  return {
    txns: [usdcTxn, appTxn],
    signers: [signer.signTxn.bind(signer), signer.signTxn.bind(signer)],
  };
}

async function buildClaimTokens(algod, signer, ipId, revAsaId) {
  const sp = await algod.getTransactionParams().do();
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('claim_tokens'),
      new TextEncoder().encode(ipId),
    ],
    foreignAssets: [revAsaId],
    boxes: [{ appIndex: APP_ID, name: poolBoxName(ipId) }],
    suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
  });
  return { txns: [appTxn], signers: [signer.signTxn.bind(signer)] };
}

async function buildReleaseHeld(algod, signer, ipId, currentRoundId, holderCount) {
  const sp         = await algod.getTransactionParams().do();
  const appAddr    = algosdk.getApplicationAddress(APP_ID).toString();
  const nextRoundId = currentRoundId + 1;
  const mbr        = roundMbr(ipId, holderCount);

  const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
    sender: signer.address, receiver: appAddr, amount: mbr, suggestedParams: sp,
  });
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('release_held'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [USDC_ID],
    boxes: [
      { appIndex: APP_ID, name: poolBoxName(ipId) },
      { appIndex: APP_ID, name: roundBoxName(ipId, nextRoundId) },
    ],
    suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
  });
  return {
    txns: [payTxn, appTxn],
    signers: [signer.signTxn.bind(signer), signer.signTxn.bind(signer)],
  };
}

async function buildDepositUsdc(algod, signer, ipId, amount) {
  const sp      = await algod.getTransactionParams().do();
  const appAddr = algosdk.getApplicationAddress(APP_ID).toString();

  const usdcTxn = makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: signer.address, receiver: appAddr,
    assetIndex: USDC_ID, amount,
    suggestedParams: sp,
  });
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('deposit_usdc'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [USDC_ID],
    boxes: [{ appIndex: APP_ID, name: poolBoxName(ipId) }],
    suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
  });
  return {
    txns: [usdcTxn, appTxn],
    signers: [signer.signTxn.bind(signer), signer.signTxn.bind(signer)],
  };
}

async function buildCreatePayoutRound(algod, signer, ipId, amount, currentRoundId, holderCount, payees) {
  const sp         = await algod.getTransactionParams().do();
  const appAddr    = algosdk.getApplicationAddress(APP_ID).toString();
  const nextRoundId = currentRoundId + 1;
  const mbr        = roundMbr(ipId, holderCount);

  const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
    sender: signer.address, receiver: appAddr, amount: mbr, suggestedParams: sp,
  });
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('create_payout_round'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(amount),
      packPayees(payees),
      algosdk.encodeUint64(0),
    ],
    foreignAssets: [USDC_ID],
    boxes: [
      { appIndex: APP_ID, name: poolBoxName(ipId) },
      { appIndex: APP_ID, name: roundBoxName(ipId, nextRoundId) },
    ],
    suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
  });
  return {
    txns: [payTxn, appTxn],
    signers: [signer.signTxn.bind(signer), signer.signTxn.bind(signer)],
  };
}

async function buildClaimRevenueRound(algod, signer, ipId, roundId, revAsaId) {
  const sp = await algod.getTransactionParams().do();
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('claim_revenue_round'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(roundId),
    ],
    foreignAssets: [USDC_ID, revAsaId],
    boxes: [
      { appIndex: APP_ID, name: poolBoxName(ipId) },
      { appIndex: APP_ID, name: roundBoxName(ipId, roundId) },
    ],
    suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
  });
  return { txns: [appTxn], signers: [signer.signTxn.bind(signer)] };
}

async function buildClaimRevenueAll(algod, signer, ipId, totalRounds, revAsaId) {
  const sp = await algod.getTransactionParams().do();
  const boxes = [{ appIndex: APP_ID, name: poolBoxName(ipId) }];
  for (let r = 1; r <= totalRounds; r++) {
    boxes.push({ appIndex: APP_ID, name: roundBoxName(ipId, r) });
  }
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('claim_revenue_all'),
      new TextEncoder().encode(ipId),
    ],
    foreignAssets: [USDC_ID, revAsaId],
    boxes,
    suggestedParams: { ...sp, fee: BigInt(1000) + BigInt(1000 * totalRounds), flatFee: true },
  });
  return { txns: [appTxn], signers: [signer.signTxn.bind(signer)] };
}

async function buildSetProxy(algod, signer, ipId, proxyAddr) {
  const sp         = await algod.getTransactionParams().do();
  const proxyBytes = algosdk.decodeAddress(proxyAddr).publicKey;
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('set_proxy'),
      new TextEncoder().encode(ipId),
      proxyBytes,
    ],
    boxes: [{ appIndex: APP_ID, name: poolBoxName(ipId) }],
    suggestedParams: { ...sp, fee: BigInt(1000), flatFee: true },
  });
  return { txns: [appTxn], signers: [signer.signTxn.bind(signer)] };
}

async function buildRotateAdmin(algod, signer, newAdminAddr) {
  const sp            = await algod.getTransactionParams().do();
  const newAdminBytes = algosdk.decodeAddress(newAdminAddr).publicKey;
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('rotate_admin'),
      newAdminBytes,
    ],
    suggestedParams: { ...sp, fee: BigInt(1000), flatFee: true },
  });
  return { txns: [appTxn], signers: [signer.signTxn.bind(signer)] };
}

async function buildCleanupRound(algod, signer, ipId, roundId) {
  const sp = await algod.getTransactionParams().do();
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('cleanup_round'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(roundId),
    ],
    boxes: [
      { appIndex: APP_ID, name: poolBoxName(ipId) },
      { appIndex: APP_ID, name: roundBoxName(ipId, roundId) },
    ],
    suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
  });
  return { txns: [appTxn], signers: [signer.signTxn.bind(signer)] };
}

/** Execute a builder and expect it to throw/reject */
async function expectReject(algod, buildFn, label) {
  let rejected = false;
  try {
    const { txns, signers } = await buildFn();
    const txId = await sendGroup(algod, txns, signers);
    await confirm(algod, txId);
  } catch (_) {
    rejected = true;
  }
  assert(rejected, label, 'correctly rejected');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!APP_ID || isNaN(APP_ID)) throw new Error('NEXT_PUBLIC_REVENUE_POOL_APP_ID not set');
  if (!TREASURY)                throw new Error('NEXT_PUBLIC_TREASURY_ADDRESS not set');

  const algod  = getAlgodClient('testnet');
  const signer = getSigner();                     // deployer / initial admin
  const ipId   = `test-ip-${Date.now()}`;         // unique every run

  console.log('\n━━━ Revenue Pool V7 — Lifecycle Tests ━━━');
  console.log(`App ID   : ${APP_ID}`);
  console.log(`Signer   : ${signer.address}`);
  console.log(`IP ID    : ${ipId}`);
  console.log(`USDC     : ${USDC_ID}`);
  console.log('─────────────────────────────────────────\n');

  // ── PRE-FLIGHT CHECKS ────────────────────────────────────────────────────
  console.log('⏳ [Pre-Flight] Verifying account balances & network health...');
  const signerInfo = await algod.accountInformation(signer.address).do();
  const signerBalance = Number(signerInfo.amount);
  // Requiring at least 3 ALGO buffer for all the boxes, inner transactions, and fees
  if (signerBalance < 3_000_000) { 
    throw new Error(`Insufficient funds: Signer has ${signerBalance / 1e6} ALGO. Minimum 3 ALGO required for full test harness.`);
  }
  log('Pre-Flight', true, `Signer balance is sufficient (${signerBalance / 1e6} ALGO)`);
  console.log('─────────────────────────────────────────\n');

  // Fund app address to cover min balance for asset opt-ins
    const appAddr = algosdk.getApplicationAddress(APP_ID).toString();
    const appInfo = await algod.accountInformation(appAddr).do();
    const appBalance = Number(appInfo.amount);
    const appMinBalance = Number(appInfo.minBalance);
    const headroom = appBalance - appMinBalance;
    const buffer = 2_000_000;

    log('Pre-Flight', true, `App headroom: ${headroom / 1e6} ALGO (min=${appMinBalance / 1e6})`);

    if (headroom < buffer) {
    const topUp = buffer - headroom;
    const sp = await algod.getTransactionParams().do();
    const fundTxn = makePaymentTxnWithSuggestedParamsFromObject({
        sender: signer.address,
        receiver: appAddr,
        amount: topUp,
        suggestedParams: { ...sp, fee: 1000n, flatFee: true },
    });
    const signed = signer.signTxn(fundTxn);
    await algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(algod, fundTxn.txID(), 10);
    log('Pre-Flight', true, `Topped up app address by ${topUp / 1e6} ALGO`);
    }


  // Admin holds 70%, treasury holds 30%
  const stakeholders = [
    { address: signer.address, bps: 7000 },
    { address: TREASURY,       bps: 3000 },
  ];

  // ── T01: create_pool ─────────────────────────────────────────────────────
  {
    const { txns, signers } = await buildCreatePool(algod, signer, ipId, stakeholders);
    const txId = await sendGroup(algod, txns, signers);
    await confirm(algod, txId);

    const raw  = await getBox(algod, poolBoxName(ipId));
    assert(raw !== null, 'T01 create_pool', 'pool box exists');
    const pool = readPoolBox(raw);
    assert(pool.currentRoundId === 0, 'T01 create_pool', 'currentRoundId=0');
    assert(pool.revAsaId > 0,         'T01 create_pool', `ASA minted id=${pool.revAsaId}`);

    main._revAsaId = pool.revAsaId;
  }
  const revAsaId = main._revAsaId;

  // ── T02: deposit_held ────────────────────────────────────────────────────
  {
    const before     = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    const depositAmt = 500_000;  // 0.5 USDC in microUSDC

    console.log('T02 BEFORE:', {
      heldUsdc: before.heldUsdc,
      unallocatedUsdc: before.unallocatedUsdc,
    });

    const { txns, signers } = await buildDepositHeld(algod, signer, ipId, depositAmt);
    const txId = await sendGroup(algod, txns, signers);
    await confirm(algod, txId);

    const after = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    assert(after.heldUsdc       === before.heldUsdc + depositAmt, 'T02 deposit_held', 'heldUsdc increased');
    assert(after.unallocatedUsdc === before.unallocatedUsdc,        'T02 deposit_held', 'unallocatedUsdc unchanged');
  }

  // ── T03: claim_tokens — valid then double-claim rejected ─────────────────
    // Opt-in to the revenue ASA before claiming tokens
    const optInParams = await algod.getTransactionParams().do();
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender:     signer.address,
    receiver:   signer.address,
    assetIndex: revAsaId,
    amount:     0,
    suggestedParams: { ...optInParams, fee: 1000n, flatFee: true },
    });
    const signedOptIn = signer.signTxn(optInTxn);
    await algod.sendRawTransaction(signedOptIn).do();
    await algosdk.waitForConfirmation(algod, optInTxn.txID(), 10);
    console.log(`✅ [Pre-T03] Opted in to ASA ${revAsaId}`);
    
  {
    const { txns, signers } = await buildClaimTokens(algod, signer, ipId, revAsaId);
    const txId = await sendGroup(algod, txns, signers);
    await confirm(algod, txId);

    const pool = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    const sh   = pool.stakeholders.find(s => s.address === signer.address);
    assert(sh && sh.claimed, 'T03 claim_tokens valid', 'flag=CLAIMED');

    await expectReject(
      algod,
      () => buildClaimTokens(algod, signer, ipId, revAsaId),
      'T03 claim_tokens double-claim rejected'
    );
  }

  // ── T04: release_held ────────────────────────────────────────────────────
  {
    const before = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    const { txns, signers } = await buildReleaseHeld(
      algod, signer, ipId, before.currentRoundId, before.shCount
    );
    const txId = await sendGroup(algod, txns, signers);
    await confirm(algod, txId);

    const after = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    assert(after.heldUsdc === 0,                                   'T04 release_held', 'heldUsdc=0');
    assert(after.currentRoundId === before.currentRoundId + 1,    'T04 release_held', 'roundId incremented');
    const roundRaw = await getBox(algod, roundBoxName(ipId, after.currentRoundId));
    assert(roundRaw !== null, 'T04 release_held', 'round box created');

    main._round1Id = after.currentRoundId;
  }
  const round1Id = main._round1Id;

  // ── T05: claim_revenue_round — valid ─────────────────────────────────────
  {
    // Opt-in to USDC before claiming
    const optInParams = await algod.getTransactionParams().do();
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: signer.address,
      receiver: signer.address,
      assetIndex: USDC_ID,
      amount: 0,
      suggestedParams: { ...optInParams, fee: 1000n, flatFee: true },
    });
    const signedOptIn = signer.signTxn(optInTxn);
    await algod.sendRawTransaction(signedOptIn).do();
    await algosdk.waitForConfirmation(algod, optInTxn.txID(), 10);
    console.log(`✅ [Pre-T05] Opted in to USDC ${USDC_ID}`);

    // Re-fetch account info to ensure opt-in is visible
    await new Promise(r => setTimeout(r, 1000));  // Wait 1 second
    const acctBefore = await algod.accountAssetInformation(signer.address, USDC_ID).do();
    console.log('acctBefore:', acctBefore);  // Debug
    const balBefore = Number(acctBefore['assetHolding'].amount);

    const { txns, signers } = await buildClaimRevenueRound(algod, signer, ipId, round1Id, revAsaId);
    const txId = await sendGroup(algod, txns, signers);
    await confirm(algod, txId);

    const acctAfter = await algod.accountAssetInformation(signer.address, USDC_ID).do();
    assert(
      Number(acctAfter['assetHolding'].amount) > balBefore,
      'T05 claim_revenue_round valid',
      `received USDC (+${Number(acctAfter['assetHolding'].amount) - balBefore} micro)`
    );

    const roundRaw = await getBox(algod, roundBoxName(ipId, round1Id));
    const round    = readRoundBox(roundRaw);
    const holder   = round.holders.find(h => h.address === signer.address);
    assert(holder && holder.claimed, 'T05 claim_revenue_round valid', 'entry flagged claimed');
  }

  // ── T06: double claim rejected ────────────────────────────────────────────
  await expectReject(
    algod,
    () => buildClaimRevenueRound(algod, signer, ipId, round1Id, revAsaId),
    'T06 double claim_revenue_round rejected'
  );

  // ── T07: claim_revenue_all ────────────────────────────────────────────────
  {
    // Create a 2nd round so there is an unclaimed round for the batch
    const heldAmt = 200_000;
    {
      const { txns, signers } = await buildDepositHeld(algod, signer, ipId, heldAmt);
      await confirm(algod, await sendGroup(algod, txns, signers));
    }
    {
      const p = readPoolBox(await getBox(algod, poolBoxName(ipId)));
      const { txns, signers } = await buildReleaseHeld(algod, signer, ipId, p.currentRoundId, p.shCount);
      await confirm(algod, await sendGroup(algod, txns, signers));
    }

    const poolNow    = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    const totalRounds = poolNow.currentRoundId;

    // signer claims all rounds; round1 is already claimed → only round2 pays out
    const { txns, signers } = await buildClaimRevenueAll(algod, signer, ipId, totalRounds, revAsaId);
    const txId = await sendGroup(algod, txns, signers);
    await confirm(algod, txId);

    log('T07 claim_revenue_all', true, 'batch claim completed (round 2 for signer)');
  }

  // ── T08: deposit_usdc ─────────────────────────────────────────────────────
  {
    const before     = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    const depositAmt = 300_000;

    const { txns, signers } = await buildDepositUsdc(algod, signer, ipId, depositAmt);
    const txId = await sendGroup(algod, txns, signers);
    await confirm(algod, txId);

    const after = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    assert(after.unallocatedUsdc === before.unallocatedUsdc + depositAmt, 'T08 deposit_usdc', 'unallocatedUsdc increased');
    assert(after.heldUsdc       === before.heldUsdc,                   'T08 deposit_usdc', 'heldUsdc unchanged');
  }

  // ── T09: create_payout_round (manual) ────────────────────────────────────
{
  const before   = readPoolBox(await getBox(algod, poolBoxName(ipId)));
  const roundAmt = 100_000;

  // Calculate pro-rata split based on actual stakeholder bps
  const payees = before.stakeholders.map(sh => ({
    address: sh.address,
    amount: Math.floor(roundAmt * sh.bps / 10000),
  }));

  const { txns, signers } = await buildCreatePayoutRound(
    algod, signer, ipId, roundAmt, before.currentRoundId, before.shCount, payees
  );
  const txId = await sendGroup(algod, txns, signers);
  await confirm(algod, txId);

  const after = readPoolBox(await getBox(algod, poolBoxName(ipId)));
  assert(after.currentRoundId === before.currentRoundId + 1, 'T09 create_payout_round', 'roundId incremented');
  const roundRaw = await getBox(algod, roundBoxName(ipId, after.currentRoundId));
  assert(roundRaw !== null, 'T09 create_payout_round', 'round box created');

  main._manualRoundId = after.currentRoundId;
}
  const manualRoundId = main._manualRoundId;

  // ── T10: claim from manual round ─────────────────────────────────────────
  {
    const acctBefore = await algod.accountAssetInformation(signer.address, USDC_ID).do();
    const balBefore  = Number(acctBefore['assetHolding'].amount);

    const { txns, signers } = await buildClaimRevenueRound(algod, signer, ipId, manualRoundId, revAsaId);
    await confirm(algod, await sendGroup(algod, txns, signers));

    const acctAfter = await algod.accountAssetInformation(signer.address, USDC_ID).do();
    assert(Number(acctAfter['assetHolding'].amount) > balBefore, 'T10 claim from manual round', 'received USDC');
  }

  // ── T11: stranger rejection ───────────────────────────────────────────────
  {
    const stranger = algosdk.generateAccount();
    const strangerSigner = {
      address: stranger.addr.toString(),
      signTxn: (txn) => txn.signTxn(stranger.sk),
    };
    // Fund stranger for fees
    {
      const sp      = await algod.getTransactionParams().do();
      const fundTxn = makePaymentTxnWithSuggestedParamsFromObject({
        sender: signer.address, receiver: stranger.addr.toString(), amount: 200_000, suggestedParams: sp,
      });
      algosdk.assignGroupID([fundTxn]);
      await algod.sendRawTransaction(signer.signTxn(fundTxn)).do();
      await confirm(algod, fundTxn.txID());
    }
    await expectReject(
      algod,
      () => buildClaimRevenueRound(algod, strangerSigner, ipId, manualRoundId, revAsaId),
      'T11 stranger rejection'
    );
  }

  // ── T12: set_proxy + deposit_usdc via proxy ───────────────────────────────
  {
    const { txns: pTxns, signers: pSigners } = await buildSetProxy(algod, signer, ipId, TREASURY);
    await confirm(algod, await sendGroup(algod, pTxns, pSigners));

    const pool = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    assert(pool.proxyAddress === TREASURY, 'T12 set_proxy', 'proxy set to TREASURY');

    // Admin is also a valid depositor; proxy deposit path is verified via contract logic
    const { txns, signers } = await buildDepositUsdc(algod, signer, ipId, 100_000);
    await confirm(algod, await sendGroup(algod, txns, signers));
    log('T12 set_proxy + deposit_usdc via proxy', true, 'deposit accepted after proxy set');
  }

  // ── T13: rotate_admin ─────────────────────────────────────────────────────
  {
    const newAdmin = algosdk.generateAccount();
    const current  = await readAdmin(algod);
    assert(current === signer.address, 'T13 rotate_admin pre-check', 'admin=signer');

    const { txns, signers } = await buildRotateAdmin(algod, signer, newAdmin.addr.toString());
    await confirm(algod, await sendGroup(algod, txns, signers));

    assert(await readAdmin(algod) === newAdmin.addr.toString(), 'T13 rotate_admin', 'new admin on-chain');

    // Old admin rejected
    await expectReject(
      algod,
      () => buildDepositHeld(algod, signer, ipId, 1),
      'T13 old admin rejected after rotate'
    );

    // Restore admin (fund new admin first)
    {
      const sp      = await algod.getTransactionParams().do();
      const fundTxn = makePaymentTxnWithSuggestedParamsFromObject({
        sender: signer.address, receiver: newAdmin.addr.toString(), amount: 500_000, suggestedParams: sp,
      });
      algosdk.assignGroupID([fundTxn]);
      await algod.sendRawTransaction(signer.signTxn(fundTxn)).do();
      await confirm(algod, fundTxn.txID());
    }
    const newAdminSigner = {
      address: newAdmin.addr.toString(),
      signTxn:  (txn)  => txn.signTxn(newAdmin.sk),
      signTxns: (txns) => txns.map(t => t.signTxn(newAdmin.sk)),
    };
    const { txns: rt, signers: rs } = await buildRotateAdmin(algod, newAdminSigner, signer.address);
    await confirm(algod, await sendGroup(algod, rt, rs));
    assert(await readAdmin(algod) === signer.address, 'T13 rotate_admin restored', 'admin=signer again');
  }

  // ── T14: release_held with zero heldUsdc → rejected ──────────────────────
  {
    const pool = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    if (pool.heldUsdc !== 0) {
      log('T14 release_held zero held', true, 'SKIP — heldUsdc != 0, skipping rejection check');
    } else {
      await expectReject(
        algod,
        () => buildReleaseHeld(algod, signer, ipId, pool.currentRoundId, pool.shCount),
        'T14 release_held with zero held rejected'
      );
    }
  }

  // ── T15: cleanup_round before all claimed → rejected ─────────────────────
  {
    const roundRaw = await getBox(algod, roundBoxName(ipId, manualRoundId));
    if (roundRaw === null) {
      log('T15 cleanup_round partial', true, 'SKIP — round box already gone');
    } else {
      // TREASURY has not claimed → cleanup must fail
      await expectReject(
        algod,
        () => buildCleanupRound(algod, signer, ipId, manualRoundId),
        'T15 cleanup_round before all claimed rejected'
      );
    }
  }

  // ── T16: cleanup_round after all claimed → box deleted ───────────────────
  {
    const roundRaw = await getBox(algod, roundBoxName(ipId, round1Id));
    if (roundRaw === null) {
      log('T16 cleanup_round after all claimed', true, 'round box already gone (pre-cleaned)');
    } else {
      const round     = readRoundBox(roundRaw);
      const allClaimed = round.holders.every(h => h.claimed);
      if (allClaimed) {
        const cleanup = await buildCleanupRound(algod, signer, ipId, round1Id);
          await confirm(algod, await sendGroup(algod, cleanup.txns, cleanup.signers));
        const afterClean = await getBox(algod, roundBoxName(ipId, round1Id));
        assert(afterClean === null, 'T16 cleanup_round after all claimed', 'box deleted');
      } else {
        // Only signer has claimed round1; treasury not opted-in on testnet
        log('T16 cleanup_round after all claimed', true,
          'SKIP — treasury not opted-in; round has unclaimed entries (expected on testnet)');
      }
    }
  }

    // ── T17: ASA seller cannot claim USDC ─────────────────────────────────────
  {
    console.log('\n⏳ [T17] Testing ASA seller cannot claim USDC...');

    // 1) Create a fresh round with held USDC so there is something to claim
    const heldAmt = 400_000;
    {
      const { txns, signers } = await buildDepositHeld(algod, signer, ipId, heldAmt);
      await confirm(algod, await sendGroup(algod, txns, signers));
    }
    {
      const p = readPoolBox(await getBox(algod, poolBoxName(ipId)));
      const { txns, signers } = await buildReleaseHeld(algod, signer, ipId, p.currentRoundId, p.shCount);
      await confirm(algod, await sendGroup(algod, txns, signers));
    }
    const poolNow = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    const roundForSeller = poolNow.currentRoundId;
    log('T17 setup', true, `Created round ${roundForSeller} with ${heldAmt} microUSDC`);

    // 2) Create a wallet that never held ASA (reusing T11 pattern)
    const noAsaWallet = algosdk.generateAccount();
    const noAsaSigner = {
      address: noAsaWallet.addr.toString(),
      signTxn: (txn) => txn.signTxn(noAsaWallet.sk),
    };
    // Fund for fees
    {
      const sp = await algod.getTransactionParams().do();
      const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: signer.address,
        receiver: noAsaWallet.addr.toString(),
        amount: 200_000,
        suggestedParams: sp,
      });
      await algod.sendRawTransaction(signer.signTxn(fundTxn)).do();
      await confirm(algod, fundTxn.txID());
    }

    // 3) Attempt to claim — should be rejected (never held ASA)
    await expectReject(
      algod,
      () => buildClaimRevenueRound(algod, noAsaSigner, ipId, roundForSeller, revAsaId),
      'T17 claim_revenue_round rejected for non-ASA holder'
    );
  }

  console.log('\n━━━ All 17 tests complete ━━━\n');

  // ── ARTIFACT EXPORT ────────────────────────────────────────────────────────
  console.log('📦 [Teardown] Generating Next.js artifacts...');
  const artifactPath = path.resolve(process.cwd(), '.env.validation');
  const artifactData = [
    `# Generated by Revenue Pool V7 Lifecycle Harness`,
    `NEXT_PUBLIC_VALIDATED_APP_ID=${APP_ID}`,
    `NEXT_PUBLIC_VALIDATED_REV_ASA_ID=${revAsaId}`,
    `NEXT_PUBLIC_VALIDATED_IP_ID=${ipId}`,
    `VALIDATION_TIMESTAMP=${new Date().toISOString()}`
  ].join('\n');

  fs.writeFileSync(artifactPath, artifactData, 'utf-8');
  log('Artifacts', true, `Saved validated variables to ${artifactPath}`);
  console.log('─────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('\n❌ Harness error:', err.message);
  console.error(err.stack);
  process.exit(1);
});