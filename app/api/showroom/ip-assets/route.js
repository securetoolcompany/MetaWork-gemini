import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET(request) {
  try {
    const db = await getDatabase();
    const ipAssetsCollection = db.collection('ip_assets');

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 24;

    // Build search filter
    const filter = {};
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } },
      ];
    }

    // Fetch IP assets
    const ipAssets = await ipAssetsCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const total = await ipAssetsCollection.countDocuments(filter);

    return NextResponse.json({
      success: true,
      ipAssets,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });

  } catch (error) {
    console.error('Error fetching IP assets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch IP assets' },
      { status: 500 }
    );
  }
}
