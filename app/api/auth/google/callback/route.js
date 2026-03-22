import { NextResponse } from 'next/server';
import { generateToken, createOrUpdateUser } from '@/lib/auth';

// Google OAuth callback handler
export async function GET(request) {
  try {
    console.log('=== GOOGLE CALLBACK START ===');
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    if (error) {
      console.log('OAuth error:', error);
      return NextResponse.redirect(new URL('/login?error=access_denied', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    }
    
    if (!code) {
      console.log('No code provided');
      return NextResponse.redirect(new URL('/login?error=no_code', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    }
    
    console.log('Exchanging code for tokens...');
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    });
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    }
    
    const tokens = await tokenResponse.json();
    console.log('Token exchange successful');
    
    // Get user info from Google
    console.log('Fetching user info from Google...');
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    if (!userInfoResponse.ok) {
      console.error('User info fetch failed');
      return NextResponse.redirect(new URL('/login?error=user_info_failed', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
    }
    
    const googleUser = await userInfoResponse.json();
    console.log('Google user info:', { email: googleUser.email, name: googleUser.name });
    
    // Create or update user in database
    console.log('Creating/updating user in database...');
    const user = await createOrUpdateUser({
      email: googleUser.email,
      name: googleUser.name,
      image: googleUser.picture,
      googleId: googleUser.id,
      authMethod: 'google',
      lastLoginAt: new Date()
    });
    
    console.log('User created/updated:', { id: user.id, email: user.email });
    
    // Generate JWT token (user.id will now be defined thanks to auth.js fix)
    const token = generateToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      walletAddress: user.walletAddress
    });
    
    console.log('JWT token generated, length:', token.length);
    
    // Redirect to home
    const response = NextResponse.redirect(
      new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    );
    
    // Set HttpOnly cookie with the token
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });
    
    console.log('Cookie set successfully');
    console.log('=== GOOGLE CALLBACK END - REDIRECTING TO / ===');
    
    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=server_error', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  }
}
