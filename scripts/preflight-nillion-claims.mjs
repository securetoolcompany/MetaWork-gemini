// scripts/preflight-nillion-claims.mjs

import dotenv from 'dotenv';

import {
  createPublicClient,
  formatEther,
  http,
  parseAbi,
} from 'viem';

import { mainnet } from 'viem/chains';

dotenv.config({ path: '.env.local', quiet: true });

const VERIFIED_IMPLEMENTATION =
  '0xd9D71B6c4b7C2c03EB7F1DbB3d509f54483E5F7C';

const IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

const stakingAbi = parseAbi([
  'function ownerOf(uint256 nodeId) view returns (address)',
]);

const emissionsAbi = parseAbi([
  'function claim(uint256 nodeId)',
]);

function safeError(error) {
  const message =
    error?.shortMessage ||
    'RPC request failed. Check the provider locally; endpoint details omitted.';

  return String(message).replace(/https?:\/\/[^\s]+/g, '[REDACTED RPC URL]');
}

async function main() {
  const {
    NILLION_CONTRACTS,
    NILLION_EXPECTED_OWNER,
    NILLION_NODES,
    NILLION_RPC_URL,
  } = await import('../lib/tokenized-funds/nillion/config.js');

  const client = createPublicClient({
    chain: mainnet,
    transport: http(NILLION_RPC_URL, {
      timeout: 30_000,
      retryCount: 2,
    }),
  });

  if ((await client.getChainId()) !== 1) {
    throw new Error('RPC is not Ethereum mainnet.');
  }

  const snapshot = await client.getBlock({
    blockTag: 'latest',
  });

  if (snapshot.number === null || !snapshot.hash) {
    throw new Error('Unable to obtain the Ethereum snapshot.');
  }

  const storage = await client.getStorageAt({
    address: NILLION_CONTRACTS.emissions,
    slot: IMPLEMENTATION_SLOT,
    blockNumber: snapshot.number,
  });

  if (!storage || !/^0x[0-9a-fA-F]{64}$/.test(storage)) {
    throw new Error('Unable to read the emissions implementation slot.');
  }

  const implementation = `0x${storage.slice(-40)}`;

  if (
    implementation.toLowerCase() !==
    VERIFIED_IMPLEMENTATION.toLowerCase()
  ) {
    throw new Error(
      'Emissions implementation changed. Inspect its ABI before proceeding.',
    );
  }

  const account = NILLION_EXPECTED_OWNER;

  const [balance, gasPrice] = await Promise.all([
    client.getBalance({
      address: account,
      blockNumber: snapshot.number,
    }),
    client.getGasPrice(),
  ]);

  const results = [];

  for (const node of NILLION_NODES) {
    const args = [BigInt(node.id)];

    const owner = await client.readContract({
      address: NILLION_CONTRACTS.staking,
      abi: stakingAbi,
      functionName: 'ownerOf',
      args,
      blockNumber: snapshot.number,
    });

    if (owner.toLowerCase() !== account.toLowerCase()) {
      throw new Error(`Node #${node.id}: unexpected owner.`);
    }

    console.log(`Node #${node.id}: checking claim simulation...`);

    await client.simulateContract({
      address: NILLION_CONTRACTS.emissions,
      abi: emissionsAbi,
      functionName: 'claim',
      args,
      account,
      blockNumber: snapshot.number,
    });

    // Gas estimation uses the provider's current state, independently
    // from the block-pinned simulation above.
    const estimatedGas = await client.estimateContractGas({
      address: NILLION_CONTRACTS.emissions,
      abi: emissionsAbi,
      functionName: 'claim',
      args,
      account,
    });

    const illustrativeCost = estimatedGas * gasPrice;

    results.push({
      nodeId: String(node.id),
      nodeOwner: owner,
      simulatedCaller: account,
      simulation: 'passed',
      simulationBlockNumber: snapshot.number.toString(),
      estimatedGas: estimatedGas.toString(),
      illustrativeGasCostWei: illustrativeCost.toString(),
      illustrativeGasCostEth: formatEther(illustrativeCost),
      claimedAmount: null,
    });
  }

  const snapshotCheck = await client.getBlock({
    blockNumber: snapshot.number,
  });

  if (snapshotCheck.hash !== snapshot.hash) {
    throw new Error('Snapshot changed. Rerun the preflight.');
  }

  const totalCost = results.reduce(
    (sum, result) => sum + BigInt(result.illustrativeGasCostWei),
    0n,
  );

  console.log(
    JSON.stringify(
      {
        mode: 'read_only_preflight',
        chainId: 1,
        emissionsProxy: NILLION_CONTRACTS.emissions,
        implementation,
        snapshotBlock: snapshot.number.toString(),
        snapshotBlockHash: snapshot.hash,
        assumedGasPayer: account,
        gasPayerBalanceEth: formatEther(balance),
        gasPriceWei: gasPrice.toString(),
        illustrativeCombinedGasCostEth: formatEther(totalCost),
        balanceCoversIllustrativeCost: balance >= totalCost,
        results,
        notices: [
          'No transactions were signed or submitted.',
          'No NIL was claimed or distributed.',
          'Simulation success does not prove a positive NIL payment.',
          'claim has no return value; claimed amounts are not measured here.',
          'Gas estimates are independent current-state estimates.',
          'Gas costs can change and do not include a safety buffer.',
          'ABI verification alone does not prove reward recipient semantics.',
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});