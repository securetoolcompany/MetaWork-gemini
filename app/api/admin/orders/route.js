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

function toFiniteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : fallback;
}


function sumNumbers(values) {
  return values.reduce(
    (total, value) => total + (toFiniteNumber(value, 0) || 0),
    0,
  );
}


function getCurrency(order) {
  return (
    getFirstValue(
      order.pricing?.currency,
      order.financialSummary?.currency,
      order.fulfillmentCosts?.currency,
      order.currency,
      order.paymentCurrency,
      order.payment?.currency,
    ) || 'USD'
  ).toUpperCase();
}


function normalizeShipment(shipment) {
  if (!shipment || typeof shipment !== 'object') {
    return null;
  }

  return {
    id: getFirstValue(
      shipment.id,
      shipment._id,
      shipment.packageId,
      shipment.package_id,
      shipment.trackingNumber,
    ),

    provider: getFirstValue(
      shipment.provider,
      shipment.fulfillmentSource,
      shipment.source,
      shipment.supplierName,
    ),

    supplierName: getFirstValue(
      shipment.supplierName,
      shipment.supplier,
    ),

    status: getFirstValue(
      shipment.status,
      shipment.deliveryStatus,
      shipment.fulfillmentStatus,
    ),

    carrier: getFirstValue(
      shipment.carrier,
      shipment.carrierName,
    ),

    service: getFirstValue(
      shipment.service,
      shipment.shippingService,
    ),

    trackingNumber: getFirstValue(
      shipment.trackingNumber,
      shipment.tracking_number,
      shipment.trackingCode,
    ),

    trackingUrl: getFirstValue(
      shipment.trackingUrl,
      shipment.tracking_url,
      shipment.trackingLink,
    ),

    shippedAt: getFirstValue(
      shipment.shippedAt,
      shipment.shipped_at,
      shipment.createdAt,
    ),

    deliveredAt: getFirstValue(
      shipment.deliveredAt,
      shipment.delivered_at,
    ),

    expectedDeliveryAt: getFirstValue(
      shipment.expectedDeliveryAt,
      shipment.estimatedDeliveryAt,
      shipment.estimated_delivery_at,
    ),
  };
}


function getFinancialSummary(order) {
  const pricing = order.pricing || {};
  const legacyTotals = order.totals || {};
  const fulfillmentCosts = order.fulfillmentCosts || {};
  const existingSummary = order.financialSummary || {};

  const customerPaidTotal = getFirstValue(
    toFiniteNumber(pricing.customerPaidTotal),
    toFiniteNumber(pricing.total),
    toFiniteNumber(order.customerPaidTotal),
    toFiniteNumber(order.total),
    toFiniteNumber(order.amountTotal),
    toFiniteNumber(order.amount),
    toFiniteNumber(order.totalAmount),
    toFiniteNumber(legacyTotals.total),
    toFiniteNumber(order.payment?.amount),
  );

  const refundedTotal =
    getFirstValue(
      toFiniteNumber(pricing.refundedTotal),
      toFiniteNumber(order.refundedTotal),
      toFiniteNumber(order.refundAmount),
      toFiniteNumber(order.payment?.refundedTotal),
    ) || 0;

  const netCollected =
    getFirstValue(
      toFiniteNumber(pricing.netCollected),
      toFiniteNumber(existingSummary.netCollected),
    ) ??
    (customerPaidTotal !== null
      ? Math.max(customerPaidTotal - refundedTotal, 0)
      : null);

  const processorFeeTotal =
    getFirstValue(
      toFiniteNumber(pricing.paymentProcessorFee),
      toFiniteNumber(pricing.processorFeeTotal),
      toFiniteNumber(existingSummary.processorFeeTotal),
      toFiniteNumber(order.paymentProcessorFee),
      toFiniteNumber(order.stripeFee),
    ) || 0;

  const productCost =
    getFirstValue(
      toFiniteNumber(fulfillmentCosts.productCost),
      toFiniteNumber(fulfillmentCosts.blankCost),
      toFiniteNumber(order.productCost),
      toFiniteNumber(order.blankCost),
    ) || 0;

  const shippingCost =
    getFirstValue(
      toFiniteNumber(fulfillmentCosts.shippingCost),
      toFiniteNumber(order.supplierShippingCost),
      toFiniteNumber(order.shippingCost),
    ) || 0;

  const packagingCost =
    getFirstValue(
      toFiniteNumber(fulfillmentCosts.packagingCost),
      toFiniteNumber(order.packagingCost),
    ) || 0;

  const handlingCost =
    getFirstValue(
      toFiniteNumber(fulfillmentCosts.handlingCost),
      toFiniteNumber(order.handlingCost),
    ) || 0;

  const customsDutyCost =
    getFirstValue(
      toFiniteNumber(fulfillmentCosts.customsDutyCost),
      toFiniteNumber(order.customsDutyCost),
    ) || 0;

  const explicitSupplierCostTotal = getFirstValue(
    toFiniteNumber(fulfillmentCosts.totalSupplierCost),
    toFiniteNumber(existingSummary.supplierCostTotal),
    toFiniteNumber(order.totalSupplierCost),
  );

  const totalFulfillmentCost =
    explicitSupplierCostTotal ??
    sumNumbers([
      productCost,
      shippingCost,
      packagingCost,
      handlingCost,
      customsDutyCost,
    ]);

  const hasRecordedCost =
    explicitSupplierCostTotal !== null ||
    productCost > 0 ||
    shippingCost > 0 ||
    packagingCost > 0 ||
    handlingCost > 0 ||
    customsDutyCost > 0;

  const costStatus =
    getFirstValue(
      fulfillmentCosts.costStatus,
      existingSummary.costStatus,
      order.costStatus,
    ) || (hasRecordedCost ? 'estimated' : 'missing');

  const explicitDistributableRevenue = getFirstValue(
    toFiniteNumber(existingSummary.distributableRevenue),
    toFiniteNumber(order.distributableRevenue),
    toFiniteNumber(order.revenueAllocation?.distributableAmount),
  );

  const distributableRevenue =
    explicitDistributableRevenue ??
    (netCollected !== null
      ? netCollected - processorFeeTotal - totalFulfillmentCost
      : null);

  const calculationStatus =
    getFirstValue(
      existingSummary.calculationStatus,
      order.financialCalculationStatus,
    ) ||
    (netCollected === null
      ? 'incomplete'
      : !hasRecordedCost
        ? 'incomplete'
        : distributableRevenue !== null && distributableRevenue < 0
          ? 'negative'
          : costStatus === 'actual'
            ? 'ready'
            : 'estimated');

  return {
    currency: getCurrency(order),

    customerPaidTotal,
    refundedTotal,
    netCollected,

    processorFeeTotal,

    productCost,
    shippingCost,
    packagingCost,
    handlingCost,
    customsDutyCost,
    totalFulfillmentCost,

    costStatus,
    distributableRevenue,
    calculationStatus,
  };
}


function getRevenueAllocation(order, financialSummary) {
  const allocation =
    order.revenueAllocation ||
    order.revenuePoolAllocation ||
    {};

  return {
    poolKey: getFirstValue(
      allocation.poolKey,
      order.revenuePoolKey,
      order.poolKey,
    ),

    poolName: getFirstValue(
      allocation.poolName,
      order.revenuePoolName,
      order.poolName,
    ),

    projectId: getFirstValue(
      allocation.projectId,
      order.projectId,
    ),

    revenueTokenId: getFirstValue(
      allocation.revenueTokenId,
      order.revenueTokenId,
    ),

    status: getFirstValue(
      allocation.status,
      order.revenueAllocationStatus,
      order.revenueLedgerStatus,
    ) || 'not_allocated',

    heldAmount: getFirstValue(
      toFiniteNumber(allocation.heldAmount),
      toFiniteNumber(order.heldRevenueAmount),
      toFiniteNumber(
        allocation.status === 'held'
          ? allocation.distributableAmount
          : null,
      ),
      toFiniteNumber(
        order.revenueLedgerStatus === 'created'
          ? financialSummary.distributableRevenue
          : null,
      ),
    ),

    settlementBatchId: getFirstValue(
      allocation.settlementBatchId,
      order.settlementBatchId,
    ),

    claimRoundId: getFirstValue(
      allocation.claimRoundId,
      order.claimRoundId,
    ),

    ledgerStatus: getFirstValue(
      order.revenueLedgerStatus,
      allocation.ledgerStatus,
    ),

    ledgerRowCount: getFirstValue(
      toFiniteNumber(order.revenueLedgerRowCount),
      toFiniteNumber(allocation.ledgerRowCount),
    ),
  };
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
  const financialSummary = getFinancialSummary(order);
  const revenueAllocation = getRevenueAllocation(
    order,
    financialSummary,
  );

  const shipments = Array.isArray(order.shipments)
    ? order.shipments
        .map(normalizeShipment)
        .filter(Boolean)
    : [];
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

		paidAt: getFirstValue(
      order.paidAt,
      order.payment?.paidAt,
      order.paymentIntentCreatedAt,
    ),

    cancelledAt: order.cancelledAt || null,
    refundedAt: order.refundedAt || null,

    isPrintfulOrder,

    printfulOrderId: isPrintfulOrder
      ? String(order.printfulOrderId)
      : null,

		fulfillmentProvider: getFirstValue(
      order.fulfillment?.provider,
      order.fulfillmentProvider,
      order.fulfillmentSource,
      isPrintfulOrder ? 'printful' : 'manual',
    ),

    supplierName: getFirstValue(
      order.fulfillmentCosts?.supplierName,
      order.manualFulfillment?.supplierName,
      order.supplierName,
      isPrintfulOrder ? 'Printful' : null,
    ),

    supplierOrderReference: getFirstValue(
      order.fulfillmentCosts?.supplierOrderReference,
      order.manualFulfillment?.supplierOrderReference,
      order.supplierOrderReference,
      order.fulfillment?.externalOrderId,
    ),

    shipments,

    shipmentCount: shipments.length,

    latestShipment:
      shipments.length > 0
        ? shipments
            .slice()
            .sort((left, right) => {
              const leftDate = new Date(
                left.shippedAt || left.deliveredAt || 0,
              ).getTime();

              const rightDate = new Date(
                right.shippedAt || right.deliveredAt || 0,
              ).getTime();

              return rightDate - leftDate;
            })[0]
        : null,

    financialSummary,

    revenueAllocation,

    flags: {
      needsSupplierAssignment:
        !isPrintfulOrder &&
        !getFirstValue(
          order.manualFulfillment?.supplierName,
          order.supplierName,
          order.fulfillmentCosts?.supplierName,
        ),

      needsCostEntry:
        financialSummary.customerPaidTotal !== null &&
        financialSummary.costStatus === 'missing',

      needsActualCost:
        financialSummary.costStatus === 'estimated',

      hasNegativeDistributableRevenue:
        financialSummary.distributableRevenue !== null &&
        financialSummary.distributableRevenue < 0,

      needsRevenuePoolMapping:
        financialSummary.distributableRevenue !== null &&
        financialSummary.distributableRevenue > 0 &&
        !revenueAllocation.poolKey,

      hasMultipleShipments: shipments.length > 1,

      requiresReview:
        order.fulfillmentStatus === 'on_hold' ||
        order.fulfillmentStatus === 'failed' ||
        order.fulfillmentStatus === 'returned' ||
        order.refundStatus === 'refunded' ||
        financialSummary.calculationStatus === 'negative',
    },

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

          productId: getFirstValue(
            item.productId,
            item.product?.id,
            item.product?._id,
          ),

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
            item.variant,
            item.size,
          ),

          size: getFirstValue(
            item.size,
            item.selectedSize,
            item.options?.size,
            item.variant?.size,
          ),

          color: getFirstValue(
            item.color,
            item.selectedColor,
            item.options?.color,
            item.variant?.color,
          ),

          imageUrl: getFirstValue(
            item.imageUrl,
            item.image,
            item.mockupUrl,
            item.thumbnailUrl,
            item.product?.imageUrl,
            item.product?.image,
            item.product?.thumbnailUrl,
            item.variant?.imageUrl,
          ),

          unitPrice: getFirstValue(
            toFiniteNumber(item.unitPrice),
            toFiniteNumber(item.price),
            toFiniteNumber(item.amount),
          ),

          lineTotal: getFirstValue(
            toFiniteNumber(item.lineTotal),
            toFiniteNumber(item.total),
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

						fulfillment: 1,
            shipments: 1,

            paidAt: 1,
            cancelledAt: 1,
            refundedAt: 1,

            currency: 1,
            paymentCurrency: 1,
            payment: 1,

            subtotal: 1,
            total: 1,
            amount: 1,
            amountTotal: 1,
            totalAmount: 1,
            totals: 1,

            customerPaidTotal: 1,
            refundedTotal: 1,
            refundAmount: 1,

            pricing: 1,

            productCost: 1,
            blankCost: 1,
            supplierShippingCost: 1,
            shippingCost: 1,
            packagingCost: 1,
            handlingCost: 1,
            customsDutyCost: 1,
            totalSupplierCost: 1,
            costStatus: 1,

            fulfillmentCosts: 1,
            financialSummary: 1,

            supplierName: 1,
            supplierOrderReference: 1,
            manualFulfillment: 1,

            revenueAllocation: 1,
            revenuePoolAllocation: 1,
            revenuePoolKey: 1,
            revenuePoolName: 1,
            poolKey: 1,
            poolName: 1,
            projectId: 1,
            revenueTokenId: 1,

            revenueAllocationStatus: 1,
            revenueLedgerStatus: 1,
            revenueLedgerRowCount: 1,
            heldRevenueAmount: 1,

            settlementBatchId: 1,
            claimRoundId: 1,

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