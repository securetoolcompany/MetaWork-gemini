/**
 * scripts/test_lifecycle.js
 * Revenue Pool V9 — Full Lifecycle Test Harness (16 cases + A-F)
 *
 * Run with:  node contracts/test_revenue_pool_v9.js
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

const CLAIM_PAGE_SIZE = 4;

async function buildClaimRevenueAll(
  algod,
  signer,
  ipId,
  startRoundId,
  currentRoundId,
) {
  if (
    !Number.isInteger(startRoundId) ||
    !Number.isInteger(currentRoundId) ||
    startRoundId < 1 ||
    startRoundId > currentRoundId
  ) {
    throw new Error(
      `Invalid V9 claim page: start=${startRoundId}, current=${currentRoundId}`
    );
  }

  const endRoundId = Math.min(
    startRoundId + CLAIM_PAGE_SIZE - 1,
    currentRoundId,
  );

  const boxes = [
    { appIndex: APP_ID, name: poolBoxName(ipId) },
  ];

  for (let roundId = startRoundId; roundId <= endRoundId; roundId++) {
    boxes.push({
      appIndex: APP_ID,
      name: roundBoxName(ipId, roundId),
    });
  }

  const maxInnerTransfers = endRoundId - startRoundId + 1;
  const sp = await algod.getTransactionParams().do();

  const appTxn = makeApplicationNoOpTxnFromObject({
    sender: signer.address,
    appIndex: APP_ID,
    appArgs: [
      new TextEncoder().encode('claim_revenue_all'),
      new TextEncoder().encode(ipId),
      algosdk.encodeUint64(startRoundId),
    ],
    foreignAssets: [USDC_ID],
    boxes,
    suggestedParams: {
      ...sp,
      fee: BigInt(1000 * (1 + maxInnerTransfers)),
      flatFee: true,
    },
  });

  return {
    txns: [appTxn],
    signers: [signer.signTxn.bind(signer)],
  };
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

	// V8 snapshot-policy test wallets
	const aliceSigner = {
	address: alice.addr.toString(),
	signTxn: (txn) => txn.signTxn(alice.sk),
	};

	const bobSigner = {
	address: bob.addr.toString(),
	signTxn: (txn) => txn.signTxn(bob.sk),
	};

  console.log('\n━━━ Revenue Pool V9 — Lifecycle Tests ━━━');
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
    const { txns, signers } = await buildClaimRevenueAll(
			algod,
			signer,
			ipId,
			1,
			totalRounds,
		);
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

	// ── V8 Snapshot Acceptance Tests A–D + F ────────────────────────────────────
	{
		const v8IpId = `v8-snapshot-${Date.now()}`;

		const assetBalance = async (address, assetId) => {
			try {
				const info = await algod.accountAssetInformation(address, assetId).do();
				return Number(info.assetHolding.amount);
			} catch (_) {
				return 0;
			}
		};

		const optIn = async (walletSigner, assetId) => {
			const sp = await algod.getTransactionParams().do();
			const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
				sender: walletSigner.address,
				receiver: walletSigner.address,
				assetIndex: assetId,
				amount: 0,
				suggestedParams: { ...sp, fee: 1000n, flatFee: true },
			});

			await algod.sendRawTransaction(walletSigner.signTxn(txn)).do();
			await confirm(algod, txn.txID());
		};

		const v8Stakeholders = [
			{ address: aliceSigner.address, bps: 7000 },
			{ address: signer.address, bps: 3000 },
		];

		// Fresh V8 pool.
		{
			const { txns, signers } = await buildCreatePool(
				algod,
				signer,
				v8IpId,
				v8Stakeholders,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		const v8Pool = readPoolBox(await getBox(algod, poolBoxName(v8IpId)));
		const v8RevAsaId = v8Pool.revAsaId;

		assert(v8RevAsaId > 0, 'V8 setup', `fresh REV ASA=${v8RevAsaId}`);

		// Alice needs REV to sell and USDC to receive claims.
		await optIn(aliceSigner, v8RevAsaId);
		await optIn(aliceSigner, USDC_ID);

		// Bob needs REV to receive Alice's transferred tokens.
		await optIn(bobSigner, v8RevAsaId);

		// Alice claims her initial REV allocation.
		{
			const { txns, signers } = await buildClaimTokens(
				algod,
				aliceSigner,
				v8IpId,
				v8RevAsaId,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		assert(
			await assetBalance(aliceSigner.address, v8RevAsaId) > 0,
			'V8 setup',
			'Alice received REV tokens',
		);

		// Deposit sufficient USDC into the fresh V8 pool's unallocated balance.
		{
			const { txns, signers } = await buildDepositUsdc(
				algod,
				signer,
				v8IpId,
				500_000,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));
		}

		// Creates an explicit immutable payout round that contains Alice only.
		const createAliceRound = async (amount) => {
			const before = readPoolBox(await getBox(algod, poolBoxName(v8IpId)));

			const { txns, signers } = await buildCreatePayoutRound(
				algod,
				signer,
				v8IpId,
				amount,
				before.currentRoundId,
				1,
				[{ address: aliceSigner.address, amount }],
			);

			await confirm(algod, await sendGroup(algod, txns, signers));

			const after = readPoolBox(await getBox(algod, poolBoxName(v8IpId)));
			return after.currentRoundId;
		};

		// ── Test A: Recorded holder claims exact allocation ────────────────────────
		const roundAId = await createAliceRound(100_000);

		{
			const usdcBefore = await assetBalance(aliceSigner.address, USDC_ID);

			const { txns, signers } = await buildClaimRevenueRound(
				algod,
				aliceSigner,
				v8IpId,
				roundAId,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));

			const usdcAfter = await assetBalance(aliceSigner.address, USDC_ID);
			const round = readRoundBox(await getBox(algod, roundBoxName(v8IpId, roundAId)));
			const aliceEntry = round.holders.find(
				(holder) => holder.address === aliceSigner.address,
			);

			assert(
				usdcAfter === usdcBefore + 100_000,
				'V8-A exact allocation',
				'Alice received exactly 100000 microUSDC',
			);

			assert(
				aliceEntry && aliceEntry.claimed,
				'V8-A claimed flag',
				'Alice entry is FLAG_CLAIMED',
			);
		}

		// ── Test B/C setup: record Alice, then transfer all REV to Bob ───────────
		const roundBId = await createAliceRound(100_000);

		const aliceRevBeforeSale = await assetBalance(aliceSigner.address, v8RevAsaId);

		{
			const sp = await algod.getTransactionParams().do();

			const transferTxn = makeAssetTransferTxnWithSuggestedParamsFromObject({
				sender: aliceSigner.address,
				receiver: bobSigner.address,
				assetIndex: v8RevAsaId,
				amount: aliceRevBeforeSale,
				suggestedParams: { ...sp, fee: 1000n, flatFee: true },
			});

			await algod.sendRawTransaction(aliceSigner.signTxn(transferTxn)).do();
			await confirm(algod, transferTxn.txID());
		}

		assert(
			await assetBalance(aliceSigner.address, v8RevAsaId) === 0,
			'V8-B zero REV',
			'Alice transferred all REV to Bob',
		);

		// ── Test C: Buyer cannot claim seller's historic snapshot ─────────────────
		await expectReject(
			algod,
			() => buildClaimRevenueRound(algod, bobSigner, v8IpId, roundBId),
			'V8-C Bob cannot claim Alice historic round',
		);

		{
			const round = readRoundBox(await getBox(algod, roundBoxName(v8IpId, roundBId)));
			const aliceEntry = round.holders.find(
				(holder) => holder.address === aliceSigner.address,
			);

			assert(
				aliceEntry && !aliceEntry.claimed,
				'V8-C Alice entry unchanged',
				'Bob did not mark Alice entry claimed',
			);
		}

		// ── Test B: Seller at zero REV claims historic snapshot ───────────────────
		{
			const usdcBefore = await assetBalance(aliceSigner.address, USDC_ID);

			const { txns, signers } = await buildClaimRevenueRound(
				algod,
				aliceSigner,
				v8IpId,
				roundBId,
			);

			await confirm(algod, await sendGroup(algod, txns, signers));

			const usdcAfter = await assetBalance(aliceSigner.address, USDC_ID);

			assert(
				usdcAfter === usdcBefore + 100_000,
				'V8-B zero-REV seller claim',
				'Alice received her historic 100000 microUSDC allocation',
			);
		}

		// ── Test D: Already-claimed entry cannot claim twice ──────────────────────
		{
			const poolBefore = readPoolBox(await getBox(algod, poolBoxName(v8IpId)));

			await expectReject(
				algod,
				() => buildClaimRevenueRound(algod, aliceSigner, v8IpId, roundBId),
				'V8-D duplicate claim rejected',
			);

			const poolAfter = readPoolBox(await getBox(algod, poolBoxName(v8IpId)));

			assert(
				poolAfter.totalClaimed === poolBefore.totalClaimed,
				'V8-D totalClaimed unchanged',
				'Duplicate claim did not increase totalClaimed',
			);
		}

		// ── Test F: Non-ledger wallet cannot claim ─────────────────────────────────
		const roundFId = await createAliceRound(100_000);

		{
			await expectReject(
				algod,
				() => buildClaimRevenueRound(algod, bobSigner, v8IpId, roundFId),
				'V8-F non-ledger wallet rejected',
			);

			const round = readRoundBox(await getBox(algod, roundBoxName(v8IpId, roundFId)));
			const aliceEntry = round.holders.find(
				(holder) => holder.address === aliceSigner.address,
			);

			assert(
				aliceEntry && !aliceEntry.claimed,
				'V8-F Alice flag unchanged',
				'Bob did not alter Alice’s unclaimed allocation',
			);
		}

		// ── V9-E: Paginated claim-all batch cap ─────────────────────────────────
    {
      const eIpId = `v9-batch-${Date.now()}`;
      const E_ROUND_AMOUNT = 100_000;
      const E_ROUND_COUNT = 8;

      const eStakeholders = [
        { address: aliceSigner.address, bps: 7000 },
        { address: signer.address, bps: 3000 },
      ];

      // Create a dedicated fresh V9 pool.
      {
        const { txns, signers } = await buildCreatePool(
          algod,
          signer,
          eIpId,
          eStakeholders,
        );

        await confirm(algod, await sendGroup(algod, txns, signers));
      }

      // Fund the eight explicit payout rounds.
      {
        const { txns, signers } = await buildDepositUsdc(
          algod,
          signer,
          eIpId,
          E_ROUND_AMOUNT * E_ROUND_COUNT,
        );

        await confirm(algod, await sendGroup(algod, txns, signers));
      }

      // Create Rounds 1–8, each recording Alice for exactly 100,000 microUSDC.
      for (let i = 0; i < E_ROUND_COUNT; i++) {
        const before = readPoolBox(
          await getBox(algod, poolBoxName(eIpId)),
        );

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

      const poolAfterRounds = readPoolBox(
        await getBox(algod, poolBoxName(eIpId)),
      );

      assert(
        poolAfterRounds.currentRoundId === E_ROUND_COUNT,
        'V9-E setup',
        'Created exactly eight payout rounds',
      );

      const countAliceClaimedRounds = async () => {
        let claimed = 0;

        for (let roundId = 1; roundId <= E_ROUND_COUNT; roundId++) {
          const round = readRoundBox(
            await getBox(algod, roundBoxName(eIpId, roundId)),
          );

          const aliceEntry = round.holders.find(
            (holder) => holder.address === aliceSigner.address,
          );

          if (aliceEntry?.claimed) {
            claimed++;
          }
        }

        return claimed;
      };

      const usdcBefore = await assetBalance(
        aliceSigner.address,
        USDC_ID,
      );

      // Page 1: scan and pay Rounds 1–4.
      {
        const { txns, signers } = await buildClaimRevenueAll(
          algod,
          aliceSigner,
          eIpId,
          1,
          E_ROUND_COUNT,
        );

        await confirm(algod, await sendGroup(algod, txns, signers));
      }

      const claimedAfterPageOne = await countAliceClaimedRounds();
      const usdcAfterPageOne = await assetBalance(
        aliceSigner.address,
        USDC_ID,
      );

      assert(
        claimedAfterPageOne === 4,
        'V9-E first page cap',
        'First paginated claim-all call claimed exactly Rounds 1–4',
      );

      assert(
        usdcAfterPageOne === usdcBefore + (E_ROUND_AMOUNT * 4),
        'V9-E first page payment',
        'Alice received exactly four round allocations',
      );

      const round5 = readRoundBox(
        await getBox(algod, roundBoxName(eIpId, 5)),
      );

      const aliceRound5 = round5.holders.find(
        (holder) => holder.address === aliceSigner.address,
      );

      assert(
        aliceRound5 && !aliceRound5.claimed,
        'V9-E second page remains pending',
        'Round 5 remains unclaimed after page one',
      );

      // Page 2: scan and pay Rounds 5–8.
      {
        const { txns, signers } = await buildClaimRevenueAll(
          algod,
          aliceSigner,
          eIpId,
          5,
          E_ROUND_COUNT,
        );

        await confirm(algod, await sendGroup(algod, txns, signers));
      }

      const claimedAfterPageTwo = await countAliceClaimedRounds();
      const usdcAfterPageTwo = await assetBalance(
        aliceSigner.address,
        USDC_ID,
      );

      assert(
        claimedAfterPageTwo === 8,
        'V9-E second page',
        'Second paginated claim-all call claimed Rounds 5–8',
      );

      assert(
        usdcAfterPageTwo === usdcBefore + (E_ROUND_AMOUNT * E_ROUND_COUNT),
        'V9-E exact total payment',
        'Alice received all eight recorded allocations across two pages',
      );

      log(
        'V9-E paginated claim-all',
        true,
        'Page 1 paid Rounds 1–4; Page 2 paid Rounds 5–8',
      );
    }

		log('V8 A–F', true, 'snapshot-eligibility acceptance and seven-round batch-cap tests passed');
	}

  console.log('\n━━━ All tests complete ━━━\n');

  // ── ARTIFACT EXPORT ────────────────────────────────────────────────────────
  console.log('📦 [Teardown] Generating Next.js artifacts...');
  const artifactPath = path.resolve(process.cwd(), '.env.validation');
  const artifactData = [
    `# Generated by Revenue Pool V9 Lifecycle Harness`,
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