'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { PeraWalletConnect } from '@perawallet/connect';

const WalletContext = createContext(undefined);

// Helper function to recursively strip BigInt values from any object
// Converts BigInt to string to preserve full precision
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
    });

    return () => {
      wallet.disconnect().catch(() => {});
    };
  }, []);

  // MOVE signData HERE - before connect
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
          // Get auth token from cookie
          const authToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('auth_token='))
            ?.split('=')[1];

          if (authToken) {
            console.log('Auth token found, linking wallet to user account...');
            
            // Generate nonce
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

            // Sign the nonce
            const signature = await peraWallet.signData(
              [{ data: new TextEncoder().encode(message), message }],
              accounts[0]
            );
            console.log('Signature received, linking wallet...');

            // Link wallet to user
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
          // Don't fail the connection if linking fails
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
  }, [peraWallet]); // Removed signData from dependencies, using peraWallet.signData directly

  const disconnect = useCallback(async () => {
    if (peraWallet) {
      try {
        await peraWallet.disconnect();
      } catch (err) {
        console.error('Disconnect error:', err);
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
    if (!peraWallet) {
      throw new Error('Wallet not initialized - please refresh the page');
    }
    
    if (!accountAddress) {
      throw new Error('Wallet not connected - please connect your Pera Wallet first');
    }

    try {
      console.log('=== signTransactionGroup Debug ===');
      console.log('Number of transactions:', txnBytesArray.length);
      console.log('Wallet instance exists:', !!peraWallet);
      console.log('Account:', accountAddress);
      console.log('Connector exists:', !!peraWallet.connector);
      
      const txnsForWalletConnect = txnBytesArray.map((txnBytes, index) => {
        console.log(`Processing transaction ${index}, length: ${txnBytes?.length}`);
        
        const uint8 = txnBytes instanceof Uint8Array ? txnBytes : new Uint8Array(txnBytes);
        const base64Txn = btoa(String.fromCharCode.apply(null, uint8));
        console.log(`Transaction ${index} converted to base64, length: ${base64Txn.length}`);
        
        return { txn: base64Txn };
      });
      
      console.log('Sending transactions via WalletConnect...');
      
      if (!peraWallet.connector) {
        throw new Error('WalletConnect session not available - please reconnect your wallet');
      }
      
      const result = await peraWallet.connector.sendCustomRequest({
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        jsonrpc: '2.0',
        method: 'algo_signTxn',
        params: [txnsForWalletConnect]
      });
      
      console.log('Signed transactions received:', result?.length);
      
      const signedTxns = result.filter(Boolean).map(sig => {
        if (typeof sig === 'string') {
          const binaryStr = atob(sig);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          return bytes;
        }
        return new Uint8Array(sig);
      });
      
      return signedTxns;
    } catch (err) {
      console.error('Sign transaction group error:', err);
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Error data:', err.data);
      
      if (err.data?.type === 'SIGN_TRANSACTIONS' && err.data?.code === 4001) {
        throw new Error('Transaction was rejected in Pera Wallet');
      }
      
      if (err.message?.includes('sendCustomRequest') || err.message?.includes('connector')) {
        throw new Error('Wallet session expired - please disconnect and reconnect your Pera Wallet');
      }
      
      if (err.message?.includes('closed') || err.data?.type === 'CONNECT_MODAL_CLOSED') {
        throw new Error('Pera Wallet popup was closed - please try again');
      }
      
      if (err.message?.toLowerCase().includes('cancel') || 
          err.message?.toLowerCase().includes('reject') ||
          err.data?.type === 'SIGN_TRANSACTIONS_MODAL_CLOSED') {
        throw new Error('Transaction cancelled - you closed the signing request');
      }
      
      if (err.message?.includes('Invalid Input') || err.message?.includes('does not need to be signed')) {
        throw new Error('Transaction format error - please try again');
      }
      
      if (err.message?.includes('BigInt') || err.message?.includes('serialize') || err.message?.includes('getEncodingSchema')) {
        throw new Error('Transaction encoding error - please disconnect and reconnect your wallet, then try again.');
      }
      
      throw err;
    }
  }, [peraWallet, accountAddress]);

  const value = {
    peraWallet,
    accountAddress,
    isConnected: !!accountAddress,
    isConnecting,
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
