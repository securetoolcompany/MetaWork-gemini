import { NextResponse } from 'next/server';
import { generateNonce } from '@/lib/signing';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    // Simple session-based nonce for EDM (no wallet required)
    const nonce = generateNonce();
    
    return NextResponse.json({ 
      nonce,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Nonce GET error:', error);
    return NextResponse.json({ error: 'Nonce unavailable' }, { status: 500 });
  }
}

// Generate a nonce for wallet authentication
export async function POST(request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }
    
    // Generate a unique nonce
    const nonce = generateNonce();
    const timestamp = Date.now();
    const message = `Sign this message to authenticate with MetaWork.\n\nNonce: ${nonce}\nTimestamp: ${timestamp}\nWallet: ${walletAddress}`;
    
    // Store the nonce in database with expiration
    const { db } = await connectToDatabase();
    await db.collection('auth_nonces').updateOne(
      { walletAddress },
      { 
        $set: { 
          nonce, 
          message,
          timestamp,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
        } 
      },
      { upsert: true }
    );
    
    return NextResponse.json({
      nonce,
      message,
      timestamp
    });
  } catch (error) {
    console.error('Nonce generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate nonce' },
      { status: 500 }
    );
  }
}
