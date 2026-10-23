// app/tokenized-funds/nillion/nodes/[nodeId]/page.tsx


'use client';


import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isAddress } from 'viem';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import EthereumWalletSelector from '../../../../../components/tokenized-funds/nillion/EthereumWalletSelector';
import { calculateNillionPrincipalPerformance } from '../../../../../lib/tokenized-funds/nillion/principal-performance.js';

type Investor = {
  wallet: string;
  stakeBaseUnits: string;
  participationBps: string;
  estimatedPendingBaseUnits: string;
};

type Position = {
  id: string;
  wallet: string | null;
  stakeBaseUnits: string;
  participationBps: string;
  estimatedPendingBaseUnits: string;
  grossShareBaseUnits: string;
  operatingCostsShareBaseUnits: string;
  managementFeeShareBaseUnits: string;
  projections: {
    dailyGrossBaseUnits: string;
    dailyManagementFeeBaseUnits: string;
    dailyAfterFeeBaseUnits: string;
    weeklyGrossBaseUnits: string;
    weeklyManagementFeeBaseUnits: string;
    weeklyAfterFeeBaseUnits: string;
    yearlyGrossBaseUnits: string;
    yearlyManagementFeeBaseUnits: string;
    yearlyAfterFeeBaseUnits: string;
  };
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

		managementFeeBps: number;
    positions: Position[];
		investors: Investor[];
    warnings: string[];


    projections: {
			grossDailyBaseUnits: string;
      grossWeeklyBaseUnits: string;
      grossYearlyBaseUnits: string;
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

function BreakdownRow({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between ${
        emphasis ? 'font-semibold text-white' : 'text-slate-300'
      }`}
    >
      <div className="min-w-0">
        <dt className="text-sm">{label}</dt>
        {note && (
          <p className="mt-0.5 text-xs font-normal leading-5 text-slate-500">
            {note}
          </p>
        )}
      </div>
      <dd className="whitespace-nowrap text-base tabular-nums">
        {value}
      </dd>
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
  const [purchasePriceUsd, setPurchasePriceUsd] = useState('');
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


  const position = node?.rewards.positions?.find(
    (entry) =>
      entry.wallet !== null &&
      entry.wallet.toLowerCase() === selectedWallet.toLowerCase(),
  );

	const currentPriceUsd = node?.principalPerformance?.available
    ? node.principalPerformance.node.currentPriceUsd
    : null;

  let personalPrincipalPerformance:
    | ReturnType<typeof calculateNillionPrincipalPerformance>
    | null = null;

  let purchasePriceError: string | null = null;

  if (position && currentPriceUsd && purchasePriceUsd.trim()) {
    const enteredPrice = purchasePriceUsd.trim();
    const price = enteredPrice.startsWith('.')
      ? `0${enteredPrice}`
      : enteredPrice;

    if (!/^\d+(?:\.\d{1,18})?$/.test(price)) {
      purchasePriceError =
        'Enter your USD purchase price per NIL, such as 0.10.';
    } else {
      try {
        personalPrincipalPerformance =
          calculateNillionPrincipalPerformance({
            originalStakeBaseUnits: position.stakeBaseUnits,
            baselinePriceUsd: price,
            currentPriceUsd,
          });
      } catch {
        purchasePriceError =
          'Enter a purchase price greater than zero.';
      }
    }
  }
	
  const projectionRows = position
    ? [
        {
          label: 'Daily',
          gross: position.projections.dailyGrossBaseUnits,
          fee: position.projections.dailyManagementFeeBaseUnits,
          net: position.projections.dailyAfterFeeBaseUnits,
        },
        {
          label: 'Weekly',
          gross: position.projections.weeklyGrossBaseUnits,
          fee: position.projections.weeklyManagementFeeBaseUnits,
          net: position.projections.weeklyAfterFeeBaseUnits,
        },
        {
          label: 'Yearly',
          gross: position.projections.yearlyGrossBaseUnits,
          fee: position.projections.yearlyManagementFeeBaseUnits,
          net: position.projections.yearlyAfterFeeBaseUnits,
        },
      ]
    : [];
	

  const investorWarningPattern =
    /investor|position|management fee|allocation/i;

  const nodeWarnings =
    node?.rewards.warnings.filter(
      (warning) => !investorWarningPattern.test(warning),
    ) ?? [];

  const investorWarnings =
    node?.rewards.warnings.filter((warning) =>
      investorWarningPattern.test(warning),
    ) ?? [];	

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

				<div
          role="note"
          className="mt-6 rounded-2xl border-2 border-blue-400 bg-blue-500/10 p-5 sm:p-6"
        >
          <p className="text-xl font-bold uppercase tracking-wide text-blue-200 sm:text-2xl">
            In-kind rewards — paid in NIL, not USD
          </p>
          <p className="mt-3 text-base font-semibold leading-7 text-slate-100">
            All reward estimates and APR figures shown here are
            NIL-denominated. APR represents estimated additional NIL
            relative to NIL staked—not a USD return.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            NIL’s market price can rise or fall. Earning more NIL does
            not guarantee that your investment’s USD value will increase.
            Principal price changes are shown separately from rewards.
          </p>
        </div>

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
              aria-labelledby="node-performance-heading"
              className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h2
                id="node-performance-heading"
                className="text-2xl font-semibold"
              >
                Node Performance
              </h2>


              <div
                role="note"
                className="mt-4 rounded-xl border-2 border-amber-400/60 bg-amber-400/10 p-4"
              >
                <p className="text-sm font-bold uppercase tracking-wide text-amber-300">
                  These are NOT individual earnings
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-100">
                  Everything in this section describes the node itself. It is
                  not what you or any investor earns. To see your personal
                  earnings, you must{' '}
                  <a
                    href="#your-investment"
                    className="font-semibold underline hover:text-white"
                  >
                    connect your wallet
                  </a>{' '}
                  in the “Your investment” section below.
                </p>
              </div>


              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Metric
                  label="Total node stake"
                  value={`${formatNil(node.stakeBaseUnits)} NIL`}
                  detail="All NIL bonded to this node, recorded on-chain. Not your stake."
                />


                <Metric
                  label="Node NIL rewards earned"
                  value={`${formatNil(
                    node.rewards.grossPendingBaseUnits,
                  )} NIL`}
                  detail="Total NIL emissions the node has earned and not yet claimed. Gross figure for the whole node, before any fees or costs. Not your earnings."
                />


                <Metric
                  label="Node gross APR"
                  value={formatApr(
                    node.rewards.projections.grossAprBps,
                  )}
                  detail="Annualized NIL emissions relative to node stake, before any fees or costs. An estimate, not a promised return."
                />
              </div>


              <h3 className="mt-8 text-lg font-semibold">
                Node emissions projection
              </h3>


              <p className="mt-2 text-sm leading-6 text-slate-400">
                Projected gross NIL emissions for the whole node, before any
                fees or costs, assuming current network conditions and
                eligibility continue. Not your earnings.
              </p>


              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Metric
                  label="Node daily projection"
                  value={`${formatNil(
                    node.rewards.projections.grossDailyBaseUnits,
                  )} NIL`}
                />


                <Metric
                  label="Node weekly projection"
                  value={`${formatNil(
                    node.rewards.projections.grossWeeklyBaseUnits,
                  )} NIL`}
                />


                <Metric
                  label="Node yearly projection"
                  value={`${formatNil(
                    node.rewards.projections.grossYearlyBaseUnits,
                  )} NIL`}
                  detail="Annual projection uses 365 days."
                />
              </div>


              {nodeWarnings.length > 0 && (
                <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <ul className="space-y-2 text-sm leading-6 text-amber-300">
                    {nodeWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>


            <section
              id="your-investment"
              className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h2 className="text-xl font-semibold">
                Your investment
              </h2>


              <div
                role="note"
                className="mt-4 rounded-xl border-2 border-blue-400/60 bg-blue-400/10 p-4"
              >
                <p className="text-sm font-bold uppercase tracking-wide text-blue-300">
                  Connect your wallet to see your earnings
                </p>
                <p className="mt-1 text-sm leading-6 text-blue-100">
                  Your personal figures appear only after you connect or
                  enter the receiving wallet recorded for your investment.
                  This is a public, read-only lookup—not a login or proof of
                  wallet ownership.
                </p>
              </div>


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
                  View my investment
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
                  ) : position ? (
                    <>
                      <h3 className="mt-4 text-lg font-semibold">
                        Your investment report — Node #{node.nodeId}
                      </h3>


                      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <Metric
                          label="Your recorded stake"
                          value={`${formatNil(
                            position.stakeBaseUnits,
                          )} NIL`}
                          detail="Your recorded pool interest in this node."
                        />
                        <Metric
                          label="Your share of this node"
                          value={formatApr(position.participationBps)}
                          detail="Percentage shown rounded down to two decimals."
                        />
                        <Metric
                          label="Estimated investor APR"
                          value={formatApr(
                            node.rewards.projections.investorAprAfterFeeBps,
                          )}
                          detail="Annualized estimate after the management fee, before operating costs. An estimate, not a promised return."
                        />
                      </div>


                      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
                        <h4 className="text-base font-semibold">
                          Your estimated pending rewards
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Your share of this node’s unclaimed NIL rewards,
                          step by step. Estimates only—not payments
                          received.
                        </p>


                        <dl className="mt-3 divide-y divide-slate-800">
                          <BreakdownRow
                            label="Your share of node rewards"
                            value={`${formatNil(
                              position.grossShareBaseUnits,
                            )} NIL`}
                            note="Your percentage of the node’s total pending NIL, before any deductions."
                          />
                          <BreakdownRow
                            label={`Management fee (${
                              node.rewards.managementFeeBps / 100
                            }%)`}
                            value={`−${formatNil(
                              position.managementFeeShareBaseUnits,
                            )} NIL`}
                            note="The management fee retained from your share of node rewards. This estimate is not a payment already made."
                          />
                          <BreakdownRow
                            label="Your estimated pending rewards"
                            value={`${formatNil(
                              position.estimatedPendingBaseUnits,
                            )} NIL`}
                            emphasis
                          />
                        </dl>
                      </div>

											<section
                        aria-labelledby="personal-principal-heading"
                        className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-5"
                      >
                        <h4
                          id="personal-principal-heading"
                          className="text-lg font-semibold"
                        >
                          Your principal value calculator
                        </h4>

                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          We do not know what you paid for your NIL.
                          Enter your purchase price per NIL—or your
                          average price if you bought at multiple prices.
                          This calculator applies that price to your
                          recorded stake on this node.
                        </p>

                        <div className="mt-4 max-w-sm">
                          <label
                            htmlFor="nil-purchase-price"
                            className="block text-sm font-medium text-slate-300"
                          >
                            Your purchase price per NIL (USD)
                          </label>

                          <input
                            id="nil-purchase-price"
                            type="text"
                            inputMode="decimal"
                            value={purchasePriceUsd}
                            onChange={(event) =>
                              setPurchasePriceUsd(event.target.value)
                            }
                            placeholder="For example: 0.10"
                            maxLength={40}
                            autoComplete="off"
                            spellCheck={false}
                            aria-invalid={Boolean(purchasePriceError)}
                            aria-describedby={
                              purchasePriceError
                                ? 'nil-purchase-price-help nil-purchase-price-error'
                                : 'nil-purchase-price-help'
                            }
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-400"
                          />

                          <p
                            id="nil-purchase-price-help"
                            className="mt-2 text-xs leading-5 text-slate-500"
                          >
                            Enter USD per token, not your total investment.
                            This input is not saved to your investment record.
                          </p>

                          {purchasePriceError && (
                            <p
                              id="nil-purchase-price-error"
                              role="alert"
                              className="mt-2 text-sm text-red-300"
                            >
                              {purchasePriceError}
                            </p>
                          )}
                        </div>

                        {!currentPriceUsd ? (
                          <p className="mt-4 text-sm text-amber-300">
                            The current NIL price is temporarily unavailable.
                            Your stake and reward estimates remain separate
                            from this calculator.
                          </p>
                        ) : (
                          <p className="mt-4 text-sm text-slate-400">
                            Current dashboard quote: ${currentPriceUsd} per NIL.
                          </p>
                        )}

                        <div aria-live="polite">
                          {personalPrincipalPerformance && (
                            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              <Metric
                                label="Stake value at your purchase price"
                                value={formatUsdAtomic(
                                  personalPrincipalPerformance.startingValueUsdAtomic,
                                )}
                                detail={`Based on ${formatNil(
                                  position.stakeBaseUnits,
                                  6,
                                )} NIL recorded for this position.`}
                              />

                              <Metric
                                label="Stake value at the current price"
                                value={formatUsdAtomic(
                                  personalPrincipalPerformance.currentValueUsdAtomic,
                                )}
                                detail="Estimated market value of the same NIL stake. Not a withdrawal balance."
                              />

                              <Metric
                                label="Estimated unrealized price gain / loss"
                                value={`${formatUsdAtomic(
                                  personalPrincipalPerformance.appreciationUsdAtomic,
                                  true,
                                )} (${formatSignedReturn(
                                  personalPrincipalPerformance.priceReturnBps,
                                )})`}
                                detail="Price movement only. Excludes reward tokens, fees, and transaction costs."
                              />
                            </div>
                          )}
                        </div>

                        <p className="mt-4 text-xs leading-5 text-slate-500">
                          This is an illustration using your entered price
                          and recorded stake—not a verified cost basis,
                          total investment return, or guaranteed resale value.
                          It does not change your stake or reward allocation.
                        </p>
                      </section>

                      <h4 className="mt-6 text-base font-semibold">
                        Your estimated future rewards
                      </h4>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Based on current network conditions continuing.
                        Estimates, not guarantees. Annual projection uses
                        365 days.
                      </p>


                      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                        <table className="w-full min-w-[32rem] text-left text-sm">
                          <caption className="sr-only">
                            Your estimated future rewards before the
                            management fee, the fee amount, and after the
                            fee
                          </caption>
                          <thead className="text-xs text-slate-400">
                            <tr>
                              <th scope="col" className="px-4 py-3 font-medium">
                                Period
                              </th>
                              <th scope="col" className="px-4 py-3 text-right font-medium">
                                Your share before fee
                              </th>
                              <th scope="col" className="px-4 py-3 text-right font-medium">
                                Management fee (
                                {node.rewards.managementFeeBps / 100}%)
                              </th>
                              <th scope="col" className="px-4 py-3 text-right font-medium text-white">
                                Your estimate after fee
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 tabular-nums">
                            {projectionRows.map((row) => (
                              <tr key={row.label}>
                                <th scope="row" className="px-4 py-3 font-medium text-slate-300">
                                  {row.label}
                                </th>
                                <td className="px-4 py-3 text-right text-slate-300">
                                  {formatNil(row.gross)} NIL
                                </td>
                                <td className="px-4 py-3 text-right text-slate-400">
                                  −{formatNil(row.fee)} NIL
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-white">
                                  {formatNil(row.net)} NIL
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>


                      <div
                        role="note"
                        className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100"
                      >
                        These are estimates, not payments received. Actual
                        weekly distributions reflect applicable operating
                        costs and the management fee under your pool
                        agreement.
                      </div>


                      {investorWarnings.length > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                          <ul className="space-y-2 text-sm leading-6 text-amber-300">
                            {investorWarnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
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