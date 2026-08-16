import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const creator = searchParams.get('creator') || '';
    const sort = searchParams.get('sort') || '';
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

    const andClauses = [
      {
        status: 'active',
        isPublic: true,
        licensable: true,
      },
    ];

    if (excludeOwner === 'true' && currentUserId) {
      andClauses.push({ ownerId: { $ne: currentUserId } });
    }

    if (search) {
      const r = new RegExp(search, 'i');
      andClauses.push({
        $or: [{ name: r }, { title: r }, { description: r }, { ownerName: r }]
      });
    }

    if (category && category !== 'all') {
      andClauses.push({ $or: [{ category }, { systemCategory: category }] });
    }

    if (tags.length > 0) {
      andClauses.push({ $or: [{ tags: { $in: tags } }, { userTags: { $in: tags } }] });
    }

    if (creator && creator !== 'all') {
      andClauses.push({ ownerName: creator });
    }

    const query = andClauses.length > 0 ? { $and: andClauses } : {};

    const totalCount = await db.collection('ip_assets').countDocuments(query);

    let ipAssets;
    if (sort === 'random') {
      const pipeline = [];
      if (andClauses.length > 0) pipeline.push({ $match: query });
      pipeline.push({ $sample: { size: limit } });
      ipAssets = await db.collection('ip_assets').aggregate(pipeline).toArray();
    } else {
      ipAssets = await db.collection('ip_assets')
        .find(query)
        .sort({ usageCount: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
    }

    const categories = await db
      .collection('ip_assets')
      .distinct('category', { $and: andClauses });

    const creators = await db
      .collection('ip_assets')
      .distinct('ownerName', { $and: andClauses });

    return NextResponse.json({
      success: true,
      ipAssets: ipAssets.map((asset) => {
        const licensingFeeCents =
          asset.licensingFeeCents != null
            ? Math.round(Number(asset.licensingFeeCents))
            : asset.licenseFeeUsd != null
              ? Math.round(Number(asset.licenseFeeUsd) * 100)
              : asset.licensingFee != null
                ? Math.round(Number(asset.licensingFee) * 100)
                : 0;

        const imageUrl = [asset.imageUrl, asset.thumbnailUrl, asset.image].find(
          (value) => typeof value === 'string' && value.trim().length > 0
        )?.trim() || null;

        return {
          id: asset.id || asset._id?.toString(),
          title: asset.name || asset.title || 'Untitled IP asset',
          description: asset.description || '',
          imageUrl,
          category: asset.category || asset.systemCategory || '',
          tags: Array.isArray(asset.tags)
            ? asset.tags
            : Array.isArray(asset.userTags)
              ? asset.userTags
              : [],
          ownerId: asset.ownerId?.toString() || null,
          ownerName: asset.ownerName || asset.ownerUsername || 'Unknown creator',
          ownerUsername: asset.ownerUsername || null,
          ownerAvatar: asset.ownerAvatar || null,
          licensingFeeCents: Number.isFinite(licensingFeeCents)
            ? Math.max(0, licensingFeeCents)
            : 0,
          isPublic: asset.isPublic === true,
          licensable: asset.licensable === true,
          status: asset.status || null,
          createdAt: asset.createdAt || null,
        };
      }),
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      filters: {
        categories: categories.filter(Boolean).sort(),
        creators: creators.filter(Boolean).sort(),
        popularTags: [],
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