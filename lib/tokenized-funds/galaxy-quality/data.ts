// lib/tokenized-funds/galaxy-quality/data.ts

import 'server-only';

import { GALAXY_QUALITY } from './config';
import { getQualityAggregateLiquidity } from './liquidity';
export type QualityMetrics = {
  totalAssetsUsd: number | null;
  liquidityUsd: number | null;
  underlyingNetApy: number | null;
  underlyingPerformanceFee: number | null;
  underlyingManagementFee: number | null;
  fetchedAt: string;
};

type ApiVault = {
  address: string;
  name: string;
  totalAssetsUsd: number | null;
  liquidityUsd: number | null;
  avgNetApyExcludingRewards: number | null;
  performanceFee: number | null;
  managementFee: number | null;
};

type GraphqlResponse = {
  data?: {
    vaultV2ByAddress?: ApiVault | null;
  };
  errors?: Array<{ message: string }>;
};

const query = `
  query GalaxyQualityMetrics($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      name
      totalAssetsUsd
      liquidityUsd
      avgNetApyExcludingRewards
      performanceFee
      managementFee
    }
  }
`;

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null;
}

export async function getQualityMetrics(): Promise<QualityMetrics | null> {
  try {
    const response = await fetch('https://api.morpho.org/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          address: GALAXY_QUALITY.underlyingVault,
          chainId: GALAXY_QUALITY.chainId,
        },
      }),
      next: {
        revalidate: 60,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Vault API returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as GraphqlResponse;

    if (payload.errors?.length) {
      throw new Error(
        payload.errors.map((error) => error.message).join('; '),
      );
    }

    const vault = payload.data?.vaultV2ByAddress;

    if (!vault) {
      throw new Error('Base Quality vault was not found in the V2 API');
    }

    if (
      typeof vault.address !== 'string' ||
      vault.address.toLowerCase() !==
        GALAXY_QUALITY.underlyingVault.toLowerCase()
    ) {
      throw new Error('Base Quality vault address mismatch');
    }

    const aggregate = await getQualityAggregateLiquidity();

    const totalAssetsUsd = finiteNumber(vault.totalAssetsUsd);

    const onchainTotalAssets = aggregate
    ? Number(aggregate.totalAssets)
    : null;

    const onchainLiquidity = aggregate
    ? Number(aggregate.aggregateLiquidity)
    : null;

    // Use the API's implied asset valuation rather than assuming USDC = $1.
    const aggregateLiquidityUsd =
    totalAssetsUsd != null &&
    onchainTotalAssets != null &&
    Number.isFinite(onchainTotalAssets) &&
    onchainTotalAssets > 0 &&
    onchainLiquidity != null &&
    Number.isFinite(onchainLiquidity)
        ? totalAssetsUsd * Math.min(
            1,
            Math.max(0, onchainLiquidity / onchainTotalAssets),
        )
        : null;

    return {
      totalAssetsUsd,
    	liquidityUsd: aggregateLiquidityUsd,
      underlyingNetApy: finiteNumber(vault.avgNetApyExcludingRewards),
      underlyingPerformanceFee: finiteNumber(vault.performanceFee),
      underlyingManagementFee: finiteNumber(vault.managementFee),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      '[galaxy-quality-metrics]',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return null;
  }
}