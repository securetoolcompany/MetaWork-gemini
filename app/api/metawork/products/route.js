import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  return trimmed;
}

function getProductImageUrl(product) {
  if (product.thumbnailUrl) {
    return normalizeImageUrl(product.thumbnailUrl);
  }
  if (product.mockupImages && product.mockupImages.length > 0 && product.mockupImages[0]) {
    return normalizeImageUrl(product.mockupImages[0]);
  }
  if (product.imageUrl) {
    return normalizeImageUrl(product.imageUrl);
  }
  if (product.images && product.images.length > 0 && product.images[0]) {
    return normalizeImageUrl(product.images[0]);
  }
  return null;
}

function normalizeId(doc) {
  if (!doc) return doc;
  if (!doc.id && doc._id) {
    doc.id = doc._id.toString();
  }
  if (doc._id) {
    doc._id = doc._id.toString();
  }
  return doc;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const status = searchParams.get('status')?.split(',').filter(Boolean) || ['active', 'live'];
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') === 'asc' ? 1 : -1;
    const isPublicRequest = searchParams.get('public') === 'true';

    let currentUserId = null;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;

    if (token) {
      try {
        const decoded = verifyToken(token);
        currentUserId = decoded?.userId;
      } catch {
        // ignore
      }
    }

    const { db } = await connectToDatabase();

    const query = {};

    if (isPublicRequest) {
      query.isPublic = true;
      query.status = { $in: status };
    } else if (currentUserId) {
      query.$or = [
        { userId: currentUserId },
        { isPublic: true, status: { $in: status } }
      ];
    } else {
      query.isPublic = true;
      query.status = { $in: status };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: searchRegex },
          { name: searchRegex },
          { description: searchRegex }
        ]
      });
    }

    if (category) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { systemCategory: category },
          { categories: category }
        ]
      });
    }

    if (tags.length > 0) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { tags: { $in: tags } },
          { userTags: { $in: tags } }
        ]
      });
    }

    const totalCount = await db.collection('products').countDocuments(query);

    const sortObj = {};
    sortObj[sort] = order;

    const products = await db.collection('products')
      .find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const processedProducts = products.map(p => {
      const normalized = normalizeId(p);
      return {
        id: normalized.id,
        _id: normalized._id,
        title: p.title || p.name,
        name: p.title || p.name,
        description: p.description,
        price: p.price,
        imageUrl: getProductImageUrl(p),
        images: p.mockupImages || p.images || [],
        categories: p.categories || [],
        systemCategory: p.systemCategory || null,
        tags: p.tags || [],
        userTags: p.userTags || [],
        userId: p.userId,
        status: p.status,
        isPublic: p.isPublic,
        showroomListed: p.showroomListed,
        minted: p.minted,
        sales: p.sales || p.salesCount || 0,
        baseProduct: p.baseProduct || p.catalogProductName,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      };
    });

    return NextResponse.json({
      success: true,
      products: processedProducts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Products List API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/metawork/products
 * Handle bulk or generic product updates
 */
export async function PUT(request) {
  try {
    const updates = await request.json();
    const { id, ...dataToUpdate } = updates;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('products').updateOne(
      { $or: [
        { id: id },
        { _id: /^[a-fA-F0-9]{24}$/.test(id) ? new (require('mongodb').ObjectId)(id) : id }
      ]},
      { $set: { ...dataToUpdate, updatedAt: new Date() } }
    );

    // CRITICAL: This JSON response stops the SyntaxError
    return NextResponse.json({ 
      success: true, 
      message: 'Product synced successfully',
      matchedCount: result.matchedCount 
    });

  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update', message: error.message }, 
      { status: 500 }
    );
  }
}