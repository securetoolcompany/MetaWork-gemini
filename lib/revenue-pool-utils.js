import algosdk from 'algosdk';
import { getAlgodClient, getTransactionParams, waitForConfirmation } from './algorand';
import fs from 'fs';
import path from 'path';

// USDC Asset ID on Algorand Testnet
const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941');

// Platform wallet for clawback authority - Force primitive string
const ENV_WALLET = process.env.METAWORK_PLATFORM_WALLET || 'WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI';
const PLATFORM_WALLET = String(ENV_WALLET).trim();

/**
 * Compile TEAL source to bytecode
 */
async function compileTeal(tealSource) {
  const algodClient = getAlgodClient();
  const compiled = await algodClient.compile(tealSource).do();
  return new Uint8Array(Buffer.from(compiled.result, 'base64'));
}

/**
 * Get compiled Revenue Pool programs
 */
function getPoolPrograms() {
  const contractsDir = path.join(process.cwd(), 'contracts');
  const approvalTeal = fs.readFileSync(path.join(contractsDir, 'revenue_pool_approval.teal'), 'utf8');
  const clearTeal = fs.readFileSync(path.join(contractsDir, 'revenue_pool_clear.teal'), 'utf8');
  return { approvalTeal, clearTeal };
}

/**
 * Create a complete IP minting + Revenue Pool setup transaction group
 */
export async function createCompleteMintingFlow(creatorAddress, nftParams, stakeholders) {
  const {
    name,
    unitName,
    metadataUrl,
    metadataHash,
    ipAssetId
  } = nftParams;

  // Ensure creatorAddress is a primitive string
  const sender = String(creatorAddress).trim();
  const suggestedParams = await getTransactionParams();

  // ========================================
  // GROUP 1: Create NFT + Revenue Tokens
  // ========================================

  // Transaction 1: Create IP Ownership NFT
  const nftTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: sender,
    total: 1n,
    decimals: 0,
    defaultFrozen: false,
    manager: sender,
    reserve: sender,
    freeze: undefined,
    clawback: undefined, 
    unitName: unitName.substring(0, 8),
    assetName: name.substring(0, 32),
    assetURL: metadataUrl.substring(0, 96),
    assetMetadataHash: metadataHash ? new Uint8Array(Buffer.from(metadataHash, 'base64').slice(0, 32)) : undefined,
    suggestedParams
  });

  // Transaction 2: Create Revenue Tokens WITH CLAWBACK
  const revTokenTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: sender,
    total: 100n,
    decimals: 0,
    defaultFrozen: false,
    manager: PLATFORM_WALLET, 
    reserve: undefined,
    freeze: PLATFORM_WALLET, 
    clawback: PLATFORM_WALLET, 
    unitName: `REV${(ipAssetId || 'IP').substring(0, 4).toUpperCase()}`,
    assetName: `${name} Revenue`.substring(0, 32),
    assetURL: metadataUrl.substring(0, 96),
    suggestedParams
  });

  // Group 1 transactions
  const group1Txns = [nftTxn, revTokenTxn];
  algosdk.assignGroupID(group1Txns);

  // Encode Group 1 for signing
  const group1Base64 = group1Txns.map(txn => 
    Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64')
  );

  return {
    mintingTransactions: group1Base64,
    mintingTxnIds: group1Txns.map(t => t.txID()),
    nftTxnIndex: 0,
    revTokenTxnIndex: 1,
    clawbackAuthority: PLATFORM_WALLET,
    stakeholders,
    message: 'Sign these transactions to mint your IP. Tokens will be transferred to the Revenue Pool automatically.'
  };
}

/**
 * Create pool setup transactions AFTER minting is confirmed
 */
export async function createPoolSetupTransactions(creatorAddress, revenueTokenId, ipAssetId, stakeholders) {
  const sender = String(creatorAddress).trim();
  const suggestedParams = await getTransactionParams();

  // Get compiled pool programs
  const { approvalTeal, clearTeal } = getPoolPrograms();
  const [approvalProgram, clearProgram] = await Promise.all([
    compileTeal(approvalTeal),
    compileTeal(clearTeal)
  ]);

  // Transaction 1: Deploy Revenue Pool contract
  const deployTxn = algosdk.makeApplicationCreateTxnFromObject({
    sender: sender,
    suggestedParams: { ...suggestedParams, fee: 2000 },
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram,
    clearProgram,
    numGlobalByteSlices: 2,
    numGlobalInts: 4,
    numLocalByteSlices: 0,
    numLocalInts: 1,
    extraPages: 0
  });

  const deployTxnBase64 = Buffer.from(algosdk.encodeUnsignedTransaction(deployTxn)).toString('base64');

  return {
    step: 'deploy_pool',
    transaction: deployTxnBase64,
    txnId: deployTxn.txID(),
    revenueTokenId,
    ipAssetId,
    stakeholders,
    message: 'Sign to deploy the Revenue Pool contract'
  };
}

/**
 * Create finalization transactions after pool is deployed
 */
export async function createPoolFinalizationTransactions(
  creatorAddress, 
  appId, 
  appAddress,
  revenueTokenId, 
  ipAssetId, 
  stakeholders
) {
  const sender = String(creatorAddress).trim();
  const poolAddr = String(appAddress).trim();
  const suggestedParams = await getTransactionParams();
  const transactions = [];

  // Transaction 1: Fund pool with ALGO
  transactions.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: sender,
    receiver: poolAddr,
    amount: 400000, 
    suggestedParams
  }));

  // Transaction 2: Initialize pool
  transactions.push(algosdk.makeApplicationNoOpTxnFromObject({
    sender: sender,
    suggestedParams,
    appIndex: appId,
    appArgs: [
      new Uint8Array(Buffer.from('init')),
      new Uint8Array(Buffer.from(ipAssetId)),
      algosdk.encodeUint64(revenueTokenId)
    ]
  }));

  // Transaction 3: Pool opts-in to assets
  transactions.push(algosdk.makeApplicationNoOpTxnFromObject({
    sender: sender,
    suggestedParams,
    appIndex: appId,
    appArgs: [
      new Uint8Array(Buffer.from('opt_in_assets'))
    ],
    foreignAssets: [revenueTokenId, USDC_ASSET_ID]
  }));

  // Transaction 4: Transfer ALL 100 tokens to pool
  transactions.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: sender,
    receiver: poolAddr,
    amount: 100, 
    assetIndex: revenueTokenId,
    suggestedParams
  }));

  // Transactions 5+: Set stakeholder allocations
  for (const stakeholder of stakeholders) {
    // FIX: Ensure address is a string
    const stkAddr = String(stakeholder.address).trim();
    transactions.push(algosdk.makeApplicationNoOpTxnFromObject({
      sender: sender,
      suggestedParams: { ...suggestedParams, fee: 2000 },
      appIndex: appId,
      appArgs: [
        new Uint8Array(Buffer.from('set_stakeholder')),
        algosdk.decodeAddress(stkAddr).publicKey,
        algosdk.encodeUint64(stakeholder.percentage)
      ],
      boxes: [
        { 
          appIndex: appId, 
          name: Buffer.concat([
            Buffer.from('stk_'), 
            algosdk.decodeAddress(stkAddr).publicKey
          ]) 
        }
      ]
    }));
  }

  algosdk.assignGroupID(transactions);

  const txnsBase64 = transactions.map(txn => 
    Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64')
  );

  return {
    step: 'finalize_pool',
    transactions: txnsBase64,
    transactionCount: transactions.length,
    appId,
    appAddress: poolAddr,
    message: `Sign ${transactions.length} transactions to finalize the Revenue Pool`
  };
}

/**
 * Use clawback to force transfer tokens to pool
 */
export async function forceTransferToPool(
  platformPrivateKey,
  creatorAddress,
  poolAddress,
  revenueTokenId,
  amount
) {
  const suggestedParams = await getTransactionParams();
  const algodClient = getAlgodClient();

  const clawbackTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: PLATFORM_WALLET,
    receiver: String(poolAddress).trim(),
    assetSender: String(creatorAddress).trim(),
    amount,
    assetIndex: revenueTokenId,
    suggestedParams
  });

  const secretKey = algosdk.mnemonicToSecretKey(platformPrivateKey).sk;
  const signedTxn = clawbackTxn.signTxn(secretKey);

  const { txid } = await algodClient.sendRawTransaction(signedTxn).do();
  await waitForConfirmation(txid, 10);

  return { txId: txid, success: true };
}

export {
  PLATFORM_WALLET,
  USDC_ASSET_ID
};
export const GLOBAL_POOL_APP_ID = Number(process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID || '0');
export function getProductBoxKey(productId) {
  return `box_${productId}`;  // Or your impl
}
