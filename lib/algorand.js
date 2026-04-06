import algosdk from 'algosdk';

const TESTNET_ALGOD_TOKEN = 'a'.repeat(64);
const TESTNET_ALGOD_SERVER = process.env.ALGORAND_TESTNET_RPC || 'https://testnet-api.algonode.cloud';
const TESTNET_ALGOD_PORT = 443;

const TESTNET_INDEXER_TOKEN = 'a'.repeat(64);
const TESTNET_INDEXER_SERVER = process.env.ALGORAND_TESTNET_INDEXER || 'https://testnet-idx.algonode.cloud';
const TESTNET_INDEXER_PORT = 443;

export function getAlgodClient() {
  return new algosdk.Algodv2(TESTNET_ALGOD_TOKEN, TESTNET_ALGOD_SERVER, TESTNET_ALGOD_PORT);
}

export function getIndexerClient() {
  return new algosdk.Indexer(TESTNET_INDEXER_TOKEN, TESTNET_INDEXER_SERVER, TESTNET_INDEXER_PORT);
}

export async function getAccountInformation(address) {
  const algodClient = getAlgodClient();
  try {
    return await algodClient.accountInformation(address).do();
  } catch (error) {
    console.error('Error fetching account information:', error);
    throw error;
  }
}

export async function getTransactionParams() {
  const algodClient = getAlgodClient();
  return await algodClient.getTransactionParams().do();
}

export async function submitTransaction(signedTxn) {
  const algodClient = getAlgodClient();
  const { txid } = await algodClient.sendRawTransaction(signedTxn).do();
  return txid;
}

export async function waitForConfirmation(txid, maxRounds = 4) {
  const algodClient = getAlgodClient();
  return await algosdk.waitForConfirmation(algodClient, txid, maxRounds);
}

/**
 * Get asset ID from a transaction using the indexer
 * More reliable than pending transaction info for asset creation
 */
export async function getAssetIdFromTransaction(txId, maxRetries = 10, delayMs = 2000) {
  const indexer = getIndexerClient();
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const txnInfo = await indexer.lookupTransactionByID(txId).do();
      
      if (txnInfo && txnInfo.transaction) {
        // For asset creation, the asset ID is in the transaction result
        const assetId = txnInfo.transaction['created-asset-index'] || 
                        txnInfo.transaction.createdAssetIndex ||
                        txnInfo.transaction['asset-config-transaction']?.['created-asset-index'];
        
        if (assetId) {
          // Convert BigInt to Number if necessary
          return typeof assetId === 'bigint' ? Number(assetId) : assetId;
        }
      }
    } catch (err) {
      // Indexer might not have the transaction yet
      console.log(`Indexer lookup attempt ${i + 1}/${maxRetries}:`, err.message);
    }
    
    // Wait before retrying
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return null;
}

export function isValidAddress(address) {
  return algosdk.isValidAddress(address);
}

export function decodeAddress(address) {
  return algosdk.decodeAddress(address);
}

export function formatAlgoAmount(microAlgos) {
  return (microAlgos / 1000000).toFixed(6);
}

// Add this to the bottom of lib/algorand.js
export async function distributeRoyalties(orderData) {
  console.log("Stripe payment confirmed. Triggering Algorand distribution for:", orderData);
  // Future logic: convert USD to Crypto and send to creators
  return { success: true };
}