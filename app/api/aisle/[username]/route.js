import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { username } = await params;
    const { db } = await connectToDatabase();

    // 1. Case-insensitive lookup for the Creator
    const searchRegex = new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const creator = await db.collection('users').findOne({
      $or: [{ 'aisleSettings.slug': searchRegex }, { username: searchRegex }]
    });

    if (!creator) return NextResponse.json({ success: false, error: 'Creator not found' }, { status: 404 });

    const creatorId = creator._id.toString();
    const altId = creator.id || creatorId;

    const idList = [creatorId, altId];
    if (ObjectId.isValid(creatorId)) idList.push(new ObjectId(creatorId));

    // 2. Fetch only Products and IP Assets (Collections are already in the 'creator' object)
    const [products, ipAssets] = await Promise.all([
      db.collection('products').find({
        $and: [
          { $or: [{ creatorId: { $in: idList } }, { userId: { $in: idList } }] },
          { status: 'live' }
        ]
      }).toArray(),
      db.collection('ip_assets').find({
        $or: [{ ownerId: { $in: idList } }, { userId: { $in: idList } }]
      }).toArray()
    ]);

    // 3. Return the response using the collections stored in the user document
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
      
      // Pull directly from the creator document to match your aisle-settings PUT route
      collections: (creator.collections || [])
        .filter(c => c.active !== false) // Only show active ones
        .map(c => ({
          ...c,
          id: c.id || c._id?.toString()
        }))
    });
  } catch (error) {
    console.error('Aisle API Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}