// app/admin/nillion/distributions/page.tsx

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { NILLION_FEE_DISCLOSURE } from '../../../../lib/tokenized-funds/nillion/fee-policy.js';

const API = '/api/admin/tokenized-funds/nillion/distribution-proposals';
const SUFFIX_LENGTH = 6;

type Assignment = {
  batchId?: string;
  nodeId?: string;
  positionId?: string;
  amountBaseUnits: string;
};

type Claim = {
  eventId: string;
  transactionHash: string;
  logIndex: string;
  blockNumber: string;
  amountBaseUnits: string;
};

type Proposal = {
  _id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  active: boolean;
  preparedAt: string;
  expiresAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  review: {
    proposal: {
      accounting: {
        grossClaimedBaseUnits: string;
        recordedManagementFeeBaseUnits: string;
        alreadyPaidBaseUnits: string;
        operatorOwnershipUnpaidBaseUnits: string;
        proposedInvestorTransfersBaseUnits: string;
        walletPendingUnpaidBaseUnits: string;
        roundingRemainderBaseUnits: string;
        requiredOutstandingReserveBaseUnits: string;
      };
      transfers: {
        from: string;
        to: string;
        amountBaseUnits: string;
        allocations: Assignment[];
      }[];
      operatorRetentionCandidates: Assignment[];
      walletPending: Assignment[];
      batches: {
        batchId: string;
        nodeId: string;
        allocationVersion: string | number;
        claims: Claim[];
      }[];
      sources: {
        ledgerSha256: string;
        allocationSha256: string;
        allocationVersion: string | number;
      };
      proposalSha256: string;
    };
    verification: {
      finalizedBlockNumber: string;
      verifiedClaimCount: number;
      verifiedPaymentCount: number;
      ownerNilBalanceBaseUnits: string;
      requiredOutstandingReserveBaseUnits: string;
    };
  };
};

type Blocked = 'disabled' | 'forbidden' | null;

function formatNil(value: string, decimals = 6) {
  const amount = BigInt(value);
  const scale = BigInt('1000000');
  const whole = amount / scale;
  const fraction = (amount % scale)
    .toString()
    .padStart(6, '0')
    .slice(0, decimals);

  return `${whole.toLocaleString('en-US')}.${fraction}`;
}

function shortHash(value: string, head = 8, tail = 6) {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
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
          <span className="text-sm font-normal text-slate-400">NIL</span>
        )}
      </div>
      {detail && (
        <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
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
      <dd className="whitespace-nowrap text-base tabular-nums">{value}</dd>
    </div>
  );
}

function EtherscanLink({ hash }: { hash: string }) {
  return (
    <a
      href={`https://etherscan.io/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
      aria-label={`View claim transaction ${hash} on Etherscan`}
    >
      {shortHash(hash)}
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    approved: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    rejected: 'border-slate-600 bg-slate-800 text-slate-300',
    expired: 'border-slate-600 bg-slate-800 text-slate-300',
  };

  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${
        styles[status] ?? styles.rejected
      }`}
    >
      {status}
    </span>
  );
}

async function request(method: 'GET' | 'POST', body?: unknown) {
  const response = await fetch(API, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

export default function NillionDistributionApprovalPage() {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<Blocked>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'prepare' | 'approve' | 'reject' | null>(
    null,
  );
  const [stale, setStale] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [suffixInput, setSuffixInput] = useState('');
  const [rejectArmed, setRejectArmed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  const inFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function handleFailure(
    status: number,
    fallback: string,
    serverMessage?: string,
  ) {
    if (status === 503 && serverMessage?.includes('is not enabled')) {
      setBlocked('disabled');
    } else if (status === 403) {
      setBlocked('forbidden');
    } else {
      setError(fallback);
    }
  }

  const load = useCallback(async () => {
    try {
      const result = await request('GET');
      if (!mounted.current) return;

      if (!result.ok) {
        handleFailure(
          result.status,
          'Unable to load the distribution proposal. Please try again.',
          result.data?.error,
        );
        return;
      }

      setProposal(result.data?.proposal ?? null);
    } catch {
      if (mounted.current) {
        setError('Unable to load the distribution proposal. Please try again.');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const proposalId = proposal?._id;

  useEffect(() => {
    setAcknowledged(false);
    setSuffixInput('');
    setRejectArmed(false);
    setStale(false);
  }, [proposalId]);

  const isPending = proposal?.status === 'pending';

  useEffect(() => {
    if (!isPending) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isPending, proposalId]);

  const remainingMs = proposal ? Date.parse(proposal.expiresAt) - now : 0;
  const expired =
    proposal?.status === 'expired' ||
    (isPending && Number.isFinite(remainingMs) && remainingMs <= 0);
  const actionable = isPending && !expired;

  async function submit(action: 'prepare' | 'approve' | 'reject') {
    if (inFlight.current) return;
    if (action !== 'prepare' && !proposal) return;

    inFlight.current = true;
    setBusy(action);
    setError(null);
    setNotice(null);

    const body =
      action === 'prepare' ? { action } : { action, id: proposal!._id };

    try {
      const result = await request('POST', body);
      if (!mounted.current) return;

      if (!result.ok) {
        if (result.status === 409) {
          if (action === 'approve') {
            setStale(true);
            setError(
              expired
                ? 'This proposal has expired. Reject it if needed, then prepare again.'
                : 'This proposal is stale: sources or on-chain state changed, or it is no longer pending. Nothing was approved. Reject it, then prepare again.',
            );
          } else if (action === 'reject') {
            setError(
              'This proposal could not be rejected because it is no longer pending. Reload to see its current state.',
            );
          } else {
            setError(
              'A distribution proposal is already active. Reload to see it.',
            );
          }
        } else {
          handleFailure(
            result.status,
            'The request failed. No payment was sent. You can try again.',
            result.data?.error,
          );
        }
        return;
      }

      const data = result.data;

      if (data?.status === 'nothing_to_review') {
        setProposal(null);
        setNotice('No finalized claims available for distribution.');
      } else if (data?.status === 'existing_pending') {
        setProposal(data.proposal);
        setNotice('A pending proposal already exists. Showing it below.');
      } else if (data?.proposal) {
        setProposal(data.proposal);
      }
    } catch {
      if (mounted.current) {
        setError('Network error. No payment was sent. You can try again.');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setBusy(null);
        setRejectArmed(false);
      }
    }
  }

  async function copyId() {
    if (!proposal) return;
    try {
      await navigator.clipboard.writeText(proposal._id);
      setCopied(true);
      window.setTimeout(() => {
        if (mounted.current) setCopied(false);
      }, 2000);
    } catch {
      setError('Unable to copy. Select the ID text manually.');
    }
  }

  const suffixRequired = proposal ? proposal._id.slice(-SUFFIX_LENGTH) : '';
  const approveReady =
    actionable &&
    !stale &&
    acknowledged &&
    suffixInput.trim().toLowerCase() === suffixRequired;

  const canPrepare =
    !loading &&
    !blocked &&
    !stale &&
    (!proposal ||
      proposal.status === 'rejected' ||
      proposal.status === 'expired' ||
      expired);

  const data = proposal?.review.proposal;
  const verification = proposal?.review.verification;
  const claims =
    data?.batches.flatMap((batch) =>
      batch.claims.map((claim) => ({ ...claim, nodeId: batch.nodeId })),
    ) ?? [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Admin
        </Link>

        <header className="mt-8">
          <p className="text-sm uppercase tracking-widest text-blue-400">
            Nillion Fund
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            Distribution approval
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            {NILLION_FEE_DISCLOSURE}
          </p>
        </header>

        <div
          role="note"
          className="mt-6 rounded-2xl border-2 border-blue-400 bg-blue-500/10 p-5 sm:p-6"
        >
          <p className="text-lg font-bold text-blue-200">
            Approving does not send any payment.
          </p>
          <p className="mt-2 text-base font-semibold text-slate-100">
            Execution is not enabled.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This screen only records your decision on one server-verified
            proposal. All amounts are in NIL.
          </p>
        </div>

        {loading && (
          <p role="status" className="mt-8 text-slate-400">
            Loading distribution proposal…
          </p>
        )}

        {blocked === 'disabled' && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100"
          >
            Distribution proposals are not enabled.
          </div>
        )}

        {blocked === 'forbidden' && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            Admin access is required to view this page.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
          >
            {error}
          </div>
        )}

        {notice && !error && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm leading-6 text-slate-300"
          >
            {notice}
          </div>
        )}

        {!loading && !blocked && !proposal && !notice && (
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-5">
            <p className="text-base font-semibold text-slate-200">
              No proposal prepared
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Preparing a proposal scans finalized on-chain claims and can
              take tens of seconds.
            </p>
          </div>
        )}

        {canPrepare && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => void submit('prepare')}
              disabled={busy !== null}
              aria-busy={busy === 'prepare'}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-wait disabled:opacity-60"
            >
              {busy === 'prepare'
                ? 'Scanning finalized claims…'
                : 'Prepare proposal'}
            </button>
            {busy === 'prepare' && (
              <p role="status" className="mt-3 text-sm text-slate-400">
                Scanning finalized on-chain claims. This can take tens of
                seconds. Keep this page open.
              </p>
            )}
          </div>
        )}

        {proposal && data && verification && (
          <>
            <section
              aria-labelledby="proposal-heading"
              className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="proposal-heading" className="text-xl font-semibold">
                  Proposal
                </h2>
                <StatusBadge status={expired ? 'expired' : proposal.status} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span
                  title={proposal._id}
                  className="font-mono text-sm text-slate-200"
                >
                  {shortHash(proposal._id, 10, 8)}
                </span>
                <button
                  type="button"
                  onClick={() => void copyId()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  {copied ? 'Copied' : 'Copy full ID'}
                </button>
              </div>

              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-400">Prepared</dt>
                  <dd className="mt-1 text-slate-200">
                    {new Date(proposal.preparedAt).toLocaleString()}
                  </dd>
                </div>
                {isPending && (
                  <div>
                    <dt className="text-slate-400">Expires in</dt>
                    <dd
                      className={`mt-1 tabular-nums ${
                        expired ? 'text-red-300' : 'text-amber-200'
                      }`}
                    >
                      {expired ? 'Expired' : formatCountdown(remainingMs)}
                    </dd>
                  </div>
                )}
              </dl>

              {expired && (
                <p className="mt-4 text-sm leading-6 text-amber-200">
                  This proposal has expired. Prepare a new proposal to
                  continue.
                </p>
              )}
              {proposal.status === 'approved' && (
                <p className="mt-4 text-sm font-semibold text-emerald-300">
                  Approved - execution not enabled.
                </p>
              )}
              {proposal.status === 'rejected' && (
                <p className="mt-4 text-sm text-slate-300">
                  Rejected. No further action is possible on this proposal.
                </p>
              )}
            </section>

            <section
              aria-labelledby="claims-heading"
              className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h2 id="claims-heading" className="text-xl font-semibold">
                Claims
              </h2>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <caption className="sr-only">
                    Finalized claims included in this proposal
                  </caption>
                  <thead className="border-b border-slate-800 text-xs text-slate-400">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Node
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Block
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Transaction
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {claims.map((claim) => (
                      <tr
                        key={JSON.stringify([
                          claim.eventId,
                          claim.transactionHash,
                          claim.logIndex,
                        ])}
                      >
                        <td className="px-4 py-3 text-slate-200">
                          Node #{claim.nodeId}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          {formatNil(claim.amountBaseUnits)} NIL
                        </td>
                        <td className="px-4 py-3 tabular-nums text-slate-400">
                          {claim.blockNumber}
                        </td>
                        <td className="px-4 py-3">
                          <EtherscanLink hash={claim.transactionHash} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              aria-labelledby="accounting-heading"
              className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h2 id="accounting-heading" className="text-xl font-semibold">
                Accounting
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Totals are cumulative across the included ledger, not new
                withdrawals. Only the investor transfers below would be
                paid out.
              </p>
              <dl className="mt-4 divide-y divide-slate-800">
                <BreakdownRow
                  label="Gross claimed"
                  value={`${formatNil(data.accounting.grossClaimedBaseUnits)} NIL`}
                  emphasis
                />
                <BreakdownRow
                  label="Management fee"
                  note="Accounting total only. This is not a transfer."
                  value={`${formatNil(data.accounting.recordedManagementFeeBaseUnits)} NIL`}
                />
                <BreakdownRow
                  label="Operator ownership share"
                  note="Unpaid entitlement retained in the owner wallet. This is not a transfer."
                  value={`${formatNil(data.accounting.operatorOwnershipUnpaidBaseUnits)} NIL`}
                />
                <BreakdownRow
                  label="Investor transfers"
                  note="The only proposed outgoing payments. Listed exactly below."
                  value={`${formatNil(data.accounting.proposedInvestorTransfersBaseUnits)} NIL`}
                  emphasis
                />
                <BreakdownRow
                  label="Wallet-pending (held)"
                  note="Held back until a receiving wallet is provided. Never redistributed."
                  value={`${formatNil(data.accounting.walletPendingUnpaidBaseUnits)} NIL`}
                />
                <BreakdownRow
                  label="Rounding remainder"
                  note="Tracked separately."
                  value={`${formatNil(data.accounting.roundingRemainderBaseUnits)} NIL`}
                />
                <BreakdownRow
                  label="Already paid"
                  value={`${formatNil(data.accounting.alreadyPaidBaseUnits)} NIL`}
                />
              </dl>
            </section>

            <section
              aria-labelledby="transfers-heading"
              className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h2 id="transfers-heading" className="text-xl font-semibold">
                Proposed investor transfers
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Proposed only. Nothing is sent when you approve.
              </p>

              {data.transfers.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">
                  No investor transfers are proposed.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950">
                  <table className="w-full min-w-[38rem] text-left text-sm">
                    <caption className="sr-only">
                      Proposed outgoing NIL transfers
                    </caption>
                    <thead className="border-b border-slate-800 text-xs text-slate-400">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Recipient
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-right font-medium"
                        >
                          Amount
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Allocations
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.transfers.map((transfer) => (
                        <tr key={`${transfer.to}-${transfer.amountBaseUnits}`}>
                          <td className="break-all px-4 py-3 font-mono text-xs text-slate-200">
                            {transfer.to}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-300">
                            {formatNil(transfer.amountBaseUnits)} NIL
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {transfer.allocations.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.walletPending.length > 0 && (
                <>
                  <h3 className="mt-6 text-base font-semibold">
                    Held: wallet pending
                  </h3>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950">
                    <table className="w-full min-w-[30rem] text-left text-sm">
                      <caption className="sr-only">
                        Amounts held because no receiving wallet is set
                      </caption>
                      <thead className="border-b border-slate-800 text-xs text-slate-400">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-medium">
                            Node / position
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-right font-medium"
                          >
                            Held amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.walletPending.map((item, index) => (
                          <tr
                            key={JSON.stringify([
                              item.batchId,
                              item.nodeId,
                              item.positionId,
                              index,
                            ])}
                          >
                            <td className="break-all px-4 py-3 text-slate-300">
                              {item.nodeId ? `Node #${item.nodeId} · ` : ''}
                              {item.positionId ?? '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-amber-200">
                              {formatNil(item.amountBaseUnits)} NIL
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {data.operatorRetentionCandidates.length > 0 && (
                <>
                  <h3 className="mt-6 text-base font-semibold">
                    Retained: operator ownership (not transfers)
                  </h3>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-700 bg-slate-950">
                    <table className="w-full min-w-[30rem] text-left text-sm">
                      <caption className="sr-only">
                        Operator ownership entitlements retained in the owner
                        wallet
                      </caption>
                      <thead className="border-b border-slate-800 text-xs text-slate-400">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-medium">
                            Node / position
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-right font-medium"
                          >
                            Retained amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.operatorRetentionCandidates.map((item, index) => (
                          <tr
                            key={JSON.stringify([
                              item.batchId,
                              item.nodeId,
                              item.positionId,
                              index,
                            ])}
                          >
                            <td className="break-all px-4 py-3 text-slate-300">
                              {item.nodeId ? `Node #${item.nodeId} · ` : ''}
                              {item.positionId ?? '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-200">
                              {formatNil(item.amountBaseUnits)} NIL
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section
              aria-labelledby="verification-heading"
              className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h2 id="verification-heading" className="text-xl font-semibold">
                Server verification
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Metric
                  label="Owner NIL balance"
                  value={`${formatNil(verification.ownerNilBalanceBaseUnits)} NIL`}
                />
                <Metric
                  label="Required outstanding reserve"
                  value={`${formatNil(verification.requiredOutstandingReserveBaseUnits)} NIL`}
                />
                <Metric
                  label="Claims verified"
                  value={String(verification.verifiedClaimCount)}
                  detail={`Finalized block ${verification.finalizedBlockNumber}`}
                />
              </div>

              <dl className="mt-4 divide-y divide-slate-800 text-sm">
                <BreakdownRow
                  label="Allocation version"
                  value={String(data.sources.allocationVersion)}
                />
                <BreakdownRow
                  label="Allocation hash"
                  value={shortHash(data.sources.allocationSha256, 10, 8)}
                />
                <BreakdownRow
                  label="Ledger hash"
                  value={shortHash(data.sources.ledgerSha256, 10, 8)}
                />
              </dl>
            </section>

            <section
              aria-labelledby="warnings-heading"
              className="mt-8 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-6"
            >
              <h2
                id="warnings-heading"
                className="text-xl font-semibold text-amber-100"
              >
                Not checked by the server
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-100">
                <li>ETH gas balance is not checked.</li>
                <li>Incoming NIL transfers are not reconciled.</li>
                <li>Allocation history is an owner assertion.</li>
              </ul>
            </section>

            {actionable && (
              <section
                aria-labelledby="decision-heading"
                className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <h2 id="decision-heading" className="text-xl font-semibold">
                  Decision
                </h2>

                {!stale && (
                  <div className="mt-4 space-y-4">
                    <label className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(event) =>
                          setAcknowledged(event.target.checked)
                        }
                        disabled={busy !== null}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        I understand approving does not send any payment,
                        execution is not enabled, and the warnings above are
                        not checked by the server.
                      </span>
                    </label>

                    <div>
                      <label
                        htmlFor="approve-suffix"
                        className="block text-sm text-slate-300"
                      >
                        Type the last {SUFFIX_LENGTH} characters of the
                        proposal ID (
                        <span className="font-mono">{suffixRequired}</span>)
                      </label>
                      <input
                        id="approve-suffix"
                        type="text"
                        value={suffixInput}
                        onChange={(event) => setSuffixInput(event.target.value)}
                        disabled={busy !== null}
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-2 w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {!stale && (
                    <button
                      type="button"
                      onClick={() => void submit('approve')}
                      disabled={!approveReady || busy !== null}
                      aria-busy={busy === 'approve'}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy === 'approve' ? 'Approving…' : 'Approve proposal'}
                    </button>
                  )}

                  {!rejectArmed ? (
                    <button
                      type="button"
                      onClick={() => setRejectArmed(true)}
                      disabled={busy !== null}
                      className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-medium text-slate-200 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void submit('reject')}
                        disabled={busy !== null}
                        aria-busy={busy === 'reject'}
                        className="rounded-xl bg-red-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectArmed(false)}
                        disabled={busy !== null}
                        className="text-sm text-slate-400 hover:text-white disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}