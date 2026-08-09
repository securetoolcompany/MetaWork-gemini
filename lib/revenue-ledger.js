// lib/revenue-ledger.js

export const REVENUE_LEDGER_STATUSES = Object.freeze([
  'pending',
  'eligible',
  'batched',
  'deposited',
  'released',
  'reversed',
  'voided',
]);

export const REVENUE_DESTINATION_TYPES = Object.freeze([
  'ip_pool',
  'product_pool',
]);

export const REVENUE_LEDGER_FINANCIAL_FIELDS = Object.freeze([
  'grossSaleCents',
  'allocatedDiscountCents',
  'allocatedShippingRevenueCents',
  'allocatedTaxCents',
  'stripeFeeCents',
  'supplierCostCents',
  'supplierShippingCostCents',
  'platformFeeCents',
  'refundReserveCents',
  'netDistributableCents',
]);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function assertSafeInteger(value, fieldName, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(
      `${fieldName} must be a safe integer greater than or equal to ${minimum}`
    );
  }

  return value;
}

function assertOptionalDate(value, fieldName) {
  if (value === null || value === undefined) return null;

  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${fieldName} must be a valid Date or date value`);
  }

  return date;
}

function cloneJsonMetadata(value, fieldName) {
  if (value === null || value === undefined) return null;

  try {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new TypeError(`${fieldName} must be JSON-serializable`);
    }

    return JSON.parse(serialized);
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError(`${fieldName} must be JSON-serializable`);
  }
}

export function assertRevenueLedgerStatus(status) {
  const normalizedStatus = assertNonEmptyString(status, 'status');

  if (!REVENUE_LEDGER_STATUSES.includes(normalizedStatus)) {
    throw new TypeError(
      `status must be one of: ${REVENUE_LEDGER_STATUSES.join(', ')}`
    );
  }

  return normalizedStatus;
}

export function createRevenueLedgerIdempotencyKey({
  orderId,
  orderItemIndex,
  ipAssetId,
}) {
  const normalizedOrderId = assertNonEmptyString(String(orderId), 'orderId');
  const normalizedIpAssetId = assertNonEmptyString(
    String(ipAssetId),
    'ipAssetId'
  );
  const normalizedItemIndex = assertSafeInteger(
    orderItemIndex,
    'orderItemIndex'
  );

  return `order:${normalizedOrderId}:item:${normalizedItemIndex}:pool:${normalizedIpAssetId}`;
}

export function createRevenueLedgerRow({
  orderId,
  orderNumber,
  orderItemIndex,
  productId,
  variationId = null,
  quantity,
  destinationType = 'ip_pool',
  ipAssetId,
  revenuePoolAppId,
  revenueTokenAssetId,
  currency = 'USD',
  financials,
  fulfillmentStatusSnapshot,
  eligibleAt = null,
  status = 'pending',
  ineligibleReason = null,
  paymentSourceMetadata = null,
  now = new Date(),
}) {
  const normalizedDestinationType = assertNonEmptyString(
    destinationType,
    'destinationType'
  );

  if (!REVENUE_DESTINATION_TYPES.includes(normalizedDestinationType)) {
    throw new TypeError(
      `destinationType must be one of: ${REVENUE_DESTINATION_TYPES.join(', ')}`
    );
  }

  const normalizedOrderId = assertNonEmptyString(String(orderId), 'orderId');
  const normalizedIpAssetId = assertNonEmptyString(
    String(ipAssetId),
    'ipAssetId'
  );
  const normalizedNow = assertOptionalDate(now, 'now');

  if (!financials || typeof financials !== 'object') {
    throw new TypeError('financials must be an object of integer cent values');
  }

  const normalizedFinancials = {};

  for (const fieldName of REVENUE_LEDGER_FINANCIAL_FIELDS) {
    normalizedFinancials[fieldName] = assertSafeInteger(
      financials[fieldName],
      `financials.${fieldName}`
    );
  }

  return {
    orderId: normalizedOrderId,
    orderNumber: assertNonEmptyString(String(orderNumber), 'orderNumber'),
    orderItemIndex: assertSafeInteger(orderItemIndex, 'orderItemIndex'),
    productId: assertNonEmptyString(String(productId), 'productId'),
    variationId:
      variationId === null || variationId === undefined
        ? null
        : assertNonEmptyString(String(variationId), 'variationId'),
    quantity: assertSafeInteger(quantity, 'quantity', { minimum: 1 }),

    destinationType: normalizedDestinationType,
    ipAssetId: normalizedIpAssetId,
    revenuePoolAppId: assertSafeInteger(
      revenuePoolAppId,
      'revenuePoolAppId',
      { minimum: 1 }
    ),
    revenueTokenAssetId: assertSafeInteger(
      revenueTokenAssetId,
      'revenueTokenAssetId',
      { minimum: 1 }
    ),

    currency: assertNonEmptyString(currency, 'currency').toUpperCase(),
    ...normalizedFinancials,

    fulfillmentStatusSnapshot: assertNonEmptyString(
      fulfillmentStatusSnapshot,
      'fulfillmentStatusSnapshot'
    ),
    eligibleAt: assertOptionalDate(eligibleAt, 'eligibleAt'),
    status: assertRevenueLedgerStatus(status),
    ineligibleReason:
      ineligibleReason === null || ineligibleReason === undefined
        ? null
        : assertNonEmptyString(ineligibleReason, 'ineligibleReason'),

    paymentSourceMetadata: cloneJsonMetadata(
      paymentSourceMetadata,
      'paymentSourceMetadata'
    ),

    idempotencyKey: createRevenueLedgerIdempotencyKey({
      orderId: normalizedOrderId,
      orderItemIndex,
      ipAssetId: normalizedIpAssetId,
    }),

    settlementBatchId: null,
    usdcDepositTxId: null,
    releaseHeldTxId: null,
    revenueRoundId: null,

    createdAt: normalizedNow,
    updatedAt: new Date(normalizedNow),
  };
}