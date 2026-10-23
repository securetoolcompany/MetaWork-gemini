// scripts/find-nillion-node-starts.mjs

import dotenv from 'dotenv';
import {
  createPublicClient,
  http,
  parseAbiItem,
} from 'viem';
import { mainnet } from 'viem/chains';

dotenv.config({ path: '.env.local', quiet: true });

const EMISSIONS_ADDRESS =
  '0xeff51614B2ccB89264e75a1303A17878cEA59C62';

const NODE_IDS = [19n, 20n];

const enrolledEvent = parseAbiItem(
  'event Enrolled(uint256 indexed nodeId, uint256 stake)',
);

const client = createPublicClient({
  chain: mainnet,
  transport: http(
    process.env.NILLION_ETHEREUM_RPC_URL?.trim() ||
      'https://ethereum-rpc.publicnode.com',
    {
      timeout: 30_000,
      retryCount: 2,
    },
  ),
});

async function getDeploymentBlock() {
  async function explorerGet(endpoint) {
    const response = await fetch(
      `https://eth.blockscout.com/api/v2/${endpoint}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Explorer lookup failed for ${endpoint}: HTTP ${response.status}`,
      );
    }

    return response.json();
  }

  const address = await explorerGet(
    `addresses/${EMISSIONS_ADDRESS}`,
  );

  const transactionHash = address.creation_transaction_hash;

  if (
    typeof transactionHash !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)
  ) {
    throw new Error(
      'Explorer did not return a valid proxy creation transaction.',
    );
  }

  const transaction = await explorerGet(
    `transactions/${transactionHash}`,
  );

  if (
    typeof transaction.hash !== 'string' ||
    transaction.hash.toLowerCase() !== transactionHash.toLowerCase()
  ) {
    throw new Error('Explorer transaction hash does not match the lookup.');
  }

  const blockValue = transaction.block_number;

  if (
    !(
      (typeof blockValue === 'number' &&
        Number.isSafeInteger(blockValue) &&
        blockValue >= 0) ||
      (typeof blockValue === 'string' && /^\d+$/.test(blockValue))
    )
  ) {
    throw new Error(
      'Explorer did not return a confirmed creation block number.',
    );
  }

  const blockNumber = BigInt(blockValue);

  const explorerBlock = await explorerGet(
    `blocks/${blockNumber.toString()}`,
  );

  if (
    typeof explorerBlock.hash !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(explorerBlock.hash)
  ) {
    throw new Error('Explorer did not return a valid creation block hash.');
  }

  const rpcBlock = await client.getBlock({
    blockNumber,
  });

  if (
    !rpcBlock.hash ||
    rpcBlock.hash.toLowerCase() !== explorerBlock.hash.toLowerCase()
  ) {
    throw new Error(
      'Explorer and RPC disagree on the creation block. Stopping before the history scan.',
    );
  }

  return {
    blockNumber,
    transactionHash,
  };
}

async function main() {
  const deployment = await getDeploymentBlock();
  const latestBlock = await client.getBlockNumber();

  console.log(`Proxy deployment block: ${deployment.blockNumber}`);
  console.log(`Scanning through block: ${latestBlock}`);

  const firstEnrollments = new Map();

  let fromBlock = deployment.blockNumber;
  let chunkSize = 10_000n;

  while (
    fromBlock <= latestBlock &&
    firstEnrollments.size < NODE_IDS.length
  ) {
    const proposedEnd = fromBlock + chunkSize - 1n;
    const toBlock =
      proposedEnd < latestBlock ? proposedEnd : latestBlock;

    let logs;

    try {
      logs = await client.getLogs({
        address: EMISSIONS_ADDRESS,
        event: enrolledEvent,
        args: {
          nodeId: NODE_IDS,
        },
        fromBlock,
        toBlock,
        strict: true,
      });
    } catch (error) {
      if (chunkSize > 1n) {
        chunkSize =
          chunkSize / 2n > 0n ? chunkSize / 2n : 1n;

        console.warn(
          `Log request failed; retrying with ${chunkSize} block(s) per request.`,
        );

        continue;
      }

      throw error;
    }

    logs.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber < b.blockNumber ? -1 : 1;
      }

      return a.logIndex - b.logIndex;
    });

    for (const log of logs) {
      const nodeId = log.args.nodeId.toString();

      if (!firstEnrollments.has(nodeId)) {
        firstEnrollments.set(nodeId, log);
        console.log(
          `Found node #${nodeId}: block ${log.blockNumber}`,
        );
      }
    }

    console.log(`Scanned ${fromBlock}–${toBlock}`);
    fromBlock = toBlock + 1n;
  }

  const nodes = [];

  for (const id of NODE_IDS) {
    const nodeId = id.toString();
    const log = firstEnrollments.get(nodeId);

    if (!log) {
      nodes.push({
        nodeId,
        found: false,
        reason: 'No Enrolled event found in the scanned proxy history.',
      });

      continue;
    }

    const block = await client.getBlock({
      blockNumber: log.blockNumber,
    });

    if (block.hash !== log.blockHash) {
      throw new Error(
        `Block changed while reading node #${nodeId}. Rerun the inspection.`,
      );
    }

    nodes.push({
      nodeId,
      found: true,
      startSource: 'first_enrolled_event',
      startBlock: log.blockNumber.toString(),
      startTimestamp: block.timestamp.toString(),
      startTimeUtc: new Date(
        Number(block.timestamp) * 1000,
      ).toISOString(),
      initialEnrolledStakeBaseUnits: log.args.stake.toString(),
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    });
  }

  console.log(
    JSON.stringify(
      {
        proxy: EMISSIONS_ADDRESS,
        proxyDeploymentBlock: deployment.blockNumber.toString(),
        proxyCreationTransaction: deployment.transactionHash,
        scannedThroughBlock: (fromBlock - 1n).toString(),
        nodes,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});