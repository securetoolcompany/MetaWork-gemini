import { ObjectId } from 'mongodb';
import {
  CART_COLLECTION,
  findCanonicalCartVariant,
} from '@/lib/models/Cart';
import { getSessionId, getUserSession } from '@/lib/cart-session';

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function getCandidateVariants(product) {
  return [
    ...(Array.isArray(product?.variants) ? product.variants : []),
    ...(Array.isArray(product?.variations) ? product.variations : []),
    ...(Array.isArray(product?.baseProduct?.variants)
      ? product.baseProduct.variants
      : []),
  ];
}

function getVariantSize(variant) {
  return (
    variant?.attributes?.pa_size ??
    variant?.attributes?.size ??
    variant?.size ??
    null
  );
}

function getVariantColor(variant) {
  return (
    variant?.attributes?.pa_color ??
    variant?.attributes?.color ??
    variant?.color ??
    null
  );
}

function normalizeOption(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Enforces the same template-backed product option rules that previously lived
 * only in the checkout route. Keeping them here protects both the shipping
 * quote endpoint and final checkout.
 */
function validateTemplateSelection({ product, dbVariation, cartItem, index }) {
  if (!product.printfulTemplateId) {
    return;
  }

  const canonicalVariants = getCandidateVariants(product);

  const availableSizes = [
    ...new Set(canonicalVariants.map(getVariantSize).filter(Boolean)),
  ];

  const availableColors = [
    ...new Set(canonicalVariants.map(getVariantColor).filter(Boolean)),
  ];

  // Require selection only where a customer has more than one real option.
  const requiresSizeSelection = availableSizes.length > 1;
  const requiresColorSelection = availableColors.length > 1;

  const selectedOptions = cartItem.selectedOptions ?? {};

  const selectedSize =
    selectedOptions.size ??
    cartItem.attributes?.pa_size ??
    cartItem.attributes?.size ??
    null;

  const selectedColor =
    selectedOptions.color ??
    cartItem.attributes?.pa_color ??
    cartItem.attributes?.color ??
    null;

  if (requiresSizeSelection && !normalizeOption(selectedSize)) {
    const error = new Error(
      `Cart item ${index + 1} for template-backed product requires a size selection.`
    );
    error.code = 'MISSING_TEMPLATE_SIZE';
    throw error;
  }

  if (requiresColorSelection && !normalizeOption(selectedColor)) {
    const error = new Error(
      `Cart item ${index + 1} for template-backed product requires a color selection.`
    );
    error.code = 'MISSING_TEMPLATE_COLOR';
    throw error;
  }

  const variantSize = getVariantSize(dbVariation);
  const variantColor = getVariantColor(dbVariation);

  if (
    requiresSizeSelection &&
    normalizeOption(selectedSize) !== normalizeOption(variantSize)
  ) {
    const error = new Error(
      `Cart item ${index + 1} selected size does not match its catalog variant.`
    );
    error.code = 'TEMPLATE_SIZE_VARIANT_MISMATCH';
    throw error;
  }

  if (
    requiresColorSelection &&
    normalizeOption(selectedColor) !== normalizeOption(variantColor)
  ) {
    const error = new Error(
      `Cart item ${index + 1} selected color does not match its catalog variant.`
    );
    error.code = 'TEMPLATE_COLOR_VARIANT_MISMATCH';
    throw error;
  }
}

/**
 * Resolves the only cart owner the current request may access.
 * Logged-in carts are owned by userId; guest carts by a signed session cookie.
 * Neither identifier is accepted from request JSON.
 */
export async function getCartOwner() {
  const { userId } = await getUserSession();

  if (userId) {
    const normalizedUserId = String(userId);

    return {
      userId: normalizedUserId,
      ownerQuery: { userId: normalizedUserId },
    };
  }

  const sessionId = await getSessionId();

  if (!sessionId) {
    const error = new Error('No active cart session.');
    error.code = 'CART_SESSION_NOT_FOUND';
    throw error;
  }

  const normalizedSessionId = String(sessionId);

  return {
    sessionId: normalizedSessionId,
    ownerQuery: { sessionId: normalizedSessionId },
  };
}

/**
 * Loads the current authenticated or guest cart directly from MongoDB.
 */
export async function getServerCart({ db }) {
  const owner = await getCartOwner();

  const cart = await db.collection(CART_COLLECTION).findOne(owner.ownerQuery);

  if (!cart?.items?.length) {
    const error = new Error('Your cart is empty.');
    error.code = 'EMPTY_CART';
    throw error;
  }

  return { cart, owner };
}

/**
 * Re-resolves every cart item from MongoDB. Browser-visible cart snapshots,
 * including priceSnapshot, title, images, and Printful IDs, are never trusted
 * for money calculations or shipping-rate inputs.
 */
export async function resolveCanonicalCartItems({ db, cartItems }) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    const error = new Error('No items in cart.');
    error.code = 'EMPTY_CART';
    throw error;
  }

  return Promise.all(
    cartItems.map(async (cartItem, index) => {
      if (!cartItem?.productId || !cartItem?.variationId) {
        const error = new Error(
          `Cart item ${index + 1} is missing productId or variationId.`
        );
        error.code = 'INVALID_CART_ITEM';
        throw error;
      }

      if (!ObjectId.isValid(cartItem.productId)) {
        const error = new Error(
          `Cart item ${index + 1} has an invalid productId.`
        );
        error.code = 'INVALID_CART_ITEM';
        throw error;
      }

      const quantity = Number(cartItem.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        const error = new Error(
          `Cart item ${index + 1} has an invalid quantity.`
        );
        error.code = 'INVALID_CART_ITEM';
        throw error;
      }

      const product = await db.collection('products').findOne({
        _id: new ObjectId(cartItem.productId),
      });

      if (!product) {
        const error = new Error(
          `Product not found for cart item ${index + 1}.`
        );
        error.code = 'CART_PRODUCT_NOT_FOUND';
        throw error;
      }

      const dbVariation = findCanonicalCartVariant(
        product,
        cartItem.variationId
      );

      if (!dbVariation) {
        const error = new Error(
          `Canonical variant ${cartItem.variationId} was not found for product ${product._id}.`
        );
        error.code = 'CART_VARIANT_NOT_FOUND';
        throw error;
      }

      validateTemplateSelection({
        product,
        dbVariation,
        cartItem,
        index,
      });

      const unitPrice = Number(
        dbVariation.retail_price ??
          dbVariation.retailPrice ??
          dbVariation.price ??
          product.retail_price ??
          product.retailPrice ??
          product.price
      );

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        const error = new Error(
          `Canonical retail price is invalid for product ${product._id}, variant ${cartItem.variationId}.`
        );
        error.code = 'INVALID_SERVER_PRICE';
        throw error;
      }

      /*
       * Keep the two Printful IDs distinct:
       * - catalogVariantId: used by the Printful shipping-rate quote request.
       * - syncVariantId: retained for connected-store fulfillment.
       */
      const catalogVariantId =
        dbVariation.printfulCatalogVariantId ??
        dbVariation.catalogVariantId ??
        dbVariation.printful_id ??
        dbVariation.variantId ??
        dbVariation.variant_id ??
        dbVariation.id ??
        null;

      const syncVariantId =
        dbVariation.sync_variant_id ??
        dbVariation.printfulVariantId ??
        null;

      if (!catalogVariantId) {
        const error = new Error(
          `Product ${product._id}, variant ${cartItem.variationId} has no Printful catalog variant ID.`
        );
        error.code = 'MISSING_PRINTFUL_CATALOG_VARIANT';
        throw error;
      }

      return {
        productId: String(product._id),
        variationId: String(cartItem.variationId),
        quantity,
        title: product.title ?? product.name ?? 'Untitled product',
        sku: dbVariation.sku ?? null,
        unitPrice: money(unitPrice),
        currency: 'USD',

        catalogVariantId: String(catalogVariantId),
        syncVariantId: syncVariantId ? String(syncVariantId) : null,

        // Used by the existing order snapshot and fulfillment code.
        product,
        dbVariation,
        cartItem,
      };
    })
  );
}

/**
 * Stable authoritative representation used to bind a shipping quote to the
 * current cart. A changed variant, quantity, canonical price, or Printful
 * catalog mapping invalidates the quote.
 */
export function makeCartFingerprint(items) {
  return JSON.stringify(
    items
      .map((item) => ({
        productId: item.productId,
        variationId: item.variationId,
        catalogVariantId: item.catalogVariantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        currency: item.currency,
      }))
      .sort((a, b) =>
        `${a.productId}:${a.variationId}`.localeCompare(
          `${b.productId}:${b.variationId}`
        )
      )
  );
}