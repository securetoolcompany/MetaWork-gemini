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
  const { user, token, updateUser, checkSession } = useAuth();
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
      const nonceResponse = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: accountAddress })
      });

      if (!nonceResponse.ok) {
        throw new Error('Failed to fetch authentication nonce');
      }

      const { message } = await nonceResponse.json();

      // Step 2: Request user signature via the wallet provider
      const messageBytes = new TextEncoder().encode(message);

      const signature = await signData(messageBytes, message);

      const signatureBytes =
        signature instanceof Uint8Array
          ? signature
          : new Uint8Array(signature);

      const signatureBase64 = btoa(
        String.fromCharCode(...signatureBytes)
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
          signature: signatureBase64,
        })
      });

      const data = await response.json();

      if (data.success) {
        // Step 4: Update local session with the new token
        // This is critical because a merge might have changed the underlying User ID
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }

        // Update the in-memory user immediately so the wallet list renders without refresh.
        if (data.user) {
          updateUser(data.user);
        }

        // Reconcile AuthContext with the canonical server session/token state.
        if (typeof checkSession === 'function') {
          await checkSession();
        }

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