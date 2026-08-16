import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { validateShippingCodes } from '@/lib/addressCodes';
import {
  getServerCart,
  makeCartFingerprint,
  resolveCanonicalCartItems,
} from '@/lib/checkout-cart';
import {
  makeAddressFingerprint,
  normalizeShippingAddress,
  quotePrintfulShipping,
} from '@/lib/printful-shipping';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QUOTE_TTL_MS = 15 * 60 * 1000;

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function validateRequiredAddressFields(shippingInfo) {
  const requiredFields = [
    'name',
    'address1',
    'city',
    'zip',
    'country_code',
  ];

  const missing = requiredFields.filter(
    (field) => !String(shippingInfo?.[field] ?? '').trim()
  );

  if (missing.length > 0) {
    const error = new Error(
      `Missing required shipping information: ${missing.join(', ')}.`
    );
    error.code = 'INVALID_SHIPPING_ADDRESS';
    error.missing = missing;
    throw error;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const rawShippingInfo = body?.shippingInfo ?? body?.address ?? {};

    validateRequiredAddressFields(rawShippingInfo);

    /*
     * Existing project utility canonicalizes country and state codes.
     * It may reject an invalid or unsupported destination before Printful is
     * called, which is preferable to persisting a malformed quote.
     */
    const { country, state } = validateShippingCodes(rawShippingInfo);

    const shippingInfo = normalizeShippingAddress({
      ...rawShippingInfo,
      country_code: country,
      state_code: state || '',
    });

    const { db } = await connectToDatabase();

    /*
     * Uses the same authenticated-user / guest-session ownership model as
     * app/api/cart/route.js. No cart item, price, quantity, or Printful ID is
     * accepted from the browser.
     */
    const { cart, owner } = await getServerCart({ db });

    const resolvedCartItems = await resolveCanonicalCartItems({
      db,
      cartItems: cart.items,
    });

    /*
    * Printful sync data maps:
    * - sync_variant_id: the saved store variant ID used for fulfillment.
    * - catalogVariantId: the catalog variant ID required by shipping-rates.
    *
    * The request itself inherits the connected Printful store through the
    * X-PF-Store-Id header configured inside lib/printful-shipping.js.
    */
    const quoteItems = resolvedCartItems.map((item) => {
      if (!item.catalogVariantId) {
        const error = new Error(
          `Product "${item.title}" does not have a Printful catalog variant ID and cannot be quoted.`
        );
        error.code = 'MISSING_PRINTFUL_CATALOG_VARIANT';
        throw error;
      }

      return {
        variant_id: Number(item.catalogVariantId),
        quantity: item.quantity,
      };
    });

    const rates = await quotePrintfulShipping({
      recipient: shippingInfo,
      items: quoteItems,
    });

    const quotedAt = new Date();
    const expiresAt = new Date(quotedAt.getTime() + QUOTE_TTL_MS);
    const quoteId = crypto.randomUUID();

    const cartFingerprint = makeCartFingerprint(resolvedCartItems);
    const addressFingerprint = makeAddressFingerprint(shippingInfo);

    const quote = {
      quoteId,

    // Exactly one ownership field is persisted, based on the current request.
      ...(owner.userId
        ? { userId: owner.userId }
        : { sessionId: owner.sessionId }),

      cartId: String(cart._id),
      cartFingerprint,
      addressFingerprint,

      shippingInfo,

      /*
       * Snapshot safe identifiers only. Do not store cart price snapshots as
       * authority; checkout re-resolves cart pricing from products again.
       */
      cartItems: resolvedCartItems.map((item) => ({
        productId: item.productId,
        variationId: item.variationId,
        quantity: item.quantity,
        catalogVariantId: item.catalogVariantId,
        syncVariantId: item.syncVariantId,
      })),

      subtotal: money(
        resolvedCartItems.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        )
      ),

      currency: 'USD',
      rates,
      quotedAt,
      expiresAt,
      createdAt: quotedAt,
    };

    await db.collection('shippingQuotes').insertOne(quote);

    /*
     * TTL cleanup is asynchronous. Checkout must still explicitly validate
     * expiresAt before it can create payment.
     */
    await db.collection('shippingQuotes').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );

    return NextResponse.json(
      {
        quoteId,
        expiresAt: expiresAt.toISOString(),
        rates,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error) {
    console.error('[shipping/rates]', error);

    const status =
      error.code === 'INVALID_SHIPPING_ADDRESS'
        ? 400
        : error.code === 'EMPTY_CART'
          ? 400
          : error.code === 'CART_SESSION_NOT_FOUND'
            ? 401
            : error.code === 'NO_SHIPPING_RATES' ||
              error.code === 'MISSING_PRINTFUL_SYNC_VARIANT'
              ? 422
              : error.code === 'PRINTFUL_NOT_CONFIGURED' ||
                error.code === 'PRINTFUL_STORE_NOT_CONFIGURED' ||
                error.code === 'INVALID_PRINTFUL_STORE_ID'
                ? 500
                : error.code === 'PRINTFUL_SHIPPING_RATE_ERROR'
                  ? 502
                  : 500;

    return NextResponse.json(
      {
        error: error.message || 'Unable to calculate shipping.',
        code: error.code || 'SHIPPING_QUOTE_FAILED',
        missing: error.missing,
      },
      { status }
    );
  }
}