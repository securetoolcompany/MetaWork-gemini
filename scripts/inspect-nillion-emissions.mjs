// scripts/inspect-nillion-emissions.mjs

import dotenv from 'dotenv';
import {
  createPublicClient,
  getAddress,
  http,
} from 'viem';
import { mainnet } from 'viem/chains';

dotenv.config({ path: '.env.local', quiet: true });

const EMISSIONS_ADDRESS =
  '0xeff51614B2ccB89264e75a1303A17878cEA59C62';

const IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

const EXPLORER_API =
  'https://eth.blockscout.com/api/v2/smart-contracts';

const client = createPublicClient({
  chain: mainnet,
  transport: http(
    process.env.NILLION_ETHEREUM_RPC_URL?.trim() ||
      'https://ethereum-rpc.publicnode.com',
    {
      timeout: 20_000,
      retryCount: 2,
    },
  ),
});

async function fetchContract(address) {
  const response = await fetch(`${EXPLORER_API}/${address}`, {
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `Contract lookup failed for ${address}: HTTP ${response.status}`,
    );
  }

  return response.json();
}

function readAbi(contract) {
  if (Array.isArray(contract.abi)) {
    return contract.abi;
  }

  if (typeof contract.abi === 'string') {
    const parsed = JSON.parse(contract.abi);

    if (Array.isArray(parsed)) {
      return parsed;
    }
  }

  throw new Error('The explorer did not return a usable implementation ABI.');
}

async function main() {
  const block = await client.getBlock({
    blockTag: 'latest',
  });

  if (block.number === null) {
    throw new Error('Unable to determine the Ethereum block number.');
  }

  const storage = await client.getStorageAt({
    address: EMISSIONS_ADDRESS,
    slot: IMPLEMENTATION_SLOT,
    blockNumber: block.number,
  });

  if (!storage || !/^0x[0-9a-fA-F]{64}$/.test(storage)) {
    throw new Error('The implementation storage slot could not be read.');
  }

  const implementation = getAddress(`0x${storage.slice(-40)}`);

  if (implementation === '0x0000000000000000000000000000000000000000') {
    throw new Error(
      'The ERC-1967 implementation slot is empty. Further proxy inspection is required.',
    );
  }

  console.log(`Proxy: ${EMISSIONS_ADDRESS}`);
  console.log(`Implementation: ${implementation}`);
  console.log(`Snapshot block: ${block.number.toString()}`);

  const contract = await fetchContract(implementation);
  const abi = readAbi(contract);

  const events = abi.filter((entry) => entry.type === 'event');

  if (events.length === 0) {
    throw new Error('The implementation ABI contains no events.');
  }

  console.log(
    JSON.stringify(
      {
        implementation,
        name: contract.name ?? null,
        verified: contract.is_verified ?? null,

        events,

        relevantFunctions: abi.filter(
          (entry) =>
            entry.type === 'function' &&
            /enroll|join|start|initial|claim/i.test(entry.name ?? ''),
        ),
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