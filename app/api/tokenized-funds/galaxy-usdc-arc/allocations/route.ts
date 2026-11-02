import { NextResponse } from 'next/server';
import { GALAXY_ARC } from '../../../../../lib/tokenized-funds/galaxy-usdc-arc/config';

export const dynamic = 'force-dynamic';

type Adapter = {
  address: string;
  type: string;
  assetsUsd: number | null;
};

type Position = {
  market: {
    collateralAsset: {
      address: string;
      symbol: string;
      name: string;
    } | null;
  };
  state: { supplyAssetsUsd: number | null } | null;
};

type Allocation = {
  id: string;
  symbol: string;
  name: string;
  assetsUsd: number;
};

async function graphql<T>(query: string): Promise<T> {
  const response = await fetch('https://api.morpho.org/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await response.json();

  if (!response.ok || payload.errors?.length) {
    throw new Error(
      payload.errors?.map((error: { message: string }) => error.message).join('; ')
      || `Allocation API returned HTTP ${response.status}`,
    );
  }

  if (!payload.data) throw new Error('Missing allocation data.');
  return payload.data as T;
}

function validAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export async function GET() {
  try {
    const { vaultV2ByAddress: vault } = await graphql<{
      vaultV2ByAddress: {
        address: string;
        totalAssetsUsd: number | null;
        idleAssetsUsd: number | null;
        adapters: { items: Adapter[] };
      } | null;
    }>(`{
      vaultV2ByAddress(
        address: "${GALAXY_ARC.underlyingVault}"
        chainId: ${GALAXY_ARC.chainId}
      ) {
        address
        totalAssetsUsd
        idleAssetsUsd
        adapters(first: 100) {
          items { address type assetsUsd }
        }
      }
    }`);

    if (
      !vault ||
      vault.address.toLowerCase() !== GALAXY_ARC.underlyingVault.toLowerCase()
    ) {
      throw new Error('Underlying vault address mismatch.');
    }

    if (
      !validAmount(vault.totalAssetsUsd) ||
      vault.totalAssetsUsd <= 0 ||
      !validAmount(vault.idleAssetsUsd)
    ) {
      throw new Error('Underlying valuation unavailable.');
    }

    if (vault.adapters.items.length >= 100) {
      throw new Error('Adapter response may be truncated.');
    }

    const adapters = vault.adapters.items.filter(adapter => {
      if (!validAmount(adapter.assetsUsd)) {
        throw new Error('Adapter valuation unavailable.');
      }
      return adapter.assetsUsd > 0;
    });

    for (const adapter of adapters) {
      if (
        !/^0x[0-9a-fA-F]{40}$/.test(adapter.address) ||
        !adapter.type.startsWith('MorphoMarketV1')
      ) {
        throw new Error('An active adapter requires additional allocation support.');
      }
    }

    const grouped = new Map<string, Allocation>();

    if (adapters.length) {
      const addresses = adapters
        .map(adapter => JSON.stringify(adapter.address.toLowerCase()))
        .join(',');

      const { marketPositions } = await graphql<{
        marketPositions: { items: Position[] };
      }>(`{
        marketPositions(
          first: 100
          where: {
            chainId_in: [${GALAXY_ARC.chainId}]
            userAddress_in: [${addresses}]
          }
        ) {
          items {
            market {
              collateralAsset { address symbol name }
            }
            state { supplyAssetsUsd }
          }
        }
      }`);

      if (!Array.isArray(marketPositions?.items)) {
        throw new Error('Market positions unavailable.');
      }

      if (marketPositions.items.length >= 100) {
        throw new Error('Market response may be truncated.');
      }

      for (const position of marketPositions.items) {
        const amount = position.state?.supplyAssetsUsd;
        if (!validAmount(amount)) {
          throw new Error('A market valuation is unavailable.');
        }
        if (amount === 0) continue;

        const collateral = position.market.collateralAsset;
        const id = collateral?.address.toLowerCase() ?? 'no-collateral';
        const existing = grouped.get(id);

        grouped.set(id, {
          id,
          symbol: collateral?.symbol ?? 'No collateral',
          name: collateral?.name ?? 'Market without collateral',
          assetsUsd: (existing?.assetsUsd ?? 0) + amount,
        });
      }
    }

    if (vault.idleAssetsUsd > 0) {
      grouped.set('idle-usdc', {
        id: 'idle-usdc',
        symbol: 'Idle USDC',
        name: 'Unallocated underlying-vault USDC',
        assetsUsd: vault.idleAssetsUsd,
      });
    }

    const allocations = [...grouped.values()]
      .sort((a, b) => b.assetsUsd - a.assetsUsd);

    const accountedUsd = allocations.reduce(
      (sum, allocation) => sum + allocation.assetsUsd,
      0,
    );

    const coverage = accountedUsd / vault.totalAssetsUsd;

    if (!Number.isFinite(coverage) || Math.abs(1 - coverage) > 0.01) {
      throw new Error('Allocation totals do not reconcile within 1%.');
    }

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      underlyingTotalAssetsUsd: vault.totalAssetsUsd,
      accountedUsd,
      coveragePercent: coverage * 100,
      allocations: allocations.map(allocation => ({
        ...allocation,
        percent: allocation.assetsUsd / accountedUsd * 100,
      })),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error(
      '[galaxy-usdc-arc-allocations]',
      error instanceof Error ? error.message : error,
    );

    return NextResponse.json({
      error: 'Live allocation data is temporarily unavailable.',
    }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
