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

    const query = {};

    if (creator) {
      // adjust to your schema: userId / creatorId / ownerUsername
      query.$or = [
        { userId: creator },
        { creatorId: creator },
        { ownerUsername: creator },
      ];
    }

    if (status) {
      query.status = status;
    } else {
      // default to public/live products
      query.status = { $in: ['live', 'active'] };
    }

    if (category) {
      // assuming categories: string[] on the product
      query.categories = category;
    }

    if (q) {
      query.$text = { $search: q };
      // or use regex if you don’t have a text index:
      // query.title = { $regex: q, $options: 'i' };
    }

// Only apply isPublic filter if we are NOT looking for a specific creator's own stuff
// Or if a "showDrafts" flag isn't passed.
if (!creator) {
  query.isPublic = { $ne: false };
  query.status = { $in: ['live', 'active'] };
} else {
  // If a creator ID is provided, we assume we want to see their 
  // catalog for management, so we loosen the restriction.
  // Optional: Check session here to ensure ONLY the owner sees non-public items.
}
    const cursor = db
      .collection('products')
      .find(query)
      .sort({ createdAt: -1 }) // or your preferred sort
      .skip(skip)
      .limit(limit);

    const [items, total] = await Promise.all([
      cursor.toArray(),
      db.collection('products').countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      products: items,
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
