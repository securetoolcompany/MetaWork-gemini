import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query) {
      return NextResponse.json({ products: [], aisles: [], profiles: [] });
    }

    const { db } = await connectToDatabase();
    const searchRegex = new RegExp(query, 'i');

    const [products, rawAisles, profiles] = await Promise.all([
      db.collection('products')
        .find({
          $or: [
            { name: searchRegex },
            { description: searchRegex },
          ],
          isDraft: { $ne: true },
          isPublic: true,
          status: { $in: ['active', 'live'] },
        })
        .limit(10)
        .project({ _id: 1, name: 1, id: 1 })
        .toArray(),

      db.collection('aisles')
        .find({
          $or: [
            { title: searchRegex },
            { slug: searchRegex },
          ],
          isActive: true,
        })
        .limit(10)
        .project({ _id: 1, title: 1, slug: 1, userId: 1 })
        .toArray(),

      db.collection('users')
        .find({
          $or: [
            { username: searchRegex },
            { displayName: searchRegex },
            { email: searchRegex },
          ],
          profileSetup: true,  // only show users who've saved a name
        })
        .limit(10)
        .project({ _id: 1, username: 1, displayName: 1, slug: 1, email: 1 })
        .toArray(),
    ]);

    // Resolve the public URL slug for each aisle via userId -> user.aisleSettings.slug || user.username
    const userIds = rawAisles.map(a => a.userId).filter(Boolean);

    const objectIds = userIds
      .map(id => { try { return new ObjectId(id); } catch { return null; } })
      .filter(Boolean);

    const aisleUsers = userIds.length
      ? await db.collection('users')
          .find({
            $or: [
              ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
              { _id: { $in: userIds } },
            ]
          })
          .project({ _id: 1, username: 1, 'aisleSettings.slug': 1 })
          .toArray()
      : [];

    const userMap = {};
    aisleUsers.forEach(u => { userMap[u._id.toString()] = u; });

    const aisles = rawAisles.map(aisle => {
      const user = userMap[aisle.userId?.toString()];
      const publicSlug = user?.aisleSettings?.slug || user?.username || null;
      return { ...aisle, publicSlug };
    });

    return NextResponse.json({ products, aisles, profiles });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}