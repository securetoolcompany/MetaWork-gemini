import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { generateToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    // 1. Parse and validate input
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // 2. Database Lookup
    const { db } = await connectToDatabase();
    const loginIdentifier = email.toLowerCase().trim();
    // Regex for case-insensitive exact match
    const searchRegex = new RegExp(`^${loginIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const user = await db.collection('users').findOne({
      $or: [
        { email: searchRegex },
        { username: searchRegex }
      ]
    });

    // 3. Authentication Checks
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

    // 4. GENERATE TOKEN (Crucial to do this before setting the cookie)
    const userIdStr = user.id || user.userId || user._id.toString();
    const token = generateToken({
      userId: userIdStr,
      email: user.email,
      walletAddress: user.walletAddress
    });

    // 5. Update last login in Background
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
    );

    // 6. Build the JSON Response
    const response = NextResponse.json({
      success: true,
      token, // Kept for Client-side LocalStorage backup
      user: {
        id: userIdStr,
        email: user.email,
        name: user.name || user.username,
        walletAddress: user.walletAddress,
        membershipTier: user.membershipTier || 'basic'
      }
    });

    // 7. ATTACH THE COOKIE (This is what the Middleware reads)
    response.cookies.set('auth_token', token, {
      httpOnly: true, // Security: JS cannot touch this cookie
      secure: process.env.NODE_ENV === 'production', // Only over HTTPS in prod
      sameSite: 'lax', // Best balance for redirects
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
      path: '/', // Available across the whole site
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