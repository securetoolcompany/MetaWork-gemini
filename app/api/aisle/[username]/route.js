import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  // ⬅ params is a Promise in Next 15
  const { username } = await params;   // ⬅ await here

  try {
    console.log('🔍 Aisle API param username:', username);

    const { db } = await connectToDatabase();

    let creator = await db.collection('users').findOne(
      { 'aisleSettings.slug': username },
      { projection: { password: 0 } }
    );
    console.log('🔍 Creator by slug:', creator?.username, creator?.aisleSettings?.slug);

    if (!creator) {
      creator = await db.collection('users').findOne(
        { username },
        { projection: { password: 0 } }
      );
      console.log('🔍 Creator by username:', creator?.username);
    }

    if (!creator) {
      return NextResponse.json(
        { success: false, error: 'Creator not found' },
        { status: 404 }
      );
    }

    // 🔐 OWNER CHECK (here, in /api/aisle/[username])
const token = request.cookies.get('auth_token')?.value;
let isOwner = false;

if (token) {
  try {
    const decoded = verifyToken(token);         // same helper as aisle-settings
    const sessionUserId = decoded.userId;       // e.g. "user_1769104841665_7btkj7"
    const creatorId = creator.id || creator._id?.toString();

    console.log('🔐 Owner check:', { sessionUserId, creatorId });

    if (sessionUserId && creatorId && sessionUserId === creatorId) {
      isOwner = true;
    }
  } catch (e) {
    console.error('Failed to verify auth_token in aisle route:', e);
  }
} else {
  console.log('🔐 No auth_token cookie on aisle request');
}

    const creatorObjectId = creator._id.toString();
    console.log('🔍 Looking for products with userId:', creatorObjectId);

    const { db: db2 } = await connectToDatabase(); // or reuse db
    const products = await db2
      .collection('products')
      .find({
        userId: creatorObjectId,
        status: { $in: ['active', 'live'] },
      })
      .toArray();

    console.log(`📦 Found ${products.length} products for ${creator.username}`);

    const ipAssets = await db2
      .collection('ip_assets')
      .find({
        ownerUsername: creator.username,
        status: { $in: ['unminted', 'active'] },
      })
      .sort({ createdAt: -1 })
      .toArray();

    console.log('🎨 Found IP assets:', ipAssets.length);

    return NextResponse.json({
      success: true,
      creator: {
        id: creator.id,
        name:
          creator.aisleSettings?.title ||
          creator.profile?.displayName ||
          creator.name,
        username: creator.username,
        email: creator.email,
        bio: creator.aisleSettings?.description || creator.bio,
        avatar: creator.aisleSettings?.logo || creator.avatar,
        banner: creator.aisleSettings?.heroImage || creator.banner,
        aisleSettings:
          creator.aisleSettings || {
            theme: 'dark-professional',
            accentColor: '#3b82f6',
            productsPerRow: 4,
            cardStyle: 'modern',
            adSettings: { sidebar: true },
            defaultSort: 'newest',
            allowReviews: true,
            showSalesCounter: false,
          },
        collections: creator.collections || [],
        verified: creator.membershipTier === 'pro',
        stats: { followers: 0 },
        tagline:
          (
            creator.aisleSettings?.description ||
            creator.bio ||
            ''
          ).substring(0, 100),
      },
      products: products.map((p) => ({
        id: p._id.toString(),
        _id: p._id.toString(),
        title: p.title,
        description: p.description,
        price: p.price,
        imageUrl:
          p.imageUrl ||
          p.thumbnailUrl ||
          'https://placehold.co/600x600/1a1a2e/e94560?text=Product',
        thumbnailUrl:
          p.thumbnailUrl ||
          p.imageUrl ||
          'https://placehold.co/600x600/1a1a2e/e94560?text=Product',
        status: p.status,
        isPublic: p.isPublic,
        salesCount: p.sales || p.salesCount || 0,
        categories: p.categories || [],
        createdAt: p.createdAt,
      })),
      ipAssets,
      isOwner,
    });
  } catch (error) {
    console.error('Aisle API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server Error' },
      { status: 500 }
    );
  }
}
