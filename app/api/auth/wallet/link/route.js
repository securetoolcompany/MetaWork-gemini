import { NextResponse } from 'next/server';
import { verifyToken, linkWalletToUser, generateToken } from '@/lib/auth';
import { verifySignature } from '@/lib/signing';
import { connectToDatabase } from '@/lib/mongodb';
import { isValidAddress } from '@/lib/algorand';

/**
 * API Route: Link wallet to existing account
 * Supports multi-chain groundwork by accepting a 'chain' parameter.
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { walletAddress, signature, chain = 'algorand' } = body; // Default to algorand
    
    if (!walletAddress || !signature) {
      return NextResponse.json(
        { error: 'Wallet address and signature are required' },
        { status: 400 }
      );
    }
    
    // Chain-specific validation groundwork
    if (chain === 'algorand') {
      if (!isValidAddress(walletAddress)) {
        return NextResponse.json(
          { error: 'Invalid Algorand wallet address' },
          { status: 400 }
        );
      }
    }
    // Note: Future chains (eth, sol, etc.) can add validation logic here
    
    // Get the stored nonce
    const { db } = await connectToDatabase();
    const nonceRecord = await db.collection('auth_nonces').findOne({ walletAddress });
    
    if (!nonceRecord || new Date() > nonceRecord.expiresAt) {
      return NextResponse.json(
        { error: 'Invalid or expired authentication request' },
        { status: 400 }
      );
    }
    
    // Verify the signature
    const signatureBytes = typeof signature === 'string'
      ? new Uint8Array(Buffer.from(signature, 'base64'))
      : new Uint8Array(signature);
    
    // verifySignature should be chain-aware or handled by chain-specific helpers
    const isValid = await verifySignature(
      nonceRecord.message,
      signatureBytes,
      walletAddress
    );
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Delete the used nonce
    await db.collection('auth_nonces').deleteOne({ walletAddress });
    
    // Link wallet to user using the updated lib/auth.js logic
    // This handles the wallets array and priority merging
    const linkedUser = await linkWalletToUser(decoded.userId, walletAddress, chain);
    
    // Generate new token for the user record
    // This is critical because the userId might change if a merge occurred
    const newToken = generateToken({ userId: linkedUser.id });
    
    return NextResponse.json({
      success: true,
      token: newToken, 
      user: {
        id: linkedUser.id,
        walletAddress: linkedUser.walletAddress, // Legacy primary wallet
        wallets: linkedUser.wallets,           // New multi-chain array
        email: linkedUser.email,
        name: linkedUser.profile?.displayName || linkedUser.name,
        membershipTier: linkedUser.membershipTier
      }
    });
  } catch (error) {
    console.error('Wallet linking error:', error);

    // Provide a clear conflict error if the wallet belongs to another account
    if (error.message.includes('already linked')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to link wallet' },
      { status: 500 }
    );
  }
}