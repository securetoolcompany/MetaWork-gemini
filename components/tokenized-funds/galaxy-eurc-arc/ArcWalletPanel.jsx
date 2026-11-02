'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  formatUnits,
  getAddress,
  parseAbi,
  parseUnits,
	encodeFunctionData,
	toHex,
} from 'viem';
const arc = {
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [] } },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
};

import { GALAXY_ARC as CONFIG } from '../../../lib/tokenized-funds/galaxy-eurc-arc/config';

const vaultAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function deposit(uint256 assets,address onBehalf) returns (uint256)',
  'function redeem(uint256 shares,address receiver,address onBehalf) returns (uint256)',
]);

const LOCAL_TEST_ENABLED = false;

const ADMIN_PREVIEW_ENABLED = false;

const PUBLIC_DEPOSITS_ENABLED = false;

const PUBLIC_REDEMPTIONS_ENABLED = false;

const BUTTON =
  'rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40';

function sameAddress(a, b) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function writeAllowed() {
  return false;
}

function message(error) {
  const code =
    error?.code ??
    error?.cause?.code ??
    error?.cause?.cause?.code;

  if (code === 4001) return 'Wallet request cancelled.';
  if (code === -32002) return 'Check the request already open in your wallet.';

  return error?.shortMessage || error?.message || 'Request failed.';
}

function clients(provider) {
  return {
    publicClient: createPublicClient({
      chain: arc,
      transport: custom(provider),
    }),
    walletClient: createWalletClient({
      chain: arc,
      transport: custom(provider),
    }),
  };
}

function displayUnits(value, decimals, places = 6) {
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ''] = formatted.split('.');
  const trimmed = fraction.slice(0, places).replace(/0+$/, '');

  return trimmed ? `${whole}.${trimmed}` : whole;
}

export default function ArcWalletPanel() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balances, setBalances] = useState(null);
  const [amount, setAmount] = useState('1');
  const [tab, setTab] = useState('deposit');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState([]);

  const pending = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);

  async function readBalances(selectedProvider, selectedAccount) {
    const version = generation.current;
    const { publicClient } = clients(selectedProvider);

    if (await publicClient.getChainId() !== arc.id) {
      throw new Error('Switch your wallet to Arc.');
    }

    const blockNumber = await publicClient.getBlockNumber();
    const [eth, usdc, shares] = await Promise.all([
      publicClient.getBalance({
        address: selectedAccount,
        blockNumber,
      }),
      publicClient.readContract({
        address: CONFIG.assetAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [selectedAccount],
        blockNumber,
      }),
      publicClient.readContract({
        address: CONFIG.wrapperAddress,
        abi: vaultAbi,
        functionName: 'balanceOf',
        args: [selectedAccount],
        blockNumber,
      }),
    ]);

    const assets = await publicClient.readContract({
      address: CONFIG.wrapperAddress,
      abi: vaultAbi,
      functionName: 'convertToAssets',
      args: [shares],
      blockNumber,
    });

    if (
      mounted.current &&
      version === generation.current &&
      await publicClient.getChainId() === arc.id
    ) {
      setBalances({ eth, usdc, shares, assets });
    }
  }

  useEffect(() => {
    if (!provider) return;

    function accountsChanged(accounts) {
      generation.current++;
      setAccount(accounts?.[0] ? getAddress(accounts[0]) : null);
      setBalances(null);
      setStatus('');
      setError('');
    }

    function chainChanged(chain) {
      generation.current++;
      setChainId(Number(chain));
      setBalances(null);
      setStatus('');
      setError('');
    }

    function disconnected() {
      generation.current++;
      setAccount(null);
      setChainId(null);
      setBalances(null);
    }

    provider.on?.('accountsChanged', accountsChanged);
    provider.on?.('chainChanged', chainChanged);
    provider.on?.('disconnect', disconnected);

    return () => {
      provider.removeListener?.('accountsChanged', accountsChanged);
      provider.removeListener?.('chainChanged', chainChanged);
      provider.removeListener?.('disconnect', disconnected);
    };
  }, [provider]);

  useEffect(() => {
    if (!provider || !account || chainId !== arc.id) return;

    void readBalances(provider, account).catch((cause) => {
      if (mounted.current) setError(message(cause));
    });
  }, [provider, account, chainId]);

  async function connect() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');

    try {
      const root = window.ethereum;
      const candidates = root?.providers ?? [root];
      const injected =
        candidates.find(item => item?.isMetaMask && !item?.isRabby) ||
        root;
      if (!injected?.request) {
        throw new Error('Install or open an EVM wallet.');
      }

      const accounts = await injected.request({
        method: 'eth_requestAccounts',
      });
      if (!accounts?.[0]) throw new Error('No wallet account returned.');

      const chain = await injected.request({ method: 'eth_chainId' });
      generation.current++;
      setProvider(injected);
      setAccount(getAddress(accounts[0]));
      setChainId(Number(chain));
      setBalances(null);
    } catch (cause) {
      setError(message(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function switchToArc() {
    if (!provider || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13b2' }],
      });
      setChainId(Number(await provider.request({
        method: 'eth_chainId',
      })));
    } catch (cause) {
      const code = cause?.code ?? cause?.cause?.code;
      setError(
        Number(code) === 4902
          ? 'Add Arc chain 5042 to your wallet, then reconnect.'
          : message(cause),
      );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function transact() {
    setError('Deposits and redemptions are disabled pending operator validation.');
  }

  async function refresh() {
    if (!provider || !account || busy) return;
    setError('');
    try {
      await readBalances(provider, account);
    } catch (cause) {
      setError(message(cause));
    }
  }

  const onArc = chainId === arc.id;
  const canDeposit =
		onArc && writeAllowed('deposit', account);

	const canRedeem =
		onArc && writeAllowed('redeem', account);

  return (
	<div className="space-y-5">
			{!account ? (
			<button
					type="button"
					className={`${BUTTON} w-full`}
					onClick={connect}
					disabled={busy}
			>
					{busy ? 'Connecting…' : 'Connect wallet'}
			</button>
			) : (
			<>
					<div className="flex items-center justify-between gap-3">
					<a
							href={`https://explorer.arc.io/address/${account}`}
							target="_blank"
							rel="noopener noreferrer"
							title={account}
							className="font-mono text-xs text-slate-400 transition hover:text-white"
					>
							{account.slice(0, 6)}…{account.slice(-4)}
					</a>

					<span
							className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
							onArc
									? 'bg-emerald-400/10 text-emerald-300'
									: 'bg-amber-400/10 text-amber-300'
							}`}
					>
							{onArc ? 'Arc connected' : 'Wrong network'}
					</span>
					</div>

					{!onArc ? (
					<button
							type="button"
							className={`${BUTTON} w-full`}
							onClick={switchToArc}
							disabled={busy}
					>
							{busy ? 'Check your wallet…' : 'Switch to Arc'}
					</button>
					) : (
					<>
							<div>
							<p className="text-xs text-slate-400">
									Position balance
							</p>

							<p className="mt-3 break-words text-3xl font-semibold tracking-tight text-white">
									{balances ? displayUnits(balances.assets, 6) : '—'}
									<span className="ml-2 text-arc font-medium text-slate-400">
									EURC
									</span>
							</p>

							<p className="mt-2 break-words text-xs text-slate-500">
									{balances
									? `${formatUnits(balances.shares, 18)} ${CONFIG.wrapperSymbol}`
									: 'Reading wrapper shares…'}
							</p>
							</div>

							<dl className="space-y-2 border-y border-white/[0.06] py-4 text-xs">
							<div className="flex justify-between gap-3">
									<dt className="text-slate-400">Wallet EURC</dt>
									<dd className="break-all text-right tabular-nums text-slate-200">
									{balances ? displayUnits(balances.usdc, 6) : '—'}
									</dd>
							</div>

							<div className="flex justify-between gap-3">
									<dt className="text-slate-400">Native USDC for gas</dt>
									<dd className="break-all text-right tabular-nums text-slate-200">
									{balances ? displayUnits(balances.eth, 18, 8) : '—'}
									</dd>
							</div>
							</dl>

							<div
							role="group"
							aria-label="Position action"
							className="flex gap-1 rounded-xl bg-black/20 p-1"
							>
							{[
									['deposit', 'Deposit'],
									['withdraw', 'Withdraw'],
							].map(([value, label]) => (
									<button
									key={value}
									type="button"
									aria-pressed={tab === value}
									disabled={busy}
									onClick={() => setTab(value)}
									className={`flex-1 rounded-lg px-3 py-2.5 text-sm transition disabled:opacity-50 ${
											tab === value
											? 'bg-white/[0.08] font-medium text-white'
											: 'text-slate-500 hover:text-slate-200'
									}`}
									>
									{label}
									</button>
							))}
							</div>

							{tab === 'deposit' ? (
							<div>
									<label
									htmlFor="galaxy-eurc-arc-deposit-amount"
									className="block text-xs text-slate-400"
									>
									Deposit amount
									</label>

									<div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
									<input
											id="galaxy-eurc-arc-deposit-amount"
											type="text"
											inputMode="decimal"
											autoComplete="off"
											value={amount}
											onChange={(event) => setAmount(event.target.value)}
											placeholder="0.00"
											disabled={busy || !canDeposit}
											className="min-w-0 flex-1 bg-transparent text-2xl text-white outline-none placeholder:text-slate-600 disabled:opacity-50"
									/>

									<span className="rounded-lg bg-sky-400/10 px-2.5 py-1.5 text-xs font-medium text-sky-300">
											EURC
									</span>
									</div>

									<button
									type="button"
									className={`${BUTTON} mt-4 w-full`}
									disabled={busy || !canDeposit || !balances}
									onClick={() => void transact('deposit')}
									>
									{busy ? 'Processing…' : 'Deposit EURC'}
									</button>

									<p className="mt-2 text-[11px] leading-5 text-slate-500">
									A separate EURC approval is requested if needed.
									Shares are sent to your connected wallet.
									</p>
							</div>
							) : (
							<div>
									<div className="rounded-2xl border border-white/10 bg-black/10 p-4">
									<p className="text-xs text-slate-400">
											Full-position redemption
									</p>

									<p className="mt-2 text-xl font-medium text-white">
											{balances ? displayUnits(balances.assets, 6) : '—'}
											<span className="ml-2 text-sm text-slate-400">
											EURC position value
											</span>
									</p>

									<p className="mt-2 text-xs leading-5 text-slate-500">
											Redeems all wrapper shares owned by this wallet.
											Actual EURC returned is determined at execution
											and depends on available liquidity.
									</p>
									</div>

									<button
									type="button"
									className={`${BUTTON} mt-4 w-full`}
									disabled={
											busy ||
											!canRedeem ||
											!balances ||
											balances.shares === 0n
									}
									onClick={() => void transact('redeem')}
									>
									{busy
											? 'Processing…'
											: balances?.shares === 0n
											? 'No position to withdraw'
											: 'Withdraw entire position'}
									</button>

									<p className="mt-2 text-[11px] leading-5 text-slate-500">
									This test interface supports full redemption only.
									Protection shares are not included.
									</p>
							</div>
							)}

							<button
							type="button"
							onClick={refresh}
							disabled={busy}
							className="text-xs text-sky-300 underline underline-offset-4 transition hover:text-sky-200 disabled:opacity-40"
							>
							Refresh balances
							</button>
					</>
					)}
			</>
			)}

			<p className="rounded-xl border border-amber-400/10 bg-amber-400/5 px-3 py-2 text-[11px] leading-5 text-amber-300">
				{LOCAL_TEST_ENABLED || ADMIN_PREVIEW_ENABLED
					? 'Administrator testing is enabled. Public availability is controlled separately.'
					: canDeposit
						? 'Transactions use EURC on Arc. Capital is at risk.'
						: canRedeem
							? 'New deposits are paused. Existing positions can still be redeemed, subject to liquidity.'
							: 'Read-only preview. Transactions are disabled pending operator validation. EURC assets and native-USDC gas are separate balances.'}
			</p>

			{status && (
			<p role="status" className="text-sm leading-6 text-slate-300">
					{status}
			</p>
			)}

			{error && (
			<p
					role="alert"
					className="break-words rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs leading-6 text-red-300"
			>
					{error}
			</p>
			)}

			{transactions.length > 0 && (
			<div className="space-y-3 border-t border-white/[0.06] pt-4">
					<p className="text-xs font-medium text-slate-400">
					Session transactions
					</p>

					{transactions.map((transaction) => (
					<a
							key={transaction.hash}
							href={`https://explorer.arc.io/tx/${transaction.hash}`}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/10 px-3 py-3 transition hover:border-sky-400/30"
					>
							<span className="min-w-0">
							<span className="block text-xs capitalize text-slate-200">
									{transaction.label}
							</span>
							<span className="mt-1 block font-mono text-[10px] text-slate-500">
									{transaction.hash.slice(0, 10)}…
									{transaction.hash.slice(-6)}
							</span>
							</span>

							<span
							className={`text-[11px] ${
									transaction.status === 'success'
									? 'text-emerald-300'
									: transaction.status === 'pending'
											? 'text-amber-300'
											: 'text-red-300'
							}`}
							>
							{transaction.status === 'success'
									? 'Confirmed ↗'
									: transaction.status === 'pending'
									? 'Pending ↗'
									: 'Reverted ↗'}
							</span>
					</a>
					))}
			</div>
			)}
	</div>
	);
}