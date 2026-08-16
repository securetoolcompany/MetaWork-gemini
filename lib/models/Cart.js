/**
 * Cart Schema Model for MongoDB
 * 
 * This file defines the cart structure used throughout the application.
 * We use native MongoDB driver (not Mongoose) as per project conventions.
 * 
 * Cart Structure:
 * {
 *   _id: ObjectId,
 *   userId: String,           // User's MongoDB _id.toString() or null for guests
 *   sessionId: String,        // For guest carts (nanoid generated)
 *   items: [
 *     {
 *       productId: String,    // Product's _id.toString()
 *       variationId: String,  // Variation ID from product.variations array
 *       quantity: Number,
 *       priceSnapshot: Number,// Price at time of add
 *       title: String,        // Product title snapshot
 *       thumbnailUrl: String, // Product thumbnail snapshot
 *       attributes: Object    // e.g., { pa_size: "m" }
 *     }
 *   ],
 *   createdAt: Date,
 *   updatedAt: Date,
 *   expiresAt: Date          // TTL for guest carts (30 days)
 * }
 */

// Collection name
export const CART_COLLECTION = 'carts';

// TTL duration for guest carts (30 days in milliseconds)
export const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Create a new cart item object
 * @param {Object} product - The product from database
 * @param {String} variationId - The variation ID
 * @param {Number} quantity - Quantity to add
 * @returns {Object} Cart item
 */
export function findCanonicalCartVariant(product, variationId) {
  const requestedVariationId = String(variationId);

  const candidateVariants = [
    ...(Array.isArray(product?.variants) ? product.variants : []),
    ...(Array.isArray(product?.variations) ? product.variations : []),
    ...(Array.isArray(product?.baseProduct?.variants)
      ? product.baseProduct.variants
      : []),
  ];

  return (
    candidateVariants.find((variant) => {
      const ids = [
        variant?.id,
        variant?._id,
        variant?.variantId,
        variant?.variant_id,
        variant?.printful_id,
        variant?.sync_variant_id,
        variant?.printfulVariantId,
      ]
        .filter((value) => value !== undefined && value !== null)
        .map(String);

      return ids.includes(requestedVariationId);
    }) || null
  );
}

export function getCartImageSnapshot(product, variation = null) {
  const candidates = [
    variation?.thumbnailUrl,
    variation?.thumbnail_url,
    variation?.imageUrl,
    variation?.image_url,
    variation?.previewUrl,
    variation?.preview_url,
    variation?.files?.[0]?.previewUrl,
    variation?.files?.[0]?.preview_url,

    product?.thumbnailUrl,
    product?.mockupUrl,
    ...(Array.isArray(product?.mockupImages) ? product.mockupImages : []),
    ...(Array.isArray(product?.mockups) ? product.mockups : []),
    product?.imageUrl,
    product?.image,
    product?.images?.[0],

    product?.baseProduct?.thumbnailUrl,
    product?.baseProduct?.mockupUrl,
    ...(Array.isArray(product?.baseProduct?.mockupImages)
      ? product.baseProduct.mockupImages
      : []),
    product?.baseProduct?.imageUrl,
    product?.baseProduct?.image,
  ];

  return (
    candidates.find(
      (value) =>
        typeof value === 'string' &&
        value.trim() &&
        !value.includes('/undefined') &&
        !value.includes('null')
    ) || null
  );
}

export function createCartItem(product, variationId, quantity, selection = {}) {
  const variation = findCanonicalCartVariant(product, variationId);

  if (!variation) {
    throw new Error('Canonical product variation was not found');
  }

  const price = Number(
    variation.retail_price ??
      variation.retailPrice ??
      variation.price ??
      product.retail_price ??
      product.retailPrice ??
      product.price
  );

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Canonical product retail price is invalid');
  }

  const syncVariantId =
    variation.sync_variant_id ??
    variation.printfulVariantId ??
    null;

  const catalogVariantId =
    variation.printful_id ??
    variation.variantId ??
    variation.variant_id ??
    variation.id ??
    null;

  const thumbnailUrl = getCartImageSnapshot(product, variation);

  const selectedSize =
    selection.size ??
    variation.attributes?.pa_size ??
    null;

  const selectedColor =
    selection.color ??
    variation.attributes?.pa_color ??
    null;

  const canonicalVariants = [
    ...(Array.isArray(product.variants) ? product.variants : []),
    ...(Array.isArray(product.variations) ? product.variations : []),
    ...(Array.isArray(product.baseProduct?.variants) ? product.baseProduct.variants : []),
  ];

  const templateHasSizes = canonicalVariants.some(
    (variant) => Boolean(variant?.attributes?.pa_size)
  );

  const templateHasColors = canonicalVariants.some(
    (variant) => Boolean(variant?.attributes?.pa_color)
  );

  if (product?.printfulTemplateId && templateHasSizes && !selectedSize) {
    throw new Error('Please select a size');
  }

  if (product?.printfulTemplateId && templateHasColors && !selectedColor) {
    throw new Error('Please select a color');
  }

  const selectedColorKey =
    variation.colorKey || String(selectedColor || '').trim().toLowerCase();

  return {
    productId: product._id?.toString() || product.id,
    variationId: String(variationId),
    quantity: Math.max(1, parseInt(quantity, 10) || 1),

    // Canonical variant retail price, resolved only from MongoDB.
    priceSnapshot: price,
    price,

    title: product.title || product.name || 'Untitled Product',
    thumbnailUrl,
    imageUrl: thumbnailUrl,

    attributes: variation.attributes || {
      ...(variation.size ? { size: variation.size } : {}),
      ...(variation.color ? { color: variation.color } : {}),
    },

    // Store-sync and catalog identifiers must remain distinct.
    sync_variant_id: syncVariantId,
    printfulVariantId: syncVariantId,
    printful_id: catalogVariantId,
    catalogVariantId,
    selectedOptions: {
      size: selectedSize,
      color: selectedColor,
      colorKey: selectedColorKey,
    },
  };
}

/**
 * Create a new cart document
 * @param {String|null} userId - User ID if logged in
 * @param {String|null} sessionId - Session ID for guests
 * @returns {Object} Cart document
 */
export function createCartDocument(userId, sessionId) {
  const now = new Date();
  const cart = {
    userId: userId || null,
    sessionId: sessionId || null,
    items: [],
    createdAt: now,
    updatedAt: now
  };
  
  // Add TTL only for guest carts
  if (!userId && sessionId) {
    cart.expiresAt = new Date(now.getTime() + GUEST_CART_TTL_MS);
  }
  
  return cart;
}

/**
 * Calculate cart totals
 * @param {Array} items - Cart items
 * @returns {Object} Cart totals
 */
export function calculateCartTotals(items = []) {
  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalPrice = items.reduce((sum, item) => 
    sum + ((item.priceSnapshot || 0) * (item.quantity || 0)), 0
  );
  
  return {
    totalItems,
    totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimals
    itemCount: items.length
  };
}

/**
 * Merge two carts (used when guest logs in)
 * For duplicate productId + variationId, sum quantities
 * @param {Array} userItems - Existing user cart items
 * @param {Array} guestItems - Guest cart items to merge
 * @returns {Array} Merged items
 */
export function mergeCartItems(userItems = [], guestItems = []) {
  const itemMap = new Map();
  
  // Add user items first
  userItems.forEach(item => {
    const key = `${item.productId}:${item.variationId}`;
    itemMap.set(key, { ...item });
  });
  
  // Merge guest items
  guestItems.forEach(item => {
    const key = `${item.productId}:${item.variationId}`;
    if (itemMap.has(key)) {
      // Duplicate - sum quantities
      const existing = itemMap.get(key);
      existing.quantity += item.quantity;
    } else {
      // New item - add it
      itemMap.set(key, { ...item });
    }
  });
  
  return Array.from(itemMap.values());
}

/**
 * Normalize cart document for API response
 * @param {Object} cart - Cart document from DB
 * @returns {Object} Normalized cart
 */
export function normalizeCart(cart) {
  if (!cart) return null;
  
  const totals = calculateCartTotals(cart.items);
  
  return {
    id: cart._id?.toString(),
    userId: cart.userId,
    sessionId: cart.sessionId,
    items: cart.items || [],
    ...totals,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt
  };
}
