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
export function createCartItem(product, variationId, quantity) {
  // Find the variation in product
  const variation = product.variations?.find(v => 
    String(v.id) === String(variationId) || 
    String(v._id) === String(variationId)
  );
  
  // Use variation price if available, otherwise product price
  const price = variation?.price ?? product.price ?? 0;
  
  return {
    productId: product._id?.toString() || product.id,
    variationId: String(variationId),
    quantity: Math.max(1, parseInt(quantity) || 1),
    priceSnapshot: parseFloat(price) || 0,
    title: product.title || product.name || 'Untitled Product',
    thumbnailUrl: product.thumbnailUrl || product.imageUrl || null,
    attributes: variation?.attributes || {}
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
