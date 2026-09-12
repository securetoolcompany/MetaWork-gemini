'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { PeraWalletConnect } from '@perawallet/connect';
import algosdk from 'algosdk';

const WalletContext = createContext(undefined);

const MAINNET_CHAIN_ID = 416001;

export function WalletProvider({ children }) {
  const walletRef = useRef(null);

  const [peraWallet, setPeraWallet] = useState(null);
  const [accountAddress, setAccountAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletReady, setIsWalletReady] = useState(false);

  useEffect(() => {
    const wallet = new PeraWalletConnect({
      chainId: MAINNET_CHAIN_ID,
      shouldShowSignTxnToast: true,
    });

    walletRef.current = wallet;
    setPeraWallet(wallet);
    setIsWalletReady(true);

    const handleDisconnect = () => {
      setAccountAddress(null);
    };

    wallet.connector?.on('disconnect', handleDisconnect);

    wallet
      .reconnectSession()
      .then((accounts) => {
        setAccountAddress(accounts?.[0] ?? null);
      })
      .catch(() => {
        // No previous WalletConnect session is normal.
        setAccountAddress(null);
      });

    return () => {
      wallet.connector?.off?.('disconnect', handleDisconnect);

      if (walletRef.current === wallet) {
        walletRef.current = null;
      }
    };
  }, []);

  const connect = useCallback(async () => {
    const wallet = walletRef.current;

    if (!wallet) {
      const message = 'Pera Wallet is still initializing. Refresh and try again.';
      setError(message);
      throw new Error(message);
    }

    if (isConnecting) {
      return accountAddress;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // A stale restored address must never prevent an explicit new connection.
      if (wallet.connector?.connected) {
        try {
          await wallet.disconnect();
        } catch {
          // Continue: connect() will create a fresh request if possible.
        }
        setAccountAddress(null);
      }

      const accounts = await wallet.connect();
      const address = accounts?.[0] ?? null;

      if (!address) {
        throw new Error('Pera Wallet did not return an account address.');
      }

      setAccountAddress(address);
      return address;
    } catch (connectError) {
      if (connectError?.data?.type === 'CONNECT_MODAL_CLOSED') {
        return null;
      }

      const message =
        connectError instanceof Error
          ? connectError.message
          : 'Failed to connect Pera Wallet.';

      setError(message);
      throw connectError;
    } finally {
      setIsConnecting(false);
    }
  }, [accountAddress, isConnecting]);

  const disconnect = useCallback(async () => {
    const wallet = walletRef.current;

    try {
      await wallet?.disconnect();
    } finally {
      setAccountAddress(null);
      setError(null);
    }
  }, []);

  const signData = useCallback(
    async (data, message) => {
      const wallet = walletRef.current;

      if (!wallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      const signatures = await wallet.signData(
        [{ data, message }],
        accountAddress
      );

      return signatures[0];
    },
    [accountAddress]
  );

  const signTransaction = useCallback(
    async (txnGroups) => {
      const wallet = walletRef.current;

      if (!wallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      return wallet.signTransaction(txnGroups, accountAddress);
    },
    [accountAddress]
  );

  const signSingleTransaction = useCallback(
    async (txnBytes) => {
      const wallet = walletRef.current;

      if (!wallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      const signedTxns = await wallet.signTransaction(
        [[{ txn: txnBytes, signers: [accountAddress] }]],
        accountAddress
      );

      return signedTxns[0];
    },
    [accountAddress]
  );

  const signTransactionGroup = useCallback(
    async (txnBytesArray) => {
      const wallet = walletRef.current;

      if (!wallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      const txnGroup = txnBytesArray.map((txnBytes) => ({
        txn: algosdk.decodeUnsignedTransaction(txnBytes),
        signers: [accountAddress],
      }));

      try {
        const signedTxns = await wallet.signTransaction(
          [txnGroup],
          accountAddress
        );

        return signedTxns
          .map((signedTxn) =>
            signedTxn ? new Uint8Array(signedTxn) : null
          )
          .filter(Boolean);
      } catch (signError) {
        if (
          signError?.data?.type === 'CONNECT_MODAL_CLOSED' ||
          signError?.data?.type === 'SIGN_TRANSACTIONS_MODAL_CLOSED'
        ) {
          throw new Error('Transaction cancelled');
        }

        if (signError?.data?.code === 4001) {
          throw new Error('Transaction was rejected in Pera Wallet');
        }

        throw signError;
      }
    },
    [accountAddress]
  );

  const value = {
    peraWallet,
    accountAddress,
    isConnected: Boolean(accountAddress),
    isConnecting,
    isWalletReady,
    error,
    connect,
    disconnect,
    signData,
    signTransaction,
    signSingleTransaction,
    signTransactionGroup,
    setAccountAddress,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }

  return context;
}