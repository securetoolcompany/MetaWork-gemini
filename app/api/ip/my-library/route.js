import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

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

    // Query for user's own IP
    const query = { ownerId: decoded.userId };

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

    // Separate by status for UI tabs
    const listed = ipAssets.filter(ip => ip.status === 'listed' && ip.isMinted);
    const unlisted = ipAssets.filter(ip => ip.status === 'unlisted' || !ip.isMinted);
    const pending = ipAssets.filter(ip => ip.status === 'pending');

    return NextResponse.json({
      success: true,
      ipAssets,
      grouped: {
        listed,
        unlisted,
        pending
      },
      counts: {
        total: ipAssets.length,
        listed: listed.length,
        unlisted: unlisted.length,
        pending: pending.length
      }
    });

  } catch (error) {
    console.error('My IP Library API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
