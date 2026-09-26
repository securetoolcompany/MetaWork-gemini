// app/api/aisle/[username]/route.js

import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPublicDocument(document) {
  return {
    ...document,
    _id: document._id?.toString(),
    id: document.id?.toString() || document._id?.toString(),
  };
}

export async function GET(request, { params }) {
  try {
    const { username } = await params;
    const normalizedUsername = String(username || '').trim();

    if (!normalizedUsername) {
      return NextResponse.json(
        { success: false, error: 'Creator not found' },
        { status: 404 },
      );
    }

    const { db } = await connectToDatabase();

    const searchRegex = new RegExp(
      `^${escapeRegex(normalizedUsername)}$`,
      'i',
    );

    const creator = await db.collection('users').findOne({
      $or: [
        { 'aisleSettings.slug': searchRegex },
        { username: searchRegex },
      ],
    });

    if (!creator) {
      return NextResponse.json(
        { success: false, error: 'Creator not found' },
        { status: 404 },
      );
    }

    const stringOwnerIds = Array.from(
      new Set(
        [
          creator._id?.toString(),
          creator.id,
          creator.username,
        ]
          .filter(Boolean)
          .map((value) => String(value)),
      ),
    );

    const objectIdOwnerIds = creator._id ? [creator._id] : [];

    const productOwnerQuery = {
      $or: [
        { creatorId: { $in: stringOwnerIds } },
        { userId: { $in: stringOwnerIds } },
        { ownerId: { $in: stringOwnerIds } },
        { creatorId: { $in: objectIdOwnerIds } },
        { userId: { $in: objectIdOwnerIds } },
        { ownerId: { $in: objectIdOwnerIds } },
        ...(creator.username
          ? [
              { creatorUsername: creator.username },
              { ownerUsername: creator.username },
            ]
          : []),
      ],
    };

    const publicProductQuery = {
      $and: [
        productOwnerQuery,
        {
          $or: [
            { isPublic: true },
            { isVisible: true },
            { showroomListed: true },
            { status: 'live' },
          ],
        },
      ],
    };

    const ipOwnerQuery = {
      $or: [
        { ownerId: { $in: stringOwnerIds } },
        { userId: { $in: stringOwnerIds } },
        { creatorId: { $in: stringOwnerIds } },
        { ownerId: { $in: objectIdOwnerIds } },
        { userId: { $in: objectIdOwnerIds } },
        { creatorId: { $in: objectIdOwnerIds } },
        ...(creator.username
          ? [
              { ownerUsername: creator.username },
              { creatorUsername: creator.username },
              { username: creator.username },
            ]
          : []),
      ],
    };

    const [products, ipAssets] = await Promise.all([
      db.collection('products').find(publicProductQuery).toArray(),
      db.collection('ip_assets').find(ipOwnerQuery).toArray(),
    ]);

    console.log('[public-aisle] inventory loaded', {
      username: creator.username,
      mongoUserId: creator._id?.toString(),
      appUserId: creator.id || null,
      productCount: products.length,
      ipAssetCount: ipAssets.length,
      ipAssets: ipAssets.map((asset) => ({
        id: asset._id?.toString(),
        name: asset.name || asset.title || null,
        ownerId: asset.ownerId?.toString?.() || asset.ownerId || null,
        ownerUsername: asset.ownerUsername || null,
        status: asset.status || null,
      })),
    });

    const formattedCollections = (creator.collections || [])
      .filter((collection) => collection?.active !== false)
      .map((collection) => ({
        ...collection,
        id:
          collection.id?.toString() ||
          collection._id?.toString() ||
          Math.random().toString(36).slice(2, 11),
      }));

    return NextResponse.json({
      success: true,
      creator: {
        username: creator.username,
        aisleSettings: creator.aisleSettings || {},
        title: creator.aisleSettings?.title || creator.username,
        description: creator.aisleSettings?.description || creator.bio,
        logo: creator.aisleSettings?.logo || creator.avatar,
        heroImage: creator.aisleSettings?.heroImage || creator.banner,
      },
      products: products.map(toPublicDocument),
      ipAssets: ipAssets.map(toPublicDocument),
      collections: formattedCollections,
    });
  } catch (error) {
    console.error('Aisle API Error:', error);

    return NextResponse.json(
      { success: false, error: 'Server Error' },
      { status: 500 },
    );
  }
}