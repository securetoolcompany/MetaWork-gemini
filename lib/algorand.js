import algosdk from 'algosdk';

const DEFAULT_TESTNET_ALGOD_RPC = 'https://testnet-api.algonode.cloud';
const DEFAULT_TESTNET_INDEXER_RPC = 'https://testnet-idx.algonode.cloud';
const DEFAULT_TESTNET_TOKEN = 'a'.repeat(64);

const NETWORKS = {
  testnet: {
    genesisId: 'testnet-v1.0',
    usdcAssetId: 10458941,
  },
  mainnet: {
    genesisId: 'mainnet-v1.0',
    usdcAssetId: 31566704,
  },
};

function normalizeNetwork(network) {
  const value = String(
    network || process.env.ALGORAND_NETWORK || 'mainnet'
  )
    .trim()
    .toLowerCase();

  if (!Object.hasOwn(NETWORKS, value)) {
    throw new Error(
      `Unsupported ALGORAND_NETWORK "${value}". Use "testnet" or "mainnet".`
    );
  }

  return value;
}

function getEnvironmentValue(name) {
  const value = process.env[name];

  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function getTokenHeader(token, headerName) {
  if (!token) {
    return '';
  }

  return {
    [headerName || 'X-API-Key']: token,
  };
}

function getNetworkConfig(network) {
  const net = normalizeNetwork(network);

  if (net === 'mainnet') {
    const algodServer = getEnvironmentValue('ALGORAND_MAINNET_RPC');

    if (!algodServer) {
      throw new Error(
        'ALGORAND_MAINNET_RPC is required for mainnet. ' +
        'Refusing to use a public fallback endpoint.'
      );
    }

    const indexerServer = getEnvironmentValue(
      'ALGORAND_MAINNET_INDEXER'
    );

    return {
      network: net,
      genesisId: NETWORKS[net].genesisId,
      algodServer,
      algodPort: Number(getEnvironmentValue('ALGORAND_MAINNET_ALGOD_PORT') || 443),
      algodToken: getEnvironmentValue('ALGORAND_MAINNET_ALGOD_TOKEN'),
      algodTokenHeader:
        getEnvironmentValue('ALGORAND_MAINNET_ALGOD_TOKEN_HEADER') ||
        'X-Algo-API-Token',
      indexerServer,
      indexerPort: Number(
        getEnvironmentValue('ALGORAND_MAINNET_INDEXER_PORT') || 443
      ),
      indexerToken: getEnvironmentValue('ALGORAND_MAINNET_INDEXER_TOKEN'),
      indexerTokenHeader:
        getEnvironmentValue('ALGORAND_MAINNET_INDEXER_TOKEN_HEADER') ||
        'X-Algo-API-Token',
    };
  }

  return {
    network: net,
    genesisId: NETWORKS[net].genesisId,
    algodServer:
      getEnvironmentValue('ALGORAND_TESTNET_RPC') ||
      DEFAULT_TESTNET_ALGOD_RPC,
    algodPort: Number(
      getEnvironmentValue('ALGORAND_TESTNET_ALGOD_PORT') || 443
    ),
    algodToken:
      getEnvironmentValue('ALGORAND_TESTNET_ALGOD_TOKEN') ||
      getEnvironmentValue('ALGOD_X_API_KEY') ||
      DEFAULT_TESTNET_TOKEN,
    algodTokenHeader:
      getEnvironmentValue('ALGORAND_TESTNET_ALGOD_TOKEN_HEADER') ||
      (getEnvironmentValue('ALGOD_X_API_KEY')
        ? 'X-API-Key'
        : 'X-Algo-API-Token'),
    indexerServer:
      getEnvironmentValue('ALGORAND_TESTNET_INDEXER') ||
      DEFAULT_TESTNET_INDEXER_RPC,
    indexerPort: Number(
      getEnvironmentValue('ALGORAND_TESTNET_INDEXER_PORT') || 443
    ),
    indexerToken:
      getEnvironmentValue('ALGORAND_TESTNET_INDEXER_TOKEN') ||
      DEFAULT_TESTNET_TOKEN,
    indexerTokenHeader:
      getEnvironmentValue('ALGORAND_TESTNET_INDEXER_TOKEN_HEADER') ||
      'X-Algo-API-Token',
  };
}

/**
 * Returns a network-aware Algod client.
 *
 * TestNet: Tatum endpoint/config, with Algonode as a development fallback.
 * MainNet: your explicitly configured self-operated Algod node only.
 */
export function getAlgodClient(network) {
  const config = getNetworkConfig(network);

  return new algosdk.Algodv2(
    getTokenHeader(config.algodToken, config.algodTokenHeader),
    config.algodServer,
    config.algodPort
  );
}

/**
 * Returns a network-aware Indexer client.
 *
 * MainNet recipient snapshots require an Indexer. Configure your own
 * ALGORAND_MAINNET_INDEXER or this function refuses to run on MainNet.
 */
export function getIndexerClient(network) {
  const config = getNetworkConfig(network);

  if (!config.indexerServer) {
    throw new Error(
      'ALGORAND_MAINNET_INDEXER is required for mainnet revenue-holder ' +
      'snapshots and indexer lookups. Configure your self-operated Indexer.'
    );
  }

  return new algosdk.Indexer(
    getTokenHeader(config.indexerToken, config.indexerTokenHeader),
    config.indexerServer,
    config.indexerPort
  );
}

/**
 * Verifies that the selected Algod endpoint serves the expected network.
 * Call this before any production admin action that signs or submits a group.
 */
export async function assertAlgodNetwork(network) {
  const config = getNetworkConfig(network);
  const algodClient = getAlgodClient(config.network);
  const params = await algodClient.getTransactionParams().do();

  if (params.genesisID !== config.genesisId) {
    throw new Error(
      `Algod network mismatch: configured ${config.network}, expected ` +
      `${config.genesisId}, received ${params.genesisID || 'unknown'}.`
    );
  }

  return {
    network: config.network,
    genesisId: params.genesisID,
    lastRound: Number(params.firstRound),
  };
}

export async function getAccountInformation(address, network) {
  const algodClient = getAlgodClient(network);

  try {
    return await algodClient.accountInformation(address).do();
  } catch (error) {
    console.error('Error fetching account information:', error);
    throw error;
  }
}

export async function getTransactionParams(network) {
  return getAlgodClient(network).getTransactionParams().do();
}

export async function submitTransaction(signedTxn, network) {
  const { txid } = await getAlgodClient(network)
    .sendRawTransaction(signedTxn)
    .do();

  return txid;
}

export async function waitForConfirmation(txid, maxRounds = 4, network) {
  return algosdk.waitForConfirmation(
    getAlgodClient(network),
    txid,
    maxRounds
  );
}

/**
 * Gets an ASA ID from its confirmed asset-creation transaction.
 * The optional network argument is important for MainNet operations.
 */
export async function getAssetIdFromTransaction(
  txId,
  maxRetries = 10,
  delayMs = 2000,
  network
) {
  const indexer = getIndexerClient(network);

  for (let i = 0; i < maxRetries; i += 1) {
    try {
      const txnInfo = await indexer.lookupTransactionByID(txId).do();
      const transaction = txnInfo?.transaction;

      if (transaction) {
        const assetId =
          transaction['created-asset-index'] ||
          transaction.createdAssetIndex ||
          transaction['asset-config-transaction']?.['created-asset-index'];

        if (assetId) {
          return typeof assetId === 'bigint'
            ? Number(assetId)
            : Number(assetId);
        }
      }
    } catch (error) {
      console.log(
        `Indexer lookup attempt ${i + 1}/${maxRetries}:`,
        error instanceof Error ? error.message : error
      );
    }

    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

export function getUsdcAssetId(network) {
  const net = normalizeNetwork(network);
  const overrideName =
    net === 'mainnet'
      ? 'ALGORAND_MAINNET_USDC_ASSET_ID'
      : 'ALGORAND_TESTNET_USDC_ASSET_ID';

  const override = getEnvironmentValue(overrideName);

  if (override) {
    const assetId = Number(override);

    if (!Number.isSafeInteger(assetId) || assetId <= 0) {
      throw new Error(`${overrideName} must be a positive integer.`);
    }

    return assetId;
  }

  return NETWORKS[net].usdcAssetId;
}

export function isValidAddress(address) {
  return algosdk.isValidAddress(address);
}

export function decodeAddress(address) {
  return algosdk.decodeAddress(address);
}

export function formatAlgoAmount(microAlgos) {
  return (Number(microAlgos) / 1_000_000).toFixed(6);
}

export async function distributeRoyalties(orderData) {
  console.log(
    'Stripe payment confirmed. Triggering Algorand distribution for:',
    orderData
  );

  return { success: true };
}

/**
 * Server-only signer abstraction.
 * Never import this from a client component or expose its mnemonic via
 * NEXT_PUBLIC_* environment variables.
 */
export function getSigner() {
  const mnemonic = getEnvironmentValue('METAWORK_PLATFORM_MNEMONIC');

  if (!mnemonic) {
    throw new Error('METAWORK_PLATFORM_MNEMONIC is not set.');
  }

  const account = algosdk.mnemonicToSecretKey(mnemonic);

  return {
    address: account.addr.toString(),
    signTxn: (transaction) => transaction.signTxn(account.sk),
    signTxns: (transactions) =>
      transactions.map((transaction) => transaction.signTxn(account.sk)),
  };
}