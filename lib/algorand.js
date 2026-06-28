import algosdk from 'algosdk';

const TESTNET_INDEXER_TOKEN = 'a'.repeat(64);
const TESTNET_INDEXER_SERVER = process.env.ALGORAND_TESTNET_INDEXER || 'https://testnet-idx.algonode.cloud';
const TESTNET_INDEXER_PORT = 443;

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

/**
 * Returns a network-aware Algod client.
 * Uses ALGORAND_NETWORK env var to select testnet vs mainnet.
 * Falls back to the existing testnet config already in this file.
 */
export function getAlgodClient(network) {
  const net = network || process.env.ALGORAND_NETWORK || process.env.NEXT_PUBLIC_ALGORAND_NETWORK || 'testnet';

  if (net === 'mainnet') {
    const mainnetToken = process.env.ALGOD_X_API_KEY || '';
    const mainnetServer = process.env.ALGORAND_MAINNET_RPC || 'https://mainnet-api.algonode.cloud';
    return new algosdk.Algodv2(
      { 'X-API-Key': mainnetToken },
      mainnetServer,
      443
    );
  }

  const testnetToken = process.env.ALGOD_X_API_KEY
    ? { 'X-API-Key': process.env.ALGOD_X_API_KEY }
    : 'a'.repeat(64);
  const testnetServer = process.env.ALGORAND_TESTNET_RPC || 'https://testnet-api.algonode.cloud';
  return new algosdk.Algodv2(testnetToken, testnetServer, 443);
}

/**
 * Returns the USDC asset ID for the given network.
 * Testnet: 10458941  |  Mainnet: 31566704
 */
export function getUsdcAssetId(network) {
  const net = network || process.env.ALGORAND_NETWORK || 'testnet';
  if (process.env.USDC_ASSET_ID) return parseInt(process.env.USDC_ASSET_ID, 10);
  return net === 'mainnet' ? 31566704 : 10458941;
}

/**
 * Signer abstraction using METAWORK_PLATFORM_MNEMONIC.
 * Today: single admin wallet.
 * Future: replace body with multisig — no callers change.
 */
export function getSigner() {
  const mn = process.env.METAWORK_PLATFORM_MNEMONIC;
  if (!mn) throw new Error('METAWORK_PLATFORM_MNEMONIC is not set');
  const account = algosdk.mnemonicToSecretKey(mn);
  return {
    address: account.addr.toString(),
    signTxn:  (txn)  => txn.signTxn(account.sk),
    signTxns: (txns) => txns.map(t => t.signTxn(account.sk)),
  };
}