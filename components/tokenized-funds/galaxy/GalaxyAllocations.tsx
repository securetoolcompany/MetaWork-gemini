'use client';

import { useEffect, useState } from 'react';
import { Layers3 } from 'lucide-react';

type Allocation = {
  id: string;
  symbol: string;
  name: string;
  assetsUsd: number;
  percent: number;
};

type AllocationData = {
  fetchedAt: string;
  underlyingTotalAssetsUsd: number;
  accountedUsd: number;
  coveragePercent: number;
  allocations: Allocation[];
};

const colors = [
  '#38bdf8', '#818cf8', '#a78bfa', '#2dd4bf',
  '#fbbf24', '#fb7185', '#34d399', '#e879f9',
];

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export default function GalaxyAllocations({
  endpoint = '/api/tokenized-funds/galaxy/allocations',
}: {
  endpoint?: string;
}) {
  const [data, setData] = useState<AllocationData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    let pending = false;
    let controller: AbortController | null = null;

    async function refresh() {
      if (pending || stopped) return;
      pending = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 40_000);

      try {
        const response = await fetch(
          endpoint,
          { cache: 'no-store', signal: controller.signal },
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Live allocation request failed.');
        }

        if (
          !Array.isArray(payload.allocations) ||
          payload.allocations.length === 0
        ) {
          throw new Error('No allocation data returned.');
        }

        if (!stopped) {
          setData(payload);
          setError('');
        }
      } catch {
        if (!stopped) {
          setError('Live allocation refresh is temporarily unavailable.');
        }
      } finally {
        window.clearTimeout(timeout);
        pending = false;
        if (!stopped) setLoading(false);
      }
    }

    void refresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60_000);

    function focused() {
      void refresh();
    }

    window.addEventListener('focus', focused);

    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', focused);
    };
  }, [endpoint]);

  let cursor = 0;
  const stops = data?.allocations.map((allocation, index) => {
    const start = cursor;
    cursor += allocation.percent;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });

  const activeCollateralCount = data?.allocations.filter(
    allocation => allocation.id !== 'idle-usdc',
  ).length ?? 0;

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Layers3 className="h-4 w-4 text-sky-400" aria-hidden="true" />
            Where your USDC works
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Current underlying lending allocations by borrower collateral.
          </p>
        </div>

        <span className={`rounded-full px-3 py-1 text-[11px] ${
          error
            ? 'bg-amber-400/10 text-amber-300'
            : 'bg-sky-400/10 text-sky-300'
        }`}>
          {loading ? 'Loading allocations…' :
            error ? 'Refresh unavailable' : 'Auto-refresh · 60 seconds'}
        </span>
      </div>

      {error && (
        <p role="status" className="mt-5 text-sm text-amber-300">
          {error}
          {data ? ' Showing the last successfully fetched readings below.' : ''}
        </p>
      )}

      {!data && !loading && (
        <p className="mt-5 text-sm text-slate-400">
          The chart is unavailable. No historical percentages are substituted.
        </p>
      )}

      {data && (
        <>
          <div className="mt-8 grid items-center gap-8 sm:grid-cols-[190px_minmax(0,1fr)]">
            <div
              className="relative mx-auto flex h-44 w-44 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${stops?.join(',')})` }}
              role="img"
              aria-label="Underlying allocation chart. Current percentages and USD values are listed alongside."
            >
              <div className="flex h-[140px] w-[140px] flex-col items-center justify-center rounded-full bg-[#0e1421]">
                <span className="text-3xl font-semibold">
                  {activeCollateralCount}
                </span>
                <span className="mt-1 text-xs text-slate-400">
                  collateral types
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {data.allocations.map((allocation, index) => (
                <div
                  key={allocation.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {allocation.symbol}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {allocation.name}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right tabular-nums">
                    <p className="text-sm text-slate-300">
                      {allocation.percent.toFixed(2)}%
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {usd.format(allocation.assetsUsd)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <dl className="mt-7 space-y-3 border-t border-white/[0.06] pt-5 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-slate-400">Underlying vault assets</dt>
              <dd className="tabular-nums text-slate-200">
                {usd.format(data.underlyingTotalAssetsUsd)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-slate-400">Reported allocation total</dt>
              <dd className="tabular-nums text-slate-200">
                {usd.format(data.accountedUsd)}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            Last fetched: {new Date(data.fetchedAt).toLocaleString()}.
            Data is API-indexed, not a per-block stream.
            Percentages use the reported allocation total and group markets
            sharing the same collateral. Idle underlying USDC is shown when
            present. Small differences from vault totals can occur between
            indexed readings.
          </p>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            These are underlying-vault allocations, not your wallet balance
            or an immediate withdrawal quote. Your position tokens represent
            an interest in the MetaWork Tokenizer—not direct ownership of
            borrower collateral.
          </p>
        </>
      )}
    </section>
  );
}
