// lib/revenue-allocation.js

export const USDC_ATOMIC_UNITS_PER_USD_CENT = 10000;

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

function assertSafeProduct(left, right, fieldName) {
  const result = left * right;

  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${fieldName} exceeds JavaScript safe-integer range`);
  }

  return result;
}

export function calculateIpLicenseAllocation({
  quantity,
  licensingFeeCents,
  platformFeeBps,
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
    { minimum: 0, maximum: 10000 }
  );

  const grossLicenseFeeCents = assertSafeProduct(
    normalizedQuantity,
    normalizedLicensingFeeCents,
    'grossLicenseFeeCents'
  );

  const platformFeeNumerator = assertSafeProduct(
    grossLicenseFeeCents,
    normalizedPlatformFeeBps,
    'platformFeeCents'
  );

  const platformFeeCents = Math.floor(platformFeeNumerator / 10000);
  const netPoolAllocationCents = grossLicenseFeeCents - platformFeeCents;

  const usdcAtomicUnits = assertSafeProduct(
    netPoolAllocationCents,
    USDC_ATOMIC_UNITS_PER_USD_CENT,
    'usdcAtomicUnits'
  );

  return {
    quantity: normalizedQuantity,
    licensingFeeCents: normalizedLicensingFeeCents,
    platformFeeBps: normalizedPlatformFeeBps,
    grossLicenseFeeCents,
    platformFeeCents,
    netPoolAllocationCents,
    usdcAtomicUnits,
  };
}