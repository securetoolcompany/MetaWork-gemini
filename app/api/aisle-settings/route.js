import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const getUserQuery = (userId) => {
  const id = String(userId || '').trim();

  return {
    $or: [
      { id },
      ...(ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : []),
    ],
  };
};

export async function GET(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token);

    if (!decoded?.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { db } = await connectToDatabase();

    const user = await db.collection('users').findOne(
      getUserQuery(decoded.userId),
      {
        projection: {
          aisleSettings: 1,
          'profile.displayName': 1,
          username: 1,
          collections: 1,
          id: 1,
        },
      },
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 },
      );
    }

    const possibleIds = [
      decoded.userId,
      user._id?.toString(),
      user.id,
      user.username,
    ].filter(Boolean);

    const query = {
      $or: [
        { creatorId: { $in: possibleIds } },
        { userId: { $in: possibleIds } },
        { ownerId: { $in: possibleIds } },
      ],
    };

    const [products, ipAssets] = await Promise.all([
      db.collection('products').find(query).toArray(),
      db.collection('ip_assets').find(query).toArray(),
    ]);

    const standardizedCollections = (user.collections || []).map((col) => ({
      ...col,
      id:
        col.id?.toString() ||
        col._id?.toString() ||
        Math.random().toString(36).slice(2, 11),
      active: col.active !== false,
    }));

    return NextResponse.json({
      success: true,
      aisleSettings: user.aisleSettings || {},
      collections: standardizedCollections,
      products: products.map((product) => ({
        ...product,
        _id: product._id?.toString(),
        id: product._id?.toString(),
      })),
      ipAssets: ipAssets.map((ipAsset) => ({
        ...ipAsset,
        _id: ipAsset._id?.toString(),
        id: ipAsset._id?.toString(),
      })),
      user: {
        name: user.profile?.displayName,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Aisle Settings GET Error:', error);

    return NextResponse.json(
      { success: false, error: 'Server Error' },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token);

    if (!decoded?.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { aisleSettings, collections } = await request.json();
    const { db } = await connectToDatabase();

    const user = await db.collection('users').findOne(
      getUserQuery(decoded.userId),
      { projection: { _id: 1, id: 1, username: 1 } },
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found or ID mismatch' },
        { status: 404 },
      );
    }

    const collectionsToSave = (collections || []).map((col) => ({
      ...col,
      active: col.active !== undefined ? col.active : true,
      productIds: (col.productIds || []).map((id) => id.toString()),
    }));

    const result = await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          aisleSettings: aisleSettings || {},
          collections: collectionsToSave,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount !== 1) {
      return NextResponse.json(
        { success: false, error: 'User not found while saving settings' },
        { status: 404 },
      );
    }

    if (aisleSettings?.slug) {
      const aisleQuery = {
        $or: [
          { userId: decoded.userId },
          { userId: user._id.toString() },
          ...(user.id ? [{ userId: user.id }] : []),
          ...(user.username ? [{ userId: user.username }] : []),
        ],
      };

      const now = new Date();
      const title = aisleSettings.title || 'My Aisle';

      await db.collection('aisles').updateOne(
        aisleQuery,
        {
          $set: {
            slug: aisleSettings.slug,
            title,
            updatedAt: now,
          },
          $setOnInsert: {
            userId: user._id.toString(),
            isActive: true,
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('[API] Aisle Settings PUT Error:', error);

    return NextResponse.json(
      { success: false, error: 'Server Error' },
      { status: 500 },
    );
  }
}