// lib/tokenized-funds/galaxy-quality/liquidity.js

import 'server-only';

import { unstable_cache } from 'next/cache';
import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  parseAbi,
} from 'viem';
import { base } from 'viem/chains';

const VAULT = '0x1e9e47583f15D45a10Df48c0b1846E0492c795D7';
const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ADAPTER = '0xA655F18850F63cc5087E83b2F55C5D1Ba1a9324c';
const MORPHO = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';

const vaultAbi = parseAbi([
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function adaptersLength() view returns (uint256)',
  'function adapters(uint256 index) view returns (address)',
]);

const adapterAbi = parseAbi([
  'function parentVault() view returns (address)',
  'function morpho() view returns (address)',
  'function marketIdsLength() view returns (uint256)',
  'function marketIds(uint256 index) view returns (bytes32)',
  'function expectedSupplyAssets(bytes32 marketId) view returns (uint256)',
]);

const morphoAbi = parseAbi([
  'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)',
  'function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)',
]);

const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const min = (a, b) => a < b ? a : b;

async function readAggregateLiquidity() {
  const client = createPublicClient({
    chain: base,
    transport: http(
      process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      { timeout: 10_000, retryCount: 1 },
    ),
  });

  if (await client.getChainId() !== 8453) {
    throw new Error('Liquidity RPC is not Base mainnet.');
  }

  const blockNumber = await client.getBlockNumber();

  const read = (address, abi, functionName, args = []) =>
    client.readContract({
      address,
      abi,
      functionName,
      args,
      blockNumber,
    });

  const [asset, totalAssets, adapterCount] = await Promise.all([
    read(VAULT, vaultAbi, 'asset'),
    read(VAULT, vaultAbi, 'totalAssets'),
    read(VAULT, vaultAbi, 'adaptersLength'),
  ]);

  if (!same(asset, ASSET) || adapterCount !== 1n) {
    throw new Error('Vault asset or adapter configuration changed.');
  }

  const adapter = await read(VAULT, vaultAbi, 'adapters', [0n]);

  if (!same(adapter, ADAPTER)) {
    throw new Error('Unknown adapter; aggregate calculation requires review.');
  }

  const [parentVault, morpho, count, idle, morphoBalance] =
    await Promise.all([
      read(adapter, adapterAbi, 'parentVault'),
      read(adapter, adapterAbi, 'morpho'),
      read(adapter, adapterAbi, 'marketIdsLength'),
      read(asset, erc20Abi, 'balanceOf', [VAULT]),
      read(asset, erc20Abi, 'balanceOf', [MORPHO]),
    ]);

  if (!same(parentVault, VAULT) || !same(morpho, MORPHO)) {
    throw new Error('Adapter provenance mismatch.');
  }

  if (count > 100n) {
    throw new Error('Unexpected market count.');
  }

  const seen = new Set();
  let marketLiquidity = 0n;

  for (let index = 0n; index < count; index++) {
    const id = await read(
      adapter,
      adapterAbi,
      'marketIds',
      [index],
    );

    if (seen.has(id.toLowerCase())) {
      throw new Error('Duplicate market ID.');
    }

    seen.add(id.toLowerCase());

    const [position, state, params] = await Promise.all([
      read(adapter, adapterAbi, 'expectedSupplyAssets', [id]),
      read(morpho, morphoAbi, 'market', [id]),
      read(morpho, morphoAbi, 'idToMarketParams', [id]),
    ]);

    if (!same(params[0], ASSET)) {
      throw new Error('Unexpected market loan asset.');
    }

    const free =
      state[0] > state[2] ? state[0] - state[2] : 0n;

    marketLiquidity += min(position, free);
  }

  const aggregate = min(
    totalAssets,
    idle + min(marketLiquidity, morphoBalance),
  );

  return {
    blockNumber: blockNumber.toString(),
    totalAssets: formatUnits(totalAssets, 6),
    aggregateLiquidity: formatUnits(aggregate, 6),
  };
}

const cachedLiquidity = unstable_cache(
  readAggregateLiquidity,
  ['galaxy-quality-base-aggregate-liquidity-v1'],
  { revalidate: 60 },
);

export async function getQualityAggregateLiquidity() {
  try {
    return await cachedLiquidity();
  } catch (error) {
    console.error(
      '[quality-aggregate-liquidity]',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return null;
  }
}