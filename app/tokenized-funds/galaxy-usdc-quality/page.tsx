// app/tokenized-funds/galaxy-usdc-quality/page.tsx

import Link from 'next/link';
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

import GalaxyMetrics from '../../../components/tokenized-funds/galaxy/GalaxyMetrics';
import { GALAXY_QUALITY } from '../../../lib/tokenized-funds/galaxy-quality/config';
import { getQualityMetrics } from '../../../lib/tokenized-funds/galaxy-quality/data';
import BaseWalletPanel from '../../../components/tokenized-funds/galaxy-quality/BaseWalletPanel';
import QualityDisclosures from '../../../components/tokenized-funds/galaxy-quality/QualityDisclosures';

export const metadata = {
  title: 'Galaxy USDC Quality Tokenizer on Base | MetaWork',
  description:
    'Access Galaxy USDC Quality on Base through the MetaWork Tokenizer. Explore position tokens, underlying vault metrics, fees, liquidity, and risks.',
};

export const revalidate = 60;

const card =
  'rounded-3xl border border-white/[0.08] bg-white/[0.025]';

function percentage(value: number | null | undefined) {
  if (value == null) return 'Unavailable';

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function GalaxyQualityPage() {
  const vault = GALAXY_QUALITY;
  const metrics = await getQualityMetrics();

  const performanceFeePercent = vault.performanceFeeBps / 100;
  const managementFeePercent = vault.managementFeeBps / 100;

  const publicDepositsEnabled =
    vault.depositsEnabled &&
    process.env.NEXT_PUBLIC_GALAXY_QUALITY_DEPOSITS === 'true';

  const publicRedemptionsEnabled =
    process.env.NEXT_PUBLIC_GALAXY_QUALITY_REDEMPTIONS === 'true';

  const availabilityLabel = publicDepositsEnabled
    ? 'Deposits enabled'
    : publicRedemptionsEnabled
      ? 'New deposits paused'
      : 'Public transactions disabled';

  const availabilityDescription = publicDepositsEnabled
    ? 'Use the connected-wallet controls above to receive position tokens through the MetaWork Tokenizer. Withdrawals depend on available liquidity.'
    : publicRedemptionsEnabled
      ? 'The redemption interface remains available for existing position tokens, subject to available liquidity.'
      : 'Public deposits and redemptions are disabled in this interface.';

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
    ['Network costs', 'Variable ETH gas fees on Base'],
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
                MetaWork Tokenizer
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {vault.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs text-blue-200">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              Base
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
                  MetaWork’s Tokenizer gives you tokenized access to
                  Galaxy USDC Quality on Base. Deposit USDC to receive
                  position tokens representing your share of assets
                  held through the Tokenizer.
                </p>

                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">
                  Galaxy curates the underlying lending strategy.
                  MetaWork provides the Tokenizer and the interface
                  for deposits, position tracking, and redemption.
                </p>

                <div className="mt-8 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-3">
                  {[
                    ['Asset', 'USDC on Base'],
                    ['Position token', vault.wrapperSymbol],
                    [
                      'MetaWork fee',
                      `${performanceFeePercent}% of yield`,
                    ],
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

            <section className={`${card} p-6 sm:p-7`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Layers3
                      className="h-4 w-4 text-sky-400"
                      aria-hidden="true"
                    />
                    Where your USDC works
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Tokenized access to Galaxy USDC Quality—a separate
                    strategy from Galaxy USDC Enhanced.
                  </p>
                </div>

                <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-slate-400">
                  Strategy overview
                </span>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {[
                  [
                    'Curated collateral markets',
                    'Galaxy selects lending markets within the underlying Quality vault. Collateral supports borrowing, but does not eliminate losses.',
                  ],
                  [
                    'Borrower-paid interest',
                    'Yield comes from interest paid by borrowers. Rates and market allocations can change over time.',
                  ],
                  [
                    'Your position tokens',
                    `Deposits into the MetaWork Tokenizer receive ${vault.wrapperSymbol} position tokens. These represent your proportional interest in the Tokenizer, not direct ownership of borrower collateral.`,
                  ],
                  [
                    'Shared underlying liquidity',
                    'Redeeming position tokens for USDC depends on available underlying liquidity. Your position value can exceed the amount immediately withdrawable.',
                  ],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
                  >
                    <h3 className="text-sm font-medium text-sky-200">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {text}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-xs leading-5 text-slate-500">
                Detailed collateral allocation percentages are not
                displayed. The strategy overview is descriptive, not
                a live holdings breakdown.
              </p>
            </section>

            <section className={`${card} p-6 sm:p-7`}>
              <h2 className="text-lg font-semibold">
                From USDC to your tokenized position
              </h2>

              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                {[
                  {
                    icon: Wallet,
                    title: 'Deposit through the Tokenizer',
                    text: 'Use your own wallet and USDC on Base. The MetaWork Tokenizer routes deposits through its adapter into the underlying Galaxy USDC Quality vault.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Receive position tokens',
                    text: `Receive ${vault.wrapperSymbol} tokens in your wallet. Galaxy’s underlying strategy allocates the deposited assets to curated, collateral-backed lending markets.`,
                  },
                  {
                    icon: ArrowDownLeft,
                    title: 'Track and redeem',
                    text: 'Track your token balance and its USDC asset value. That value changes with underlying performance, fees, and any losses. Redeem for USDC subject to available liquidity.',
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

                    <h3 className="mt-4 text-sm font-medium">
                      {title}
                    </h3>

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
                    MetaWork’s performance fee applies to yield—not
                    your initial deposit.
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
                MetaWork fee is {performanceFeePercent} USDC. You
                retain {100 - performanceFeePercent} USDC before
                network costs. This is an illustration, not a
                return forecast.
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Underlying vault fees are reported separately and may
                change. The displayed underlying APY is before
                MetaWork’s performance fee and excludes incentives.
                It is not a customer net APY quote.
              </p>
            </section>

            <QualityDisclosures />

            <section className={`${card} divide-y divide-white/[0.06] px-6 sm:px-7`}>
              <details className="py-5">
                <summary className="cursor-pointer text-sm font-medium">
                  Position tokens & redemption
                </summary>

                <p className="mt-4 text-sm leading-7 text-slate-400">
                  Your {vault.wrapperSymbol} position tokens
                  represent your proportional interest in the
                  MetaWork Tokenizer. The position panel shows your
                  token balance and its current USDC asset value.
                  That value is not a guaranteed withdrawal quote
                  and does not represent a fixed USDC amount per token.
                </p>

                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Position tokens provide access to the underlying
                  vault through the Tokenizer. They do not represent
                  direct ownership of borrower collateral or a
                  guarantee from MetaWork, Galaxy, or Morpho.
                </p>
              </details>

              <details className="py-5">
                <summary className="cursor-pointer text-sm font-medium">
                  Withdrawals & liquidity
                </summary>

                <p className="mt-4 text-sm leading-7 text-slate-400">
                  USDC withdrawals depend on available underlying
                  liquidity. Instant withdrawal is not guaranteed.
                  The withdrawal panel currently supports redemption
                  of all position tokens held by your connected
                  wallet. Special exit routes, including forced
                  deallocation and in-kind redemption, are not
                  available through this interface.
                </p>
              </details>

              <details className="py-5">
                <summary className="cursor-pointer text-sm font-medium">
                  Base network & deposit asset
                </summary>

                <p className="mt-4 text-sm leading-7 text-slate-400">
                  This product is on Base, not Ethereum mainnet.
                  Wallet transactions must use chain ID 8453.
                  The deposit asset is USDC at the address below.
                  Use the connected-wallet controls to deposit;
                  do not send tokens directly to displayed
                  contract addresses.
                </p>

                <p className="mt-3 break-all font-mono text-xs leading-6 text-slate-300">
                  {vault.assetAddress}
                </p>
              </details>

              <details className="py-5">
                <summary className="cursor-pointer text-sm font-medium">
                  Infrastructure & product terms
                </summary>

                <dl className="mt-4 space-y-4 text-sm">
                  {[
                    ['Underlying strategy', 'Galaxy USDC Quality'],
                    ['Strategy curator', 'Galaxy'],
                    ['Access layer', 'MetaWork Tokenizer'],
                    ['Infrastructure', 'Morpho Vault V2 · Base'],
                    ['Underlying vault', vault.underlyingVault],
                    [
                      'MetaWork Tokenizer contract',
                      vault.wrapperAddress ?? 'Not configured',
                    ],
                    ['Position token symbol', vault.wrapperSymbol],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="mt-1 break-all leading-6 text-slate-300">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 text-xs leading-6 text-slate-500">
                  The MetaWork Tokenizer uses a fee-wrapper vault
                  architecture over the underlying Galaxy USDC
                  Quality vault. “Tokenizer” is MetaWork’s
                  customer-facing name for this access layer.
                  It does not mean MetaWork originates Galaxy’s
                  strategy or directly tokenizes borrower collateral.
                </p>

                <p className="mt-3 text-xs leading-6 text-slate-500">
                  The Tokenizer and underlying vault have separate
                  contracts, permissions, and fee settings. Review
                  the applicable terms, administrator permissions,
                  fees, and withdrawal limitations before depositing.
                </p>
              </details>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6">
            <section className="overflow-hidden rounded-3xl border border-sky-400/20 bg-[#101827] shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
                <div>
                  <h2 className="font-semibold">
                    Your tokenized position
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    MetaWork Tokenizer · Base
                  </p>
                </div>

                <Wallet
                  className="h-4 w-4 text-slate-500"
                  aria-hidden="true"
                />
              </div>

              <div className="p-6">
                <BaseWalletPanel />
              </div>

              <div className="space-y-3 border-t border-white/[0.06] px-6 py-5">
                {[
                  'USDC deposits on Base',
                  `${vault.wrapperSymbol} position tokens in your wallet`,
                  `${performanceFeePercent}% MetaWork performance fee on yield`,
                  'Redemptions subject to available liquidity',
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

              <div className="border-t border-white/[0.06] bg-black/10 px-6 py-4">
                <p
                  className={`text-xs font-medium ${
                    publicDepositsEnabled
                      ? 'text-sky-300'
                      : 'text-amber-300'
                  }`}
                >
                  {availabilityLabel}
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {availabilityDescription} Do not send tokens
                  directly to contract addresses.
                </p>
              </div>
            </section>

            <p className="px-3 pt-4 text-center text-[11px] leading-5 text-slate-600">
              Not an insured savings account. Capital is at risk.
              Returns are not guaranteed.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}