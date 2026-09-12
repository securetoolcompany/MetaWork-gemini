'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { PeraWalletConnect } from '@perawallet/connect';
import algosdk from 'algosdk';

const WalletContext = createContext(undefined);

const MAINNET_CHAIN_ID = 416001;

export function WalletProvider({ children }) {
  const [peraWallet, setPeraWallet] = useState(null);
  const [accountAddress, setAccountAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletReady, setIsWalletReady] = useState(false);

  useEffect(() => {
    const configuredChainId = Number(
      process.env.NEXT_PUBLIC_ALGORAND_CHAIN_ID
    );

    if (configuredChainId !== MAINNET_CHAIN_ID) {
      setError(
        `Wallet is disabled: expected MainNet chain ID ${MAINNET_CHAIN_ID}, received ${
          configuredChainId || 'missing'
        }.`
      );
      setIsWalletReady(true);
      return undefined;
    }

    const wallet = new PeraWalletConnect({
      chainId: MAINNET_CHAIN_ID,
      shouldShowSignTxnToast: true,
    });

    const handleDisconnect = () => {
      setAccountAddress(null);
    };

    setPeraWallet(wallet);
    wallet.connector?.on('disconnect', handleDisconnect);

    wallet
      .reconnectSession()
      .then((accounts) => {
        if (accounts?.length) {
          setAccountAddress(accounts[0]);
        }
      })
      .catch(() => {
        // No persisted session is normal on first connection.
      })
      .finally(() => {
        setIsWalletReady(true);
      });

    return () => {
      wallet.connector?.off?.('disconnect', handleDisconnect);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!isWalletReady || !peraWallet) {
      const message = 'Wallet is still initializing. Refresh and try again.';
      setError(message);
      throw new Error(message);
    }

    if (isConnecting) {
      return accountAddress;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await peraWallet.connect();
      const address = accounts?.[0] || null;
      setAccountAddress(address);
      return address;
    } catch (connectError) {
      if (connectError?.data?.type === 'CONNECT_MODAL_CLOSED') {
        return null;
      }

      const message =
        connectError instanceof Error
          ? connectError.message
          : 'Failed to connect Pera Wallet';
      setError(message);
      throw connectError;
    } finally {
      setIsConnecting(false);
    }
  }, [accountAddress, isConnecting, isWalletReady, peraWallet]);

  const disconnect = useCallback(async () => {
    try {
      await peraWallet?.disconnect();
    } finally {
      setAccountAddress(null);
    }
  }, [peraWallet]);

  const signData = useCallback(
    async (data, message) => {
      if (!peraWallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      const signatures = await peraWallet.signData(
        [{ data, message }],
        accountAddress
      );
      return signatures[0];
    },
    [accountAddress, peraWallet]
  );

  const signTransaction = useCallback(
    async (txnGroups) => {
      if (!peraWallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      return peraWallet.signTransaction(txnGroups, accountAddress);
    },
    [accountAddress, peraWallet]
  );

  const signSingleTransaction = useCallback(
    async (txnBytes) => {
      if (!peraWallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      const signedTxns = await peraWallet.signTransaction(
        [[{ txn: txnBytes, signers: [accountAddress] }]],
        accountAddress
      );
      return signedTxns[0];
    },
    [accountAddress, peraWallet]
  );

  const signTransactionGroup = useCallback(
    async (txnBytesArray) => {
      if (!peraWallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      const txnGroup = txnBytesArray.map((txnBytes) => ({
        txn: algosdk.decodeUnsignedTransaction(txnBytes),
        signers: [accountAddress],
      }));

      try {
        const signedTxns = await peraWallet.signTransaction(
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
    [accountAddress, peraWallet]
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