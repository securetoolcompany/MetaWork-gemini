import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    // Filters
    const creator = searchParams.get('creator');   // e.g. userId or username
    const status = searchParams.get('status');     // e.g. 'live'
    const category = searchParams.get('category'); // pill category
    const q = searchParams.get('q');               // text search
    const includeDrafts = searchParams.get('includeDrafts') === 'true'; // ✅ Added Draft support

    const query = {};

    if (creator) {
      query.$or = [
        { userId: creator },
        { creatorId: creator },
        { ownerUsername: creator },
      ];
    }

    // ✅ FIXED STATUS LOGIC: Include 'published' and handle 'includeDrafts'
    if (status) {
      query.status = status;
    } else {
      const allowedStatuses = ['live', 'active', 'published'];
      if (creator && includeDrafts) {
        allowedStatuses.push('draft');
      }
      query.status = { $in: allowedStatuses };
    }

    if (category) {
      query.categories = category;
    }

    if (q) {
      query.$text = { $search: q };
    }

    // Only apply isPublic filter if we are NOT looking for a specific creator's own stuff
    if (!creator) {
      query.isPublic = { $ne: false };
    } 

    const cursor = db
      .collection('products')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const [items, total] = await Promise.all([
      cursor.toArray(),
      db.collection('products').countDocuments(query),
    ]);

    // ✅ Ensure string IDs are attached for the front-end components
    const processedItems = items.map(item => ({
      ...item,
      id: item.id || item._id.toString(),
      _id: item._id.toString()
    }));

    return NextResponse.json({
      success: true,
      products: processedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Product API Error (list):', error);
    return NextResponse.json(
      { success: false, error: 'Server Error' },
      { status: 500 }
    );
  }
}