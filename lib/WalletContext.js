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

const MAINNET_CHAIN_ID = 'mainnet-v1.0'; 

export function WalletProvider({ children }) {
  const [peraWallet, setPeraWallet] = useState(null);
  const [accountAddress, setAccountAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletReady, setIsWalletReady] = useState(false);

  useEffect(() => {
    // 1. Read string value from Vercel env
    const configuredChainId = process.env.NEXT_PUBLIC_ALGORAND_CHAIN_ID;

    // 2. Validate against human-readable MainNet target
    if (configuredChainId !== MAINNET_CHAIN_ID) {
      setError(
        `Wallet is disabled: expected MainNet chain ID ${MAINNET_CHAIN_ID}, received ${
          configuredChainId || 'missing'
        }.`
      );
      setIsWalletReady(true);
      return undefined;
    }

    // 3. Map text string safely to Pera's expected numeric code
    const peraNumericId = configuredChainId === 'mainnet-v1.0' ? 416001 : 416002;

    // 4. Initialize Pera Wallet with the correct numeric code variable
    const wallet = new PeraWalletConnect({
      chainId: peraNumericId,
      shouldShowSignTxnToast: true,
    });

    const handleDisconnect = () => {
      console.log('Wallet disconnected');
      setAccountAddress(null);
    };

    setPeraWallet(wallet);

    wallet
      .reconnectSession()
      .then((accounts) => {
        if (accounts?.length > 0) {
          setAccountAddress(accounts[0]);
          console.log('Reconnected to MainNet wallet session:', accounts[0]);
        }
      })
      .catch((reconnectError) => {
        console.log(
          'No existing wallet session to reconnect:',
          reconnectError?.message
        );
      })
      .finally(() => {
        setIsWalletReady(true);
      });

    wallet.connector?.on('disconnect', handleDisconnect);

    return () => {
      wallet.connector?.off?.('disconnect', handleDisconnect);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!isWalletReady || !peraWallet) {
      setError('Wallet is still initializing. Refresh and try again.');
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('Initiating Pera Wallet MainNet connection...');
      const accounts = await peraWallet.connect();

      if (accounts?.length > 0) {
        const address = accounts[0];
        setAccountAddress(address);
        console.log('Connected to Pera Wallet:', address);
        return address;
      }

      return null;
    } catch (connectError) {
      const wasCancelled =
        connectError?.data?.type === 'CONNECT_MODAL_CLOSED';

      if (wasCancelled) {
        console.log('Pera Wallet connection cancelled by user');
        return null;
      }

      console.error('Wallet connection error:', connectError);
      const message =
        connectError instanceof Error
          ? connectError.message
          : 'Failed to connect wallet';
      setError(message);
      throw connectError;
    } finally {
      setIsConnecting(false);
    }
  }, [isWalletReady, peraWallet]);

  const disconnect = useCallback(async () => {
    console.log('WalletContext: disconnect called');

    try {
      await peraWallet?.disconnect();
    } catch (disconnectError) {
      console.error(
        'Pera disconnect error (might already be disconnected):',
        disconnectError
      );
    } finally {
      setAccountAddress(null);
    }
  }, [peraWallet]);

  const signData = useCallback(
    async (data, message) => {
      if (!peraWallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const signatures = await peraWallet.signData(
          [{ data, message }],
          accountAddress
        );
        return signatures[0];
      } catch (signError) {
        console.error('Sign data error:', signError);
        throw signError;
      }
    },
    [peraWallet, accountAddress]
  );

  const signTransaction = useCallback(
    async (txnGroups) => {
      if (!peraWallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        return await peraWallet.signTransaction(txnGroups, accountAddress);
      } catch (signError) {
        console.error('Sign transaction error:', signError);
        throw signError;
      }
    },
    [peraWallet, accountAddress]
  );

  const signSingleTransaction = useCallback(
    async (txnBytes) => {
      if (!peraWallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const signedTxns = await peraWallet.signTransaction(
          [[{ txn: txnBytes, signers: [accountAddress] }]],
          accountAddress
        );
        return signedTxns[0];
      } catch (signError) {
        console.error('Sign single transaction error:', signError);
        throw signError;
      }
    },
    [peraWallet, accountAddress]
  );

  const signTransactionGroup = useCallback(
    async (txnBytesArray) => {
      if (!peraWallet) {
        throw new Error(
          'Wallet not initialized - refresh the page and try again'
        );
      }

      if (!accountAddress) {
        throw new Error(
          'Wallet not connected - connect your Pera Wallet first'
        );
      }

      try {
        const txnGroup = txnBytesArray.map((txnBytes) => ({
          txn: algosdk.decodeUnsignedTransaction(txnBytes),
          signers: [accountAddress],
        }));

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
        console.error('Sign transaction group error:', signError);

        if (
          signError?.data?.type === 'CONNECT_MODAL_CLOSED' ||
          signError?.data?.type === 'SIGN_TRANSACTIONS_MODAL_CLOSED'
        ) {
          throw new Error('Transaction cancelled - signing request was closed');
        }

        if (signError?.data?.code === 4001) {
          throw new Error('Transaction was rejected in Pera Wallet');
        }

        throw signError;
      }
    },
    [peraWallet, accountAddress]
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