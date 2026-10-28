// lib/tokenized-funds/galaxy/data.ts

import 'server-only';
import { GALAXY_USDC } from './config';

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
    vaultV2ByAddress: ApiVault | null;
  };
  errors?: Array<{
    message: string;
  }>;
};

export type GalaxyMetrics = {
  totalAssetsUsd: number | null;
  liquidityUsd: number | null;
  underlyingNetApy: number | null;
  underlyingPerformanceFee: number | null;
  underlyingManagementFee: number | null;
  fetchedAt: string;
};

const query = `
  query GalaxyMetrics($address: String!, $chainId: Int!) {
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
}

export async function getGalaxyMetrics(): Promise<GalaxyMetrics | null> {
  try {
    const response = await fetch('https://api.morpho.org/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          address: GALAXY_USDC.underlyingVault,
          chainId: GALAXY_USDC.chainId,
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
      throw new Error('Vault was not found in the V2 API');
    }

    if (
      vault.address.toLowerCase() !==
      GALAXY_USDC.underlyingVault.toLowerCase()
    ) {
      throw new Error('Vault address mismatch');
    }

    return {
      totalAssetsUsd: finiteNumber(vault.totalAssetsUsd),
      liquidityUsd: finiteNumber(vault.liquidityUsd),
      underlyingNetApy: finiteNumber(
        vault.avgNetApyExcludingRewards,
      ),
      underlyingPerformanceFee: finiteNumber(vault.performanceFee),
      underlyingManagementFee: finiteNumber(vault.managementFee),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      '[galaxy-metrics]',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return null;
  }
}