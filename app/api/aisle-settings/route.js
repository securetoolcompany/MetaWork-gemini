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
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // --- NEW ROBUST FETCH LOGIC ---
    // Gather all possible ways this user might be identified in the database
    const possibleIds = [
      decoded.userId, 
      user._id?.toString(), 
      user.id, 
      user.username
    ].filter(Boolean); // Removes empty values

    // Create the query BEFORE using it
    const query = {
      $or: [
        { creatorId: { $in: possibleIds } },
        { userId: { $in: possibleIds } },
        { ownerUsername: { $in: possibleIds } }
      ]
    };

    // Fetch products and IP Assets using the correct collection names and robust query
    const products = await db.collection('products').find(query).toArray();
    const ipAssets = await db.collection('ip_assets').find(query).toArray();

    // 🛑 SAFE DEBUGGING BLOCK 🛑
    console.log("=== API DEBUG: /api/aisle-settings ===");
    console.log("1. Who is asking? Token User ID:", decoded.userId);
    console.log("2. Who did we find in DB?", user.username, "| DB _id:", user._id?.toString());
    console.log("3. What IDs are we searching for?", JSON.stringify(query.$or));
    console.log("4. Products found count:", products.length);
    console.log("5. IP Assets found count:", ipAssets.length);
    console.log("=======================================");

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