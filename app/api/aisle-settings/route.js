import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

// GET - Load user's aisle settings
export async function GET(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    const { db } = await connectToDatabase();
    
    // FIX: Use _id instead of id
    const user = await db.collection('users').findOne(
      { _id: decoded.userId },
      { 
        projection: { 
          aisleSettings: 1, 
          'profile.displayName': 1,
          username: 1,
          collections: 1
        } 
      }
    );
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    const products = await db.collection('products')
      .find({ creatorId: decoded.userId })
      .toArray();
    
    const ipAssets = await db.collection('ipAssets')
      .find({ creatorId: decoded.userId })
      .toArray();
    
    return NextResponse.json({ 
      success: true, 
      aisleSettings: user.aisleSettings || {},
      collections: user.collections || [],
      products: products,
      ipAssets: ipAssets,
      user: {
        name: user.profile?.displayName,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Aisle Settings GET Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server Error' 
    }, { status: 500 });
  }
}

// POST - Save user's aisle settings
export async function POST(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    
    // DEBUG LOGS - RIGHT HERE!
    console.log('🔍 Decoded token:', decoded);
    console.log('🔍 User ID:', decoded?.userId);
    
    const { aisleSettings, collections } = await request.json();
    console.log('🔍 Received data:', { aisleSettings, collections });
    
    const { db } = await connectToDatabase();
    
    // FIX: Use _id instead of id
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
    
    console.log('🔍 Update result:', result);
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      aisleSettings: aisleSettings,
      collections: collections 
    });
  } catch (error) {
    console.error('❌ Aisle Settings POST Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server Error' 
    }, { status: 500 });
  }
}

export async function PUT(request) {
  return POST(request);
}
