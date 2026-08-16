import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

function toIPLibraryAsset(asset) {
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
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/ip/my-library
 * Get current user's IP (both listed and unlisted)
 * For use in Product Creator IP selection
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status'); // 'listed', 'unlisted', 'all'

    const { db } = await connectToDatabase();

    // Match both current string owner IDs and legacy MongoDB ObjectId owner IDs.
    const ownerIdValues = [decoded.userId];

    if (ObjectId.isValid(decoded.userId)) {
      ownerIdValues.push(new ObjectId(decoded.userId));
    }

    const query = {
      ownerId: { $in: ownerIdValues },
    };

    // Filter by status if specified
    if (status && status !== 'all') {
      query.status = status;
    }

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const ipAssets = await db.collection('ip_assets')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const normalizedIPAssets = ipAssets.map(toIPLibraryAsset);

    const active = normalizedIPAssets.filter((ip) => ip.status === 'active');
    const pendingMint = normalizedIPAssets.filter(
      (ip) => ip.status === 'pending_nft_mint'
    );
    const other = normalizedIPAssets.filter(
      (ip) => ip.status !== 'active' && ip.status !== 'pending_nft_mint'
    );

    return NextResponse.json({
      success: true,
      ipAssets: normalizedIPAssets,
      grouped: {
        active,
        pendingMint,
        other,
      },
      counts: {
        total: normalizedIPAssets.length,
        active: active.length,
        pendingMint: pendingMint.length,
        other: other.length,
      },
    });

  } catch (error) {
    console.error('My IP Library API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
