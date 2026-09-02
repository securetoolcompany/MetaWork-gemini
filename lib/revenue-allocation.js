export const PLATFORM_FEE_BPS = 2000;
export const BPS_DENOMINATOR = 10000;
export const USDC_ATOMIC_UNITS_PER_USD_CENT = 10000;
export const ALLOCATION_CALCULATION_VERSION = 'fixed_license_fee_20pct_v1';
export const ROUNDING_POLICY = 'platform_fee_floor_creator_favorable_v1';

function assertSafeInteger(value, name, { minimum = 0, maximum } = {}) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer`);
  }

  if (value < minimum) {
    throw new Error(`${name} must be at least ${minimum}`);
  }

  if (maximum != null && value > maximum) {
    throw new Error(`${name} must be at most ${maximum}`);
  }

  return value;
}

export function calculateIpLicenseAllocation({
  quantity,
  licensingFeeCents,
  platformFeeBps = PLATFORM_FEE_BPS,
}) {
  const normalizedQuantity = assertSafeInteger(quantity, 'quantity', {
    minimum: 1,
  });

  const normalizedLicensingFeeCents = assertSafeInteger(
    licensingFeeCents,
    'licensingFeeCents',
    { minimum: 0 }
  );

  const normalizedPlatformFeeBps = assertSafeInteger(
    platformFeeBps,
    'platformFeeBps',
    { minimum: 0, maximum: BPS_DENOMINATOR }
  );

  if (normalizedPlatformFeeBps !== PLATFORM_FEE_BPS) {
    throw new Error(
      `platformFeeBps must be ${PLATFORM_FEE_BPS} for MetaWork IP settlement`
    );
  }

  const licenseGrossCents =
    normalizedQuantity * normalizedLicensingFeeCents;

  assertSafeInteger(licenseGrossCents, 'licenseGrossCents');

  // Floor the platform fee to whole cents. Any sub-cent remainder stays
  // with the IP creator's pool allocation.
  const platformFeeCents = Math.floor(
    (licenseGrossCents * normalizedPlatformFeeBps) / BPS_DENOMINATOR
  );

  const allocationCents = licenseGrossCents - platformFeeCents;
  const usdcAtomicUnits =
    allocationCents * USDC_ATOMIC_UNITS_PER_USD_CENT;

  assertSafeInteger(platformFeeCents, 'platformFeeCents');
  assertSafeInteger(allocationCents, 'allocationCents');
  assertSafeInteger(usdcAtomicUnits, 'usdcAtomicUnits');

  return Object.freeze({
    calculationVersion: ALLOCATION_CALCULATION_VERSION,
    roundingPolicy: ROUNDING_POLICY,
    quantity: normalizedQuantity,
    licensingFeeCents: normalizedLicensingFeeCents,
    platformFeeBps: normalizedPlatformFeeBps,
    licenseGrossCents,
    platformFeeCents,
    allocationCents,
    usdcAtomicUnits,
  });
}

export const PRODUCT_REVENUE_CALCULATION_VERSION =
  'product_revenue_no_platform_fee_v1';

export const PRODUCT_REVENUE_ROUNDING_POLICY =
  'product_revenue_full_merchandise_allocation_v1';

export function calculateProductRevenueAllocation({
  merchandiseSubtotalCents,
}) {
  const normalizedMerchandiseSubtotalCents = assertSafeInteger(
    merchandiseSubtotalCents,
    'merchandiseSubtotalCents',
    { minimum: 0 }
  );

  const allocationCents = normalizedMerchandiseSubtotalCents;
  const usdcAtomicUnits =
    allocationCents * USDC_ATOMIC_UNITS_PER_USD_CENT;

  assertSafeInteger(allocationCents, 'allocationCents');
  assertSafeInteger(usdcAtomicUnits, 'usdcAtomicUnits');

  return Object.freeze({
    calculationVersion: PRODUCT_REVENUE_CALCULATION_VERSION,
    roundingPolicy: PRODUCT_REVENUE_ROUNDING_POLICY,
    merchandiseSubtotalCents: normalizedMerchandiseSubtotalCents,
    platformFeeCents: 0,
    allocationCents,
    usdcAtomicUnits,
  });
}