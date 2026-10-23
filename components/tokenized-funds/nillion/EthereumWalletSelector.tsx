// components/tokenized-funds/nillion/EthereumWalletSelector.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import { isAddress } from 'viem';

type EthereumProvider = {
  request: (args: {
    method: string;
  }) => Promise<unknown>;
  on?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
};

type Props = {
  onAddressChange: (address: string | null) => void;
};

function firstAddress(accounts: unknown): string | null {
  if (!Array.isArray(accounts)) return null;

  const address = accounts[0];

  return typeof address === 'string' &&
    isAddress(address, { strict: false })
    ? address
    : null;
}

export default function EthereumWalletSelector({
  onAddressChange,
}: Props) {
  const callbackRef = useRef(onAddressChange);
  const mountedRef = useRef(false);
  const pendingRef = useRef(false);

  const [provider, setProvider] =
    useState<EthereumProvider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbackRef.current = onAddressChange;
  }, [onAddressChange]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!provider) return;

    function handleAccountsChanged(accounts: unknown) {
      const nextAddress = firstAddress(accounts);

      setAddress(nextAddress);
      setError(null);
      callbackRef.current(nextAddress);
    }

    function handleDisconnect() {
      setAddress(null);
      callbackRef.current(null);
    }

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('disconnect', handleDisconnect);

    return () => {
      provider.removeListener?.(
        'accountsChanged',
        handleAccountsChanged,
      );
      provider.removeListener?.('disconnect', handleDisconnect);
    };
  }, [provider]);

  async function connect() {
    if (pendingRef.current) return;

    const ethereum = (
      window as Window & {
        ethereum?: EthereumProvider;
      }
    ).ethereum;

    if (!ethereum?.request) {
      setError(
        'No browser Ethereum wallet detected. You can still use the address lookup below.',
      );
      return;
    }

    pendingRef.current = true;
    setConnecting(true);
    setError(null);

    try {
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!mountedRef.current) return;

      const nextAddress = firstAddress(accounts);

      if (!nextAddress) {
        throw new Error('The wallet did not return an Ethereum address.');
      }

      setProvider(ethereum);
      setAddress(nextAddress);
      callbackRef.current(nextAddress);
    } catch (cause) {
      if (!mountedRef.current) return;

      const code =
        typeof cause === 'object' &&
        cause !== null &&
        'code' in cause
          ? cause.code
          : null;

      setError(
        code === 4001
          ? 'Wallet connection was cancelled.'
          : code === -32002
            ? 'A wallet request is already open. Check your wallet.'
            : 'Unable to connect. Check your wallet or use the address lookup below.',
      );
    } finally {
      pendingRef.current = false;

      if (mountedRef.current) {
        setConnecting(false);
      }
    }
  }

  function clearSelection() {
    setProvider(null);
    setAddress(null);
    setError(null);
    callbackRef.current(null);
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connecting}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {connecting
            ? 'Connecting…'
            : address
              ? 'Reconnect Ethereum wallet'
              : 'Connect Ethereum wallet'}
        </button>

        {address && (
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 hover:border-slate-500"
          >
            Clear selection
          </button>
        )}
      </div>

      {address && (
        <p className="mt-3 break-all text-xs text-slate-400">
          Wallet selected: {address}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-300">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Selects an address for public earnings tracking. No signature
        or transaction is requested. Clearing the selection does not
        revoke wallet permissions.
      </p>
    </div>
  );
}