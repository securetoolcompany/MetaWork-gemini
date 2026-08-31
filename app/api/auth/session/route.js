import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Get session from cookie
export async function GET(request) {
  try {
    console.log('=== SESSION CHECK START ===');
    const { db } = await connectToDatabase();
    
    const allCookies = request.cookies.getAll();
    console.log('All cookies received:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value })));
    
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      console.log('No auth_token cookie found');
      return NextResponse.json({ user: null });
    }
    
    console.log('Auth token found, length:', token.length);
    
    const decoded = verifyToken(token);
    
    if (!decoded || !decoded.userId) {
      console.log('Token verification failed or no userId');
      return NextResponse.json({ user: null });
    }
    
    console.log('Token decoded successfully:', { userId: decoded.userId, email: decoded.email });
    
    let queryId;
    try {
      queryId = new ObjectId(decoded.userId);
    } catch {
      queryId = decoded.userId;
    }
    const user = await db.collection('users').findOne({
      $or: [{ _id: queryId }, { _id: decoded.userId }, { id: decoded.userId }]
    });

    if (!user) {
      console.log('User not found in database for userId:', decoded.userId);
      return NextResponse.json({ user: null });
    }
    
    console.log('User found in database:', { _id: user._id, email: user.email });
    
    // If user doesn't have 'id' field, add it now
    if (!user.id) {
      console.log('User missing id field, adding it...');
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { id: user._id } }
      );
      user.id = user._id;
    }
    
    console.log('=== SESSION CHECK END - USER AUTHENTICATED ===');
    
    return NextResponse.json({
      user: {
        id: user.id || user._id,
        walletAddress: user.walletAddress || null,
        wallets: Array.isArray(user.wallets) ? user.wallets : [],
        email: user.email,
        name: user.profile?.displayName || user.name,
        image: user.profile?.avatar || user.image,
        username: user.username,
        membershipTier: user.membershipTier,
        role: user.role,
        isAdmin: user.isAdmin === true || user.role === 'admin',
      }
    });
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json({ user: null });
  }
}
