import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { verifyToken } from '@/lib/auth';
import {
  publicProductEligibility,
} from '@/lib/public-inventory-eligibility';

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

    const includeDrafts =
      searchParams.get('includeDrafts') === 'true';

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : request.cookies.get('auth_token')?.value;

    let authenticatedUser = null;

    if (token && creator && includeDrafts) {
      let decoded = null;

      try {
        decoded = verifyToken(token);
      } catch {
        // Invalid authentication receives public-only access.
      }

      if (decoded?.userId) {
        const userId = String(decoded.userId).trim();

        const identityFilters = [
          { _id: userId },
          { id: userId },
          { userId },
        ];

        if (ObjectId.isValid(userId)) {
          identityFilters.unshift({ _id: new ObjectId(userId) });
        }

        authenticatedUser = await db.collection('users').findOne(
          { $or: identityFilters },
          { projection: { _id: 1, id: 1, userId: 1, username: 1 } },
        );
      }
    }

    const ownerAliases = authenticatedUser
      ? [...new Set([
          authenticatedUser._id,
          authenticatedUser.id,
          authenticatedUser.userId,
          authenticatedUser.username,
        ].filter(Boolean).map(String))]
      : [];

    const canReadOwnDrafts = Boolean(
      creator &&
      includeDrafts &&
      authenticatedUser &&
      ownerAliases.includes(creator)
    );

    function creatorFilter(values, username) {
      const stringValues = [...new Set(values.filter(Boolean).map(String))];
      const objectValues = stringValues
        .filter((value) => ObjectId.isValid(value))
        .map((value) => new ObjectId(value));

      return {
        $or: [
          { userId: { $in: [...stringValues, ...objectValues] } },
          { creatorId: { $in: [...stringValues, ...objectValues] } },
          { ownerId: { $in: [...stringValues, ...objectValues] } },
          ...(username
            ? [
                { ownerUsername: username },
                { creatorUsername: username },
              ]
            : []),
        ],
      };
    }

    const clauses = [];

    if (canReadOwnDrafts) {
      clauses.push(creatorFilter(
        ownerAliases,
        authenticatedUser.username,
      ));

      // No status restriction means all of this owner's states.
      if (status) clauses.push({ status });
    } else {
      clauses.push(publicProductEligibility());

      if (creator) {
        clauses.push(creatorFilter([creator], creator));
      }

      // Requested status may narrow public eligibility, never expand it.
      if (status) clauses.push({ status });
    }

    const query = { $and: clauses };

    if (category) {
      // assuming categories: string[] on the product
      query.categories = category;
    }

    if (q) {
      query.$text = { $search: q };
      // or use regex if you don’t have a text index:
      // query.title = { $regex: q, $options: 'i' };
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
