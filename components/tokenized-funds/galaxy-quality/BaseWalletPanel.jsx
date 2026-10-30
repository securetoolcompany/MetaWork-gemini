// components/tokenized-funds/galaxy-quality/BaseWalletPanel.jsx

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
} from 'viem';
import { base } from 'viem/chains';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function firstAccount(accounts) {
  const value = Array.isArray(accounts) ? accounts[0] : null;

  return typeof value === 'string' &&
    isAddress(value, { strict: false })
    ? getAddress(value)
    : null;
}

function errorCode(error) {
  return (
    error?.code ??
    error?.cause?.code ??
    error?.cause?.cause?.code
  );
}

function errorMessage(error) {
  const code = errorCode(error);

  if (code === 4001) return 'Wallet request cancelled.';
  if (code === -32002) {
    return 'A wallet request is already open. Check your wallet.';
  }

  return error?.shortMessage || error?.message || 'Wallet request failed.';
}

export default function BaseWalletPanel() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [balances, setBalances] = useState(null);
  const [balanceError, setBalanceError] = useState(null);

  const requestPending = useRef(false);
  const session = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      session.current++;
    };
  }, []);

  useEffect(() => {
    if (!provider) return;

    function accountsChanged(accounts) {
      session.current++;
      setAccount(firstAccount(accounts));
      setBalances(null);
      setError(null);
    }

    function chainChanged(chain) {
      session.current++;
      setChainId(Number(chain));
      setBalances(null);
      setError(null);
    }

    function disconnected() {
      session.current++;
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
    if (!provider || !account || chainId !== base.id) {
      setBalances(null);
      return;
    }

    let cancelled = false;

    async function refresh() {
      const version = session.current;

      try {
        const client = createPublicClient({
          chain: base,
          transport: custom(provider),
        });

        if (await client.getChainId() !== base.id) return;

        const [eth, usdc, decimals] = await Promise.all([
          client.getBalance({ address: account }),
          client.readContract({
            address: USDC,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
          }),
          client.readContract({
            address: USDC,
            abi: erc20Abi,
            functionName: 'decimals',
          }),
        ]);

        if (Number(decimals) !== 6) {
          throw new Error('Unexpected Base USDC decimals.');
        }

        if (await client.getChainId() !== base.id) return;

        if (!cancelled && version === session.current) {
          setBalances({
            eth: formatEther(eth),
            usdc: formatUnits(usdc, 6),
          });
          setBalanceError(null);
        }
      } catch (cause) {
        if (!cancelled && version === session.current) {
          setBalances(null);
          setBalanceError(errorMessage(cause));
        }
      }
    }

    void refresh();

    const timer = window.setInterval(() => void refresh(), 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [provider, account, chainId]);

  async function connect() {
    if (requestPending.current) return;

    const ethereum = window.ethereum;

    if (!ethereum?.request) {
      setError('Open this page in a browser with an EVM wallet installed.');
      return;
    }

    requestPending.current = true;
    setBusy(true);
    setError(null);

    const version = ++session.current;

    try {
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      const nextAccount = firstAccount(accounts);

      if (!nextAccount) {
        throw new Error('The wallet did not return an account.');
      }

      const chain = await ethereum.request({
        method: 'eth_chainId',
      });

      if (!mounted.current || version !== session.current) return;

      setProvider(ethereum);
      setAccount(nextAccount);
      setChainId(Number(chain));
      setBalances(null);
    } catch (cause) {
      if (mounted.current && version === session.current) {
        setError(errorMessage(cause));
      }
    } finally {
      requestPending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function switchToBase() {
    if (!provider || requestPending.current) return;

    requestPending.current = true;
    setBusy(true);
    setError(null);

    const selectedProvider = provider;

    try {
      const wallet = createWalletClient({
        transport: custom(selectedProvider),
      });

      try {
        await wallet.switchChain({ id: base.id });
      } catch (cause) {
        if (Number(errorCode(cause)) !== 4902) throw cause;

        await wallet.addChain({ chain: base });
        await wallet.switchChain({ id: base.id });
      }

      const [accounts, chain] = await Promise.all([
        selectedProvider.request({ method: 'eth_accounts' }),
        selectedProvider.request({ method: 'eth_chainId' }),
      ]);

      if (!mounted.current) return;

      session.current++;
      setAccount(firstAccount(accounts));
      setChainId(Number(chain));
      setBalances(null);
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      requestPending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function clearSelection() {
    session.current++;
    setProvider(null);
    setAccount(null);
    setChainId(null);
    setBalances(null);
    setError(null);
    setBalanceError(null);
  }

  const onBase = chainId === base.id;

  return (
    <div className="mt-5">
      {!account ? (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? 'Connecting…' : 'Connect wallet'}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs text-slate-400">Connected wallet</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-200">
              {account}
            </p>
            <p
              className={`mt-3 text-xs ${
                onBase ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {onBase ? 'Connected to Base' : 'Switch to Base to continue'}
            </p>
          </div>

          {!onBase && (
            <button
              type="button"
              onClick={() => void switchToBase()}
              disabled={busy}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? 'Check your wallet…' : 'Switch to Base'}
            </button>
          )}

          {onBase && (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Wallet USDC</dt>
                <dd className="tabular-nums text-slate-200">
                  {balances
                    ? Number(balances.usdc).toLocaleString('en-US', {
                        maximumFractionDigits: 6,
                      })
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Base ETH for gas</dt>
                <dd className="tabular-nums text-slate-200">
                  {balances
                    ? Number(balances.eth).toLocaleString('en-US', {
                        maximumFractionDigits: 8,
                      })
                    : '—'}
                </dd>
              </div>
            </dl>
          )}

          <button
            type="button"
            onClick={clearSelection}
            disabled={busy}
            className="text-xs text-slate-400 underline underline-offset-4 hover:text-white disabled:opacity-50"
          >
            Clear wallet selection
          </button>
        </div>
      )}

      {(error || balanceError) && (
        <p role="alert" className="mt-3 text-xs leading-5 text-amber-300">
          {error || balanceError}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        Wallet balances are not your vault position. Connecting does
        not authorize spending. Clearing selection does not revoke
        permissions in your wallet.
      </p>
    </div>
  );
}