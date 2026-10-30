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
import { base } from 'viem/chains';

import { GALAXY_QUALITY as CONFIG } from '../../../lib/tokenized-funds/galaxy-quality/config';

const vaultAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function deposit(uint256 assets,address onBehalf) returns (uint256)',
  'function redeem(uint256 shares,address receiver,address onBehalf) returns (uint256)',
]);

const LOCAL_TEST_ENABLED =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_GALAXY_QUALITY_LOCAL_TEST === 'true';

const ADMIN_PREVIEW_ENABLED =
  process.env.NEXT_PUBLIC_GALAXY_QUALITY_ADMIN_PREVIEW === 'true';

const PUBLIC_DEPOSITS_ENABLED =
  process.env.NEXT_PUBLIC_GALAXY_QUALITY_DEPOSITS === 'true';

const PUBLIC_REDEMPTIONS_ENABLED =
  process.env.NEXT_PUBLIC_GALAXY_QUALITY_REDEMPTIONS === 'true';

const BUTTON =
  'rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40';

function sameAddress(a, b) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function writeAllowed(kind, account) {
  if (!account) return false;

  const administratorAccess =
    sameAddress(account, CONFIG.administrator) &&
    (LOCAL_TEST_ENABLED || ADMIN_PREVIEW_ENABLED);

  if (administratorAccess) return true;

  if (kind === 'deposit') {
    return CONFIG.depositsEnabled && PUBLIC_DEPOSITS_ENABLED;
  }

  if (kind === 'redeem') {
    return PUBLIC_REDEMPTIONS_ENABLED;
  }

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
      chain: base,
      transport: custom(provider),
    }),
    walletClient: createWalletClient({
      chain: base,
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

export default function BaseWalletPanel() {
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

    if (await publicClient.getChainId() !== base.id) {
      throw new Error('Switch your wallet to Base.');
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
      await publicClient.getChainId() === base.id
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
    if (!provider || !account || chainId !== base.id) return;

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
      const injected = window.ethereum;
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

  async function switchToBase() {
    if (!provider || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');

    try {
      const { walletClient } = clients(provider);
      try {
        await walletClient.switchChain({ id: base.id });
      } catch (cause) {
        const code = cause?.code ?? cause?.cause?.code;
        if (Number(code) !== 4902) throw cause;
        await walletClient.addChain({ chain: base });
        await walletClient.switchChain({ id: base.id });
      }

      setChainId(Number(await provider.request({
        method: 'eth_chainId',
      })));
    } catch (cause) {
      setError(message(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function transact(kind) {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setError('');
    setStatus('');

    let submitted = false;

    try {
      if (!writeAllowed(kind, account)) {
				throw new Error(
					kind === 'deposit'
						? 'Deposits are currently disabled for this wallet.'
						: 'Redemptions are currently disabled in this interface.',
				);
			}

      if (!provider) throw new Error('Connect a wallet first.');

      const selectedAccount = account;
      const version = generation.current;
      const { publicClient, walletClient } = clients(provider);

      async function assertSession() {
        const [accounts, currentChain] = await Promise.all([
          provider.request({ method: 'eth_accounts' }),
          provider.request({ method: 'eth_chainId' }),
        ]);

        if (
          !mounted.current ||
          version !== generation.current ||
          !sameAddress(accounts?.[0], selectedAccount)
        ) {
          throw new Error('Wallet changed. Review and start again.');
        }

        if (Number(currentChain) !== base.id) {
          throw new Error('Base is required.');
        }
      }

      async function send(contract, label, gasFloor = 0n) {
        await assertSession();
        setStatus(`Simulating ${label}…`);

        await publicClient.simulateContract({
          ...contract,
          account: selectedAccount,
        });

        const estimate = await publicClient.estimateContractGas({
          ...contract,
          account: selectedAccount,
        });

        const buffered = (estimate * 150n + 99n) / 100n;

				// Explicitly tested allowance for this wrapper's deposit/redeem flows.
				// This is a regression workaround, not a universal gas guarantee.
				const wrapperOperation =
					sameAddress(contract.address, CONFIG.wrapperAddress) &&
					['deposit', 'redeem'].includes(contract.functionName);

				const testedFloor = wrapperOperation ? 4_000_000n : 0n;
				const minimumGas = gasFloor > testedFloor ? gasFloor : testedFloor;
				const gas = buffered > minimumGas ? buffered : minimumGas;

        await publicClient.simulateContract({
          ...contract,
          account: selectedAccount,
          gas,
        });

        const fees = await publicClient.estimateFeesPerGas();
        const eth = await publicClient.getBalance({
          address: selectedAccount,
        });

        if (
          fees.maxFeePerGas !== undefined &&
          eth < gas * fees.maxFeePerGas
        ) {
          throw new Error(
            'Insufficient Base ETH for the execution gas budget. Additional network fees may also apply.',
          );
        }

        await assertSession();
        setStatus(`Confirm ${label} in your wallet…`);

        const isWrapperFlow =
					sameAddress(contract.address, CONFIG.wrapperAddress) &&
					['deposit', 'redeem'].includes(contract.functionName);

				const finalGas =
					isWrapperFlow && gas < 4_000_000n
						? 4_000_000n
						: gas;

				// Recheck the exact allowance we are about to send.
				await publicClient.simulateContract({
					...contract,
					account: selectedAccount,
					gas: finalGas,
				});

				await assertSession();

				if (!writeAllowed(kind, selectedAccount)) {
					throw new Error('This action is no longer enabled.');
				}

				const payload = {
					from: selectedAccount,
					to: contract.address,
					data: encodeFunctionData({
						abi: contract.abi,
						functionName: contract.functionName,
						args: contract.args,
					}),
					value: '0x0',
					gas: toHex(finalGas),
				};

				console.info(
					'[Galaxy Quality wallet payload]',
					JSON.stringify(payload, null, 2),
				);

				setStatus(
					`Confirm ${label}. Check the wallet gas limit is ${finalGas.toString()}.`,
				);

				const hash = await provider.request({
					method: 'eth_sendTransaction',
					params: [payload],
				});

        submitted = true;
        setTransactions((previous) => [
          ...previous,
          { label, hash, status: 'pending' },
        ]);
        setStatus(`Waiting for ${label} confirmation…`);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
        });

        setTransactions((previous) =>
          previous.map((item) =>
            item.hash === hash
              ? { ...item, status: receipt.status }
              : item,
          ),
        );

        if (receipt.status !== 'success') {
          throw new Error(`${label} reverted: ${hash}`);
        }

        await assertSession();
        return receipt;
      }

      await assertSession();

			if (!writeAllowed(kind, selectedAccount)) {
				throw new Error('This action is no longer enabled.');
			}

      if (kind === 'deposit') {
        const input = amount.trim();
        if (!/^\d+(\.\d{1,6})?$/.test(input)) {
          throw new Error('Enter a USDC amount with at most six decimals.');
        }

        const assets = parseUnits(input, CONFIG.assetDecimals);
        if (assets <= 0n) throw new Error('Enter an amount greater than zero.');

        const balance = await publicClient.readContract({
          address: CONFIG.assetAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [selectedAccount],
        });
        if (balance < assets) throw new Error('Insufficient USDC.');

        const allowance = await publicClient.readContract({
          address: CONFIG.assetAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [selectedAccount, CONFIG.wrapperAddress],
        });

        if (allowance < assets) {
          await send({
            address: CONFIG.assetAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [CONFIG.wrapperAddress, assets],
          }, 'USDC approval');
        }

        await send({
          address: CONFIG.wrapperAddress,
          abi: vaultAbi,
          functionName: 'deposit',
          args: [assets, selectedAccount],
        }, 'deposit');
      } else if (kind === 'redeem') {
        const shares = await publicClient.readContract({
          address: CONFIG.wrapperAddress,
          abi: vaultAbi,
          functionName: 'balanceOf',
          args: [selectedAccount],
        });

        if (shares === 0n) throw new Error('No wallet-owned shares to redeem.');

        await send({
          address: CONFIG.wrapperAddress,
          abi: vaultAbi,
          functionName: 'redeem',
          args: [shares, selectedAccount, selectedAccount],
        }, 'redemption', 4_000_000n);
        // Local regression-test floor only, not a production gas policy.
      } else {
        throw new Error('Unknown action.');
      }

      setStatus(
        `${kind === 'deposit' ? 'Deposit' : 'Redemption'} confirmed.`,
      );

      try {
        await readBalances(provider, selectedAccount);
      } catch {
        setStatus('Transaction confirmed. Balance refresh failed; click Refresh.');
      }
    } catch (cause) {
      setError(message(cause));
      setStatus(
        submitted
          ? 'Inspect the transaction links below before retrying.'
          : '',
      );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
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

  const onBase = chainId === base.id;
  const canDeposit =
		onBase && writeAllowed('deposit', account);

	const canRedeem =
		onBase && writeAllowed('redeem', account);

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
							href={`https://basescan.org/address/${account}`}
							target="_blank"
							rel="noopener noreferrer"
							title={account}
							className="font-mono text-xs text-slate-400 transition hover:text-white"
					>
							{account.slice(0, 6)}…{account.slice(-4)}
					</a>

					<span
							className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
							onBase
									? 'bg-emerald-400/10 text-emerald-300'
									: 'bg-amber-400/10 text-amber-300'
							}`}
					>
							{onBase ? 'Base connected' : 'Wrong network'}
					</span>
					</div>

					{!onBase ? (
					<button
							type="button"
							className={`${BUTTON} w-full`}
							onClick={switchToBase}
							disabled={busy}
					>
							{busy ? 'Check your wallet…' : 'Switch to Base'}
					</button>
					) : (
					<>
							<div>
							<p className="text-xs text-slate-400">
									Position balance
							</p>

							<p className="mt-3 break-words text-3xl font-semibold tracking-tight text-white">
									{balances ? displayUnits(balances.assets, 6) : '—'}
									<span className="ml-2 text-base font-medium text-slate-400">
									USDC
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
									<dt className="text-slate-400">Wallet USDC</dt>
									<dd className="break-all text-right tabular-nums text-slate-200">
									{balances ? displayUnits(balances.usdc, 6) : '—'}
									</dd>
							</div>

							<div className="flex justify-between gap-3">
									<dt className="text-slate-400">Base ETH for gas</dt>
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
									htmlFor="quality-deposit-amount"
									className="block text-xs text-slate-400"
									>
									Deposit amount
									</label>

									<div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
									<input
											id="quality-deposit-amount"
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
											USDC
									</span>
									</div>

									<button
									type="button"
									className={`${BUTTON} mt-4 w-full`}
									disabled={busy || !canDeposit || !balances}
									onClick={() => void transact('deposit')}
									>
									{busy ? 'Processing…' : 'Deposit USDC'}
									</button>

									<p className="mt-2 text-[11px] leading-5 text-slate-500">
									A separate USDC approval is requested if needed.
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
											USDC position value
											</span>
									</p>

									<p className="mt-2 text-xs leading-5 text-slate-500">
											Redeems all wrapper shares owned by this wallet.
											Actual USDC returned is determined at execution
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
						? 'Transactions use USDC on Base. Capital is at risk.'
						: canRedeem
							? 'New deposits are paused. Existing positions can still be redeemed, subject to liquidity.'
							: 'Transactions are currently unavailable in this interface.'}
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
							href={`https://basescan.org/tx/${transaction.hash}`}
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