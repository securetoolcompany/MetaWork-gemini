// app/tokenized-funds/galaxy-usdc/page.tsx

import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Globe2,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { GALAXY_USDC } from '../../../lib/tokenized-funds/galaxy/config';
import GalaxyMetrics from '../../../components/tokenized-funds/galaxy/GalaxyMetrics';
import { getGalaxyMetrics } from '../../../lib/tokenized-funds/galaxy/data';

export const metadata = {
  title: 'Galaxy USDC Enhanced | MetaWork',
  description:
    'Put your USDC to work through collateral-backed lending on MetaWork.',
};

// Informational snapshot. Replace with live data before launch.
const allocations = [
  {
    symbol: 'PST',
    name: 'Payment & trade financing',
    share: 45.19,
    color: '#38bdf8',
    className: 'bg-sky-400',
  },
  {
    symbol: 'cbBTC',
    name: 'cbBTC-backed lending',
    share: 31.95,
    color: '#818cf8',
    className: 'bg-indigo-400',
  },
  {
    symbol: 'reUSD',
    name: 'reUSD-backed lending',
    share: 16.95,
    color: '#a78bfa',
    className: 'bg-violet-400',
  },
  {
    symbol: 'PT-USDat',
    name: 'Principal-token collateral',
    share: 5.28,
    color: '#2dd4bf',
    className: 'bg-teal-400',
  },
  {
    symbol: 'LBTC',
    name: 'LBTC-backed lending',
    share: 0.63,
    color: '#fbbf24',
    className: 'bg-amber-400',
  },
];

const allocationGradient = `conic-gradient(
  #38bdf8 0% 45.19%,
  #818cf8 45.19% 77.14%,
  #a78bfa 77.14% 94.09%,
  #2dd4bf 94.09% 99.37%,
  #fbbf24 99.37% 100%
)`;

const card =
  'rounded-3xl border border-white/[0.08] bg-white/[0.025]';

export const revalidate = 60;

export default async function GalaxyUsdcPage() {
  const vault = GALAXY_USDC;
  const metrics = await getGalaxyMetrics();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080c16] text-slate-100">
      {/* Background atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[650px]"
        style={{
          background:
            'radial-gradient(ellipse at 15% 0%, rgba(37,99,235,.18), transparent 55%), radial-gradient(ellipse at 90% 20%, rgba(124,58,237,.12), transparent 50%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <Link
          href="/tokenized-funds"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All products
        </Link>

        {/* Product identity */}
        <header className="mb-10 mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-400/20 to-indigo-500/20 shadow-[0_0_45px_rgba(56,189,248,0.10)]">
              <CircleDollarSign
                className="h-9 w-9 text-sky-300"
                aria-hidden="true"
              />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-sky-400">
                MetaWork Earn
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {vault.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              Ethereum
            </span>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-300">
              Preparing for launch
            </span>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="min-w-0 space-y-6">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border border-sky-400/15 bg-gradient-to-br from-[#10233d] via-[#111a30] to-[#15152b] p-7 sm:p-10">
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-sky-400/10"
              />
              <div
                aria-hidden="true"
                className="absolute -right-6 -top-6 h-44 w-44 rounded-full border border-sky-400/10"
              />

              <div className="relative">
                <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-sky-300">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Real-world financing. Onchain access.
                </div>

                <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
                  Your USDC.
                  <br />
                  <span className="bg-gradient-to-r from-sky-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">
                    Put to work.
                  </span>
                </h2>

                <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
                  Earn variable interest through collateral-backed
                  lending, including exposure to payment settlement,
                  trade financing, and digital assets.
                </p>

                <div className="mt-8 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-3">
                  {[
                    ['Asset', 'USDC'],
                    ['Yield source', 'Borrower interest'],
                    ['Platform fee', `${vault.performanceFeeBps / 100}% of yield`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <GalaxyMetrics metrics={metrics} />

            {/* Portfolio visualization */}
            <section className={`${card} p-6 sm:p-7`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers3
                      className="h-4 w-4 text-sky-400"
                      aria-hidden="true"
                    />
                    <h2 className="text-lg font-semibold">
                      Where your USDC works
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Lending allocations by borrower collateral.
                  </p>
                </div>

                <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-slate-400">
                  Snapshot · Oct 28, 2026
                </span>
              </div>

              <div className="mt-8 grid items-center gap-8 sm:grid-cols-[190px_minmax(0,1fr)]">
                <div
                  className="relative mx-auto flex h-44 w-44 items-center justify-center rounded-full"
                  style={{ background: allocationGradient }}
                  role="img"
                  aria-label="Collateral allocation chart. Percentages listed alongside."
                >
                  <div className="flex h-[140px] w-[140px] flex-col items-center justify-center rounded-full bg-[#0e1421]">
                    <span className="text-3xl font-semibold">5</span>
                    <span className="mt-1 text-xs text-slate-400">
                      collateral markets
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {allocations.map((item) => (
                    <div
                      key={item.symbol}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${item.className}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {item.symbol}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.name}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm tabular-nums text-slate-300">
                        {item.share.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7 rounded-2xl border border-sky-400/10 bg-sky-400/5 p-5">
                <p className="text-sm font-medium text-sky-200">
                  The Huma connection
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The largest allocation in this snapshot lends
                  against Huma’s PayFi Strategy Token, PST. Its
                  underlying economics draw on cross-border
                  payments, trade finance, and marketplace payouts.
                  This vault earns interest from borrowers pledging
                  PST—not a direct share of every payment Huma
                  finances.
                </p>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Informational snapshot, not live holdings.
                Allocations can change. You hold vault shares,
                not direct ownership of the listed collateral.
                PT-USDat refers to PT-USDat-14JAN2027.
              </p>
            </section>

            {/* Mechanism */}
            <section className={`${card} p-6 sm:p-7`}>
              <h2 className="text-lg font-semibold">
                A straightforward earning model
              </h2>

              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                {[
                  {
                    icon: Wallet,
                    title: 'You supply USDC',
                    text: 'Your deposit enters the lending strategy through your MetaWork wrapper position.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Borrowers post collateral',
                    text: 'Selected markets require collateral to support USDC borrowing.',
                  },
                  {
                    icon: ArrowDownLeft,
                    title: 'Interest accrues',
                    text: 'Borrower interest contributes to your position’s value, after fees. Losses remain possible.',
                  },
                ].map(({ icon: Icon, title, text }, index) => (
                  <div key={title}>
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-sky-300">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="font-mono text-xs text-slate-600">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-medium">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Fees */}
            <section className={`${card} p-6 sm:p-7`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Clear fees. No guesswork.
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Know what is charged—and what it is charged on.
                  </p>
                </div>
                <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs text-sky-300">
                  Planned configuration
                </span>
              </div>

              <dl className="mt-6 divide-y divide-white/[0.06]">
                {[
                  [
                    'MetaWork platform fee',
                    `${vault.performanceFeeBps / 100}% of yield earned`,
                  ],
                  [
                    'MetaWork annual asset-based fee',
                    `${vault.managementFeeBps / 100}%`,
                  ],
                  [
										'Underlying performance fee',
										metrics?.underlyingPerformanceFee != null
											? `${(metrics.underlyingPerformanceFee * 100).toFixed(2)}% of yield`
											: 'Unavailable',
									],
									[
										'Underlying annual management fee',
										metrics?.underlyingManagementFee != null
											? `${(metrics.underlyingManagementFee * 100).toFixed(2)}% annually`
											: 'Unavailable',
									],
                  ['Network costs', 'Variable ETH gas fees'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-5 py-4 text-sm"
                  >
                    <dt className="text-slate-400">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 rounded-xl bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
                If your position earns 100 USDC after underlying
                fees and before MetaWork’s fee, the planned platform
                fee is 10 USDC. You retain 90 USDC before network
                costs. This is an illustration, not a return forecast.
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
								Underlying fees are loaded with the vault metrics and may change.
								The annual management fee accrues against invested assets; it is
								not a percentage of earnings.
							</p>
            </section>

            {/* Expandable details */}
            <section className={`${card} divide-y divide-white/[0.06] px-6 sm:px-7`}>
              <details className="group py-5">
                <summary className="cursor-pointer text-sm font-medium">
                  Withdrawals & liquidity
                </summary>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  Withdrawals depend on available liquidity and
                  contract configuration. Funds on loan may not be
                  immediately available. Your total position and
                  your currently withdrawable amount can differ.
                  Immediate withdrawal is not guaranteed.
                </p>
              </details>

              <details className="group py-5">
                <summary className="cursor-pointer text-sm font-medium">
                  Risks to understand
                </summary>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  Capital is at risk. Borrower defaults, collateral
                  price declines, unsuccessful liquidations, pricing
                  errors, smart-contract failures, USDC depegging,
                  and limited liquidity can cause losses or restrict
                  withdrawals. PST also introduces exposure to the
                  credit, operational, and counterparty risks of its
                  underlying financing activities. Collateral does
                  not guarantee repayment.
                </p>
              </details>

              <details className="group py-5">
                <summary className="cursor-pointer text-sm font-medium">
                  Infrastructure & product terms
                </summary>
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Underlying curator</dt>
                    <dd className="mt-1 text-slate-300">
                      Galaxy Curation LLC
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Infrastructure</dt>
                    <dd className="mt-1 text-slate-300">
                      Morpho Vault V2 · Ethereum
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Underlying vault</dt>
                    <dd className="mt-1 break-all font-mono text-xs leading-6 text-slate-300">
                      {vault.underlyingVault}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-6 text-slate-500">
                  Full applicable terms and required disclosures
                  must be available before launch. This summary
                  is not a complete agreement.
                </p>
              </details>
            </section>
          </div>

          {/* Action panel */}
          <aside className="lg:sticky lg:top-6">
            <section className="overflow-hidden rounded-3xl border border-sky-400/20 bg-[#101827] shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <div className="border-b border-white/[0.06] px-6 py-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Your position</h2>
                  <Wallet
                    className="h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Wallet integration pending
                </p>
              </div>

              <div className="p-6">
                <p className="text-xs text-slate-400">
                  Position balance
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-500">
                  — <span className="text-lg">USDC</span>
                </p>

                <div className="mt-7 flex gap-1 rounded-xl bg-black/20 p-1">
                  <span className="flex-1 rounded-lg bg-white/[0.08] py-2.5 text-center text-sm font-medium">
                    Deposit
                  </span>
                  <span className="flex-1 py-2.5 text-center text-sm text-slate-500">
                    Withdraw
                  </span>
                </div>

                <label
                  htmlFor="deposit-amount"
                  className="mt-6 block text-xs text-slate-400"
                >
                  Deposit amount
                </label>

                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
                  <input
                    id="deposit-amount"
                    type="text"
                    placeholder="0.00"
                    disabled
                    className="min-w-0 flex-1 cursor-not-allowed bg-transparent text-2xl outline-none placeholder:text-slate-600"
                  />
                  <span className="rounded-lg bg-sky-400/10 px-2.5 py-1.5 text-xs font-medium text-sky-300">
                    USDC
                  </span>
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-sky-400/10 bg-sky-400/10 px-4 py-3.5 text-sm font-medium text-sky-300/60"
                >
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  Available after setup
                </button>

                <div className="mt-6 space-y-3">
                  {[
                    'USDC deposits on Ethereum',
                    'Platform fee based on yield',
                    'Withdrawal subject to liquidity',
                  ].map((text) => (
                    <div
                      key={text}
                      className="flex items-start gap-2 text-xs leading-5 text-slate-400"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400"
                        aria-hidden="true"
                      />
                      {text}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.06] bg-black/10 px-6 py-4">
                <div className="flex items-center gap-2 text-xs text-amber-300">
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  Setup in progress
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Wrapper deployment, live data, and wallet
                  transactions are not yet complete. Do not send
                  funds directly to any displayed address.
                </p>
              </div>
            </section>

            <p className="px-3 pt-4 text-center text-[11px] leading-5 text-slate-600">
              Investment product. Not an insured savings account.
              Returns are not guaranteed.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}