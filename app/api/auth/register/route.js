import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { generateToken } from '@/lib/auth';
import { generateSlugFromEmail } from '@/lib/utils/generateSlug';
import bcrypt from 'bcryptjs';

// Register new user with email/password
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Generate unique username slug
    const username = await generateSlugFromEmail(email, db);
    
    // Create user with new schema
    const newUser = {
      _id: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      email: email.toLowerCase(),
      password: hashedPassword,
      username, // NEW: Unique slug for Aisle URL
      authMethod: 'email',
      profile: {
        displayName: name || email.split('@')[0],
        bio: '',
        avatar: '',
        socialLinks: {}
      },
      membershipTier: 'free',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('users').insertOne(newUser);
    
    // Generate token
    const token = generateToken({
      userId: newUser._id,
      email: newUser.email,
      username: newUser.username // Include username in token
    });
    
    // Set cookie
    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username, // NEW: Return username
        name: newUser.profile.displayName,
        membershipTier: newUser.membershipTier
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
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
  