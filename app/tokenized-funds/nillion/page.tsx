// app/tokenized-funds/nillion/page.tsx

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

type NodeData = {
  nodeId: string;
  name: string;
  stakeBaseUnits: string;
  fetchedAt: string;
	  principalPerformance?: {
    available: boolean;
    nodeStartTimeUtc?: string;
    baseline?: {
      priceUsd: string;
      priceTimeUtc: string;
    };
    quote?: {
      priceUsd: string;
      quoteTimeUtc: string;
    };
    node?: {
      startingValueUsdAtomic: string;
      currentValueUsdAtomic: string;
      appreciationUsdAtomic: string;
      priceReturnBps: string;
      direction: 'gain' | 'loss' | 'unchanged';
    };
  };
  status: {
    earning: boolean;
  };
  rewards: {
    grossPendingBaseUnits: string;
    estimatedInvestorPendingBaseUnits: string;
    operatingCostsIncluded: boolean;
    allocationsMatch: boolean;
    projections: {
      grossAprBps: string;
      investorAprAfterFeeBps: string;
      grossWeeklyBaseUnits: string;
      investorDailyAfterFeeBaseUnits: string;
      investorWeeklyAfterFeeBaseUnits: string;
      investorYearlyAfterFeeBaseUnits: string;
    };
    warnings: string[];
  };
};

type DashboardData = {
  status: 'ok' | 'partial' | 'unavailable';
  managementFeeBps: number;
  nodes: NodeData[];
  errors: {
    nodeId: string;
    name: string;
    message: string;
  }[];
};

function formatNil(value: string, decimals = 3) {
  const amount = BigInt(value);
  const scale = BigInt('1000000');
  const whole = amount / scale;
  const fraction = (amount % scale)
    .toString()
    .padStart(6, '0')
    .slice(0, decimals);

  return `${whole.toLocaleString('en-US')}.${fraction}`;
}

function formatUsdAtomic(value: string, showPositiveSign = false) {
  const amount = BigInt(value);
  const zero = BigInt('0');
  const negative = amount < zero;
  const absolute = negative ? -amount : amount;

  // Round millionths of a dollar to cents for display.
  const cents =
    (absolute + BigInt('5000')) / BigInt('10000');

  const whole = cents / BigInt('100');
  const fraction = (cents % BigInt('100'))
    .toString()
    .padStart(2, '0');

  const sign = negative
    ? '−'
    : showPositiveSign && amount > zero
      ? '+'
      : '';

  return `${sign}$${whole.toLocaleString('en-US')}.${fraction}`;
}

function formatSignedBps(value: string) {
  const bps = BigInt(value);
  const zero = BigInt('0');
  const negative = bps < zero;
  const absolute = negative ? -bps : bps;
  const scale = BigInt('100');

  const whole = absolute / scale;
  const fraction = (absolute % scale)
    .toString()
    .padStart(2, '0');

  const sign = negative ? '−' : bps > zero ? '+' : '';

  return `${sign}${whole}.${fraction}%`;
}

function NodeCard({ node }: { node: NodeData }) {
  const projections = node.rewards.projections;

  function percentage(value: string | undefined) {
    if (value === undefined) return '—';

    const bps = BigInt(value);
    const scale = BigInt('100');
    const whole = bps / scale;
    const fraction = (bps % scale).toString().padStart(2, '0');

    return `${whole}.${fraction}%`;
  }

  function nil(value: string | undefined) {
    return value === undefined ? '—' : `${formatNil(value)} NIL`;
  }

  const projectionRows = [
    {
      label: 'Daily',
      value: projections.investorDailyAfterFeeBaseUnits,
    },
    {
      label: 'Weekly',
      value: projections.investorWeeklyAfterFeeBaseUnits,
    },
    {
      label: 'Yearly',
      value: projections.investorYearlyAfterFeeBaseUnits,
    },
  ];

  return (
    <Link
      href={`/tokenized-funds/nillion/nodes/${node.nodeId}`}
      className="group flex h-full min-w-0 flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-blue-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{node.name}</h2>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            node.status.earning
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-amber-500/10 text-amber-400'
          }`}
        >
          {node.status.earning ? 'Earning' : 'Not earning'}
        </span>
      </div>

      <div className="mt-6">
        <p className="text-sm text-slate-400">
          All-time gross earnings
        </p>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="whitespace-nowrap text-3xl font-semibold tabular-nums tracking-tight">
            {formatNil(node.rewards.grossPendingBaseUnits)}
          </span>
          <span className="text-sm text-slate-400">NIL</span>
        </div>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Before management fees and operating costs.
          No rewards have been claimed to date.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">Gross APR</p>
          <p className="mt-2 whitespace-nowrap text-xl font-semibold tabular-nums">
            {percentage(projections.grossAprBps)}
          </p>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="text-xs text-blue-300">APR after mgmt fee</p>
          <p className="mt-2 whitespace-nowrap text-xl font-semibold tabular-nums text-blue-300">
            {percentage(projections.investorAprAfterFeeBps)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        APR is annualized in NIL. After-fee APR excludes operating
        costs. Rewards are not automatically compounded.
      </p>

      <div className="mt-6 border-t border-slate-800 pt-5">
        <h3 className="text-sm font-medium text-slate-200">
          Projected ownership earnings
        </h3>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Combined across all ownership positions, after the
          management fee and before operating costs.
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          {projectionRows.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
            >
              <dt className="text-slate-400">{row.label}</dt>
              <dd className="whitespace-nowrap text-right font-medium tabular-nums">
                {nil(row.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <dl className="mt-5 space-y-3 border-t border-slate-800 pt-5 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-slate-400">Node stake</dt>
          <dd className="whitespace-nowrap text-right tabular-nums">
            {formatNil(node.stakeBaseUnits)} NIL
          </dd>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-slate-400">
            Ownership earnings to date
          </dt>
          <dd className="whitespace-nowrap text-right tabular-nums">
            {formatNil(
              node.rewards.estimatedInvestorPendingBaseUnits,
            )}{' '}
            NIL
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Ownership earnings are shared proportionally, not an
        individual investor balance. Projections assume current
        network conditions and eligibility continue.
      </p>

			<section className="mt-5 border-t border-slate-800 pt-5">
        <h3 className="text-sm font-medium text-slate-200">
          Principal appreciation / depreciation
        </h3>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Original node principal only. Reward tokens are excluded.
        </p>

        {node.principalPerformance?.available &&
        node.principalPerformance.node ? (
          <>
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
              <span
                className={`whitespace-nowrap text-2xl font-semibold tabular-nums ${
                  node.principalPerformance.node.direction === 'loss'
                    ? 'text-red-400'
                    : node.principalPerformance.node.direction === 'gain'
                      ? 'text-emerald-400'
                      : 'text-slate-200'
                }`}
              >
                {formatUsdAtomic(
                  node.principalPerformance.node.appreciationUsdAtomic,
                  true,
                )}
              </span>

              <span
                className={`whitespace-nowrap text-sm font-medium tabular-nums ${
                  node.principalPerformance.node.direction === 'loss'
                    ? 'text-red-400'
                    : node.principalPerformance.node.direction === 'gain'
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                }`}
              >
                {formatSignedBps(
                  node.principalPerformance.node.priceReturnBps,
                )}
              </span>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <dt className="text-slate-400">
                  Starting principal value
                </dt>
                <dd className="whitespace-nowrap tabular-nums">
                  {formatUsdAtomic(
                    node.principalPerformance.node.startingValueUsdAtomic,
                  )}
                </dd>
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <dt className="text-slate-400">
                  Current principal value
                </dt>
                <dd className="whitespace-nowrap tabular-nums">
                  {formatUsdAtomic(
                    node.principalPerformance.node.currentValueUsdAtomic,
                  )}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Price performance since enrollment, using the saved
              pre-start price sample. This is not realized sale
              proceeds and is separate from NIL reward earnings.
            </p>

            {node.principalPerformance.quote && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Price quote:{' '}
                {new Date(
                  node.principalPerformance.quote.quoteTimeUtc,
                ).toLocaleString()}
                {' · CoinGecko'}
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            Principal price performance is temporarily unavailable.
            Node reward tracking remains separate.
          </p>
        )}
      </section>

      {node.rewards.warnings.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2 text-amber-300">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <ul className="space-y-2 text-xs leading-5">
              {node.rewards.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-auto pt-6">
        <div className="flex items-center justify-between gap-3 text-sm font-medium text-blue-400">
          <span>View node and your earnings</span>
          <ArrowRight
            className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  );
}

export default function NillionFundPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | null = null;

    async function load() {
      if (inFlight || disposed) return;

      inFlight = true;
      controller = new AbortController();
      setRefreshing(true);

      try {
        const response = await fetch(
          '/api/tokenized-funds/nillion/dashboard',
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error ||
              'Unable to refresh node data. Please try again shortly.',
          );
        }

        if (!Array.isArray(body.nodes) || !Array.isArray(body.errors)) {
          throw new Error('The dashboard returned an invalid response.');
        }

        if (!disposed) {
          setData(body);
          setError(null);
        }
      } catch (cause) {
        if (!disposed) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to load node data.',
          );
        }
      } finally {
        inFlight = false;

        if (!disposed) {
          setRefreshing(false);
        }
      }
    }

    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      controller?.abort();
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/tokenized-funds"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All funds
        </Link>

        <header className="mt-8 max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-widest text-blue-400">
            Node Infrastructure
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Nillion Nodes
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-400">
            Monitor your nodes and the NIL rewards they generate.
            Select a node to explore its activity and your recorded
            participation.
          </p>
        </header>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm leading-6 text-slate-300">
            Management fee:{' '}
            {data
              ? `${data.managementFeeBps / 100}%`
              : '50%'}{' '}
            after applicable operating costs. Current estimates
            exclude operating costs until those costs are entered.
            This dashboard currently tracks NIL emissions only.
          </p>
        </div>

        <div className="mt-10 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Nodes</h2>

          <div
            className="flex items-center gap-2 text-xs text-slate-400"
            role="status"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                refreshing ? 'animate-spin' : ''
              }`}
              aria-hidden="true"
            />
            {refreshing ? 'Refreshing…' : 'Updates every minute'}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
          >
            {error}
            {data && (
              <p className="mt-1">
                Showing the last successful data. Figures may be stale.
              </p>
            )}
          </div>
        )}

        {!data && !error && (
          <p className="mt-6 text-sm text-slate-400">
            Loading live node data…
          </p>
        )}

        {data && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {data.nodes.map((node) => (
              <NodeCard key={node.nodeId} node={node} />
            ))}

            {data.errors.map((nodeError) => (
              <div
                key={nodeError.nodeId}
                className="rounded-2xl border border-amber-500/30 bg-slate-900 p-6"
              >
                <h2 className="text-xl font-semibold">
                  {nodeError.name}
                </h2>
                <p className="mt-4 text-sm leading-6 text-amber-300">
                  {nodeError.message}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Another attempt will be made during the next refresh.
                </p>
              </div>
            ))}
          </div>
        )}

        {data && data.nodes.length > 0 && (
          <p className="mt-6 text-xs text-slate-500">
            Snapshot times:{' '}
            {data.nodes
              .map(
                (node) =>
                  `#${node.nodeId} — ${new Date(
                    node.fetchedAt,
                  ).toLocaleTimeString()}`,
              )
              .join(' · ')}
          </p>
        )}

        <p className="mt-10 max-w-3xl text-sm leading-6 text-slate-500">
          Earnings shown currently represent all-time unclaimed NIL
					emissions for these nodes. Projections are estimates, not
					guaranteed returns. Confirmed payout tracking is not yet
					available.
        </p>
      </div>
    </main>
  );
}