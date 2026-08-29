import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

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
    console.error('[admin/orders] authentication error:', error);
    return null;
  }
}

function serialize(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === 'bigint') {
        return nestedValue.toString();
      }

      return nestedValue;
    }),
  );
}

function getFirstValue(...values) {
  return values.find(
    (value) =>
      value !== null &&
      value !== undefined &&
      value !== '',
  ) || null;
}

function normalizeAddress(order) {
  return getFirstValue(
    order.shippingAddress,
    order.shipping?.address,
    order.shipping,
    order.address,
    order.customer?.shippingAddress,
    order.customer?.address,
  );
}

function toOrderResponse(order) {
  const isPrintfulOrder =
    order.printfulOrderId !== null &&
    order.printfulOrderId !== undefined;

  const shippingAddress = normalizeAddress(order);

  return {
    id: String(order._id),

    orderNumber:
      order.orderNumber ||
      order.orderId ||
      String(order._id),

    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,

    status: order.status || 'unknown',
    paymentStatus: order.paymentStatus || null,
    refundStatus: order.refundStatus || null,

    fulfillmentStatus: order.fulfillmentStatus || 'pending',
    fulfillmentSource:
      order.fulfillmentSource ||
      (isPrintfulOrder ? 'printful' : 'manual'),

    fulfillmentUpdatedAt:
      order.fulfillmentUpdatedAt || null,

    deliveredAt: order.deliveredAt || null,

    isPrintfulOrder,

    printfulOrderId: isPrintfulOrder
      ? String(order.printfulOrderId)
      : null,

    customerName: getFirstValue(
      order.customerName,
      order.shippingAddress?.name,
      order.shipping?.name,
      order.shipping?.address?.name,
      order.customer?.name,
      order.customer?.fullName,
      order.customer?.firstName &&
        order.customer?.lastName
        ? `${order.customer.firstName} ${order.customer.lastName}`
        : null,
      order.billingAddress?.name,
    ),

    customerEmail: getFirstValue(
      order.customerEmail,
      order.email,
      order.customer?.email,
      order.shipping?.email,
      order.billingAddress?.email,
      shippingAddress?.email,
    ),

    customerPhone: getFirstValue(
      order.customerPhone,
      order.phone,
      order.shippingPhone,
      order.customer?.phone,
      order.customer?.phoneNumber,
      order.shipping?.phone,
      order.billingAddress?.phone,
      shippingAddress?.phone,
    ),

    shippingAddress,

    billingAddress: getFirstValue(
      order.billingAddress,
      order.billing?.address,
      order.billing,
    ),

    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          orderItemId:
            item.orderItemId ||
            item.id ||
            item.productId ||
            null,

          name: getFirstValue(
            item.name,
            item.productName,
            item.title,
            item.product?.name,
            item.product?.title,
            item.variantName,
            item.variant?.name,
          ),

          quantity: Number(
            item.quantity ||
            item.qty ||
            item.count ||
            0,
          ),

          sku: getFirstValue(
            item.sku,
            item.variant?.sku,
            item.product?.sku,
          ),

          variant: getFirstValue(
            item.variantName,
            item.variant?.name,
            item.size,
          ),
        }))
      : [],

    itemCount: Array.isArray(order.items)
      ? order.items.length
      : 0,

    manualDelivery: order.manualDelivery
      ? {
          actor: order.manualDelivery.actor || null,
          reason: order.manualDelivery.reason || null,
          markedAt: order.manualDelivery.markedAt || null,
        }
      : null,
      rawContactDebug: {
				customerName: order.customerName || null,
				customerEmail: order.customerEmail || null,
				customerPhone: order.customerPhone || null,

				email: order.email || null,
				phone: order.phone || null,
				shippingPhone: order.shippingPhone || null,

				customer: order.customer || null,

				shippingAddress: order.shippingAddress || null,
				shipping: order.shipping || null,
				address: order.address || null,

				billingAddress: order.billingAddress || null,
				billing: order.billing || null,
				},
  };
}
export async function GET(request) {
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

  const requestedLimit = Number(
    request.nextUrl.searchParams.get('limit') || 100,
  );

  const limit = Math.min(
    Math.max(
      Number.isSafeInteger(requestedLimit)
        ? requestedLimit
        : 100,
      1,
    ),
    250,
  );

  try {
    const { db } = await connectToDatabase();

    const orders = await db
      .collection('orders')
      .find(
        {},
        {
          projection: {
            orderNumber: 1,
            orderId: 1,
            createdAt: 1,
            updatedAt: 1,

            status: 1,
            paymentStatus: 1,
            refundStatus: 1,

            fulfillmentStatus: 1,
            fulfillmentSource: 1,
            fulfillmentUpdatedAt: 1,
            deliveredAt: 1,

            printfulOrderId: 1,

            customerName: 1,
            customerEmail: 1,
            customerPhone: 1,

            email: 1,
            phone: 1,
            shippingPhone: 1,

            customer: 1,

            shippingAddress: 1,
            shipping: 1,
            address: 1,

            billingAddress: 1,
            billing: 1,

            items: 1,

            manualDelivery: 1,
            },
        },
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(
      serialize({
        success: true,
        orders: orders.map(toOrderResponse),
      }),
    );
  } catch (error) {
    console.error('[admin/orders] failed to list orders:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unable to load orders.',
      },
      { status: 500 },
    );
  }
}