import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useWallet } from '@/lib/WalletContext';

/**
 * Hook to handle linking a blockchain wallet to a logged-in user account.
 * Supports multi-chain groundwork and account merging.
 */
export function useWalletLink() {
  const [isLinking, setIsLinking] = useState(false);
  const { user, setUser, token, setToken } = useAuth();
  const { accountAddress, signData } = useWallet();

  /**
   * Links the currently connected wallet to the authenticated user.
   * @param {string} chain - The blockchain identifier (default: 'algorand')
   */
  const linkWallet = async (chain = 'algorand') => {
    console.log('--- LINK ATTEMPT ---');
    console.log('Current Account:', accountAddress);
    console.log('Current Token:', token ? 'Found' : 'MISSING');
    
    if (!accountAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!token) {
      toast.error('Please log in first');
      return;
    }

    setIsLinking(true);

    try {
      // Step 1: Get nonce from the server to prevent replay attacks
      const nonceResponse = await fetch('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: accountAddress })
      });

      if (!nonceResponse.ok) {
        throw new Error('Failed to fetch authentication nonce');
      }

      const { message } = await nonceResponse.json();

      // Step 2: Request user signature via the wallet provider
      const signature = await signData(
        new Uint8Array(Buffer.from(message)),
        message
      );

      // Step 3: Send the signed message and chain metadata to the linking API
      // Note: We use the updated /api/auth/link-wallet route
      const response = await fetch('/api/auth/wallet/link', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: accountAddress,
          chain, // Groundwork for multi-chain support
          signature: Buffer.from(signature).toString('base64')
        })
      });

      const data = await response.json();

      if (data.success) {
        // Step 4: Update local session with the new token
        // This is critical because a merge might have changed the underlying User ID
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          if (setToken) setToken(data.token);
        }
        
        // Step 5: Update the global Auth Context with the merged user record
        // This ensures the UI (like Settings) immediately shows the new wallet list
        setUser(data.user);
        
        toast.success(`${chain.toUpperCase()} wallet linked successfully!`);
        console.log('User identity synchronized:', data.user.id);
      } else {
        throw new Error(data.error || 'Failed to link wallet');
      }
    } catch (error) {
      console.error('Wallet linking error:', error);
      toast.error(error.message || 'Failed to link wallet');
    } finally {
      setIsLinking(false);
    }
  };

  return { linkWallet, isLinking };
}