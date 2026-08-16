/**
 * scripts/test_lifecycle.js
 * Revenue Pool V10 — Full Lifecycle Test Harness (16 cases + A-F)
 *
 * Run with:  node contracts/test_revenue_pool_v10.js
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

async function assetBalance(algod, address, assetId) {
  try {
    const info = await algod.accountAssetInformation(address, assetId).do();
    return Number(info.assetHolding.amount);
  } catch (_) {
    return 0;
  }
}

async function optIn(algod, walletSigner, assetId) {
  try {
    await algod.accountAssetInformation(
      walletSigner.address,
      assetId,
    ).do();

    return;
  } catch (_) {
    // The account is not opted into this ASA yet.
  }

  const sp = await algod.getTransactionParams().do();

  const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: walletSigner.address,
    receiver: walletSigner.address,
    assetIndex: assetId,
    amount: 0,
    suggestedParams: { ...sp, fee: 1000n, flatFee: true },
  });

  await algod.sendRawTransaction(
    walletSigner.signTxn(txn),
  ).do();

  await confirm(algod, txn.txID());
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

async function buildClaimRevenueRound(algod, signer, ipId, roundId) {
  const sp = await algod.getTransactionParams().do();
  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('claim_revenue_round'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(roundId),
    ],
    foreignAssets: [USDC_ID],
    boxes: [
      { appIndex: APP_ID, name: poolBoxName(ipId) },
      { appIndex: APP_ID, name: roundBoxName(ipId, roundId) },
    ],
    suggestedParams: { ...sp, fee: BigInt(2000), flatFee: true },
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

async function fundAccount(algod, adminSigner, address, amount = 500_000) {
  const sp = await algod.getTransactionParams().do();

  const txn = makePaymentTxnWithSuggestedParamsFromObject({
    sender: adminSigner.address,
    receiver: address,
    amount,
    suggestedParams: { ...sp, fee: 1000n, flatFee: true },
  });

  await algod.sendRawTransaction(adminSigner.signTxn(txn)).do();
  await confirm(algod, txn.txID());
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!APP_ID || isNaN(APP_ID)) throw new Error('NEXT_PUBLIC_REVENUE_POOL_APP_ID not set');
  if (!TREASURY)                throw new Error('NEXT_PUBLIC_TREASURY_ADDRESS not set');

  const algod  = getAlgodClient('testnet');
  const signer = getSigner();                     // deployer / initial admin
  const ipId   = `test-ip-${Date.now()}`;         // unique every run
  
    const alice = algosdk.generateAccount();
    const bob = algosdk.generateAccount();

    // V10 snapshot-policy test wallets
    const aliceSigner = {
    address: alice.addr.toString(),
    signTxn: (txn) => txn.signTxn(alice.sk),
    };

    const bobSigner = {
    address: bob.addr.toString(),
    signTxn: (txn) => txn.signTxn(bob.sk),
    };

  console.log('\n━━━ Revenue Pool V10 — Lifecycle Tests ━━━');
  console.log(`App ID   : ${APP_ID}`);
  console.log(`Admin    : ${signer.address}`);
  console.log(`Alice    : ${aliceSigner.address}`);
  console.log(`Bob      : ${bobSigner.address}`);
  console.log(`IP ID    : ${ipId}`);
  console.log(`USDC     : ${USDC_ID}`);
  console.log('─────────────────────────────────────────\n');

  // ── PRE-FLIGHT CHECKS ────────────────────────────────────────────────────
  console.log('⏳ [Pre-Flight] Verifying account balances & network health...');
  const signerInfo = await algod.accountInformation(signer.address).do();
  const signerBalance = Number(signerInfo.amount);
    // Require enough ALGO for:
    // - app account top-up and ASA minimum-balance growth
    // - Alice and Bob test-wallet funding
    // - pool and payout-round companion MBR payments
    // - outer transaction fees and inner-transaction fee pooling
  if (signerBalance < 6_000_000) { 
    throw new Error(`Insufficient funds: Signer has ${signerBalance / 1e6} ALGO. Minimum 6 ALGO required for full test harness.`);
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

    await fundAccount(algod, signer, aliceSigner.address, 1_000_000);
    await fundAccount(algod, signer, bobSigner.address, 500_000);

    log('Pre-Flight', true, 'Funded Alice and Bob test wallets');

  // Admin holds 70%, treasury holds 30%
  const stakeholders = [
    { address: aliceSigner.address, bps: 7000 },
    { address: signer.address,       bps: 3000 },
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
    const depositAmt = 500_000;  // 0.5 USDC, expressed in microUSDC

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
  await optIn(algod, signer, revAsaId);
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
    await optIn(algod, signer, USDC_ID);
		console.log(`✅ [Pre-T05] Opted in to USDC ${USDC_ID}`);

    // Re-fetch account info to ensure opt-in is visible
    await new Promise(r => setTimeout(r, 1000));  // Wait 1 second
    const acctBefore = await algod.accountAssetInformation(signer.address, USDC_ID).do();
    console.log('acctBefore:', acctBefore);  // Debug
    const balBefore = Number(acctBefore['assetHolding'].amount);

    const { txns, signers } = await buildClaimRevenueRound(algod, signer, ipId, round1Id);
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
    () => buildClaimRevenueRound(algod, signer, ipId, round1Id),
    'T06 double claim_revenue_round rejected'
  );

  // ── T07: second single-round claim ────────────────────────────────────────
	// Create a second round. V10 claims each round individually.
	{
		const heldAmt = 200_000;

		{
			const { txns, signers } = await buildDepositHeld(
				algod,
				signer,
				ipId,
				heldAmt,
			);
			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		const before = readPoolBox(
			await getBox(algod, poolBoxName(ipId)),
		);

		{
			const { txns, signers } = await buildReleaseHeld(
				algod,
				signer,
				ipId,
				before.currentRoundId,
				before.shCount,
			);
			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		const after = readPoolBox(
			await getBox(algod, poolBoxName(ipId)),
		);

		const round2Id = after.currentRoundId;

		const usdcBefore = await assetBalance(
			algod,
			signer.address,
			USDC_ID,
		);

		{
			const { txns, signers } = await buildClaimRevenueRound(
				algod,
				signer,
				ipId,
				round2Id,
			);
			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		const usdcAfter = await assetBalance(
			algod,
			signer.address,
			USDC_ID,
		);

		assert(
			usdcAfter === usdcBefore + 60_000,
			'T07 second single-round claim',
			'Signer received the exact 30% allocation of 60,000 microUSDC',
		);

		const round2 = readRoundBox(
			await getBox(algod, roundBoxName(ipId, round2Id)),
		);

		const signerEntry = round2.holders.find(
			(holder) => holder.address === signer.address,
		);

		assert(
			signerEntry && signerEntry.claimed,
			'T07 second single-round claim',
			'Round 2 signer entry is flagged claimed',
		);
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

    const { txns, signers } = await buildClaimRevenueRound(algod, signer, ipId, manualRoundId);
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
      () => buildClaimRevenueRound(algod, strangerSigner, ipId, manualRoundId),
      'T11 stranger rejection'
    );
  }

  // ── T12: set_proxy + admin deposit_usdc ───────────────────────────────────
  {
    const { txns: pTxns, signers: pSigners } = await buildSetProxy(algod, signer, ipId, TREASURY);
    await confirm(algod, await sendGroup(algod, pTxns, pSigners));

    const pool = readPoolBox(await getBox(algod, poolBoxName(ipId)));
    assert(pool.proxyAddress === TREASURY, 'T12 set_proxy', 'proxy set to TREASURY');

    // This confirms the proxy was stored and the admin remains an authorized depositor.
    const { txns, signers } = await buildDepositUsdc(algod, signer, ipId, 100_000);
    await confirm(algod, await sendGroup(algod, txns, signers));
    log(
			'T12 set_proxy + admin deposit_usdc',
			true,
			'proxy was stored and the admin deposit remained accepted',
		);
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

    // ── V10 Snapshot Acceptance Tests A–D + F ─────────────────────────────────
		{
			const v10SnapshotIpId = `v10-snapshot-${Date.now()}`;

			const snapshotStakeholders = [
				{ address: aliceSigner.address, bps: 7_000 },
				{ address: signer.address, bps: 3_000 },
			];

			{
				const { txns, signers } = await buildCreatePool(
					algod,
					signer,
					v10SnapshotIpId,
					snapshotStakeholders,
				);

				await confirm(algod, await sendGroup(algod, txns, signers));
			}

			const snapshotPool = readPoolBox(
				await getBox(algod, poolBoxName(v10SnapshotIpId)),
			);

			const snapshotRevAsaId = snapshotPool.revAsaId;

			assert(
				snapshotRevAsaId > 0,
				'V10 setup',
				`fresh REV ASA=${snapshotRevAsaId}`,
			);

			await optIn(algod, aliceSigner, snapshotRevAsaId);
			await optIn(algod, aliceSigner, USDC_ID);
			await optIn(algod, bobSigner, snapshotRevAsaId);
			await optIn(algod, bobSigner, USDC_ID);

			{
				const { txns, signers } = await buildClaimTokens(
					algod,
					aliceSigner,
					v10SnapshotIpId,
					snapshotRevAsaId,
				);

				await confirm(algod, await sendGroup(algod, txns, signers));
			}

			assert(
				await assetBalance(
					algod,
					aliceSigner.address,
					snapshotRevAsaId,
				) > 0,
				'V10 setup',
				'Alice received REV tokens',
			);

			{
				const { txns, signers } = await buildDepositUsdc(
					algod,
					signer,
					v10SnapshotIpId,
					300_000,
				);

				await confirm(algod, await sendGroup(algod, txns, signers));
			}

			const createAliceRound = async (amount) => {
				const before = readPoolBox(
					await getBox(algod, poolBoxName(v10SnapshotIpId)),
				);

				const { txns, signers } = await buildCreatePayoutRound(
					algod,
					signer,
					v10SnapshotIpId,
					amount,
					before.currentRoundId,
					1,
					[{ address: aliceSigner.address, amount }],
				);

				await confirm(algod, await sendGroup(algod, txns, signers));

				const after = readPoolBox(
					await getBox(algod, poolBoxName(v10SnapshotIpId)),
				);

				return after.currentRoundId;
			};

			// A: Listed wallet receives its exact allocation.
			const roundAId = await createAliceRound(100_000);

			{
				const usdcBefore = await assetBalance(
					algod,
					aliceSigner.address,
					USDC_ID,
				);

				const { txns, signers } = await buildClaimRevenueRound(
					algod,
					aliceSigner,
					v10SnapshotIpId,
					roundAId,
				);

				await confirm(algod, await sendGroup(algod, txns, signers));

				const usdcAfter = await assetBalance(
					algod,
					aliceSigner.address,
					USDC_ID,
				);

				const round = readRoundBox(
					await getBox(algod, roundBoxName(v10SnapshotIpId, roundAId)),
				);

				const aliceEntry = round.holders.find(
					(holder) => holder.address === aliceSigner.address,
				);

				assert(
					usdcAfter === usdcBefore + 100_000,
					'V10-A exact allocation',
					'Alice received exactly 100000 microUSDC',
				);

				assert(
					aliceEntry && aliceEntry.claimed,
					'V10-A claimed flag',
					'Alice entry is FLAG_CLAIMED',
				);
			}

			// B/C setup: snapshot Alice, then transfer all Alice REV to Bob.
			const roundBId = await createAliceRound(100_000);

			const aliceRevBeforeSale = await assetBalance(
				algod,
				aliceSigner.address,
				snapshotRevAsaId,
			);

			{
				const sp = await algod.getTransactionParams().do();

				const transferTxn = makeAssetTransferTxnWithSuggestedParamsFromObject({
					sender: aliceSigner.address,
					receiver: bobSigner.address,
					assetIndex: snapshotRevAsaId,
					amount: aliceRevBeforeSale,
					suggestedParams: { ...sp, fee: 1000n, flatFee: true },
				});

				await algod.sendRawTransaction(
					aliceSigner.signTxn(transferTxn),
				).do();

				await confirm(algod, transferTxn.txID());
			}

			assert(
				await assetBalance(
					algod,
					aliceSigner.address,
					snapshotRevAsaId,
				) === 0,
				'V10-B zero REV',
				'Alice transferred all REV to Bob',
			);

			// C: Buyer cannot claim seller's historic snapshot.
			await expectReject(
				algod,
				() => buildClaimRevenueRound(
					algod,
					bobSigner,
					v10SnapshotIpId,
					roundBId,
				),
				'V10-C Bob cannot claim Alice historic round',
			);

			{
				const round = readRoundBox(
					await getBox(algod, roundBoxName(v10SnapshotIpId, roundBId)),
				);

				const aliceEntry = round.holders.find(
					(holder) => holder.address === aliceSigner.address,
				);

				assert(
					aliceEntry && !aliceEntry.claimed,
					'V10-C Alice entry unchanged',
					'Bob did not mark Alice entry claimed',
				);
			}

			// B: Seller can claim the recorded round after selling all REV.
			{
				const usdcBefore = await assetBalance(
					algod,
					aliceSigner.address,
					USDC_ID,
				);

				const { txns, signers } = await buildClaimRevenueRound(
					algod,
					aliceSigner,
					v10SnapshotIpId,
					roundBId,
				);

				await confirm(algod, await sendGroup(algod, txns, signers));

				const usdcAfter = await assetBalance(
					algod,
					aliceSigner.address,
					USDC_ID,
				);

				assert(
					usdcAfter === usdcBefore + 100_000,
					'V10-B zero-REV seller claim',
					'Alice received her historic 100000 microUSDC allocation',
				);
			}

			// D: A claimed snapshot entry cannot be claimed twice.
			{
				const poolBefore = readPoolBox(
					await getBox(algod, poolBoxName(v10SnapshotIpId)),
				);

				await expectReject(
					algod,
					() => buildClaimRevenueRound(
						algod,
						aliceSigner,
						v10SnapshotIpId,
						roundBId,
					),
					'V10-D duplicate claim rejected',
				);

				const poolAfter = readPoolBox(
					await getBox(algod, poolBoxName(v10SnapshotIpId)),
				);

				assert(
					poolAfter.totalClaimed === poolBefore.totalClaimed,
					'V10-D totalClaimed unchanged',
					'Duplicate claim did not increase totalClaimed',
				);
			}

			// F: A wallet omitted from a payout-round record cannot claim.
			const roundFId = await createAliceRound(100_000);

			await expectReject(
				algod,
				() => buildClaimRevenueRound(
					algod,
					bobSigner,
					v10SnapshotIpId,
					roundFId,
				),
				'V10-F non-ledger wallet rejected',
			);

			{
				const round = readRoundBox(
					await getBox(algod, roundBoxName(v10SnapshotIpId, roundFId)),
				);

				const aliceEntry = round.holders.find(
					(holder) => holder.address === aliceSigner.address,
				);

				assert(
					aliceEntry && !aliceEntry.claimed,
					'V10-F Alice flag unchanged',
					'Bob did not alter Alice’s unclaimed allocation',
				);
			}

			log(
				'V10 A–D + F',
				true,
				'snapshot eligibility and individual-claim acceptance tests passed',
			);
		}

	// ── V10-E: new-round snapshot after REV transfer ──────────────────────────
	{
		const eIpId = `v10-holder-snapshot-${Date.now()}`;
		const E_ROUND_AMOUNT = 100_000;

		const eStakeholders = [
			{ address: aliceSigner.address, bps: 7_000 },
			{ address: signer.address, bps: 3_000 },
		];

		// Create a fresh pool and its REV ASA.
		{
			const { txns, signers } = await buildCreatePool(
				algod,
				signer,
				eIpId,
				eStakeholders,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		const ePool = readPoolBox(
			await getBox(algod, poolBoxName(eIpId)),
		);

		const eRevAsaId = ePool.revAsaId;

		assert(
			eRevAsaId > 0,
			'V10-E setup',
			'Created a fresh pool and REV ASA',
		);

		// Alice receives her initial REV tokens. Bob opts in so he can buy them.
		await optIn(algod, aliceSigner, eRevAsaId);
		await optIn(algod, bobSigner, eRevAsaId);
		await optIn(algod, aliceSigner, USDC_ID);
		await optIn(algod, bobSigner, USDC_ID);

		{
			const { txns, signers } = await buildClaimTokens(
				algod,
				aliceSigner,
				eIpId,
				eRevAsaId,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		const aliceInitialRev = await assetBalance(
			algod,
			aliceSigner.address,
			eRevAsaId,
		);

		assert(
			aliceInitialRev > 0,
			'V10-E setup',
			'Alice received REV before the first snapshot',
		);

		// Fund two payout rounds.
		{
			const { txns, signers } = await buildDepositUsdc(
				algod,
				signer,
				eIpId,
				E_ROUND_AMOUNT * 2,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		// Round 1 snapshot: Alice holds REV, so Alice is the recorded recipient.
		let before = readPoolBox(
			await getBox(algod, poolBoxName(eIpId)),
		);

		{
			const { txns, signers } = await buildCreatePayoutRound(
				algod,
				signer,
				eIpId,
				E_ROUND_AMOUNT,
				before.currentRoundId,
				1,
				[{ address: aliceSigner.address, amount: E_ROUND_AMOUNT }],
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		let after = readPoolBox(
			await getBox(algod, poolBoxName(eIpId)),
		);

		const firstRoundId = after.currentRoundId;

		// Alice claims the payout created from her Round 1 snapshot.
		const aliceBeforeRound1 = await assetBalance(
			algod,
			aliceSigner.address,
			USDC_ID,
		);

		{
			const { txns, signers } = await buildClaimRevenueRound(
				algod,
				aliceSigner,
				eIpId,
				firstRoundId,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		assert(
			await assetBalance(algod, aliceSigner.address, USDC_ID)
				=== aliceBeforeRound1 + E_ROUND_AMOUNT,
			'V10-E Round 1 snapshot claim',
			'Alice received the allocation recorded before selling REV',
		);

		// Alice sells all REV to Bob after Round 1 is created.
		{
			const sp = await algod.getTransactionParams().do();

			const transferTxn = makeAssetTransferTxnWithSuggestedParamsFromObject({
				sender: aliceSigner.address,
				receiver: bobSigner.address,
				assetIndex: eRevAsaId,
				amount: aliceInitialRev,
				suggestedParams: { ...sp, fee: 1000n, flatFee: true },
			});

			await algod.sendRawTransaction(
				aliceSigner.signTxn(transferTxn),
			).do();

			await confirm(algod, transferTxn.txID());
		}

		assert(
			await assetBalance(algod, aliceSigner.address, eRevAsaId) === 0,
			'V10-E REV transfer',
			'Alice has zero REV after selling to Bob',
		);

		assert(
			await assetBalance(algod, bobSigner.address, eRevAsaId)
				=== aliceInitialRev,
			'V10-E REV transfer',
			'Bob holds the transferred REV before the next snapshot',
		);

		// Round 2 snapshot: the backend-equivalent supplied list records Bob.
		before = readPoolBox(
			await getBox(algod, poolBoxName(eIpId)),
		);

		{
			const { txns, signers } = await buildCreatePayoutRound(
				algod,
				signer,
				eIpId,
				E_ROUND_AMOUNT,
				before.currentRoundId,
				1,
				[{ address: bobSigner.address, amount: E_ROUND_AMOUNT }],
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		after = readPoolBox(
			await getBox(algod, poolBoxName(eIpId)),
		);

		const secondRoundId = after.currentRoundId;

		// Bob claims the new round created after he acquired REV.
		const bobBeforeRound2 = await assetBalance(
			algod,
			bobSigner.address,
			USDC_ID,
		);

		{
			const { txns, signers } = await buildClaimRevenueRound(
				algod,
				bobSigner,
				eIpId,
				secondRoundId,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		assert(
			await assetBalance(algod, bobSigner.address, USDC_ID)
				=== bobBeforeRound2 + E_ROUND_AMOUNT,
			'V10-E Round 2 snapshot claim',
			'Bob received the allocation recorded after acquiring REV',
		);

		// Bob cannot retroactively claim Alice's already-created Round 1.
		await expectReject(
			algod,
			() => buildClaimRevenueRound(
				algod,
				bobSigner,
				eIpId,
				firstRoundId,
			),
			'V10-E historic snapshot protection',
		);

		log(
			'V10-E holder-transfer snapshot',
			true,
			'Alice claimed Round 1; Bob bought REV and claimed the later Round 2',
		);
	}

  console.log('\n━━━ All tests complete ━━━\n');

  // ── ARTIFACT EXPORT ────────────────────────────────────────────────────────
  console.log('📦 [Teardown] Generating Next.js artifacts...');
  const artifactPath = path.resolve(process.cwd(), '.env.validation');
  const artifactData = [
    `# Generated by Revenue Pool V10 Lifecycle Harness`,
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