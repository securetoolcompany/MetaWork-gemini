import algosdk from 'algosdk';


export const PRODUCT_REVENUE_POOL_PREFIX = 'product:';

export const PRODUCT_REVENUE_TOKENIZATION_VERSION =
  'v10_product_revenue_v1';

export const PRODUCT_REVENUE_TOTAL_BPS = 10000;

export const PRODUCT_REVENUE_TOTAL_UNITS = 10000;

const MAX_POOL_KEY_BYTES = 50;

const USDC_ASSET_MBR_MICROALGOS = 100_000;
const REVENUE_ASSET_MBR_MICROALGOS = 100_000;
const POOL_FUNDING_BUFFER_MICROALGOS = 10_000;


function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(
      `${fieldName} must be a non-empty string`
    );
  }

  return value.trim();
}


function assertPositiveSafeInteger(value, fieldName) {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new TypeError(
      `${fieldName} must be a positive safe integer`
    );
  }

  return value;
}


function toPercentBps(value, fieldName) {
  const percentage = Number(value);

  if (
    !Number.isFinite(percentage) ||
    percentage <= 0 ||
    percentage > 100
  ) {
    throw new TypeError(
      `${fieldName} must be greater than 0 and no more than 100`
    );
  }

  const bps = Math.round(percentage * 100);

  if (
    !Number.isSafeInteger(bps) ||
    bps <= 0 ||
    bps > PRODUCT_REVENUE_TOTAL_BPS
  ) {
    throw new TypeError(
      `${fieldName} could not be represented as basis points`
    );
  }

  return bps;
}


function getProductIdentifier(product) {
  return assertNonEmptyString(
    String(
      product?._id ??
        product?.id ??
        product?.externalProductId ??
        ''
    ),
    'product identifier'
  );
}


export function createProductRevenuePoolKey(product) {
  const productIdentifier = getProductIdentifier(product);

  const poolKey =
    `${PRODUCT_REVENUE_POOL_PREFIX}${productIdentifier}`;

  if (Buffer.byteLength(poolKey, 'utf8') > MAX_POOL_KEY_BYTES) {
    throw new TypeError(
      `product pool key must not exceed ${MAX_POOL_KEY_BYTES} UTF-8 bytes`
    );
  }

  return poolKey;
}


export function normalizeProductRevenueStakeholders(
  incomingStakeholders,
  { defaultAddress } = {}
) {
  const rawStakeholders = Array.isArray(incomingStakeholders)
    ? incomingStakeholders
    : [];

  const normalized = rawStakeholders
    .map((stakeholder, index) => {
      const address = String(
        stakeholder?.address ??
          (index === 0 ? defaultAddress ?? '' : '')
      ).trim();

      const name = String(
        stakeholder?.name ??
          (index === 0 ? 'Product creator' : '')
      ).trim();

      const bps = toPercentBps(
        stakeholder?.percentage ?? stakeholder?.perc,
        `stakeholders[${index}].percentage`
      );

      if (!algosdk.isValidAddress(address)) {
        throw new TypeError(
          `stakeholders[${index}].address must be a valid Algorand address`
        );
      }

      return {
        name: name || `Stakeholder ${index + 1}`,
        address,
        bps,
      };
    })
    .filter((stakeholder) => stakeholder.bps > 0);

  if (normalized.length === 0) {
    throw new TypeError(
      'at least one product revenue stakeholder is required'
    );
  }

  const seenAddresses = new Set();

  for (const stakeholder of normalized) {
    const normalizedAddress =
      stakeholder.address.toUpperCase();

    if (seenAddresses.has(normalizedAddress)) {
      throw new TypeError(
        'duplicate product revenue stakeholder addresses are not allowed'
      );
    }

    seenAddresses.add(normalizedAddress);
  }

  const totalBps = normalized.reduce(
    (total, stakeholder) => total + stakeholder.bps,
    0
  );

  if (totalBps !== PRODUCT_REVENUE_TOTAL_BPS) {
    throw new TypeError(
      `product revenue stakeholder allocations must total exactly 100%; received ${(totalBps / 100).toFixed(2)}%`
    );
  }

  return normalized;
}


export function calculateProductRevenuePoolMbrMicroAlgos(
  poolKey,
  stakeholderCount
) {
  const normalizedPoolKey = assertNonEmptyString(
    poolKey,
    'poolKey'
  );

  const normalizedStakeholderCount =
    assertPositiveSafeInteger(
      stakeholderCount,
      'stakeholderCount'
    );

  /*
   * Match the current V10 pool-creation route:
   * - pool box MBR
   * - reusable claim-round box MBR
   * - V10 app opt-in to USDC
   * - app-held revenue ASA minimum balance
   * - small safety buffer
   */
  const poolBoxMbrMicroAlgos =
    2500 +
    400 *
      (
        75 +
        Buffer.byteLength(normalizedPoolKey) +
        normalizedStakeholderCount * 35
      );

  const roundBoxMbrMicroAlgos =
    2500 +
    400 *
      (
        12 +
        Buffer.byteLength(normalizedPoolKey) +
        18 +
        normalizedStakeholderCount * 41
      );

  const totalMicroAlgos =
    poolBoxMbrMicroAlgos +
    roundBoxMbrMicroAlgos +
    USDC_ASSET_MBR_MICROALGOS +
    REVENUE_ASSET_MBR_MICROALGOS +
    POOL_FUNDING_BUFFER_MICROALGOS;

  return {
    poolBoxMbrMicroAlgos,
    roundBoxMbrMicroAlgos,
    usdcAssetMbrMicroAlgos:
      USDC_ASSET_MBR_MICROALGOS,
    revenueAssetMbrMicroAlgos:
      REVENUE_ASSET_MBR_MICROALGOS,
    fundingBufferMicroAlgos:
      POOL_FUNDING_BUFFER_MICROALGOS,
    totalMicroAlgos,
  };
}


export function assertProductRevenueTokenizationReady(
  product
) {
  if (!product || typeof product !== 'object') {
    throw new TypeError('product is required');
  }

  getProductIdentifier(product);

  const variants = Array.isArray(product.variants)
    ? product.variants
    : [];

  if (variants.length === 0) {
    throw new TypeError(
      'product must have at least one priced variant before revenue tokenization'
    );
  }

  for (const variant of variants) {
    const retailPrice = Number(variant?.retail_price);
    const creatorProfitPerUnitCents = Number(
      variant?.creatorProfitPerUnitCents
    );

    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
      throw new TypeError(
        `product variant ${String(
          variant?.id ??
            variant?.variantId ??
            variant?.size ??
            'unknown'
        )} must have a positive retail_price`
      );
    }

    if (
      !Number.isSafeInteger(
        creatorProfitPerUnitCents
      ) ||
      creatorProfitPerUnitCents < 0
    ) {
      throw new TypeError(
        'Product pricing must be saved before tokenization. Update and save every product variant, then try again.'
      );
    }
  }

  const tokenizationStatus =
    product?.productRevenuePool?.tokenizationStatus;

  if (
    tokenizationStatus === 'active' ||
    tokenizationStatus === 'creating'
  ) {
    throw new TypeError(
      'product revenue tokenization already exists or is in progress'
    );
  }

  return true;
}


export function buildProductRevenuePoolDraft({
  product,
  productCreatorId,
  stakeholders,
  now = new Date(),
}) {
  assertProductRevenueTokenizationReady(product);

  const normalizedProductCreatorId =
    assertNonEmptyString(
      String(productCreatorId ?? ''),
      'productCreatorId'
    );

  const normalizedStakeholders =
    normalizeProductRevenueStakeholders(stakeholders);

  const poolKey =
    createProductRevenuePoolKey(product);

  const mbr =
    calculateProductRevenuePoolMbrMicroAlgos(
      poolKey,
      normalizedStakeholders.length
    );

  const createdAt = new Date(now);

  if (Number.isNaN(createdAt.getTime())) {
    throw new TypeError('now must be a valid date');
  }

  return {
    poolKey,

    displayName: String(
      product.name ??
        product.title ??
        product.externalProductId ??
        'Product revenue'
    ).trim(),

    productCreatorId:
      normalizedProductCreatorId,

    stakeholders: normalizedStakeholders,

    tokenizationStatus: 'pending_funding',
    tokenizationVersion:
      PRODUCT_REVENUE_TOKENIZATION_VERSION,

    mbr,

    createdAt,
  };
}