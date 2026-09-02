// lib/revenue-ledger.js

export const REVENUE_LEDGER_STATUSES = Object.freeze([
  'held',
  'release_eligible',
  'batched',
  'deposited',
  'round_created',
  'settled',
  'voided',
]);

export const REVENUE_LEDGER_ELIGIBILITY_EVENTS = Object.freeze([
  'delivered',
]);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function assertSafeInteger(value, fieldName, { minimum = 0, maximum } = {}) {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    (maximum !== undefined && value > maximum)
  ) {
    throw new TypeError(
      `${fieldName} must be a safe integer between ${minimum} and ${
        maximum === undefined ? 'Infinity' : maximum
      }`
    );
  }

  return value;
}

function assertOptionalDate(value, fieldName) {
  if (value === null || value === undefined) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${fieldName} must be a valid date value`);
  }

  return date;
}

function cloneJson(value, fieldName) {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new TypeError(`${fieldName} must be JSON-serializable`);
    }

    return JSON.parse(serialized);
  } catch (error) {
    if (error instanceof TypeError) {
      throw error;
    }

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
  orderItemId,
  revenueType,
  sourceSnapshotId,
}) {
  const normalizedOrderId = assertNonEmptyString(String(orderId), 'orderId');
  const normalizedOrderItemId = assertNonEmptyString(
    String(orderItemId),
    'orderItemId'
  );
  const normalizedRevenueType = assertNonEmptyString(
    String(revenueType),
    'revenueType'
  );
  const normalizedSourceSnapshotId = assertNonEmptyString(
    String(sourceSnapshotId),
    'sourceSnapshotId'
  );

  return `${normalizedOrderId}:${normalizedOrderItemId}:${normalizedRevenueType}:${normalizedSourceSnapshotId}`;
}

export function createHeldRevenueLedgerRow({
  orderId,
  orderNumber,
  orderItemId,
  productId,
  productVariantId = null,
  quantity,
  revenueType,
  sourceSnapshot,
  poolKey,
  ipAssetId = null,
  revenuePoolAppId,
  revenueTokenAssetId,
  currency = 'USD',
  grossLicenseFeeCents,
  platformFeeCents,
  allocationCents,
  usdcAtomicUnits,
  calculationVersion,
  roundingPolicy,
  licenseSnapshot,
  orderItemFinancialSnapshot,
  eligibilityEvent = 'delivered',
  now = new Date(),
}) {
  const normalizedOrderId = assertNonEmptyString(String(orderId), 'orderId');
  const normalizedOrderItemId = assertNonEmptyString(
    String(orderItemId),
    'orderItemId'
  );
  
  const normalizedRevenueType = assertNonEmptyString(
    String(revenueType),
    'revenueType'
  );

  if (
    normalizedRevenueType !== 'ip_license' &&
    normalizedRevenueType !== 'product_revenue'
  ) {
    throw new TypeError(
      'revenueType must be either "ip_license" or "product_revenue"'
    );
  }

  const normalizedSourceSnapshot = cloneJson(
    sourceSnapshot,
    'sourceSnapshot'
  );

  if (!normalizedSourceSnapshot) {
    throw new TypeError('sourceSnapshot is required');
  }

  const sourceSnapshotId = assertNonEmptyString(
    String(
      normalizedSourceSnapshot.licenseSnapshotId ??
        normalizedSourceSnapshot.productRevenuePoolSnapshotId ??
        normalizedSourceSnapshot.poolKey ??
        normalizedSourceSnapshot.ipAssetId
    ),
    'sourceSnapshot.sourceSnapshotId'
  );

  const normalizedPoolKey = assertNonEmptyString(
    String(poolKey),
    'poolKey'
  );

  const normalizedIpAssetId =
    normalizedRevenueType === 'ip_license'
      ? assertNonEmptyString(String(ipAssetId), 'ipAssetId')
      : null;

  if (
    normalizedRevenueType === 'ip_license' &&
    String(normalizedSourceSnapshot.ipAssetId) !== normalizedIpAssetId
  ) {
    throw new TypeError('sourceSnapshot.ipAssetId must match ipAssetId');
  }

  const normalizedEligibilityEvent = assertNonEmptyString(
    eligibilityEvent,
    'eligibilityEvent'
  );

  if (!REVENUE_LEDGER_ELIGIBILITY_EVENTS.includes(normalizedEligibilityEvent)) {
    throw new TypeError(
      `eligibilityEvent must be one of: ${REVENUE_LEDGER_ELIGIBILITY_EVENTS.join(
        ', '
      )}`
    );
  }

  const normalizedGrossLicenseFeeCents = assertSafeInteger(
    grossLicenseFeeCents,
    'grossLicenseFeeCents'
  );
  const normalizedPlatformFeeCents = assertSafeInteger(
    platformFeeCents,
    'platformFeeCents'
  );
  const normalizedAllocationCents = assertSafeInteger(
    allocationCents,
    'allocationCents'
  );
  const normalizedUsdcAtomicUnits = assertSafeInteger(
    usdcAtomicUnits,
    'usdcAtomicUnits'
  );

    const normalizedCalculationVersion = assertNonEmptyString(
      calculationVersion,
      'calculationVersion'
    );

    const normalizedRoundingPolicy = assertNonEmptyString(
      roundingPolicy,
      'roundingPolicy'
    );

  if (
    normalizedPlatformFeeCents > normalizedGrossLicenseFeeCents ||
    normalizedAllocationCents !==
      normalizedGrossLicenseFeeCents - normalizedPlatformFeeCents
  ) {
    throw new TypeError(
      'allocationCents must equal grossLicenseFeeCents minus platformFeeCents'
    );
  }

  const expectedUsdcAtomicUnits = normalizedAllocationCents * 10000;

  if (
    !Number.isSafeInteger(expectedUsdcAtomicUnits) ||
    normalizedUsdcAtomicUnits !== expectedUsdcAtomicUnits
  ) {
    throw new TypeError(
      'usdcAtomicUnits must equal allocationCents multiplied by 10000'
    );
  }

  const normalizedNow = assertOptionalDate(now, 'now');

  return {
    idempotencyKey: createRevenueLedgerIdempotencyKey({
    orderId: normalizedOrderId,
      orderItemId: normalizedOrderItemId,
      revenueType: normalizedRevenueType,
      sourceSnapshotId,
    }),

    orderId: normalizedOrderId,
    orderNumber: assertNonEmptyString(String(orderNumber), 'orderNumber'),
    orderItemId: normalizedOrderItemId,
    productId: assertNonEmptyString(String(productId), 'productId'),
    productVariantId:
      productVariantId === null || productVariantId === undefined
        ? null
        : assertNonEmptyString(String(productVariantId), 'productVariantId'),
    quantity: assertSafeInteger(quantity, 'quantity', { minimum: 1 }),
    revenueType: normalizedRevenueType,
    ipAssetId: normalizedIpAssetId,
    poolKey: normalizedPoolKey,
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
    grossLicenseFeeCents: normalizedGrossLicenseFeeCents,
    platformFeeCents: normalizedPlatformFeeCents,
    allocationCents: normalizedAllocationCents,
    usdcAtomicUnits: normalizedUsdcAtomicUnits,
    calculationVersion: normalizedCalculationVersion,
    roundingPolicy: normalizedRoundingPolicy,

    licenseSnapshot:
      normalizedRevenueType === 'ip_license'
        ? normalizedSourceSnapshot
        : null,
    productRevenuePoolSnapshot:
      normalizedRevenueType === 'product_revenue'
        ? normalizedSourceSnapshot
        : null,
    orderItemFinancialSnapshot: cloneJson(
      orderItemFinancialSnapshot,
      'orderItemFinancialSnapshot'
    ),

    status: 'held',
    eligibilityEvent: normalizedEligibilityEvent,
    eligibleAt: null,

    settlementBatchId: null,
    settlementLeaseId: null,
    settlementLeaseExpiresAt: null,
    usdcDepositTxId: null,
    revenueRoundId: null,
    releasedAt: null,
    voidedAt: null,

    createdAt: normalizedNow,
    updatedAt: new Date(normalizedNow),
  };
}