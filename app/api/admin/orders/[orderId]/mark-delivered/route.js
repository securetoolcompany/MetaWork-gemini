import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import {
  createHeldRevenueLedgerEntriesForOrder,
} from '@/lib/revenue-ledger-service';

export const dynamic = 'force-dynamic';

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
      '[admin/orders/mark-delivered] authentication error:',
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

function isNonDeliverableOrder(order) {
  return (
    order?.refundStatus === 'refunded' ||
    order?.fulfillmentStatus === 'refunded' ||
    order?.status === 'cancelled' ||
    order?.status === 'canceled'
  );
}

export async function POST(request, context) {
  const params = await context.params;
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

  const reason = parseReason(body?.reason);

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

    const existingOrder = await orders.findOne({
      _id: mongoOrderId,
    });

    if (!existingOrder) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order was not found.',
        },
        { status: 404 },
      );
    }

    if (isNonDeliverableOrder(existingOrder)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Refunded or cancelled orders cannot be marked as delivered.',
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const alreadyDelivered =
      existingOrder.fulfillmentStatus === 'delivered';

    if (!alreadyDelivered) {
      await orders.updateOne(
        {
          _id: mongoOrderId,
          fulfillmentStatus: { $ne: 'delivered' },
        },
        {
          $set: {
            fulfillmentStatus: 'delivered',
            deliveredAt: now,
            fulfillmentUpdatedAt: now,
            fulfillmentSource: 'manual_admin',
            manualDelivery: {
              actor: String(
                admin.email || admin.userId || 'unknown-admin',
              ),
              reason,
              markedAt: now,
            },
          },
        },
      );
    }

    const deliveredOrder = await orders.findOne({
      _id: mongoOrderId,
    });

    if (!deliveredOrder) {
      throw new Error('Order disappeared after delivery update.');
    }

    const ledgerResult =
      await createHeldRevenueLedgerEntriesForOrder({
        db,
        order: deliveredOrder,
        now,
      });

    return NextResponse.json({
      success: true,
      orderId,
      alreadyDelivered,
      fulfillmentStatus: deliveredOrder.fulfillmentStatus,
      deliveredAt: deliveredOrder.deliveredAt || now,
      fulfillmentSource:
        deliveredOrder.fulfillmentSource || 'manual_admin',
      ledger: {
        createdCount: ledgerResult?.createdCount ?? null,
        existingCount: ledgerResult?.existingCount ?? null,
      },
    });
  } catch (error) {
    console.error(
      '[admin/orders/mark-delivered] failed:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to mark the order as delivered.',
      },
      { status: 500 },
    );
  }
}