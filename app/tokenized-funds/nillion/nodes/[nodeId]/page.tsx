// app/tokenized-funds/nillion/nodes/[nodeId]/page.tsx

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isAddress } from 'viem';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import EthereumWalletSelector from '../../../../../components/tokenized-funds/nillion/EthereumWalletSelector';

type Investor = {
  wallet: string;
  stakeBaseUnits: string;
  participationBps: string;
  estimatedPendingBaseUnits: string;
};

type NodeData = {
  nodeId: string;
  name: string;
  owner: string;
  stakeBaseUnits: string;
  blockNumber: string;
  fetchedAt: string;

	principalPerformance:
    | {
        available: false;
        message: string;
      }
    | {
        available: true;
        node: {
          currency: 'usd';
          usdDecimals: number;
          originalStakeBaseUnits: string;
          baselinePriceUsd: string;
          currentPriceUsd: string;
          startingValueUsdAtomic: string;
          currentValueUsdAtomic: string;
          appreciationUsdAtomic: string;
          priceReturnBps: string;
          direction: 'gain' | 'loss' | 'unchanged';
          includesRewardTokens: false;
        };
      };

  status: {
    earning: boolean;
    enrolled: boolean;
    stakeEligible: boolean;
    keyValid: boolean;
    retired: boolean;
    stakeSynced: boolean;
  };

  unbonding: {
    amountBaseUnits: string;
    releaseTime: string;
  }[];

  rewards: {
    grossPendingBaseUnits: string;
    estimatedInvestorPendingBaseUnits: string;
    canShowInvestorEstimates: boolean;
    operatingCostsIncluded: boolean;

    investors: Investor[];
    warnings: string[];

    projections: {
      grossAprBps: string;
      investorAprAfterFeeBps: string;
      investorDailyAfterFeeBaseUnits: string;
      investorWeeklyAfterFeeBaseUnits: string;
      investorYearlyAfterFeeBaseUnits: string;
    };
  };
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

function formatApr(value: string | undefined) {
  if (value === undefined) return '—';

  const bps = BigInt(value);
  const scale = BigInt('100');
  const whole = bps / scale;
  const fraction = (bps % scale).toString().padStart(2, '0');

  return `${whole}.${fraction}%`;
}

function formatUsdAtomic(value: string, signed = false) {
  const amount = BigInt(value);
  const zero = BigInt('0');
  const absolute = amount < zero ? -amount : amount;

  // Convert millionths of a dollar to cents, rounded to nearest cent.
  const cents =
    (absolute + BigInt('5000')) / BigInt('10000');

  const whole = cents / BigInt('100');
  const fraction = (cents % BigInt('100'))
    .toString()
    .padStart(2, '0');

  const sign =
    amount < zero
      ? '−'
      : signed && amount > zero
        ? '+'
        : '';

  return `${sign}$${whole.toLocaleString('en-US')}.${fraction}`;
}

function formatSignedReturn(value: string) {
  const bps = BigInt(value);
  const zero = BigInt('0');
  const absolute = bps < zero ? -bps : bps;

  const whole = absolute / BigInt('100');
  const fraction = (absolute % BigInt('100'))
    .toString()
    .padStart(2, '0');

  const sign = bps < zero ? '−' : bps > zero ? '+' : '';

  return `${sign}${whole}.${fraction}%`;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  const isNil = value.endsWith(' NIL');
  const displayValue = isNil ? value.slice(0, -4) : value;

  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>

      <div
        title={value}
        className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1"
      >
        <span className="whitespace-nowrap text-xl font-semibold tabular-nums tracking-tight">
          {displayValue}
        </span>

        {isNil && (
          <span className="text-sm font-normal text-slate-400">
            NIL
          </span>
        )}
      </div>

      {detail && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {detail}
        </p>
      )}
    </div>
  );
}

export default function NillionNodePage() {
  const { nodeId } = useParams<{ nodeId: string }>();

  const [node, setNode] = useState<NodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [walletInput, setWalletInput] = useState('');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    const wallet = new URLSearchParams(
      window.location.search,
    ).get('wallet');

    if (wallet && isAddress(wallet, { strict: false })) {
      setWalletInput(wallet);
      setSelectedWallet(wallet);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;

    setNode(null);
    setLoading(true);
    setError(null);

    async function load() {
      controller = new AbortController();

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
            body.error || 'Unable to load live node data.',
          );
        }

        const match = body.nodes?.find(
          (entry: NodeData) => entry.nodeId === nodeId,
        );

        if (!match) {
          const nodeError = body.errors?.find(
            (entry: { nodeId: string }) => entry.nodeId === nodeId,
          );

          throw new Error(
            nodeError
              ? 'This node is temporarily unavailable.'
              : 'Node not found.',
          );
        }

        if (!disposed) {
          setNode(match);
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
        if (!disposed) {
          setLoading(false);
          timer = setTimeout(() => void load(), 60_000);
        }
      }
    }

    void load();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [nodeId]);

  function handleWalletSelection(address: string | null) {
    const wallet = address ?? '';

    setWalletInput(wallet);
    setSelectedWallet(wallet);
    setWalletError(null);

    const url = new URL(window.location.href);

    if (address) {
        url.searchParams.set('wallet', address);
    } else {
        url.searchParams.delete('wallet');
    }

    window.history.replaceState(null, '', url.toString());
    }

  function lookUpWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const wallet = walletInput.trim();

    if (!isAddress(wallet, { strict: false })) {
      setWalletError('Enter a valid Ethereum wallet address.');
      return;
    }

    setWalletError(null);
    setSelectedWallet(wallet);

    const url = new URL(window.location.href);
    url.searchParams.set('wallet', wallet);
    window.history.replaceState(null, '', url.toString());
  }

  const investor = node?.rewards.investors.find(
    (entry) =>
      entry.wallet.toLowerCase() === selectedWallet.toLowerCase(),
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/tokenized-funds/nillion"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All Nillion nodes
        </Link>

        <header className="mt-8">
          <p className="text-sm uppercase tracking-widest text-blue-400">
            Nillion Fund
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            {node?.name || `Nillion Node #${nodeId}`}
          </h1>
          {node && (
            <p
              className={`mt-4 text-sm ${
                node.status.earning
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            >
              {node.status.earning
                ? 'Currently earning NIL emissions'
                : 'Not currently eligible to earn NIL emissions'}
            </p>
          )}
        </header>

        {loading && (
          <p className="mt-8 text-slate-400">
            Loading live node data…
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {error}
            {node && (
              <p className="mt-2">
                Showing the last successful snapshot. Figures may be stale.
              </p>
            )}
          </div>
        )}

        {node && (
          <>
            <section
							aria-label="Node earnings"
							className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
						>
							<Metric
								label="Node stake"
								value={`${formatNil(node.stakeBaseUnits)} NIL`}
								detail="Total bonded stake recorded on-chain."
							/>

							<Metric
								label="All-time gross earnings"
								value={`${formatNil(
									node.rewards.grossPendingBaseUnits,
								)} NIL`}
								detail="Before fees and operating costs. No rewards have been claimed to date."
							/>

							<Metric
								label="Ownership earnings to date"
								value={`${formatNil(
									node.rewards.estimatedInvestorPendingBaseUnits,
								)} NIL`}
								detail="Combined across all ownership positions, after the management fee and before operating costs."
							/>

							<Metric
								label="Gross APR"
								value={formatApr(
									node.rewards.projections.grossAprBps,
								)}
								detail="Annualized NIL emissions relative to node stake, before fees and costs."
							/>

							<Metric
								label="APR after management fee"
								value={formatApr(
									node.rewards.projections.investorAprAfterFeeBps,
								)}
								detail="Ownership-based yield after the management fee, before operating costs."
							/>

							{node.principalPerformance?.available ? (
                <Metric
                  label="Principal appreciation / depreciation"
                  value={`${formatUsdAtomic(
                    node.principalPerformance.node.appreciationUsdAtomic,
                    true,
                  )} (${formatSignedReturn(
                    node.principalPerformance.node.priceReturnBps,
                  )})`}
                  detail={`Original principal: ${formatUsdAtomic(
                    node.principalPerformance.node.startingValueUsdAtomic,
                  )} at the starting baseline → ${formatUsdAtomic(
                    node.principalPerformance.node.currentValueUsdAtomic,
                  )} at the current NIL price. Excludes reward tokens.`}
                />
              ) : (
                <Metric
                  label="Principal appreciation / depreciation"
                  value="Unavailable"
                  detail={
                    node.principalPerformance?.available === false
                      ? node.principalPerformance.message
                      : 'Principal price performance is temporarily unavailable.'
                  }
                />
              )}
						</section>

						<section className="mt-8">
							<h2 className="text-xl font-semibold">
								Projected ownership earnings
							</h2>

							<p className="mt-2 text-sm leading-6 text-slate-400">
								Combined across all ownership positions after the management
								fee, before operating costs. These are estimates assuming
								current network conditions and eligibility continue.
							</p>

							<div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
								<Metric
									label="Daily"
									value={`${formatNil(
										node.rewards.projections.investorDailyAfterFeeBaseUnits,
									)} NIL`}
								/>

								<Metric
									label="Weekly"
									value={`${formatNil(
										node.rewards.projections.investorWeeklyAfterFeeBaseUnits,
									)} NIL`}
								/>

								<Metric
									label="Yearly"
									value={`${formatNil(
										node.rewards.projections.investorYearlyAfterFeeBaseUnits,
									)} NIL`}
									detail="Annual projection uses 365 days."
								/>
							</div>
						</section>

            {node.rewards.warnings.length > 0 && (
              <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <ul className="space-y-2 text-sm leading-6 text-amber-300">
                  {node.rewards.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">
                Your investment
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Enter the Ethereum receiving wallet recorded for your
                investment. This is a public, read-only lookup—not a
                login or proof of wallet ownership.
              </p>

							<EthereumWalletSelector
								onAddressChange={handleWalletSelection}
							/>

							<p className="mt-6 text-sm text-slate-400">
								Or look up any receiving address manually:
							</p>

              <form
                onSubmit={lookUpWallet}
                className="mt-5 flex flex-col gap-3 sm:flex-row"
              >
                <div className="flex-1">
                  <label htmlFor="investor-wallet" className="sr-only">
                    Ethereum wallet address
                  </label>
                  <input
                    id="investor-wallet"
                    value={walletInput}
                    onChange={(event) =>
                      setWalletInput(event.target.value)
                    }
                    placeholder="0x..."
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(walletError)}
                    aria-describedby={
                      walletError ? 'wallet-error' : undefined
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-400"
                  />
                </div>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  View my earnings
                </button>
              </form>

              {walletError && (
                <p
                  id="wallet-error"
                  role="alert"
                  className="mt-3 text-sm text-red-300"
                >
                  {walletError}
                </p>
              )}

              {selectedWallet && (
                <div className="mt-6" aria-live="polite">
                  <p className="break-all text-xs text-slate-500">
                    Viewing: {selectedWallet}
                  </p>

                  {!node.rewards.canShowInvestorEstimates ? (
                    <p className="mt-3 text-sm leading-6 text-amber-300">
                      Investor estimates are unavailable until this
                      node’s allocation records and chain checks reconcile.
                    </p>
                  ) : investor ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <Metric
                        label="Your allocated stake"
                        value={`${formatNil(
                          investor.stakeBaseUnits,
                        )} NIL`}
                      />
                      <Metric
                        label="Your participation"
                        value={`${(
                          Number(investor.participationBps) / 100
                        ).toFixed(2)}%`}
                        detail="Percentage shown rounded down to two decimals."
                      />
                      <Metric
                        label="Your estimated pending earnings"
                        value={`${formatNil(
                          investor.estimatedPendingBaseUnits,
                        )} NIL`}
                        detail={
                          node.rewards.operatingCostsIncluded
                            ? 'After the management fee and entered operating costs. Not a confirmed payout.'
                            : 'After the management fee, before operating costs. Not a confirmed payout.'
                        }
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-300">
                      No investment allocation found for this wallet
                      on this node.
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-xl font-semibold">Node details</h2>

              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-slate-400">Operating wallet</dt>
                  <dd className="mt-1">
                    <a
                      href={`https://etherscan.io/address/${node.owner}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-2 text-blue-400 hover:text-blue-300"
                    >
                      <span className="break-all">{node.owner}</span>
                      <ExternalLink
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-400">Snapshot block</dt>
                  <dd className="mt-1">{node.blockNumber}</dd>
                </div>

                <div>
                  <dt className="text-slate-400">Last refreshed</dt>
                  <dd className="mt-1">
                    {new Date(node.fetchedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>

              {node.unbonding.length > 0 && (
                <div className="mt-5 rounded-xl border border-amber-500/30 p-4 text-sm text-amber-300">
                  <p>Stake is in the unbonding process:</p>
                  <ul className="mt-2 space-y-2">
                    {node.unbonding.map((tranche, index) => (
                      <li key={`${tranche.releaseTime}-${index}`}>
                        {formatNil(tranche.amountBaseUnits)} NIL —
                        release time:{' '}
                        {new Date(
                          Number(tranche.releaseTime) * 1000,
                        ).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="mt-10 border-t border-slate-800 pt-6">
              <h2 className="text-xl font-semibold">
                Claims and distributions
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Historical claims and confirmed payout tracking are
                not yet connected. Pending rewards above are not
                a record of payments received.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}