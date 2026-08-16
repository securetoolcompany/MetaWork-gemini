import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { buildOrderItemSnapshot } from '@/lib/order-financial-snapshot';
import {
  getCartOwner,
  getServerCart,
  makeCartFingerprint,
  resolveCanonicalCartItems,
} from '@/lib/checkout-cart';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { quoteId, rateId, promoCode } = body;

    /*
     * The browser can submit only the stored quote identifier and its chosen
     * rate identifier. It must not submit cart items, merchandise pricing,
     * shipping cost, tax, totals, or shipping address.
     */
    if (!quoteId || !rateId) {
      return NextResponse.json(
        {
          error:
            'A current shipping quote and selected shipping rate are required.',
        },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    /*
     * Resolve owner from authenticated user or the guest-cart session cookie.
     * Neither a user ID nor a session ID is accepted from the request body.
     */
    const { ownerQuery } = await getCartOwner();

    const quote = await db.collection('shippingQuotes').findOne({
      quoteId: String(quoteId),
      ...ownerQuery,
    });

    if (!quote) {
      return NextResponse.json(
        {
          error:
            'Shipping quote not found. Please recalculate shipping before payment.',
          code: 'SHIPPING_QUOTE_NOT_FOUND',
        },
        { status: 400 }
      );
    }

    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      return NextResponse.json(
        {
          error:
            'Shipping quote expired. Please recalculate shipping before payment.',
          code: 'SHIPPING_QUOTE_EXPIRED',
        },
        { status: 409 }
      );
    }

    if (quote.consumedAt) {
      return NextResponse.json(
        {
          error:
            'This shipping quote has already been used. Please recalculate shipping.',
          code: 'SHIPPING_QUOTE_ALREADY_USED',
        },
        { status: 409 }
      );
    }

    const selectedRate = quote.rates?.find(
      (rate) => String(rate.id) === String(rateId)
    );

    if (!selectedRate) {
      return NextResponse.json(
        {
          error:
            'The selected shipping rate does not belong to this quote.',
          code: 'INVALID_SHIPPING_RATE',
        },
        { status: 400 }
      );
    }

    const currency = String(selectedRate.currency ?? '').toUpperCase();

    if (currency !== 'USD') {
      return NextResponse.json(
        {
          error: 'The selected shipping rate has an unsupported currency.',
          code: 'INVALID_SHIPPING_CURRENCY',
        },
        { status: 400 }
      );
    }

    const normalizedShippingCost = Number(selectedRate.amount);

    if (
      !Number.isFinite(normalizedShippingCost) ||
      normalizedShippingCost < 0
    ) {
      return NextResponse.json(
        {
          error: 'The selected shipping rate has an invalid amount.',
          code: 'INVALID_SHIPPING_AMOUNT',
        },
        { status: 400 }
      );
    }

    /*
     * Reload the requester's current persisted cart and resolve each line
     * against the current MongoDB product catalog. This blocks stale quotes
     * when quantity, variant, price, or Printful catalog mapping changes.
     */
    const { cart } = await getServerCart({ db });

    const resolvedCartItems = await resolveCanonicalCartItems({
      db,
      cartItems: cart.items,
    });

    if (makeCartFingerprint(resolvedCartItems) !== quote.cartFingerprint) {
      return NextResponse.json(
        {
          error:
            'Your cart changed after shipping was calculated. Please recalculate shipping.',
          code: 'SHIPPING_QUOTE_STALE',
        },
        { status: 409 }
      );
    }

    /*
     * Address comes only from the stored quote. It was validated with
     * validateShippingCodes before the server called Printful.
     */
    const normalizedShippingInfo = quote.shippingInfo;

    if (
      !normalizedShippingInfo?.email ||
      !normalizedShippingInfo?.name ||
      !normalizedShippingInfo?.address1 ||
      !normalizedShippingInfo?.city ||
      !normalizedShippingInfo?.zip ||
      !normalizedShippingInfo?.country_code
    ) {
      return NextResponse.json(
        {
          error:
            'The saved shipping quote is missing required shipping information.',
          code: 'INVALID_SHIPPING_QUOTE',
        },
        { status: 400 }
      );
    }

    // Canonical server-derived merchandise subtotal.
    const itemsSubtotal = resolvedCartItems.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0
    );

    let discountAmount = 0;

    if (promoCode === 'SAVE10') {
      discountAmount = 10;
    } else if (promoCode === 'HALFOFF') {
      discountAmount = itemsSubtotal * 0.5;
    }

    discountAmount = Math.min(discountAmount, itemsSubtotal);

    const discountedSubtotal = itemsSubtotal - discountAmount;
    const discountMultiplier =
      itemsSubtotal > 0 ? discountedSubtotal / itemsSubtotal : 1;

    /*
     * Stripe Tax receives only current server-resolved merchandise amounts.
     * Selected shipping is taken only from the server-persisted quote.
     */
    const lineItems = resolvedCartItems.map((item, index) => ({
      amount: Math.round(
        item.unitPrice * item.quantity * discountMultiplier * 100
      ),
      reference: `${item.productId}:${item.variationId}:${index + 1}`,
      tax_behavior: 'exclusive',
    }));

    const taxCalculation = await stripe.tax.calculations.create({
      currency: 'usd',
      customer_details: {
        address: {
          line1: normalizedShippingInfo.address1,
          city: normalizedShippingInfo.city,
          state: normalizedShippingInfo.state_code || '',
          postal_code: normalizedShippingInfo.zip,
          country: normalizedShippingInfo.country_code,
        },
        address_source: 'shipping',
      },
      line_items: lineItems,
      shipping_cost:
        normalizedShippingCost > 0
          ? {
              amount: Math.round(normalizedShippingCost * 100),
              tax_behavior: 'exclusive',
            }
          : undefined,
    });

    const finalAmountInCents = taxCalculation.amount_total;
    const exactTaxAmount = taxCalculation.tax_amount_exclusive / 100;

    const generatedOrderNumber = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const orderItemSnapshots = resolvedCartItems.map((item, index) => {
      const snapshot = buildOrderItemSnapshot({
        orderItemId: `${generatedOrderNumber}:item:${index + 1}`,
        product: item.product,
        variant: item.dbVariation,
        quantity: item.quantity,
        unitMerchandisePrice: item.unitPrice,
      });

      return {
        ...snapshot,

        // Backward-compatible fields used by existing fulfillment code.
        productId: item.productId,
        variationId: item.variationId,
        quantity: item.quantity,
        title: item.title,
        sku: item.dbVariation.sku ?? item.sku ?? null,

        // Connected Printful store identity, if present.
        sync_variant_id: item.syncVariantId,
        printfulVariantId: item.syncVariantId,

        // Catalog identity remains distinct from store sync identity.
        printful_id: item.catalogVariantId,
        catalogVariantId: item.catalogVariantId,

        // Preserved from the stored cart for existing fulfillment behavior.
        selectedOptions: item.cartItem.selectedOptions ?? null,
      };
    });

    const merchandiseSubtotalCents = resolvedCartItems.reduce(
      (total, item) =>
        total + Math.round(item.unitPrice * item.quantity * 100),
      0
    );

    const discountedMerchandiseSubtotalCents = lineItems.reduce(
      (total, lineItem) => total + lineItem.amount,
      0
    );

    const shippingCents = Math.round(normalizedShippingCost * 100);

    const discountCents =
      merchandiseSubtotalCents - discountedMerchandiseSubtotalCents;

    const orderTotalsSnapshot = {
      merchandiseSubtotalCents,
      discountedMerchandiseSubtotalCents,
      shippingCents,
      taxCents: taxCalculation.tax_amount_exclusive,
      discountCents,
      customerTotalCents: taxCalculation.amount_total,
      currency: 'USD',
    };

    const now = new Date();

    const pendingOrder = {
      orderNumber: generatedOrderNumber,
      email: normalizedShippingInfo.email,
      shippingInfo: normalizedShippingInfo,

      // Canonical immutable purchase-time product snapshots.
      items: orderItemSnapshots,

      // Legacy top-level money fields retained for existing UI/routes.
      subtotal: itemsSubtotal,
      discount: discountAmount,
      shippingCost: normalizedShippingCost,
      tax: exactTaxAmount,
      total: finalAmountInCents / 100,
      currency: 'USD',

      /*
       * Immutable shipping-rate data for the Orders dashboard and future
       * reconciliation if Printful splits packages or changes fulfillment cost.
       */
      shippingRate: {
        provider: 'printful',
        id: String(selectedRate.id),
        name: String(selectedRate.name),
        amount: normalizedShippingCost,
        currency: 'USD',
        minDeliveryDays: selectedRate.minDeliveryDays ?? null,
        maxDeliveryDays: selectedRate.maxDeliveryDays ?? null,
        quoteId: String(quote.quoteId),
        quotedAt: new Date(quote.quotedAt),
      },

      // Integer-cent audit source for settlement and charge reconciliation.
      financialSnapshot: orderTotalsSnapshot,

      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',

      settlementPolicySnapshot: {
        eligibilityEvent: 'delivered',
        holdDays: 14,
        licensingRevenueBase: 'merchandise_only',
        stripeFeeTreatment: 'platform_margin',
        settlementCadence: 'weekly',
      },

      createdAt: now,
    };

    const insertResult = await db.collection('orders').insertOne(pendingOrder);
    const orderId = insertResult.insertedId.toString();

    /*
     * Mark the quote used before the PaymentIntent is returned. This prevents
     * the same quote from being used to generate additional orders/intents.
     */
    await db.collection('shippingQuotes').updateOne(
      {
        _id: quote._id,
        ...ownerQuery,
        consumedAt: { $exists: false },
      },
      {
        $set: {
          consumedAt: now,
          orderId,
        },
      }
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        customer_email: normalizedShippingInfo.email,
        customer_name: normalizedShippingInfo.name,
        shipping_country: normalizedShippingInfo.country_code,
        order_id: orderId,
        shipping_quote_id: String(quote.quoteId),
        shipping_rate_id: String(selectedRate.id),
        applied_promo: promoCode || 'none',
        discount_amount: discountAmount.toFixed(2),
        stripe_tax_calculation_id: taxCalculation.id,
        tax_collected: exactTaxAmount.toFixed(2),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderNumber: generatedOrderNumber,
      amountSubtotal: taxCalculation.amount_subtotal,
      amountTax: taxCalculation.tax_amount_exclusive,
      amountTotal: taxCalculation.amount_total,
    });
  } catch (err) {
    console.error('STRIPE BACKEND ERROR:', err);

    return NextResponse.json(
      {
        error: err.message || 'Unable to create checkout payment',
      },
      { status: 500 }
    );
  }
}