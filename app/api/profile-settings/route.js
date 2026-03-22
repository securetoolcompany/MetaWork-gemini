import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export async function POST(request) {
  try {
    // Auth check
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    const profileData = await request.json();
    
    // Build update object with only provided fields
    const updateFields = {};
    const allowedFields = ['name', 'bio', 'tagline', 'avatar', 'banner', 'socials'];
    
    allowedFields.forEach(field => {
      if (profileData[field] !== undefined) {
        updateFields[field] = profileData[field];
      }
    });
    
    updateFields.updatedAt = new Date();
    
    const { db } = await connectToDatabase();
    
    // Update user profile
    const result = await db.collection('users').updateOne(
      { id: decoded.userId },
      { $set: updateFields }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }
    
    // Return updated user
    const updatedUser = await db.collection('users').findOne(
      { id: decoded.userId },
      { projection: { password: 0 } }
    );
    
    return NextResponse.json({ 
      success: true, 
      user: updatedUser 
    });
  } catch (error) {
    console.error('Profile Settings API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server Error' 
    }, { status: 500 });
  }
}
