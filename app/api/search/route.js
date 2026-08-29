import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const escapeRegex = (value = '') =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toIdString = (value) => {
  if (!value) return null;
  return value.toString();
};

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
    const searchRegex = new RegExp(escapeRegex(query), 'i');

    const [products, legacyAisles, profiles, userAisles] = await Promise.all([
      db.collection('products')
        .find({
          $or: [
            { name: searchRegex },
            { title: searchRegex },
            { description: searchRegex },
          ],
          isDraft: { $ne: true },
          isPublic: true,
          status: { $in: ['active', 'live'] },
        })
        .limit(10)
        .project({
          _id: 1,
          id: 1,
          name: 1,
          title: 1,
        })
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
        .project({
          _id: 1,
          title: 1,
          slug: 1,
          userId: 1,
        })
        .toArray(),

      db.collection('users')
        .find({
          $or: [
            { username: searchRegex },
            { displayName: searchRegex },
            { 'profile.displayName': searchRegex },
            { email: searchRegex },
          ],
          profileSetup: true,
        })
        .limit(10)
        .project({
          _id: 1,
          username: 1,
          displayName: 1,
          slug: 1,
          'profile.displayName': 1,
        })
        .toArray(),

      db.collection('users')
        .find({
          aisleSettings: { $exists: true },
          $or: [
            { username: searchRegex },
            { 'profile.displayName': searchRegex },
            { 'aisleSettings.slug': searchRegex },
            { 'aisleSettings.title': searchRegex },
            { 'aisleSettings.description': searchRegex },
          ],
        })
        .limit(10)
        .project({
          _id: 1,
          id: 1,
          username: 1,
          'profile.displayName': 1,
          'aisleSettings.slug': 1,
          'aisleSettings.title': 1,
          'aisleSettings.description': 1,
          'aisleSettings.logo': 1,
          'aisleSettings.heroImage': 1,
        })
        .toArray(),
    ]);

    // Legacy aisle documents need their user record resolved to preserve
    // the live public route convention.
    const legacyUserIds = legacyAisles
      .map((aisle) => aisle.userId)
      .filter(Boolean);

    const legacyObjectIds = legacyUserIds
      .map((id) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const legacyAisleUsers = legacyUserIds.length
      ? await db.collection('users')
          .find({
            $or: [
              ...(legacyObjectIds.length
                ? [{ _id: { $in: legacyObjectIds } }]
                : []),
              { _id: { $in: legacyUserIds } },
              { id: { $in: legacyUserIds } },
            ],
          })
          .project({
            _id: 1,
            id: 1,
            username: 1,
            'aisleSettings.slug': 1,
          })
          .toArray()
      : [];

    const legacyUserMap = new Map(
      legacyAisleUsers.map((user) => [
        user._id.toString(),
        user,
      ])
    );

    const formattedLegacyAisles = legacyAisles.map((aisle) => {
      const user = legacyUserMap.get(toIdString(aisle.userId));
      const publicSlug =
        user?.username ||
        user?.aisleSettings?.slug ||
        aisle.slug ||
        null;

      return {
        _id: `legacy-aisle:${aisle._id.toString()}`,
        id: aisle._id.toString(),
        type: 'aisle',
        title: aisle.title || user?.username || 'Untitled aisle',
        slug: aisle.slug || null,
        publicSlug,
      };
    });

    const formattedUserAisles = userAisles.map((user) => ({
      _id: `user-aisle:${user._id.toString()}`,
      id: user.id || user._id.toString(),
      type: 'aisle',
      title:
        user.aisleSettings?.title ||
        user.profile?.displayName ||
        user.username ||
        'Untitled aisle',
      slug: user.aisleSettings?.slug || user.username,
      publicSlug: user.username,
      description: user.aisleSettings?.description || '',
      imageUrl:
        user.aisleSettings?.logo ||
        user.aisleSettings?.heroImage ||
        null,
    }));

    // If the same aisle exists in the legacy collection and in users,
    // keep only one result. The user-backed record wins because it uses
    // the current source of truth and correct username-based route.
    const aisleByPublicSlug = new Map();

    [...formattedLegacyAisles, ...formattedUserAisles].forEach((aisle) => {
      if (!aisle.publicSlug) return;

      const key = aisle.publicSlug.toLowerCase();
      const current = aisleByPublicSlug.get(key);

      if (!current || aisle._id.startsWith('user-aisle:')) {
        aisleByPublicSlug.set(key, aisle);
      }
    });

    const aisles = Array.from(aisleByPublicSlug.values()).slice(0, 10);

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