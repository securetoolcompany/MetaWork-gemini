import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyToken(token);
    const { db } = await connectToDatabase();
    
    // FIX: Add 'collections: 1' to the projection so the DB actually returns it!
    const user = await db.collection('users').findOne(
      { _id: decoded.userId },
      { projection: { aisleSettings: 1, 'profile.displayName': 1, username: 1, collections: 1 } }
    );
    
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    const possibleIds = [decoded.userId, user._id?.toString(), user.username].filter(Boolean);

    const query = { 
      $or: [
        { creatorId: { $in: possibleIds } },
        { userId: { $in: possibleIds } },
        { ownerId: { $in: possibleIds } }
      ]
    };

    const [products, ipAssets] = await Promise.all([
      db.collection('products').find(query).toArray(),
      db.collection('ip_assets').find(query).toArray()
    ]);

    return NextResponse.json({ 
      success: true, 
      aisleSettings: user.aisleSettings || {},
      // FIX: Pull directly from the user document to match your PUT route
      collections: user.collections || [],
      products,
      ipAssets,
      user: { name: user.profile?.displayName, username: user.username }
    });
  } catch (error) {
    console.error('Aisle Settings GET Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

// PUT - Save user's aisle settings
export async function PUT(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const { aisleSettings, collections } = await request.json();
    const { db } = await connectToDatabase();

    // Pattern: Use the decoded userId to ensure the user only edits their own aisle
    const result = await db.collection('users').updateOne(
      { _id: decoded.userId },
      { 
        $set: { 
          aisleSettings: aisleSettings,
          collections: collections || [],
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('[API] Aisle Settings PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}