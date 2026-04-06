import { NextResponse } from 'next/server';
import { connectToDatabase, normalizeIds } from '@/lib/mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // 1. Basic filter for public products
    const productFilter = {
      isDraft: { $ne: true },
      status: { $ne: 'draft' },
      $or: [
        { showroomListed: true },
        { status: { $in: ['live', 'active'] } },
        { isPublic: true }
      ]
    };

    // 2. Fetch all raw data
    const [products, legacyAisles, usersWithAisles, ipAssets] = await Promise.all([
      db.collection('products').find(productFilter).toArray(),
      db.collection('aisles').find({}).toArray(),
      db.collection('users').find({ aisleSettings: { $exists: true } }).toArray(),
      db.collection('ip_assets').find({}).toArray()
    ]);

    // 3. Map Users into Aisles with DYNAMIC STATS
    // We calculate counts based on the fetched products/ip arrays 
    // where the 'owner' matches the user's ID or username.
    const formattedUserAisles = usersWithAisles.map(user => {
      const userId = user._id.toString();
      
      // Calculate real counts from the database results
      const userProductCount = products.filter(p => 
        p.ownerId === userId || p.owner === user.username
      ).length;

      const userIPCount = ipAssets.filter(i => 
        i.ownerId === userId || i.owner === user.username
      ).length;

      return {
        ...user,
        id: userId,
        _id: userId,
        type: 'aisle',
        username: user.username,
        displayName: user.aisleSettings?.title || user.profile?.displayName || user.name || user.username,
        bio: user.aisleSettings?.description || user.bio || '',
        headerImage: user.aisleSettings?.heroImage || user.banner,
        avatar: user.avatar,
        aisleSettings: user.aisleSettings || {},
        // PASS THE CALCULATED STATS HERE
        totalProducts: userProductCount,
        totalIPAssets: userIPCount,
        source: 'user_collection'
      };
    });

    // 4. Combine and Deduplicate
    const combinedAisles = [
      ...formattedUserAisles,
      ...normalizeIds(legacyAisles)
        .filter(la => !formattedUserAisles.find(ua => ua.username === la.username))
        .map(a => ({ 
          ...a, 
          type: 'aisle',
          totalProducts: a.totalProducts || 0,
          totalIPAssets: a.totalIPAssets || 0 
        }))
    ];

    const normalizedData = [
      ...normalizeIds(products).map(p => ({ ...p, type: 'product' })),
      ...combinedAisles,
      ...normalizeIds(ipAssets).map(i => ({ ...i, type: 'ip' }))
    ];

    return NextResponse.json(normalizedData);
  } catch (error) {
    console.error("❌ SHOWROOM API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}