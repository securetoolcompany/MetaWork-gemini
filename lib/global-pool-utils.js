/**
 * Global Revenue Pool Utilities
 * 
 * Shared utilities for the single global revenue pool architecture.
 * This replaces the per-product pool deployment model.
 */

import algosdk from 'algosdk';
import { getAlgodClient, getTransactionParams, waitForConfirmation } from './algorand';
import fs from 'fs';
import path from 'path';

// Environment configuration
export const GLOBAL_POOL_APP_ID = parseInt(process.env.GLOBAL_POOL_APP_ID || '0');
export const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941');
export const METAWORK_WALLET = process.env.METAWORK_PLATFORM_WALLET || 'WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI';

// Cost constants
export const POOL_CREATION_COST = 111000; // ~0.111 ALGO
export const BOX_MBR = 2500 + (128 * 400); // Base + per-byte MBR
export const ASA_MBR = 100000;

/**
 * Safe uint64 encoding that avoids BigInt issues
 */
export function encodeUint64(num) {
  const buf = Buffer.alloc(8);
  const high = Math.floor(num / 0x100000000);
  const low = num % 0x100000000;
  buf.writeUInt32BE(high, 0);
  buf.writeUInt32BE(low, 4);
  return new Uint8Array(buf);
}

/**
 * Build box key for a product
 */
export function getProductBoxKey(productId) {
  return Buffer.concat([Buffer.from('p_'), Buffer.from(productId)]);
}

/**
 * Get the global pool application address
 */
export function getGlobalPoolAddress() {
  if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
    throw new Error('Global pool not deployed');
  }
  return algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID);
}

/**
 * Parse product box data
 */
export function parseProductBox(boxValue) {
  if (!boxValue || boxValue.length < 24) {
    return null;
  }
  
  const data = Buffer.isBuffer(boxValue) ? boxValue : Buffer.from(boxValue);
  
  return {
    revenueAsaId: Number(data.readBigUInt64BE(0)),
    totalDeposited: Number(data.readBigUInt64BE(8)),
    totalClaimed: Number(data.readBigUInt64BE(16)),
    get poolBalance() {
      return this.totalDeposited - this.totalClaimed;
    }
  };
}

/**
 * Check if global pool is deployed and get info
 */
export async function getGlobalPoolInfo() {
  if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
    return {
      deployed: false,
      appId: null,
      appAddress: null
    };
  }
  
  const algodClient = getAlgodClient();
  
  try {
    const appInfo = await algodClient.getApplicationByID(GLOBAL_POOL_APP_ID).do();
    return {
      deployed: true,
      appId: GLOBAL_POOL_APP_ID,
      appAddress: algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID),
      globalState: appInfo.params?.['global-state'] || []
    };
  } catch (err) {
    return {
      deployed: false,
      appId: GLOBAL_POOL_APP_ID,
      error: err.message
    };
  }
}

/**
 * Get product info from the global pool
 */
export async function getProductInfo(productId) {
  if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
    throw new Error('Global pool not deployed');
  }
  
  const algodClient = getAlgodClient();
  const boxName = getProductBoxKey(productId);
  
  try {
    const boxValue = await algodClient.getApplicationBoxByName(GLOBAL_POOL_APP_ID, boxName).do();
    if (boxValue && boxValue.value) {
      return {
        exists: true,
        productId,
        ...parseProductBox(Buffer.from(boxValue.value))
      };
    }
    return { exists: false, productId };
  } catch (err) {
    return { exists: false, productId, error: err.message };
  }
}

/**
 * Create transactions for pool creation
 */
export async function createPoolCreationTxns(creatorAddress, productId) {
  if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
    throw new Error('Global pool not deployed');
  }
  
  const suggestedParams = await getTransactionParams();
  const appAddress = getGlobalPoolAddress();
  const boxName = getProductBoxKey(productId);
  
  const txns = [];
  
  // Payment for MBR
  txns.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: creatorAddress,
    receiver: appAddress,
    amount: POOL_CREATION_COST,
    suggestedParams: { ...suggestedParams, fee: 1000, flatFee: true }
  }));
  
  // App call to create_pool
  txns.push(algosdk.makeApplicationNoOpTxnFromObject({
    sender: creatorAddress,
    appIndex: GLOBAL_POOL_APP_ID,
    appArgs: [
      new Uint8Array(Buffer.from('create_pool')),
      new Uint8Array(Buffer.from(productId))
    ],
    boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: boxName }],
    suggestedParams: { ...suggestedParams, fee: 2000, flatFee: true }
  }));
  
  algosdk.assignGroupID(txns);
  
  return txns;
}

/**
 * Create transaction for claiming revenue tokens
 */
export async function createClaimTokensTxn(userAddress, productId, amount, revenueAsaId) {
  if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
    throw new Error('Global pool not deployed');
  }
  
  const suggestedParams = await getTransactionParams();
  const boxName = getProductBoxKey(productId);
  
  return algosdk.makeApplicationNoOpTxnFromObject({
    sender: userAddress,
    appIndex: GLOBAL_POOL_APP_ID,
    appArgs: [
      new Uint8Array(Buffer.from('claim_rev_tokens')),
      new Uint8Array(Buffer.from(productId)),
      encodeUint64(amount)
    ],
    foreignAssets: [revenueAsaId],
    boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: boxName }],
    suggestedParams: { ...suggestedParams, fee: 2000, flatFee: true }
  });
}

/**
 * Create transaction for claiming USDC revenue
 */
export async function createClaimRevenueTxn(userAddress, productId, tokenBalance) {
  if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
    throw new Error('Global pool not deployed');
  }
  
  const suggestedParams = await getTransactionParams();
  const boxName = getProductBoxKey(productId);
  
  return algosdk.makeApplicationNoOpTxnFromObject({
    sender: userAddress,
    appIndex: GLOBAL_POOL_APP_ID,
    appArgs: [
      new Uint8Array(Buffer.from('claim_revenue')),
      new Uint8Array(Buffer.from(productId)),
      encodeUint64(tokenBalance)
    ],
    foreignAssets: [USDC_ASSET_ID],
    boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: boxName }],
    suggestedParams: { ...suggestedParams, fee: 2000, flatFee: true }
  });
}

/**
 * Create transactions for depositing USDC
 */
export async function createDepositUsdcTxns(depositorAddress, productId, amount) {
  if (!GLOBAL_POOL_APP_ID || GLOBAL_POOL_APP_ID === 0) {
    throw new Error('Global pool not deployed');
  }
  
  const suggestedParams = await getTransactionParams();
  const appAddress = getGlobalPoolAddress();
  const boxName = getProductBoxKey(productId);
  
  const txns = [];
  
  // USDC transfer to app
  txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: depositorAddress,
    receiver: appAddress,
    amount: amount,
    assetIndex: USDC_ASSET_ID,
    suggestedParams: { ...suggestedParams, fee: 1000, flatFee: true }
  }));
  
  // App call to deposit_usdc
  txns.push(algosdk.makeApplicationNoOpTxnFromObject({
    sender: depositorAddress,
    appIndex: GLOBAL_POOL_APP_ID,
    appArgs: [
      new Uint8Array(Buffer.from('deposit_usdc')),
      new Uint8Array(Buffer.from(productId))
    ],
    foreignAssets: [USDC_ASSET_ID],
    boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: boxName }],
    suggestedParams: { ...suggestedParams, fee: 1000, flatFee: true }
  }));
  
  algosdk.assignGroupID(txns);
  
  return txns;
}

/**
 * Get compiled global pool programs for deployment
 */
export function getGlobalPoolPrograms() {
  const contractsDir = path.join(process.cwd(), 'contracts');
  const approvalTeal = fs.readFileSync(path.join(contractsDir, 'revenue_pool_global_approval.teal'), 'utf8');
  const clearTeal = fs.readFileSync(path.join(contractsDir, 'revenue_pool_global_clear.teal'), 'utf8');
  return { approvalTeal, clearTeal };
}

/**
 * Deploy the global pool (platform admin only)
 */
export async function deployGlobalPool(deployerAddress, metaworkWallet) {
  const algodClient = getAlgodClient();
  const suggestedParams = await getTransactionParams();
  
  const { approvalTeal, clearTeal } = getGlobalPoolPrograms();
  
  // Compile TEAL
  const approvalCompiled = await algodClient.compile(approvalTeal).do();
  const clearCompiled = await algodClient.compile(clearTeal).do();
  
  const approvalProgram = new Uint8Array(Buffer.from(approvalCompiled.result, 'base64'));
  const clearProgram = new Uint8Array(Buffer.from(clearCompiled.result, 'base64'));
  
  // Create deployment transaction
  const deployTxn = algosdk.makeApplicationCreateTxnFromObject({
    sender: deployerAddress,
    suggestedParams: { ...suggestedParams, fee: 2000, flatFee: true },
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram,
    clearProgram,
    numGlobalByteSlices: 1,
    numGlobalInts: 1,
    numLocalByteSlices: 0,
    numLocalInts: 0,
    appArgs: [algosdk.decodeAddress(metaworkWallet).publicKey]
  });
  
  return {
    transaction: deployTxn,
    txnBase64: Buffer.from(algosdk.encodeUnsignedTransaction(deployTxn)).toString('base64')
  };
}
