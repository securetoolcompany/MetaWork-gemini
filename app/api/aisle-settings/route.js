import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const getSafeId = (id) => {
  try {
    return new ObjectId(id);
  } catch (e) {
    return id;
  }
};

export async function GET(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    
    const decoded = verifyToken(token);
    const { db } = await connectToDatabase();
    
    const userId = getSafeId(decoded.userId);

    const user = await db.collection('users').findOne(
      { _id: userId },
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

    const standardizedCollections = (user.collections || []).map(col => ({
      ...col,
      id: col.id?.toString() || col._id?.toString() || Math.random().toString(36).substr(2, 9),
      active: col.active !== false 
    }));

    return NextResponse.json({ 
      success: true, 
      aisleSettings: user.aisleSettings || {},
      collections: standardizedCollections,
      products: products.map(p => ({ ...p, id: p._id.toString() })),
      ipAssets: ipAssets.map(ip => ({ ...ip, id: ip._id.toString() })),
      user: { name: user.profile?.displayName, username: user.username }
    });
  } catch (error) {
    console.error('Aisle Settings GET Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    const { aisleSettings, collections } = await request.json();
    const { db } = await connectToDatabase();
    
    const userId = getSafeId(decoded.userId);

    const collectionsToSave = (collections || []).map(col => ({
      ...col,
      active: col.active !== undefined ? col.active : true,
      productIds: (col.productIds || []).map(id => id.toString())
    }));

    const result = await db.collection('users').updateOne(
      { _id: userId },
      { 
        $set: { 
          aisleSettings: aisleSettings,
          collections: collectionsToSave,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'User not found or ID mismatch' }, { status: 404 });
    }

    // Keep aisle.slug in sync with user's chosen aisleSettings.slug
    if (aisleSettings?.slug) {
      const aisleQuery = {
        $or: [
          { userId: decoded.userId },
          { userId: userId }  // getSafeId() version — covers ObjectId-based users
        ]
      };

      await db.collection('aisles').updateOne(
        aisleQuery,
        { 
          $set: { 
            slug: aisleSettings.slug,
            title: aisleSettings.title || 'My Aisle',
            updatedAt: new Date() 
          },
          $setOnInsert: {
            userId: decoded.userId,
            title: aisleSettings.title || 'My Aisle',
            isActive: true,
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('[API] Aisle Settings PUT Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}