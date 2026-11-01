'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createPublicClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  parseAbi,
  parseUnits,
  toHex,
} from 'viem';
import { mainnet } from 'viem/chains';
import { GALAXY_USDC as CONFIG } from '../../../lib/tokenized-funds/galaxy/config';

const OPERATOR = '0x39Bb4A10626B58430AbFa8284B0F001f49734F70';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const SYMBOL = 'mwGUSDCe';

// Public transaction activation is a separate launch decision.
const PUBLIC_DEPOSITS_ENABLED = true;
const PUBLIC_REDEMPTIONS_ENABLED = true;

const LOCAL_TEST_ENABLED =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_GALAXY_ENHANCED_LOCAL_TEST === 'true';

const vaultAbi = parseAbi([
  'function asset() view returns (address)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function previewDeposit(uint256 assets) view returns (uint256)',
  'function previewRedeem(uint256 shares) view returns (uint256)',
  'function deposit(uint256 assets,address receiver) returns (uint256)',
  'function redeem(uint256 shares,address receiver,address owner) returns (uint256)',
]);

const button =
  'rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40';

function same(a, b) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function display(value, decimals, places = 6) {
  const [whole, fraction = ''] = formatUnits(value, decimals).split('.');
  const trimmed = fraction.slice(0, places).replace(/0+$/, '');
  return trimmed ? whole + '.' + trimmed : whole;
}

function errorMessage(error) {
  const code = error?.code ?? error?.cause?.code ?? error?.cause?.cause?.code;
  if (code === 4001) return 'Wallet request cancelled.';
  if (code === -32002) return 'Check the request already open in MetaMask.';
  return error?.shortMessage || error?.message || 'Wallet request failed.';
}

// Temporary UI access for the verified operator wallet only.
// This is a frontend restriction, not an on-chain access control.
const OPERATOR_TEST_ENABLED = true;

function operatorTesting(account) {
  if (typeof window === 'undefined' || !same(account, OPERATOR)) {
    return false;
  }

  const hostname = window.location.hostname;
  const localTesting =
    LOCAL_TEST_ENABLED &&
    ['localhost', '127.0.0.1'].includes(hostname);

  const productionOperatorTesting =
    OPERATOR_TEST_ENABLED &&
    window.location.protocol === 'https:' &&
    hostname === 'metawork.tools';

  return localTesting || productionOperatorTesting;
}

function allowed(kind, account) {
  if (!account) return false;
  if (operatorTesting(account)) return true;
  return kind === 'deposit'
    ? PUBLIC_DEPOSITS_ENABLED
    : PUBLIC_REDEMPTIONS_ENABLED;
}

export default function EthereumWalletPanel() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balances, setBalances] = useState(null);
  const [amount, setAmount] = useState('1');
  const normalizedAmount = amount.trim().replace(/^\./, '0.');
  const [tab, setTab] = useState('deposit');
  const [busy, setBusy] = useState(false);
  const [unresolved, setUnresolved] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState([]);

  const pending = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const readSequence = useRef(0);

  const vault = CONFIG.wrapperAddress;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);

  function publicClient(selectedProvider) {
    return createPublicClient({
      chain: mainnet,
      transport: custom(selectedProvider),
    });
  }

  async function refreshBalances(selectedProvider, selectedAccount) {
    const version = generation.current;
    const sequence = ++readSequence.current;

    async function currentSession() {
      const [chain, accounts] = await Promise.all([
        selectedProvider.request({ method: 'eth_chainId' }),
        selectedProvider.request({ method: 'eth_accounts' }),
      ]);
      return {
        chain: Number(chain),
        account: accounts?.[0] ? getAddress(accounts[0]) : null,
      };
    }

    const initial = await currentSession();
    if (!mounted.current || version !== generation.current) return;

    if (initial.chain !== 1 || !same(initial.account, selectedAccount)) {
      setChainId(initial.chain);
      setAccount(initial.account);
      setBalances(null);
      throw new Error(
        initial.chain !== 1
          ? 'Switch MetaMask to Ethereum mainnet.'
          : 'Wallet account changed. Refresh the connection.',
      );
    }

    if (!vault) throw new Error('Wrapper address is not configured.');
    const client = publicClient(selectedProvider);
    const blockNumber = await client.getBlockNumber();
    const read = (address, abi, functionName, args = []) =>
      client.readContract({
        address, abi, functionName, args, blockNumber,
      });

    const [asset, shareDecimals, usdcDecimals] = await Promise.all([
      read(vault, vaultAbi, 'asset'),
      read(vault, vaultAbi, 'decimals'),
      read(USDC, erc20Abi, 'decimals'),
    ]);

    if (
      !same(asset, USDC) ||
      Number(shareDecimals) !== 18 ||
      Number(usdcDecimals) !== 6
    ) {
      throw new Error('Unexpected wrapper asset or token decimals.');
    }

    const [eth, usdc, shares, allowance] = await Promise.all([
      client.getBalance({ address: selectedAccount, blockNumber }),
      read(USDC, erc20Abi, 'balanceOf', [selectedAccount]),
      read(vault, vaultAbi, 'balanceOf', [selectedAccount]),
      read(USDC, erc20Abi, 'allowance', [selectedAccount, vault]),
    ]);
    const assets = await read(vault, vaultAbi, 'convertToAssets', [shares]);

    const final = await currentSession();
    if (
      !mounted.current ||
      version !== generation.current ||
      sequence !== readSequence.current
    ) return;

    if (final.chain !== 1 || !same(final.account, selectedAccount)) {
      setChainId(final.chain);
      setAccount(final.account);
      setBalances(null);
      return;
    }

    setChainId(1);
    setAccount(final.account);
    setBalances({ eth, usdc, shares, allowance, assets });
  }

  useEffect(() => {
    if (!provider) return;

    let stopped = false;
    let checking = false;
    let sessionKey = null;
    let lastBalanceRead = 0;

    function invalidate() {
      generation.current++;
      readSequence.current++;
      sessionKey = null;
      lastBalanceRead = 0;
      setBalances(null);
      setChainId(null);
      setStatus('');
      setError('');
    }

    async function synchronize() {
      if (stopped || checking) return;
      checking = true;
      const version = generation.current;

      try {
        const [chain, accounts] = await Promise.all([
          provider.request({ method: 'eth_chainId' }),
          provider.request({ method: 'eth_accounts' }),
        ]);

        if (stopped || version !== generation.current) return;

        const nextChain = Number(chain);
        const nextAccount = accounts?.[0]
          ? getAddress(accounts[0])
          : null;
        const nextKey =
          String(nextChain) + ':' + (nextAccount || '').toLowerCase();
        const changed = nextKey !== sessionKey;

        if (changed) {
          generation.current++;
          readSequence.current++;
          sessionKey = nextKey;
          lastBalanceRead = 0;
          setBalances(null);
          setStatus('');
          setError('');
        }

        setChainId(nextChain);
        setAccount(nextAccount);

        if (
          nextChain === 1 &&
          nextAccount &&
          (changed || Date.now() - lastBalanceRead >= 15000)
        ) {
          lastBalanceRead = Date.now();
          const balanceVersion = generation.current;

          void refreshBalances(provider, nextAccount).catch((cause) => {
            if (
              !stopped &&
              mounted.current &&
              balanceVersion === generation.current
            ) {
              lastBalanceRead = 0;
              setBalances(null);
              setError(errorMessage(cause));
            }
          });
        }
      } catch (cause) {
        if (!stopped && version === generation.current) {
          generation.current++;
          readSequence.current++;
          sessionKey = null;
          lastBalanceRead = 0;
          setBalances(null);
          setChainId(null);
          setError(errorMessage(cause));
        }
      } finally {
        checking = false;
      }
    }

    function changed() {
      if (stopped) return;
      invalidate();
      void synchronize();
    }

    function disconnected() {
      if (stopped) return;
      invalidate();
      setAccount(null);
    }

    function focused() {
      lastBalanceRead = 0;
      void synchronize();
    }

    function visibilityChanged() {
      if (document.visibilityState === 'visible') focused();
    }

    provider.on?.('accountsChanged', changed);
    provider.on?.('chainChanged', changed);
    provider.on?.('disconnect', disconnected);
    window.addEventListener('focus', focused);
    document.addEventListener('visibilitychange', visibilityChanged);

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void synchronize();
    }, 2000);

    void synchronize();

    return () => {
      stopped = true;
      generation.current++;
      readSequence.current++;
      window.clearInterval(timer);
      provider.removeListener?.('accountsChanged', changed);
      provider.removeListener?.('chainChanged', changed);
      provider.removeListener?.('disconnect', disconnected);
      window.removeEventListener('focus', focused);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [provider]);

  // Provider synchronization owns initial reads and balance refreshes.

  async function connect() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const injected = window.ethereum;
      const candidates = injected?.providers || [injected];
      const selected =
        candidates.find((item) => item?.isMetaMask && !item?.isRabby) ||
        injected;
      if (!selected?.request) throw new Error('Open this page in a wallet-enabled browser.');

      const accounts = await selected.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) throw new Error('No wallet account returned.');

      generation.current++;
      setProvider(selected);
      setAccount(getAddress(accounts[0]));
      setChainId(Number(await selected.request({ method: 'eth_chainId' })));
      setBalances(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function switchNetwork() {
    if (!provider || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }],
      });
      setChainId(Number(await provider.request({ method: 'eth_chainId' })));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function transact() {
    if (pending.current || unresolved) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setStatus('');

    let hash;
    let walletRequested = false;
    let receiptKnown = false;

    try {
      if (!provider || !account || !vault) throw new Error('Connect a wallet first.');
      const kind = tab === 'deposit' ? 'deposit' : 'redeem';
      if (!allowed(kind, account)) throw new Error('Transactions are not enabled for this wallet.');

      const selectedAccount = account;
      const version = generation.current;
      const client = publicClient(provider);

      async function assertSession() {
        const [accounts, chain] = await Promise.all([
          provider.request({ method: 'eth_accounts' }),
          provider.request({ method: 'eth_chainId' }),
        ]);
        if (
          !mounted.current ||
          version !== generation.current ||
          !same(accounts?.[0], selectedAccount)
        ) throw new Error('Wallet changed. Review and start again.');
        if (Number(chain) !== 1) throw new Error('Ethereum mainnet is required.');
        if (!allowed(kind, selectedAccount)) throw new Error('This action is no longer enabled.');
      }

      await assertSession();
      const asset = await client.readContract({
        address: vault, abi: vaultAbi, functionName: 'asset',
      });
      if (!same(asset, USDC)) throw new Error('Unexpected wrapper asset.');

      let contract;
      let label;
      let confirmation;

      if (kind === 'deposit') {
        const input = normalizedAmount;
        if (!/^\d+(\.\d{1,6})?$/.test(input)) {
          throw new Error('Enter USDC with at most six decimal places.');
        }
        const assets = parseUnits(input, 6);
        if (assets <= 0n) throw new Error('Enter an amount greater than zero.');

        const [balance, allowance] = await Promise.all([
          client.readContract({
            address: USDC, abi: erc20Abi, functionName: 'balanceOf',
            args: [selectedAccount],
          }),
          client.readContract({
            address: USDC, abi: erc20Abi, functionName: 'allowance',
            args: [selectedAccount, vault],
          }),
        ]);
        if (balance < assets) throw new Error('Insufficient USDC.');

        if (allowance < assets) {
          contract = {
            address: USDC, abi: erc20Abi, functionName: 'approve',
            args: [vault, assets],
          };
          label = 'USDC approval';
          confirmation =
            'Approve exactly ' + formatUnits(assets, 6) +
            ' USDC for the MetaWork Tokenizer?\n\n' +
            vault + '\n\nThis does not deposit. Deposit requires a separate click.';
        } else {
          const preview = await client.readContract({
            address: vault, abi: vaultAbi, functionName: 'previewDeposit',
            args: [assets],
          });
          if (preview <= 0n) throw new Error('Deposit preview returned zero shares.');
          contract = {
            address: vault, abi: vaultAbi, functionName: 'deposit',
            args: [assets, selectedAccount],
          };
          label = 'deposit';
          confirmation =
            'Deposit ' + formatUnits(assets, 6) + ' USDC?\n\n' +
            'Estimated shares: ' + formatUnits(preview, 18) + ' ' + SYMBOL +
            '\nRecipient: ' + selectedAccount +
            '\n\nPreview is not a guaranteed execution quote. Capital is at risk.';
        }
      } else {
        const shares = await client.readContract({
          address: vault, abi: vaultAbi, functionName: 'balanceOf',
          args: [selectedAccount],
        });
        if (shares <= 0n) throw new Error('No wallet-owned shares to redeem.');
        const preview = await client.readContract({
          address: vault, abi: vaultAbi, functionName: 'previewRedeem',
          args: [shares],
        });
        if (preview <= 0n) throw new Error('Redemption preview returned zero USDC.');
        contract = {
          address: vault, abi: vaultAbi, functionName: 'redeem',
          args: [shares, selectedAccount, selectedAccount],
        };
        label = 'redemption';
        confirmation =
          'Redeem your entire wallet-owned position?\n\n' +
          formatUnits(shares, 18) + ' ' + SYMBOL +
          '\nEstimated USDC: ' + formatUnits(preview, 6) +
          '\nRecipient: ' + selectedAccount +
          '\n\nSubject to available liquidity. Preview is not guaranteed.';
      }

      await assertSession();
      setStatus('Simulating ' + label + '…');
      await client.simulateContract({ ...contract, account: selectedAccount });
      const estimate = await client.estimateContractGas({
        ...contract, account: selectedAccount,
      });
      const gas = (estimate * 150n + 99n) / 100n;
      await client.simulateContract({
        ...contract, account: selectedAccount, gas,
      });

      const fees = await client.estimateFeesPerGas();
      if (fees.maxFeePerGas === undefined || fees.maxPriorityFeePerGas === undefined) {
        throw new Error('Could not obtain an Ethereum fee quote.');
      }
      const eth = await client.getBalance({ address: selectedAccount });
      if (eth < gas * fees.maxFeePerGas) throw new Error('Insufficient ETH for gas.');

      if (!window.confirm(confirmation)) {
        setStatus('Cancelled. No wallet transaction requested.');
        return;
      }

      await assertSession();
      await client.simulateContract({
        ...contract, account: selectedAccount, gas,
      });
      await assertSession();

      const payload = {
        from: selectedAccount,
        to: contract.address,
        data: encodeFunctionData({
          abi: contract.abi,
          functionName: contract.functionName,
          args: contract.args,
        }),
        value: '0x0',
        gas: toHex(gas),
        maxFeePerGas: toHex(fees.maxFeePerGas),
        maxPriorityFeePerGas: toHex(fees.maxPriorityFeePerGas),
      };

      setStatus('Review ' + label + ' in MetaMask.');
      walletRequested = true;
      hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [payload],
      });
      setUnresolved(true);
      setTransactions((items) => [...items, { label, hash, status: 'pending' }]);
      setStatus('Waiting for ' + label + ' confirmation…');

      const receipt = await client.waitForTransactionReceipt({ hash });
      receiptKnown = true;
      setUnresolved(false);
      setTransactions((items) => items.map((item) =>
        item.hash === hash ? { ...item, status: receipt.status } : item,
      ));
      if (receipt.status !== 'success') {
        throw new Error(label + ' reverted. Inspect the transaction before retrying.');
      }

      setStatus(label === 'USDC approval'
        ? 'Approval confirmed. Review the amount and click again to deposit.'
        : label + ' confirmed.');

      try {
        await assertSession();
        await refreshBalances(provider, selectedAccount);
      } catch {
        setStatus(label + ' confirmed. Refresh balances after checking the connected wallet.');
      }
    } catch (cause) {
      const code = cause?.code ?? cause?.cause?.code ?? cause?.cause?.cause?.code;
      if (walletRequested && !receiptKnown && code !== 4001) {
        setUnresolved(true);
        setStatus(
          'Check MetaMask and transaction history before retrying.' +
          (hash ? ' Transaction: ' + hash : ''),
        );
      }
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function refresh() {
    if (!provider || !account || pending.current) return;
    setError('');
    try {
      await refreshBalances(provider, account);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  let requestedAssets = 0n;
  try {
    if (/^\d+(\.\d{1,6})?$/.test(normalizedAmount)) {
      requestedAssets = parseUnits(normalizedAmount, 6);
    }
  } catch {
    requestedAssets = 0n;
  }

  const onMainnet = chainId === 1;
  const kind = tab === 'deposit' ? 'deposit' : 'redeem';
  const enabled = onMainnet && allowed(kind, account);
  const needsApproval = Boolean(
    balances && requestedAssets > 0n && balances.allowance < requestedAssets,
  );
  const canAct =
    enabled && balances && !busy && !unresolved &&
    (tab === 'deposit'
      ? requestedAssets > 0n && balances.usdc >= requestedAssets
      : balances.shares > 0n);

  return (
    <section className="overflow-hidden rounded-3xl border border-sky-400/20 bg-[#101827] shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
      <div className="border-b border-white/[0.06] px-6 py-5">
        <h2 className="font-semibold">Your position</h2>
        <p className="mt-2 text-xs text-slate-400">
          Ethereum · {SYMBOL}
        </p>
      </div>

      <div className="space-y-5 p-6">
        {!account ? (
          <button type="button" className={button + ' w-full'} onClick={connect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect MetaMask'}
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 text-xs">
              <a
                href={'https://etherscan.io/address/' + account}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sky-300"
              >
                {account.slice(0, 6)}…{account.slice(-4)}
              </a>
              <span className={onMainnet ? 'text-emerald-300' : 'text-amber-300'}>
                {onMainnet ? 'Ethereum connected' : 'Wrong network'}
              </span>
            </div>

            {!onMainnet ? (
              <button type="button" className={button + ' w-full'} onClick={switchNetwork} disabled={busy}>
                Switch to Ethereum mainnet
              </button>
            ) : (
              <>
                <div>
                  <p className="text-xs text-slate-400">Estimated position value</p>
                  <p className="mt-3 text-3xl font-semibold">
                    {balances ? display(balances.assets, 6) : '—'}
                    <span className="ml-2 text-base text-slate-400">USDC</span>
                  </p>
                  <p className="mt-2 break-all text-xs text-slate-500">
                    {balances ? display(balances.shares, 18, 18) : '—'} {SYMBOL}
                  </p>
                </div>

                <dl className="space-y-2 border-y border-white/[0.06] py-4 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Wallet USDC</dt>
                    <dd>{balances ? display(balances.usdc, 6) : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Ethereum ETH</dt>
                    <dd>{balances ? display(balances.eth, 18, 8) : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">USDC allowance</dt>
                    <dd>{balances ? display(balances.allowance, 6) : '—'}</dd>
                  </div>
                </dl>

                <div className="flex gap-1 rounded-xl bg-black/20 p-1">
                  {['deposit', 'withdraw'].map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={busy}
                      onClick={() => setTab(value)}
                      className={'flex-1 rounded-lg py-2.5 text-sm ' +
                        (tab === value ? 'bg-white/10 text-white' : 'text-slate-400')}
                    >
                      {value === 'deposit' ? 'Deposit' : 'Withdraw'}
                    </button>
                  ))}
                </div>

                {tab === 'deposit' ? (
                  <div>
                    <label htmlFor="galaxy-enhanced-amount" className="text-xs text-slate-400">
                      Deposit amount · USDC
                    </label>
                    <input
                      id="galaxy-enhanced-amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      disabled={busy || !enabled}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-2xl outline-none disabled:opacity-50"
                    />
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-slate-400">
                    Redeem your entire wallet-owned position. Protection shares
                    at the dead address are not included. Withdrawals depend on liquidity.
                  </p>
                )}

                <button
                  type="button"
                  className={button + ' w-full'}
                  disabled={!canAct}
                  onClick={transact}
                >
                  {busy ? 'Processing…' :
                    !enabled ? 'Transactions not enabled' :
                    tab === 'withdraw' ? 'Withdraw entire position' :
                    needsApproval ? 'Approve ' + formatUnits(requestedAssets, 6) + ' USDC' : 'Deposit USDC'}
                </button>

                <button type="button" onClick={refresh} disabled={busy}
                  className="text-xs text-sky-300 underline disabled:opacity-40">
                  Refresh balances
                </button>
              </>
            )}
          </>
        )}

        <p className="rounded-xl border border-amber-400/10 bg-amber-400/5 p-3 text-xs leading-5 text-amber-300">
          {operatorTesting(account)
            ? 'Deposits and withdrawals are enabled. Transactions use real Ethereum mainnet funds. Capital is at risk.'
            : 'Deposits and withdrawals are enabled. Transactions use real Ethereum mainnet funds. Capital is at risk.'}
        </p>
        <p className="text-xs leading-5 text-slate-500">
          Approval and deposit require separate clicks. Position value is an
          estimate, not a guarantee of immediately available withdrawal liquidity.
        </p>
        {status && <p role="status" className="break-words text-xs leading-6 text-slate-300">{status}</p>}
        {error && <p role="alert" className="break-words rounded-xl bg-red-400/5 p-3 text-xs leading-6 text-red-300">{error}</p>}
        {transactions.map((tx) => (
          <a key={tx.hash} href={'https://etherscan.io/tx/' + tx.hash}
            target="_blank" rel="noopener noreferrer"
            className="block break-all text-xs text-sky-300 underline">
            {tx.label}: {tx.status} · {tx.hash}
          </a>
        ))}
      </div>
    </section>
  );
}
