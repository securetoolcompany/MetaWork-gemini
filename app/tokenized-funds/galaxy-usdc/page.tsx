import GalaxyDisclosures from '../../../components/tokenized-funds/galaxy/GalaxyDisclosures';
import GalaxyAllocations from '../../../components/tokenized-funds/galaxy/GalaxyAllocations';
// app/tokenized-funds/galaxy-usdc/page.tsx

import Link from 'next/link';
import GalaxyDepositFlow from '../../../components/tokenized-funds/galaxy/GalaxyDepositFlow';
import {
  ArrowDownLeft,
  ArrowLeft,
  Check,
  CircleDollarSign,
  Globe2,
  Layers3,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';

import EthereumWalletPanel from '../../../components/tokenized-funds/galaxy/EthereumWalletPanel';
import GalaxyMetrics from '../../../components/tokenized-funds/galaxy/GalaxyMetrics';
import { GALAXY_USDC } from '../../../lib/tokenized-funds/galaxy/config';
import { getGalaxyMetrics } from '../../../lib/tokenized-funds/galaxy/data';

export const metadata = {
  title: 'Galaxy USDC Enhanced on Ethereum | MetaWork Earn',
  description:
    'Access Galaxy USDC Enhanced on Ethereum through the MetaWork Tokenizer. Explore position tokens, underlying vault metrics, fees, liquidity, and risks.',
};

export const revalidate = 60;

const card =
  'rounded-3xl border border-white/[0.08] bg-white/[0.025]';

const positionSymbol = 'mwGUSDCe';
const assetAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

function percentage(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'Unavailable';

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function GalaxyUsdcPage() {
  const vault = GALAXY_USDC;
  const metrics = await getGalaxyMetrics();

  const performanceFeePercent = vault.performanceFeeBps / 100;
  const managementFeePercent = vault.managementFeeBps / 100;

  const fees = [
    [
      'MetaWork performance fee',
      `${performanceFeePercent}% of yield earned`,
    ],
    [
      'MetaWork annual asset-based fee',
      `${managementFeePercent}%`,
    ],
    [
      'Underlying vault performance fee',
      metrics?.underlyingPerformanceFee != null
        ? `${percentage(metrics.underlyingPerformanceFee)} of yield`
        : 'Unavailable',
    ],
    [
      'Underlying vault annual management fee',
      metrics?.underlyingManagementFee != null
        ? `${percentage(metrics.underlyingManagementFee)} annually`
        : 'Unavailable',
    ],
    ['Network costs', 'Variable ETH gas fees on Ethereum'],
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080c16] text-slate-100">
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
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs text-indigo-200">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              Ethereum
            </span>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs text-sky-200">
              Tokenized access
            </span>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="min-w-0 space-y-6">
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
                <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-sky-300">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Curated lending. Tokenized access.
                </p>

                <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
                  Your USDC.
                  <br />
                  <span className="bg-gradient-to-r from-sky-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">
                    Put to work.
                  </span>
                </h2>

                <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
                  Access Galaxy USDC Enhanced on Ethereum through
                  the MetaWork Tokenizer. Deposit USDC to receive{' '}
                  {positionSymbol} position tokens representing
                  your share of assets held through the Tokenizer.
                </p>

                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">
                  Galaxy curates the underlying lending strategy.
                  MetaWork provides the tokenized access layer
                  and the interface for deposits, position
                  tracking, and redemption.
                </p>

                <div className="mt-8 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-3">
                  {[
                    ['Asset', 'USDC on Ethereum'],
                    ['Position token', positionSymbol],
                    ['MetaWork fee', `${performanceFeePercent}% of yield`],
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

            <GalaxyMetrics
              metrics={metrics}
              reloadHref={vault.href}
              liquidityLabel="Underlying vault liquidity"
              liquidityDescription="Estimated liquidity across the underlying vault's positions. Reallocation may be required; this is not your immediate withdrawal limit."
            />

            <GalaxyAllocations />

            <section className={`${card} p-6 sm:p-7`}>
              <h2 className="text-lg font-semibold">
                From USDC to your tokenized position
              </h2>

              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                {[
                  {
                    icon: Wallet,
                    title: 'Deposit into the Galaxy vault',
                    text: 'A completed deposit transfers USDC out of your wallet through the MetaWork Tokenizer and its adapter into the underlying Galaxy USDC Enhanced vault on Ethereum. Connecting your wallet alone does not deposit funds.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Receive position tokens',
                    text: `Receive ${positionSymbol} tokens in your wallet. These record your proportional interest in the Tokenizer as its assets participate in the underlying lending strategy.`,
                  },
                  {
                    icon: ArrowDownLeft,
                    title: 'Track and redeem',
                    text: 'Track your token balance and estimated USDC value. That value changes with performance, fees, and losses. Redeem your entire wallet-owned position, subject to available liquidity.',
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

            <section className={`${card} p-6 sm:p-7`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    Clear fees. No guesswork.
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    MetaWork’s performance fee applies to
                    yield—not your initial deposit.
                  </p>
                </div>

                <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs text-sky-300">
                  Tokenizer fee configuration
                </span>
              </div>

              <dl className="mt-6 divide-y divide-white/[0.06]">
                {fees.map(([label, value]) => (
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
                fees and before MetaWork’s performance fee, the
                MetaWork fee is {performanceFeePercent} USDC.
                You retain {100 - performanceFeePercent} USDC
                before network costs. This is an illustration,
                not a return forecast.
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Underlying vault fees are reported separately and
                may change. An annual management fee accrues
                against invested assets, not just earnings.
                Underlying vault APY is not a customer net APY
                quote after MetaWork’s fee and network costs.
              </p>
            </section>

            <GalaxyDisclosures product="enhanced" />

            
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <GalaxyDepositFlow assetSymbol="USDC" />
            <EthereumWalletPanel />

            <section className={`${card} space-y-3 px-6 py-5`}>
              <h2 className="mb-4 text-sm font-medium">
                Your tokenized position
              </h2>

              {[
                'USDC deposits on Ethereum mainnet',
                `${positionSymbol} position tokens in your wallet`,
                `${performanceFeePercent}% MetaWork performance fee on yield`,
                'Entire-position redemption through this interface',
                'Withdrawals subject to available liquidity',
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

              <p className="border-t border-white/[0.06] pt-4 text-xs leading-5 text-slate-500">
                MetaWork Tokenizer · Ethereum. Use the wallet
                controls above; do not send tokens directly to
                contract addresses.
              </p>
            </section>

            <p className="px-3 text-center text-[11px] leading-5 text-slate-600">
              Not an insured savings account. Capital is at risk.
              Returns are not guaranteed.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}