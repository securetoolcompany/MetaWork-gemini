// app/api/aisle/[username]/route.js

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { username } = await params;
    const { db } = await connectToDatabase();

    const searchRegex = new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const creator = await db.collection('users').findOne({
      $or: [{ 'aisleSettings.slug': searchRegex }, { username: searchRegex }]
    });

    if (!creator) return NextResponse.json({ success: false, error: 'Creator not found' }, { status: 404 });

    const creatorId = creator._id.toString();
    
    const idList = [creatorId];
    if (ObjectId.isValid(creatorId)) {
      idList.push(new ObjectId(creatorId));
    }
    if (creator.id) {
      idList.push(creator.id);
    }

    const [products, ipAssets] = await Promise.all([
      db.collection('products').find({
        $and: [
          { $or: [{ creatorId: { $in: idList } }, { userId: { $in: idList } }] },
          { isDraft: false },
          { isPublic: true },
          { status: { $in: ['active', 'live'] } } // ✅ Now accepts 'active' products!
        ]
      }).toArray(),
      db.collection('ip_assets').find({
        $or: [
          { ownerId: { $in: idList } }, 
          { userId: { $in: idList } },
          { creatorId: { $in: idList } }
        ]
      }).toArray()
    ]);

    // FIX: Map collections to ensure they have a string 'id' and filter by active status
    const formattedCollections = (creator.collections || [])
      .filter(c => c.active !== false)
      .map(c => ({
        ...c,
        id: c.id || c._id?.toString() || Math.random().toString(36).substr(2, 9)
      }));

    return NextResponse.json({
      success: true,
      creator: {
        username: creator.username,
        aisleSettings: creator.aisleSettings || {},
        title: creator.aisleSettings?.title || creator.username,
        description: creator.aisleSettings?.description || creator.bio,
        logo: creator.aisleSettings?.logo || creator.avatar,
        heroImage: creator.aisleSettings?.heroImage || creator.banner
      },
      products: products.map(p => ({ ...p, id: p._id.toString() })),
      ipAssets: ipAssets.map(ip => ({ ...ip, id: ip._id.toString() })),
      collections: formattedCollections
    });
  } catch (error) {
    console.error('Aisle API Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}