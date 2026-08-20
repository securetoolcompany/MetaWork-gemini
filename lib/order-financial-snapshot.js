// lib/order-financial-snapshot.js

function toCents(value, fieldName) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error(`[order-financial-snapshot] Invalid ${fieldName}`);
  }

  return Math.round(numericValue * 100);
}

function normalizeId(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return String(value);
}

function getVariantId(variant = {}) {
  return normalizeId(
    variant.variantId ??
      variant.variant_id ??
      variant.printful_id ??
      variant.printfulVariantId ??
      variant.id
  );
}

function getProductId(product = {}) {
  return normalizeId(product._id ?? product.id ?? product.productId);
}

function buildCanonicalPricingSnapshot(variant = {}) {
  const printfulCostCents = toCents(
    variant.printfulCost ?? variant.printful_cost ?? 0,
    'variant.printfulCost'
  );

  const placementCostCents = toCents(
    variant.placementCost ?? variant.placement_cost ?? 0,
    'variant.placementCost'
  );

  const metaWorkMarkupCents = toCents(
    variant.metaWorkMarkup ?? variant.metaworkMarkup ?? 0,
    'variant.metaWorkMarkup'
  );

  const lockedIpFeesCents = toCents(
    variant.lockedIpFees ?? variant.locked_ip_fees ?? 0,
    'variant.lockedIpFees'
  );

  const costCents = toCents(variant.cost ?? 0, 'variant.cost');

  const retailPriceCents = toCents(
    variant.retail_price ?? variant.retailPrice ?? variant.price ?? 0,
    'variant.retail_price'
  );

  return {
    pricingVersion: variant.pricingVersion ?? 'v1',
    printfulCostCents,
    placementCostCents,
    metaWorkMarkupCents,
    lockedIpFeesCents,
    costCents,
    retailPriceCents,
  };
}

function buildLockedLicenseTermsSnapshot(terms = []) {
  if (!Array.isArray(terms)) {
    throw new Error(
      '[order-financial-snapshot] product.licensedRevenueTerms must be an array'
    );
  }

  return terms.map((term) => {
    const ipAssetId = normalizeId(term?.ipAssetId);
    const licenseSnapshotId =
      normalizeId(term?.licenseSnapshotId) ?? ipAssetId;
    const poolKey = normalizeId(
      term?.poolKey ??
        term?.ipId ??
        term?.tokenizedIpId ??
        term?.assetId ??
        term?.id
    );
    const licensingFeeCents = Number(term?.licensingFeeCents);
    const platformFeeBps = Number(term?.platformFeeBps);
    const requiresSettlement = Boolean(term?.requiresSettlement);
    const revenuePoolAppId = Number(term?.revenuePoolAppId);
    const revenueTokenAssetId = Number(term?.revenueTokenAssetId);

    if (
      !ipAssetId ||
      !licenseSnapshotId ||
      !Number.isSafeInteger(licensingFeeCents) ||
      licensingFeeCents < 0 ||
      !Number.isSafeInteger(platformFeeBps) ||
      platformFeeBps < 0 ||
      platformFeeBps > 10000
    ) {
      throw new Error(
        '[order-financial-snapshot] Invalid locked licensing term on product'
      );
    }

    if (requiresSettlement && !poolKey) {
      throw new Error(
        `[order-financial-snapshot] Settled IP asset is missing a valid V10 poolKey: ${ipAssetId}`
      );
    }

    if (
      requiresSettlement &&
      (!Number.isSafeInteger(revenuePoolAppId) ||
        revenuePoolAppId <= 0 ||
        !Number.isSafeInteger(revenueTokenAssetId) ||
        revenueTokenAssetId <= 0)
    ) {
      throw new Error(
        `[order-financial-snapshot] Settled IP asset is missing a valid V10 pool target: ${ipAssetId}`
      );
    }

    return {
      licenseSnapshotId,
      ipAssetId,
      poolKey,
      licensingFeeCents,
      platformFeeBps,
      requiresSettlement,
      revenuePoolAppId: requiresSettlement ? revenuePoolAppId : null,
      revenueTokenAssetId: requiresSettlement ? revenueTokenAssetId : null,
      lockedAt: term.lockedAt ?? null,
    };
  });
}

export function buildOrderItemSnapshot({
  orderItemId,
  product,
  variant,
  quantity,
  unitMerchandisePrice,
}) {
  const normalizedQuantity = Number(quantity);

  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
    throw new Error('[order-financial-snapshot] quantity must be an integer >= 1');
  }

  const productId = getProductId(product);
  const productVariantId = getVariantId(variant);

  if (!productId || !productVariantId) {
    throw new Error(
      '[order-financial-snapshot] product and canonical variant identifiers are required'
    );
  }

  const unitMerchandisePriceCents = toCents(
    unitMerchandisePrice,
    'unitMerchandisePrice'
  );

  return {
    orderItemId: String(orderItemId),
    productId,
    productVariantId,
    quantityOrdered: normalizedQuantity,
    quantityDelivered: 0,
    quantityCancelled: 0,

    unitMerchandisePriceCents,
    merchandiseSubtotalCents: unitMerchandisePriceCents * normalizedQuantity,

    canonicalPricing: buildCanonicalPricingSnapshot(variant),
    lockedLicensedRevenueTerms: buildLockedLicenseTermsSnapshot(
      product.licensedRevenueTerms
    ),

    deliveryStatus: 'pending',
    deliveredAt: null,
    eligibilityStatus: 'not_delivered',

    shipments: [],
    createdAt: new Date(),
  };
}