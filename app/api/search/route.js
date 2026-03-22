import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query) {
      return NextResponse.json({
        products: [],
        aisles: [],
        profiles: [],
      });
    }

    const { db } = await connectToDatabase();
    const searchRegex = new RegExp(query, 'i');

    const [products, aisles, profiles] = await Promise.all([
      db.collection('products')
        .find({
          $or: [
            { title: searchRegex },
            { description: searchRegex },
            { categories: searchRegex },
          ],
        })
        .limit(10)
        .project({ _id: 1, title: 1, slug: 1, creatorId: 1 })
        .toArray(),

      db.collection('aisles')
        .find({
          $or: [
            { name: searchRegex },
            { slug: searchRegex },
          ],
        })
        .limit(10)
        .project({ _id: 1, name: 1, slug: 1 })
        .toArray(),

      db.collection('users')
        .find({
          $or: [
            { username: searchRegex },
            { displayName: searchRegex },
            { email: searchRegex },
          ],
        })
        .limit(10)
        .project({ _id: 1, username: 1, displayName: 1, slug: 1, email: 1 })
        .toArray(),
    ]);

    return NextResponse.json({
      products,
      aisles,
      profiles,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}