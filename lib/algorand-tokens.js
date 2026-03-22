import algosdk from 'algosdk';
import { getAlgodClient, getTransactionParams, submitTransaction, waitForConfirmation } from './algorand';

// MetaWork platform wallet address (receives 20% of revenue tokens)
const METAWORK_PLATFORM_WALLET = process.env.METAWORK_PLATFORM_WALLET || 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';

// Vault escrow address - this holds all revenue tokens until claimed
// For production, this should be a smart contract application address
// For MVP, we use the platform wallet as escrow (it will hold tokens for all vaults)
const VAULT_ESCROW_ADDRESS = process.env.VAULT_ESCROW_ADDRESS || METAWORK_PLATFORM_WALLET;

/**
 * Get the vault escrow address
 */
export function getVaultEscrowAddress() {
  return VAULT_ESCROW_ADDRESS;
}

/**
 * Create an atomic transaction group for minting IP NFT + Revenue Tokens
 * Both assets are created in a single atomic transaction
 * Revenue tokens are sent to vault escrow for stakeholder claims
 * @param {string} creatorAddress - The creator's wallet address
 * @param {object} params - NFT and token parameters
 * @param {boolean} sendToVault - Whether to send revenue tokens to vault escrow (default: true)
 * @returns {Promise<{transactions: Array, txnBytesArray: Array}>}
 */
export async function createIPMintingTransactionGroup(creatorAddress, params, sendToVault = true) {
  const {
    name,
    unitName,
    metadataUrl,
    metadataHash,
    ipAssetId // Database ID for the IP asset
  } = params;
  
  const suggestedParams = await getTransactionParams();
  
  // Transaction 1: Create IP Ownership NFT (supply=1, decimals=0)
  const nftTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: creatorAddress,
    total: 1n,
    decimals: 0,
    defaultFrozen: false,
    manager: creatorAddress,
    reserve: creatorAddress,
    freeze: undefined,
    clawback: undefined,
    unitName: unitName.substring(0, 8),
    assetName: name.substring(0, 32),
    assetURL: metadataUrl.substring(0, 96),
    assetMetadataHash: metadataHash ? new Uint8Array(Buffer.from(metadataHash, 'base64').slice(0, 32)) : undefined,
    suggestedParams
  });
  
  // Transaction 2: Create Revenue Tokens (100 tokens with 0 decimals for simplicity)
  // CRITICAL: Platform has clawback authority - if creator doesn't transfer to pool,
  // platform can forcibly move tokens to the Revenue Pool
  const PLATFORM_WALLET = process.env.METAWORK_PLATFORM_WALLET || 'WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI';
  
  const revTokenTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: creatorAddress,
    total: 100n, // 100 tokens (no decimals for simplicity)
    decimals: 0,
    defaultFrozen: false,
    manager: PLATFORM_WALLET, // Platform manages the token
    reserve: undefined,
    freeze: PLATFORM_WALLET, // Platform can freeze if needed  
    clawback: PLATFORM_WALLET, // CRITICAL: Platform can force transfer to pool
    unitName: `REV${(ipAssetId || 'IP').substring(0, 4).toUpperCase()}`,
    assetName: `${name} Revenue`.substring(0, 32),
    assetURL: metadataUrl.substring(0, 96),
    suggestedParams
  });
  
  // Group the transactions atomically
  const txns = [nftTxn, revTokenTxn];
  algosdk.assignGroupID(txns);
  
  // Encode using msgpack and return as base64 for HTTP transport
  // Pera Wallet will decode these and re-encode internally
  const txnBytesArray = txns.map(txn => {
    const encoded = algosdk.encodeUnsignedTransaction(txn);
    return Buffer.from(encoded).toString('base64');
  });
  
  return { 
    transactions: txns, 
    txnBytesBase64: txnBytesArray,
    nftTxnIndex: 0,
    revTokenTxnIndex: 1
  };
}

/**
 * Create an unsigned transaction for minting an IP Ownership NFT (ASA)
 * @param {string} creatorAddress - The creator's wallet address
 * @param {object} params - NFT parameters
 * @returns {Promise<{txn: algosdk.Transaction, txnBytes: Uint8Array}>}
 */
export async function createIPNFTTransaction(creatorAddress, params) {
  const {
    name,
    unitName,
    metadataUrl,
    metadataHash
  } = params;
  
  const suggestedParams = await getTransactionParams();
  
  // Create ASA with supply=1, decimals=0 (unique NFT)
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: creatorAddress,
    total: 1n, // Use BigInt for algosdk v3
    decimals: 0,
    defaultFrozen: false,
    manager: creatorAddress,
    reserve: creatorAddress,
    freeze: undefined,
    clawback: undefined,
    unitName: unitName.substring(0, 8),
    assetName: name.substring(0, 32),
    assetURL: metadataUrl.substring(0, 96),
    assetMetadataHash: metadataHash ? new Uint8Array(Buffer.from(metadataHash, 'base64').slice(0, 32)) : undefined,
    suggestedParams
  });
  
  // Use encodeUnsignedTransaction for Pera Wallet compatibility (algosdk v3)
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  
  return { txn, txnBytes };
}

/**
 * Create an unsigned transaction for minting Revenue Tokens
 * @param {string} creatorAddress - The creator's wallet address
 * @param {object} params - Token parameters
 * @returns {Promise<{txn: algosdk.Transaction, txnBytes: Uint8Array}>}
 */
export async function createRevenueTokenTransaction(creatorAddress, params) {
  const {
    productName,
    productId,
    ipAssetId
  } = params;
  
  const suggestedParams = await getTransactionParams();
  
  // Create 100 tokens with 6 decimals for fractional ownership
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender: creatorAddress,
    total: 100000000n, // 100 tokens with 6 decimals (100 * 10^6) - BigInt
    decimals: 6,
    defaultFrozen: false,
    manager: creatorAddress,
    reserve: creatorAddress,
    freeze: undefined,
    clawback: undefined,
    unitName: `REV${productId.substring(0, 4).toUpperCase()}`,
    assetName: `${productName} Revenue`.substring(0, 32),
    assetURL: `ipfs://revenue-token/${productId}`,
    suggestedParams
  });
  
  // Use encodeUnsignedTransaction for Pera Wallet compatibility (algosdk v3)
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  
  return { txn, txnBytes };
}

/**
 * Create an opt-in transaction for an asset
 * @param {string} address - The address opting in
 * @param {number} assetId - The asset ID to opt into
 * @returns {Promise<{txn: algosdk.Transaction, txnBytes: Uint8Array}>}
 */
export async function createOptInTransaction(address, assetId) {
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0n,
    assetIndex: assetId,
    suggestedParams
  });
  
  // Use encodeUnsignedTransaction for Pera Wallet compatibility (algosdk v3)
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  
  return { txn, txnBytes };
}

/**
 * Create an asset transfer transaction
 * @param {string} senderAddress - Sender's address
 * @param {string} receiverAddress - Receiver's address
 * @param {number} assetId - The asset ID
 * @param {number} amount - Amount to transfer
 * @returns {Promise<{txn: algosdk.Transaction, txnBytes: Uint8Array}>}
 */
export async function createAssetTransferTransaction(senderAddress, receiverAddress, assetId, amount) {
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: senderAddress,
    receiver: receiverAddress,
    amount: BigInt(amount),
    assetIndex: assetId,
    suggestedParams
  });
  
  // Use encodeUnsignedTransaction for Pera Wallet compatibility (algosdk v3)
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  
  return { txn, txnBytes };
}

/**
 * Get asset information from the blockchain
 * @param {number} assetId - The asset ID
 * @returns {Promise<object>}
 */
export async function getAssetInfo(assetId) {
  const algodClient = getAlgodClient();
  try {
    const assetInfo = await algodClient.getAssetByID(assetId).do();
    return assetInfo;
  } catch (error) {
    console.error('Error fetching asset info:', error);
    throw error;
  }
}

/**
 * Get account's asset holdings
 * @param {string} address - The wallet address
 * @returns {Promise<Array>}
 */
export async function getAccountAssets(address) {
  const algodClient = getAlgodClient();
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    return accountInfo.assets || [];
  } catch (error) {
    console.error('Error fetching account assets:', error);
    throw error;
  }
}

/**
 * Check if an account has opted-in to an asset
 * @param {string} address - The wallet address
 * @param {number} assetId - The asset ID to check
 * @returns {Promise<boolean>}
 */
export async function hasOptedInToAsset(address, assetId) {
  try {
    const assets = await getAccountAssets(address);
    return assets.some(a => {
      const id = a['asset-id'] || a.assetId;
      return Number(id) === Number(assetId);
    });
  } catch (error) {
    console.error('Error checking opt-in status:', error);
    return false;
  }
}

/**
 * Get the MetaWork platform wallet address
 * @returns {string}
 */
export function getPlatformWallet() {
  return process.env.METAWORK_PLATFORM_WALLET || METAWORK_PLATFORM_WALLET;
}

/**
 * Create a transaction to transfer 20% of revenue tokens to the platform
 * @param {string} creatorAddress - The creator's wallet address
 * @param {number} revenueTokenAssetId - The revenue token asset ID
 * @returns {Promise<{txn: algosdk.Transaction, txnBytesBase64: string, platformWallet: string}>}
 */
export async function createPlatformTokenTransferTransaction(creatorAddress, revenueTokenAssetId) {
  const platformWallet = getPlatformWallet();
  const suggestedParams = await getTransactionParams();
  
  // Transfer 20 tokens (20% of 100 tokens)
  // With 6 decimals: 20 * 10^6 = 20,000,000
  const transferAmount = 20000000n;
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: creatorAddress,
    receiver: platformWallet,
    amount: transferAmount,
    assetIndex: revenueTokenAssetId,
    suggestedParams
  });
  
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  const txnBytesBase64 = Buffer.from(txnBytes).toString('base64');
  
  return { 
    txn, 
    txnBytesBase64,
    platformWallet,
    amount: 20 // Human readable amount
  };
}

/**
 * Create a clawback transaction to transfer tokens (requires clawback authority)
 * Used as fallback if normal transfer fails
 * @param {string} clawbackAddress - The address with clawback authority
 * @param {string} fromAddress - The address to clawback from
 * @param {string} toAddress - The address to send to
 * @param {number} assetId - The asset ID
 * @param {number} amount - Amount to transfer (with decimals)
 * @returns {Promise<{txn: algosdk.Transaction, txnBytesBase64: string}>}
 */
export async function createClawbackTransaction(clawbackAddress, fromAddress, toAddress, assetId, amount) {
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: clawbackAddress, // Clawback authority signs
    assetSender: fromAddress, // Tokens come from this account
    receiver: toAddress,
    amount: BigInt(amount),
    assetIndex: assetId,
    suggestedParams
  });
  
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  const txnBytesBase64 = Buffer.from(txnBytes).toString('base64');
  
  return { txn, txnBytesBase64 };
}
