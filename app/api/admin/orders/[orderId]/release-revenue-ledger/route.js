import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { verifyToken } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import {
  MANUAL_TEST_RELEASE_REASON,
  transitionHeldLedgerRowsToReleaseEligible,
} from '@/lib/revenue-ledger-eligibility';

export const dynamic = 'force-dynamic';

function getToken(request) {
  const authorization = request.headers.get('authorization');

  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : null;

  return bearerToken || request.cookies.get('auth_token')?.value || null;
}

function createUserFilter(userId) {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return null;
  }

  const filters = [
    { _id: normalizedUserId },
    { id: normalizedUserId },
    { userId: normalizedUserId },
  ];

  if (ObjectId.isValid(normalizedUserId)) {
    filters.unshift({
      _id: new ObjectId(normalizedUserId),
    });
  }

  return { $or: filters };
}

function createOrderFilter(orderId) {
  const normalizedOrderId = String(orderId || '').trim();

  if (!ObjectId.isValid(normalizedOrderId)) {
    return null;
  }

  return {
    _id: new ObjectId(normalizedOrderId),
  };
}

export async function POST(request, { params }) {
  try {
    if (process.env.METAWORK_ENABLE_MANUAL_TEST_RELEASE !== 'true') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Manual test ledger releases are disabled in this environment.',
          code: 'MANUAL_RELEASE_DISABLED',
        },
        { status: 403 }
      );
    }

    const token = getToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication is required.',
        },
        { status: 401 }
      );
    }

    let decoded;

    try {
      decoded = verifyToken(token);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid authentication token.',
        },
        { status: 401 }
      );
    }

    const userId = String(decoded?.userId || '').trim();
    const userFilter = createUserFilter(userId);

    if (!userFilter) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to resolve the authenticated user.',
        },
        { status: 401 }
      );
    }

    const { orderId } = await params;
    const orderFilter = createOrderFilter(orderId);

    if (!orderFilter) {
      return NextResponse.json(
        {
          success: false,
          error: 'A valid order ID is required.',
        },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const adminUser = await db.collection('users').findOne(
      userFilter,
      {
        projection: {
          _id: 1,
          id: 1,
          email: 1,
          role: 1,
          isAdmin: 1,
        },
      }
    );

    const isAdmin =
      adminUser?.isAdmin === true ||
      String(adminUser?.role || '').toLowerCase() === 'admin';

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Administrator access is required.',
        },
        { status: 403 }
      );
    }

    const order = await db.collection('orders').findOne(orderFilter, {
      projection: {
        _id: 1,
        orderNumber: 1,
        status: 1,
        paymentStatus: 1,
        fulfillmentStatus: 1,
        deliveredAt: 1,
        items: 1,
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order not found.',
        },
        { status: 404 }
      );
    }

    const isDelivered =
      order.fulfillmentStatus === 'delivered' ||
      order.status === 'delivered' ||
      Boolean(order.deliveredAt);

    if (!isDelivered) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Mark the order delivered before manually releasing revenue-ledger entries.',
          code: 'ORDER_NOT_DELIVERED',
        },
        { status: 409 }
      );
    }

    const actor =
      adminUser.email ||
      adminUser.id ||
      String(adminUser._id);

    const body = await request.json().catch(() => ({}));

    const note = String(body?.reason || '').trim();

    if (!note) {
    return NextResponse.json(
        {
        success: false,
        error: 'A manual release note is required.',
        },
        { status: 400 }
    );
    }

    const result =
    await transitionHeldLedgerRowsToReleaseEligible({
        db,
        orderId: String(order._id),
        actor,
        reason: MANUAL_TEST_RELEASE_REASON,
    });

    await db.collection('orders').updateOne(
    { _id: order._id },
    {
        $set: {
        manualRevenueRelease: {
            reason: MANUAL_TEST_RELEASE_REASON,
            note,
            actor,
            releasedAt: new Date(),
            transitionedCount: result.transitionedCount,
            existingEligibleCount: result.existingEligibleCount,
        },
        },
    }
    );

    return NextResponse.json({
      success: true,
      order: {
        id: String(order._id),
        orderNumber: order.orderNumber || null,
      },
      release: {
        reason: result.reason,
        actor: result.actor,
        transitionedCount: result.transitionedCount,
        existingEligibleCount: result.existingEligibleCount,
      },
    });
  } catch (error) {
    console.error(
      '[admin/orders/release-revenue-ledger] failed:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to release the order revenue ledger.',
      },
      { status: 500 }
    );
  }
}