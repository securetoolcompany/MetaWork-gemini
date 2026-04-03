import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { generateToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    const loginIdentifier = email.toLowerCase().trim();
    const searchRegex = new RegExp(`^${loginIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const user = await db.collection('users').findOne({
      $or: [
        { email: searchRegex },
        { username: searchRegex }
      ]
    });

    if (!user) {
      console.log(`❌ Login Failed: No user found for ${loginIdentifier}`);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.password) {
      return NextResponse.json(
        { error: 'This account uses wallet authentication. Please connect your wallet.' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 4. Update last login using the correct internal ID
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
    );

    // 5. Generate token (Ensure we use the ID string)
    const userIdStr = user.id || user.userId || user._id.toString();
    
    const token = generateToken({
      userId: userIdStr,
      email: user.email,
      walletAddress: user.walletAddress
    });

    // 6. Build response
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: userIdStr,
        email: user.email,
        name: user.name || user.username,
        walletAddress: user.walletAddress,
        membershipTier: user.membershipTier || 'basic'
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
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}