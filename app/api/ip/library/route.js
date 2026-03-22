import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ip/library
 * Get global IP library with filters for Category AND Creator
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const creator = searchParams.get('creator') || ''; // New creator filter
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const excludeOwner = searchParams.get('excludeOwner'); 

    let currentUserId = null;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (token) {
      try {
        const decoded = verifyToken(token);
        currentUserId = decoded?.userId;
      } catch (e) {}
    }

    const { db } = await connectToDatabase();

    const query = {
      $or: [
        { status: 'listed', isMinted: true },
        { status: 'minted', minted: true },
        { minted: true, isPublic: true },
        { status: 'active', isPublic: true }
      ]
    };

    if (excludeOwner && currentUserId) {
      query.ownerId = { $ne: currentUserId };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { title: searchRegex },
        { description: searchRegex }
      ];
    }

    // Category filter (check both systemCategory AND category fields)
    if (category) {
      query.$or = query.$or || [];
      const categoryOr = [
        { systemCategory: category },
        { category: category }
      ];
      
      if (query.$or.length > 0) {
        // Merge with existing $or from search
        query.$and = [
          { $or: query.$or },
          { $or: categoryOr }
        ];
        delete query.$or;
      } else {
        query.$or = categoryOr;
      }
    }

    // Tags filter (check both userTags AND tags fields)
    if (tags.length > 0) {
      const tagsQuery = {
        $or: [
          { userTags: { $in: tags } },
          { tags: { $in: tags } }
        ]
      };
      
      if (query.$and) {
        query.$and.push(tagsQuery);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, tagsQuery];
        delete query.$or;
      } else {
        query.$and = [tagsQuery];
      }
    }
    
    // Filter by Creator
if (creator && creator !== 'all') {
  if (query.$and) {
    query.$and.push({ ownerName: creator });
  } else {
    query.ownerName = creator;
  }
}


    const totalCount = await db.collection('ip_assets').countDocuments(query);

    const ipAssets = await db.collection('ip_assets')
      .find(query)
      .sort({ usageCount: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get filters: Categories and Creators
    const categories = await db.collection('ip_assets').distinct('category', query);
    
    // Get distinct creators (owners) for the dropdown
    const creators = await db.collection('ip_assets').distinct('ownerName', {
       // We use the base query (public/listed) but ignore specific filters to populate the full list
       $or: [
        { status: 'listed', isMinted: true },
        { status: 'minted', minted: true },
        { minted: true, isPublic: true },
        { status: 'active', isPublic: true }
      ]
    });
    
return NextResponse.json({
  success: true,
  ipAssets: ipAssets.map(asset => ({
    id: asset.id || asset._id?.toString(),
    _id: asset._id?.toString(),
    name: asset.name || asset.title,
    title: asset.title || asset.name,
    description: asset.description,
    imageUrl: asset.imageUrl,
    category: asset.category,
    tags: asset.tags || [],
    ownerId: asset.ownerId,
    ownerName: asset.ownerName,
    licensingFee: asset.licensingFee || 0,
    status: asset.status,
    minted: asset.minted,
    createdAt: asset.createdAt
  })),
  pagination: {
    page,
    limit,
    totalCount,
    totalPages: Math.ceil(totalCount / limit)
  },
  filters: {
    categories: categories.filter(Boolean),
    creators: creators.filter(Boolean).sort(),
    popularTags: [] 
  }
});


  } catch (error) {
    console.error('IP Library API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch IP assets', message: error.message },
      { status: 500 }
    );
  }
}
