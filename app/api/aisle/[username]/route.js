import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { username } = await params;
    const { db } = await connectToDatabase();

    // 1. FIND THE CREATOR (Check slug first, then username)
    let creator = await db.collection('users').findOne(
      { 'aisleSettings.slug': username },
      { projection: { password: 0 } }
    );

    if (!creator) {
      creator = await db.collection('users').findOne(
        { username },
        { projection: { password: 0 } }
      );
    }

    if (!creator) {
      return NextResponse.json({ success: false, error: 'Creator not found' }, { status: 404 });
    }

    const creatorId = creator.id || creator._id?.toString();

    // 2. OWNER CHECK (For "Edit Mode" buttons on the Aisle)
    const token = request.cookies.get('auth_token')?.value;
    let isOwner = false;
    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded?.userId === creatorId) isOwner = true;
      } catch (e) {
        console.error('Auth check failed:', e);
      }
    }

    // 3. GET OWNED PRODUCTS
    const ownedProducts = await db.collection('products').find({
      creatorId: creatorId,
      status: { $in: ['active', 'live'] }
    }).toArray();

    // 4. GET COMMUNITY PRODUCTS (Curation Logic)
    const approvedList = creator.aisleSettings?.approvedCommunityProducts || [];
    const approvedIds = approvedList.map(p => p.productId);

    const communityProducts = await db.collection('products').find({
      _id: { $in: approvedIds },
      userId: { $ne: creatorId } // Don't duplicate if they accidentally curated their own item
    }).toArray();

    // 5. APPLY LOCAL OVERLAYS (Primary Mockup Selection)
    const finalCommunityProducts = communityProducts.map(prod => {
      const curationEntry = approvedList.find(a => a.productId === prod._id.toString());
      const p = {
        ...prod,
        id: prod._id.toString(),
        isCommunity: true // Flag for the UI
      };
      
      // Override thumbnail if owner selected a specific mockup for their aisle
      if (curationEntry && prod.mockupImages?.[curationEntry.primaryMockupIndex]) {
        p.thumbnailUrl = prod.mockupImages[curationEntry.primaryMockupIndex];
      }
      return p;
    });

    // 6. GET IP ASSETS
    const ipAssets = await db.collection('ip_assets').find({
      ownerId: creatorId,
      status: { $in: ['unminted', 'active'] },
    }).sort({ createdAt: -1 }).toArray();

    // 7. CONSTRUCT FINAL RESPONSE
    return NextResponse.json({
      success: true,
      isOwner,
      creator: {
        id: creatorId,
        username: creator.username,
        name: creator.aisleSettings?.title || creator.profile?.displayName || creator.name,
        bio: creator.aisleSettings?.description || creator.bio,
        avatar: creator.aisleSettings?.logo || creator.avatar,
        banner: creator.aisleSettings?.heroImage || creator.banner,
        aisleSettings: creator.aisleSettings || {
          theme: 'dark-professional',
          accentColor: '#3b82f6',
          productsPerRow: 4
        },
        collections: creator.collections || [],
      },
      // Merge owned and approved community products
      products: [
        ...ownedProducts.map(p => ({ ...p, id: p._id.toString(), isCommunity: false })),
        ...finalCommunityProducts
      ],
      ipAssets,
    });

  } catch (error) {
    console.error('Aisle API Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}