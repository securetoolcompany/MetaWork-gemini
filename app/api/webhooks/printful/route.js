import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { createHeldRevenueLedgerEntriesForOrder } from '@/lib/revenue-ledger-service';

export const dynamic = 'force-dynamic';

const EVENT_COLLECTION = 'printful_webhook_events';
const LEASE_MS = 5 * 60 * 1000;

const SUPPORTED_EVENT_TYPES = new Set([
  'package_shipped',
  'order_put_hold',
  'order_remove_hold',
  'order_refunded',
]);

function unixSecondsToDate(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return new Date(seconds * 1000);
}

function buildIdempotencyKey({ store, type, created, order, shipment }) {
  const entityId =
    shipment?.id ??
    order?.id ??
    order?.external_id ??
    'unknown';

  return `printful:${store || 'unknown'}:${type || 'unknown'}:${entityId}:${created || 'unknown'}`;
}

function normalizeShipment({ eventType, shipment }) {
  if (!shipment?.id) {
    return null;
  }

  return {
    printfulShipmentId: String(shipment.id),
    status: eventType === 'package_shipped'
      ? 'shipped'
      : String(shipment.status || 'unknown'),

    carrier: shipment.carrier || null,
    service: shipment.service || null,
    trackingNumber: shipment.tracking_number || null,
    trackingUrl: shipment.tracking_url || null,

    shippedAt: unixSecondsToDate(shipment.shipped_at),
    providerCreatedAt: unixSecondsToDate(shipment.created),

    reshipment: Boolean(shipment.reshipment),
    location: shipment.location || null,

    estimatedDeliveryFrom: unixSecondsToDate(
      shipment.estimated_delivery_dates?.from
    ),

    estimatedDeliveryTo: unixSecondsToDate(
      shipment.estimated_delivery_dates?.to
    ),

    shipmentItems: Array.isArray(shipment.items)
      ? shipment.items.map((shipmentItem) => ({
          printfulOrderItemId: shipmentItem?.item_id
            ? String(shipmentItem.item_id)
            : null,

          quantity: Number(shipmentItem?.quantity || 0),
          picked: Number(shipmentItem?.picked || 0),
          printed: Number(shipmentItem?.printed || 0),
          isStarted: Boolean(shipmentItem?.is_started),
        }))
      : [],

    updatedAt: new Date(),
  };
}

function buildShipmentItemAllocations({
  eventType,
  order,
  shipment,
}) {
  if (
    eventType !== 'package_shipped' ||
    !shipment?.id ||
    !Array.isArray(order?.items) ||
    !Array.isArray(shipment?.items)
  ) {
    return [];
  }

  const printfulOrderItemsById = new Map(
    order.items
      .filter((orderItem) => orderItem?.id)
      .map((orderItem) => [
        String(orderItem.id),
        orderItem,
      ])
  );

  return shipment.items
    .map((shipmentItem) => {
      const printfulOrderItemId = String(shipmentItem?.item_id || '');
      const printfulOrderItem = printfulOrderItemsById.get(
        printfulOrderItemId
      );

      const orderItemId = String(
        printfulOrderItem?.external_id || ''
      );

      // New MetaWork orders use immutable IDs such as:
      // "497289:item:1". Legacy product-ID external IDs are not safe
      // for per-item allocation mapping.
      if (
        !printfulOrderItemId ||
        !printfulOrderItem ||
        !orderItemId.includes(':item:')
      ) {
        return null;
      }

      return {
        allocationKey: `${shipment.id}:${printfulOrderItemId}`,

        orderItemId,

        printfulShipmentId: String(shipment.id),
        printfulOrderItemId,
        printfulExternalId: orderItemId,

        quantityShipped: Number(shipmentItem?.quantity || 0),

        status: 'shipped',
        shippedAt: unixSecondsToDate(shipment.shipped_at),

        createdAt: new Date(),
      };
    })
    .filter(Boolean);
}

function getNormalizedFulfillmentStatus(eventType, order) {
  if (eventType === 'package_shipped') {
    return 'shipped';
  }

  if (eventType === 'order_put_hold') {
    return 'on_hold';
  }

  if (eventType === 'order_remove_hold') {
    return 'awaiting_approval';
  }

  if (eventType === 'order_refunded') {
    return 'refunded';
  }

  return String(order?.status || 'unknown');
}

async function claimEvent(events, eventDocument) {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
  const leaseId = crypto.randomUUID();

  // Only reclaim an event if a prior attempt failed or an old worker lease expired.
  const reclaimResult = await events.updateOne(
    {
      _id: eventDocument._id,
      $or: [
        { status: 'failed' },
        {
          status: 'processing',
          leaseExpiresAt: { $lte: now },
        },
      ],
    },
    {
      $set: {
        status: 'processing',
        leaseId,
        leaseExpiresAt,
        lastAttemptAt: now,
      },
    }
  );

  if (reclaimResult.matchedCount === 1) {
    return leaseId;
  }

  // New event: insert once. A duplicate-key error means another request
  // already created or completed the same idempotent event.
  try {
    await events.insertOne({
      ...eventDocument,
      status: 'processing',
      leaseId,
      leaseExpiresAt,
      receivedAt: now,
      lastAttemptAt: now,
    });

    return leaseId;
  } catch (error) {
    if (error?.code === 11000) {
      return null;
    }

    throw error;
  }
}

async function upsertShipmentOnOrder({
  orders,
  orderId,
  orderUpdate,
  normalizedShipment,
}) {
  if (!normalizedShipment) {
    await orders.updateOne(
      { _id: orderId },
      { $set: orderUpdate }
    );

    return;
  }

  const existingShipmentUpdate = await orders.updateOne(
    {
      _id: orderId,
      'printfulShipments.printfulShipmentId':
        normalizedShipment.printfulShipmentId,
    },
    {
      $set: {
        ...orderUpdate,
        'printfulShipments.$': normalizedShipment,
      },
    }
  );

  if (existingShipmentUpdate.matchedCount > 0) {
    return;
  }

  await orders.updateOne(
    { _id: orderId },
    {
      $set: orderUpdate,
      $push: {
        printfulShipments: normalizedShipment,
      },
    }
  );
}

async function persistShipmentItemAllocations({
  orders,
  orderId,
  allocations,
}) {
  for (const allocation of allocations) {
    const result = await orders.updateOne(
      {
        _id: orderId,
        'items.orderItemId': allocation.orderItemId,
      },
      {
        $set: {
          'items.$.printfulOrderItemId':
            allocation.printfulOrderItemId,

          'items.$.printfulExternalId':
            allocation.printfulExternalId,

          'items.$.shipmentStatus': 'shipped',

          'items.$.lastShippedAt':
            allocation.shippedAt,
        },

        $addToSet: {
          'items.$.printfulShipmentAllocations': allocation,
        },
      }
    );

    if (result.matchedCount === 0) {
      console.warn(
        '[Printful webhook] Could not map shipment allocation to MetaWork order item:',
        {
          metaworkOrderId: String(orderId),
          orderItemId: allocation.orderItemId,
          printfulShipmentId: allocation.printfulShipmentId,
          printfulOrderItemId: allocation.printfulOrderItemId,
        }
      );
    }
  }
}

export async function POST(req) {
  const expectedToken = process.env.PRINTFUL_WEBHOOK_TOKEN;
  const receivedToken = req.nextUrl.searchParams.get('token');

  if (!expectedToken) {
    console.error(
      '[Printful webhook] PRINTFUL_WEBHOOK_TOKEN is not configured.'
    );

    return NextResponse.json(
      { error: 'Webhook endpoint is not configured.' },
      { status: 500 }
    );
  }

  if (!receivedToken || receivedToken !== expectedToken) {
    return NextResponse.json(
      { error: 'Unauthorized webhook request.' },
      { status: 401 }
    );
  }

  let payload;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Webhook body must be valid JSON.' },
      { status: 400 }
    );
  }

  const eventType = String(payload?.type || '');
  const store = payload?.store ?? null;
  const created = payload?.created ?? null;
  const retryCount = Number(payload?.retries || 0);

  const order = payload?.data?.order || null;
  const shipment =
    payload?.data?.shipment ||
    (Array.isArray(order?.shipments) ? order.shipments[0] : null);

  if (!SUPPORTED_EVENT_TYPES.has(eventType)) {
    console.log('[Printful webhook] Ignoring unsupported event type:', eventType);

    return NextResponse.json({
      received: true,
      ignored: true,
      reason: 'unsupported_event_type',
    });
  }

  if (!order?.id && !order?.external_id) {
    return NextResponse.json(
      { error: 'Webhook does not include a usable Printful order identifier.' },
      { status: 400 }
    );
  }

  const idempotencyKey = buildIdempotencyKey({
    store,
    type: eventType,
    created,
    order,
    shipment,
  });

  const { db } = await connectToDatabase();
  const events = db.collection(EVENT_COLLECTION);
  const orders = db.collection('orders');

  const normalizedShipment = normalizeShipment({
    eventType,
    shipment,
  });

  const shipmentItemAllocations = buildShipmentItemAllocations({
    eventType,
    order,
    shipment,
    });

  const eventDocument = {
    _id: idempotencyKey,
    provider: 'printful',

    eventType,
    storeId: store ? String(store) : null,
    providerCreatedAt: unixSecondsToDate(created),
    retryCount,

    printfulOrderId: order?.id ? String(order.id) : null,
    externalOrderId: order?.external_id
      ? String(order.external_id)
      : null,

    printfulShipmentId: normalizedShipment?.printfulShipmentId || null,

    normalizedStatus: getNormalizedFulfillmentStatus(eventType, order),

    // Do not persist raw recipient/customer PII here.
    shipment: normalizedShipment,
    shipmentItemAllocations,
  };

  let leaseId;

  try {
    leaseId = await claimEvent(events, eventDocument);
  } catch (error) {
    console.error(
      '[Printful webhook] Could not claim event:',
      idempotencyKey,
      error
    );

    return NextResponse.json(
      { error: 'Unable to claim webhook event.' },
      { status: 500 }
    );
  }

  if (!leaseId) {
    console.log('[Printful webhook] Duplicate or active event ignored:', {
      idempotencyKey,
    });

    return NextResponse.json({
      received: true,
      duplicate: true,
    });
  }

  try {
    const printfulOrderId = order?.id ? Number(order.id) : null;
    const externalOrderId = order?.external_id
      ? String(order.external_id)
      : null;

    const orderLookup = [];

    if (Number.isFinite(printfulOrderId) && printfulOrderId > 0) {
      orderLookup.push({ printfulOrderId });
      orderLookup.push({ printfulOrderId: String(printfulOrderId) });
    }

    if (externalOrderId) {
      orderLookup.push({ orderNumber: externalOrderId });
    }

    const localOrder = await orders.findOne({
      $or: orderLookup,
    });

    if (!localOrder) {
      console.warn('[Printful webhook] No MetaWork order matched event:', {
        idempotencyKey,
        printfulOrderId,
        externalOrderId,
      });

      await events.updateOne(
        {
          _id: idempotencyKey,
          leaseId,
        },
        {
          $set: {
            status: 'processed',
            orderMatched: false,
            processedAt: new Date(),
            leaseId: null,
            leaseExpiresAt: null,
          },
        }
      );

      return NextResponse.json({
        received: true,
        orderMatched: false,
      });
    }

    const normalizedStatus = getNormalizedFulfillmentStatus(
      eventType,
      order
    );

    const orderUpdate = {
      fulfillmentStatus: normalizedStatus,
      fulfillmentUpdatedAt: new Date(),

      printfulLastEvent: {
        idempotencyKey,
        eventType,
        providerCreatedAt: unixSecondsToDate(created),
        printfulOrderId: String(order.id),
        printfulShipmentId: normalizedShipment?.printfulShipmentId || null,
      },

      // Preserve the existing value when it already exists.
      ...(localOrder.printfulOrderId
        ? {}
        : { printfulOrderId: printfulOrderId }),
    };

    if (eventType === 'order_refunded') {
      orderUpdate.printfulRefundedAt = new Date();
      orderUpdate.printfulRefundAmount = payload?.data?.amount || null;
      orderUpdate.refundStatus = 'refunded';
    }

    if (eventType === 'order_put_hold') {
      orderUpdate.printfulHoldReason = payload?.data?.reason || null;
      orderUpdate.printfulHeldAt = new Date();
    }

    if (eventType === 'order_remove_hold') {
      orderUpdate.printfulHoldReason = null;
      orderUpdate.printfulHoldReleasedAt = new Date();
    }

    await upsertShipmentOnOrder({
      orders,
      orderId: localOrder._id,
      orderUpdate,
      normalizedShipment,
    });

    await persistShipmentItemAllocations({
        orders,
        orderId: localOrder._id,
        allocations: shipmentItemAllocations,
    });

    if (normalizedStatus === 'delivered') {
      const deliveredOrder = await orders.findOne({
        _id: localOrder._id,
      });

      await createHeldRevenueLedgerEntriesForOrder({
        db,
        order: deliveredOrder,
        now: new Date(),
      });
    }

    await events.updateOne(
      {
        _id: idempotencyKey,
        leaseId,
      },
      {
        $set: {
          status: 'processed',
          orderMatched: true,
          metaworkOrderId: String(localOrder._id),
          processedAt: new Date(),
          leaseId: null,
          leaseExpiresAt: null,
        },
      }
    );

    console.log('[Printful webhook] Persisted event:', {
      idempotencyKey,
      eventType,
      metaworkOrderId: String(localOrder._id),
      printfulOrderId: String(order.id),
      printfulShipmentId: normalizedShipment?.printfulShipmentId || null,
      fulfillmentStatus: normalizedStatus,
    });

    return NextResponse.json({
      received: true,
      orderMatched: true,
      eventType,
    });
  } catch (error) {
    console.error(
      '[Printful webhook] Failed to process event:',
      idempotencyKey,
      error
    );

    await events.updateOne(
      {
        _id: idempotencyKey,
        leaseId,
      },
      {
        $set: {
          status: 'failed',
          lastError: error?.message || 'Unknown Printful webhook error',
          failedAt: new Date(),
          leaseId: null,
          leaseExpiresAt: null,
        },
      }
    );

    return NextResponse.json(
      { error: 'Webhook processing failed.' },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  const expectedToken = process.env.PRINTFUL_WEBHOOK_TOKEN;
  const receivedToken = req.nextUrl.searchParams.get('token');

  if (!expectedToken || receivedToken !== expectedToken) {
    return NextResponse.json(
      { error: 'Unauthorized webhook request.' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Printful webhook persistence endpoint is ready.',
  });
}