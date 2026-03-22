import { NextResponse } from 'next/server';
import { verifyAlgorandSignature } from '@/lib/signing';
import { connectToDatabase } from '@/lib/mongodb';
import { generateToken, createOrUpdateUser } from '@/lib/auth';
import { isValidAddress } from '@/lib/algorand';

// Verify wallet signature and authenticate
export async function POST(request) {
  try {
    const body = await request.json();
    const { walletAddress, signature } = body;
    
    console.log('=== Wallet Auth Debug ===');
    console.log('Wallet Address:', walletAddress);
    
    if (!walletAddress || !signature) {
      return NextResponse.json(
        { error: 'Wallet address and signature are required' },
        { status: 400 }
      );
    }
    
    // Validate wallet address format
    if (!isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }
    
    // Get the stored nonce
    const { db } = await connectToDatabase();
    const nonceRecord = await db.collection('auth_nonces').findOne({ walletAddress });
    
    if (!nonceRecord) {
      return NextResponse.json(
        { error: 'No authentication request found. Please request a new nonce.' },
        { status: 400 }
      );
    }
    
    // Check if nonce has expired
    if (new Date() > nonceRecord.expiresAt) {
      await db.collection('auth_nonces').deleteOne({ walletAddress });
      return NextResponse.json(
        { error: 'Authentication request expired. Please request a new nonce.' },
        { status: 400 }
      );
    }
    
    console.log('Message to verify:', nonceRecord.message);
    
    // Decode signature from base64
    let signatureBytes;
    try {
      signatureBytes = new Uint8Array(Buffer.from(signature, 'base64'));
      console.log('Signature bytes length:', signatureBytes.length);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid signature format' },
        { status: 400 }
      );
    }
    
    // Verify the signature
    const isValid = verifyAlgorandSignature(
      nonceRecord.message,
      signatureBytes,
      walletAddress
    );
    
    console.log('Verification result:', isValid);
    
    if (!isValid) {
      console.log('Signature verification failed');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Delete the used nonce
    await db.collection('auth_nonces').deleteOne({ walletAddress });
    
    // Create or update user (will generate username if new user)
    const user = await createOrUpdateUser({
      walletAddress,
      authMethod: 'wallet',
      lastLoginAt: new Date()
    });
    
    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      username: user.username, // NEW: Include username
      walletAddress: user.walletAddress,
      email: user.email
    });
    
    // Set cookie
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username, // NEW: Include username in response
        walletAddress: user.walletAddress,
        email: user.email,
        name: user.profile?.displayName,
        image: user.profile?.avatar,
        membershipTier: user.membershipTier
      }
    });
    
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60
    });
    
    return response;
  } catch (error) {
    console.error('Wallet verification error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
