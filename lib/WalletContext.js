'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { PeraWalletConnect } from '@perawallet/connect';
import algosdk from 'algosdk';

const WalletContext = createContext(undefined);

const stripBigInts = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return obj.toString(); // keep full precision
  }

  if (obj instanceof Uint8Array) {
    return obj; // leave raw bytes untouched
  }

  if (Array.isArray(obj)) {
    return obj.map(stripBigInts);
  }

  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = stripBigInts(v);
    }
    return out;
  }

  return obj;
};

export function WalletProvider({ children }) {
  const [peraWallet, setPeraWallet] = useState(null);
  const [accountAddress, setAccountAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isWalletReady, setIsWalletReady] = useState(false); // NEW FLAG

  // Initialize Pera Wallet on mount (client-side only)
  useEffect(() => {
    const wallet = new PeraWalletConnect({
      chainId: parseInt(process.env.NEXT_PUBLIC_ALGORAND_CHAIN_ID || '416002'),
      shouldShowSignTxnToast: true,
    });
    setPeraWallet(wallet);

    // Try to reconnect existing session
    wallet.reconnectSession().then(accounts => {
      if (accounts.length > 0) {
        setAccountAddress(accounts[0]);
        console.log('Reconnected to existing session:', accounts[0]);
        
        // Set up disconnect listener
        wallet.connector?.on('disconnect', () => {
          console.log('Wallet disconnected via event');
          setAccountAddress(null);
        });
      }
    }).catch(err => {
      console.log('No existing session to reconnect:', err.message);
    }).finally(() => {
      // Mark as ready whether it succeeded or failed to find an existing session
      setIsWalletReady(true); 
    });
  }, []);

  const signData = useCallback(async (data, message) => {
    if (!peraWallet || !accountAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      const signatures = await peraWallet.signData(
        [{ data, message }],
        accountAddress
      );
      return signatures[0];
    } catch (err) {
      console.error('Sign data error:', err);
      throw err;
    }
  }, [peraWallet, accountAddress]);

  const connect = useCallback(async () => {
    if (!peraWallet) {
      setError('Wallet not initialized');
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('Initiating Pera Wallet connection...');
      const accounts = await peraWallet.connect();
      
      if (accounts.length > 0) {
        setAccountAddress(accounts[0]);
        console.log('Connected to Pera Wallet:', accounts[0]);
        console.log('Connector status:', !!peraWallet.connector);
        
        // Set up disconnect listener
        peraWallet.connector?.on('disconnect', () => {
          console.log('Wallet disconnected');
          setAccountAddress(null);
        });

        // Link wallet to user account in database
        try {
          const authToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('auth_token='))
            ?.split('=')[1];

          if (authToken) {
            console.log('Auth token found, linking wallet to user account...');
            
            const nonceRes = await fetch('/api/auth/nonce', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletAddress: accounts[0] })
            });
            
            if (!nonceRes.ok) {
              throw new Error('Failed to get nonce');
            }
            
            const { message } = await nonceRes.json();
            console.log('Nonce received, requesting signature...');

            const signature = await peraWallet.signData(
              [{ data: new TextEncoder().encode(message), message }],
              accounts[0]
            );
            console.log('Signature received, linking wallet...');

            const linkRes = await fetch('/api/auth/wallet/link', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                walletAddress: accounts[0],
                signature: btoa(String.fromCharCode(...signature[0]))
              })
            });

            if (linkRes.ok) {
              console.log('✅ Wallet successfully linked to user account');
            } else {
              const errorText = await linkRes.text();
              console.error('Failed to link wallet:', errorText);
            }
          } else {
            console.log('No auth token found, skipping wallet link');
          }
        } catch (linkError) {
          console.error('Error linking wallet:', linkError);
        }

        return accounts[0];
      }
      return null;
    } catch (err) {
      if (err?.data?.type !== 'CONNECT_MODAL_CLOSED') {
        setError('Failed to connect wallet');
        console.error('Wallet connection error:', err);
      }
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [peraWallet]);

  const disconnect = useCallback(async () => {
  console.log('WalletContext: disconnect called');
  if (peraWallet) {
    try {
      await peraWallet.disconnect();
    } catch (err) {
      console.error('Pera disconnect error (might already be disconnected):', err);
    }
  }
    setAccountAddress(null);
  }, [peraWallet]);

    const signTransaction = useCallback(async (txnGroups) => {
      if (!peraWallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const signedTxns = await peraWallet.signTransaction([txnGroups]);
        return signedTxns;
      } catch (err) {
        console.error('Sign transaction error:', err);
        throw err;
      }
    }, [peraWallet, accountAddress]);

    const signSingleTransaction = useCallback(async (txnBytes) => {
      if (!peraWallet || !accountAddress) {
        throw new Error('Wallet not connected');
      }

      try {
        const signedTxns = await peraWallet.signTransaction([[{ txn: txnBytes }]]);
        return signedTxns[0];
      } catch (err) {
        console.error('Sign single transaction error:', err);
        throw err;
      }
    }, [peraWallet, accountAddress]);

    const signTransactionGroup = useCallback(async (txnBytesArray) => {
    if (!peraWallet) throw new Error('Wallet not initialized - please refresh the page');
    if (!accountAddress) throw new Error('Wallet not connected - please connect your Pera Wallet first');

    try {
      const txnGroup = txnBytesArray.map(txnBytes => ({
        txn: algosdk.decodeUnsignedTransaction(txnBytes),  // still works in v3.5.2
        signers: [accountAddress]
      }));
      console.log('txn type check:', typeof txnGroup[0].txn, txnGroup[0].txn instanceof algosdk.Transaction);
      const signedTxns = await peraWallet.signTransaction([txnGroup]);

      return signedTxns.map(s => s ? new Uint8Array(s) : null).filter(Boolean);
    } catch (err) {
      console.error('Sign transaction group error:', err);
      if (err?.data?.type === 'CONNECT_MODAL_CLOSED' || err?.data?.type === 'SIGN_TRANSACTIONS_MODAL_CLOSED') {
        throw new Error('Transaction cancelled - you closed the signing request');
      }
      if (err?.data?.code === 4001) throw new Error('Transaction was rejected in Pera Wallet');
      throw err;
    }
  }, [peraWallet, accountAddress]);

  const value = {
    peraWallet,
    accountAddress,
    isConnected: !!accountAddress,
    isConnecting,
    isWalletReady, // NOW EXPORTED TO THE REST OF THE APP
    error,
    connect,
    disconnect,
    signData,
    signTransaction,
    signSingleTransaction,
    signTransactionGroup,
    setAccountAddress
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