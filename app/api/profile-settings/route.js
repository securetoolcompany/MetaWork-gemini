import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export async function POST(request) {
  try {
    // Auth check
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    const profileData = await request.json();
    
    // Build update object with only provided fields
    const updateFields = {};
    const allowedFields = [
      'name', 'displayName', 'bio', 'bioMode', 'bioImage', 'bioVideo', 
      'bioSectionTitle', 'tagline', 'avatar', 'profilePicture', 'banner', 
      'heroMedia', 'socials', 'mission', 'missionSectionTitle', 
      'storySections', 'chaptersSectionTitle', 'country', 'location', 
      'email', 'phone', 'website', 'tipJar', 'accentColor'
    ];
    
    if (profileData) {
      Object.keys(profileData).forEach((key) => {
        if (allowedFields.includes(key) || key.startsWith('storySection_')) {
          updateFields[key] = profileData[key];
        }
      });
    }
    
    updateFields.updatedAt = new Date();
    
    const { db } = await connectToDatabase();
    
    // Use the string ID to match your DB architecture
    const query = { id: decoded.userId };

    const result = await db.collection('users').updateOne(
      query,
      { $set: updateFields }
    );

    console.log('📝 DB Update Result:', {
      userId: decoded.userId,
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'User not found in DB' }, { status: 404 });
    }
    
    // Return updated user
    const updatedUser = await db.collection('users').findOne(
      { id: decoded.userId },
      { projection: { password: 0 } }
    );
    
    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Profile Settings API Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}