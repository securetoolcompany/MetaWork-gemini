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
  licenseSnapshotId,
}) {
  const normalizedOrderId = assertNonEmptyString(String(orderId), 'orderId');
  const normalizedOrderItemId = assertNonEmptyString(
    String(orderItemId),
    'orderItemId'
  );
  const normalizedLicenseSnapshotId = assertNonEmptyString(
    String(licenseSnapshotId),
    'licenseSnapshotId'
  );

  return `${normalizedOrderId}:${normalizedOrderItemId}:${normalizedLicenseSnapshotId}`;
}

export function createHeldRevenueLedgerRow({
  orderId,
  orderNumber,
  orderItemId,
  productId,
  productVariantId = null,
  quantity,
  poolKey,
  ipAssetId,
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
  const normalizedIpAssetId = assertNonEmptyString(
    String(ipAssetId),
    'ipAssetId'
  );
  const normalizedPoolKey = assertNonEmptyString(
    String(poolKey),
    'poolKey'
  );
  const normalizedLicenseSnapshot = cloneJson(
    licenseSnapshot,
    'licenseSnapshot'
  );

  if (!normalizedLicenseSnapshot) {
    throw new TypeError('licenseSnapshot is required');
  }

  const licenseSnapshotId = assertNonEmptyString(
    String(
      normalizedLicenseSnapshot.licenseSnapshotId ??
        normalizedLicenseSnapshot.ipAssetId
    ),
    'licenseSnapshot.licenseSnapshotId'
  );

  if (String(normalizedLicenseSnapshot.ipAssetId) !== normalizedIpAssetId) {
    throw new TypeError('licenseSnapshot.ipAssetId must match ipAssetId');
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
      licenseSnapshotId,
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

    licenseSnapshot: normalizedLicenseSnapshot,
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