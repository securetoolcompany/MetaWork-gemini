import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MANUAL_FULFILLMENT_STATUSES = new Set([
  'pending',
  'awaiting_approval',
  'on_hold',
  'shipped',
  'refunded',
]);

function getToken(request) {
  const authorization = request.headers.get('authorization');

  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  return bearerToken || request.cookies.get('auth_token')?.value || null;
}

async function getAuthenticatedAdmin(request) {
  const token = getToken(request);

  if (!token) {
    return null;
  }

  try {
    const decoded = verifyToken(token);

    if (!decoded?.userId) {
      return null;
    }

    if (decoded.role === 'admin' || decoded.isAdmin === true) {
      return decoded;
    }

    const { db } = await connectToDatabase();

    const user = await db.collection('users').findOne({
      $or: [
        { id: decoded.userId },
        ...(ObjectId.isValid(String(decoded.userId))
          ? [{ _id: new ObjectId(String(decoded.userId)) }]
          : []),
      ],
    });

    return user?.isAdmin === true || user?.role === 'admin'
      ? decoded
      : null;
  } catch (error) {
    console.error(
      '[admin/orders/fulfillment] authentication error:',
      error,
    );

    return null;
  }
}

function parseReason(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const reason = value.trim();

  if (!reason || reason.length > 500) {
    return null;
  }

  return reason;
}

export async function POST(request, context) {
  const admin = await getAuthenticatedAdmin(request);

  if (!admin) {
    return NextResponse.json(
      {
        success: false,
        error: 'Administrator authorization is required.',
      },
      { status: 403 },
    );
  }

  const params = await context.params;
	const orderId = String(params?.orderId || '').trim();

  if (!ObjectId.isValid(orderId)) {
    return NextResponse.json(
      {
        success: false,
        error: 'orderId must be a valid MongoDB ObjectId.',
      },
      { status: 400 },
    );
  }

  let body;

  try {
    body = await request.json();
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Request body must be valid JSON.',
      },
      { status: 400 },
    );
  }

  const fulfillmentStatus = String(
    body?.fulfillmentStatus || '',
  ).trim();

  const reason = parseReason(body?.reason);

  if (!MANUAL_FULFILLMENT_STATUSES.has(fulfillmentStatus)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'fulfillmentStatus must be pending, awaiting_approval, on_hold, shipped, or refunded. Use the dedicated mark-delivered action for delivered.',
      },
      { status: 400 },
    );
  }

  if (!reason) {
    return NextResponse.json(
      {
        success: false,
        error:
          'reason must be a non-empty string of at most 500 characters.',
      },
      { status: 400 },
    );
  }

  try {
    const { db } = await connectToDatabase();
    const orders = db.collection('orders');
    const mongoOrderId = new ObjectId(orderId);

    const order = await orders.findOne({
      _id: mongoOrderId,
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order was not found.',
        },
        { status: 404 },
      );
    }

    if (
      order.status === 'cancelled' ||
      order.status === 'canceled' ||
      order.refundStatus === 'refunded' ||
      order.fulfillmentStatus === 'refunded'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Cancelled or refunded orders cannot receive manual fulfillment updates.',
        },
        { status: 409 },
      );
    }

    if (order.fulfillmentStatus === fulfillmentStatus) {
			return NextResponse.json({
					success: true,
					orderId,
					alreadyAtStatus: true,
					fulfillmentStatus,
					fulfillmentSource:
					order.fulfillmentSource || 'manual_admin',
			});
			}

    const now = new Date();
    const actor = String(
      admin.email || admin.userId || 'unknown-admin',
    );

    await orders.updateOne(
      { _id: mongoOrderId },
      {
        $set: {
          fulfillmentStatus,
          fulfillmentSource: 'manual_admin',
          fulfillmentUpdatedAt: now,
          updatedAt: now,
        },
        $push: {
          fulfillmentHistory: {
            status: fulfillmentStatus,
            source: 'manual_admin',
            actor,
            reason,
            recordedAt: now,
          },
        },
      },
    );

    return NextResponse.json({
      success: true,
      orderId,
      fulfillmentStatus,
      fulfillmentSource: 'manual_admin',
    });
  } catch (error) {
    console.error('[admin/orders/fulfillment] failed:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to update order fulfillment status.',
      },
      { status: 500 },
    );
  }
}