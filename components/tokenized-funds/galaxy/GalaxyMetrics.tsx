// components/tokenized-funds/galaxy/GalaxyMetrics.tsx

import { RefreshCw } from 'lucide-react';
import type { GalaxyMetrics as Metrics } from '../../../lib/tokenized-funds/galaxy/data';

type Props = {
  metrics: Metrics | null;
};

function formatUsd(value: number | null | undefined): string {
  if (value == null) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function GalaxyMetrics({ metrics }: Props) {
  const cards = [
    {
      label: 'Underlying net APY',
      value: formatPercent(metrics?.underlyingNetApy),
      available: metrics?.underlyingNetApy != null,
      description:
        'Average yield after underlying vault fees. Before the MetaWork fee; excludes incentives.',
      accent: true,
    },
    {
      label: 'Total vault deposits',
      value: formatUsd(metrics?.totalAssetsUsd),
      available: metrics?.totalAssetsUsd != null,
      description:
        'USD value of assets across the underlying vault—not just MetaWork deposits.',
      accent: false,
    },
    {
      label: 'Underlying liquidity',
      value: formatUsd(metrics?.liquidityUsd),
      available: metrics?.liquidityUsd != null,
      description:
        'API-reported vault liquidity. Not your personal withdrawal limit.',
      accent: false,
    },
  ];

  return (
    <section aria-label="Current vault metrics">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-400">
                {item.label}
              </p>

              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  item.available ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </div>

            <p
              className={`mt-4 text-3xl font-semibold tracking-tight tabular-nums ${
                !item.available
                  ? 'text-slate-500'
                  : item.accent
                    ? 'text-sky-300'
                    : 'text-white'
              }`}
            >
              {item.value}
            </p>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1"
        aria-live="polite"
      >
        <p className="text-[11px] leading-5 text-slate-500">
          {metrics ? (
            <>
              API response fetched{' '}
              <time dateTime={metrics.fetchedAt}>
                {new Date(metrics.fetchedAt).toLocaleString(
                  'en-US',
                  {
                    timeZone: 'UTC',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  },
                )}
              </time>
              . Cached for up to 60 seconds; upstream indexing may lag.
            </>
          ) : (
            'Vault data is temporarily unavailable. No estimated values are substituted.'
          )}
        </p>

        <a
          href="/tokenized-funds/galaxy-usdc"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-sky-300"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Reload
        </a>
      </div>
    </section>
  );
}