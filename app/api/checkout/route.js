import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { validateShippingCodes } from '@/lib/addressCodes';
import {
  buildOrderItemSnapshot,
} from '@/lib/order-financial-snapshot';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { ObjectId } = await import('mongodb');
    const body = await req.json();
    const { items, shippingInfo, shippingCost, promoCode } = body;

    if (
      !shippingInfo?.email ||
      !shippingInfo?.name ||
      !shippingInfo?.phone ||
      !shippingInfo?.address1 ||
      !shippingInfo?.city ||
      !shippingInfo?.zip ||
      !shippingInfo?.country_code
    ) {
      return NextResponse.json(
        { error: 'Missing required shipping information' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items in cart' },
        { status: 400 }
      );
    }

    const { country, state } = validateShippingCodes(shippingInfo);

    const normalizedShippingInfo = {
      ...shippingInfo,
      email: String(shippingInfo.email).trim().toLowerCase(),
      name: String(shippingInfo.name).trim(),
      phone: String(shippingInfo.phone).trim(),
      address1: String(shippingInfo.address1).trim(),
      city: String(shippingInfo.city).trim(),
      zip: String(shippingInfo.zip).trim(),
      country_code: country,
      state_code: state || '',
    };

    const normalizedShippingCost = Number(shippingCost || 0);

    if (
      !Number.isFinite(normalizedShippingCost) ||
      normalizedShippingCost < 0
    ) {
      return NextResponse.json(
        { error: 'Invalid shipping cost' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Resolve every cart item against MongoDB before calculating money.
    // Browser price fields are never used for totals, tax, or PaymentIntent amount.
    const resolvedCartItems = await Promise.all(
      items.map(async (cartItem, index) => {
        if (!cartItem?.productId || !cartItem?.variationId) {
          throw new Error(
            `Cart item ${index + 1} is missing productId or variationId`
          );
        }

        if (!ObjectId.isValid(cartItem.productId)) {
          throw new Error(`Cart item ${index + 1} has an invalid productId`);
        }

        const quantity = Number(cartItem.quantity);

        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new Error(`Cart item ${index + 1} has an invalid quantity`);
        }

        const product = await db.collection('products').findOne({
          _id: new ObjectId(cartItem.productId),
        });

        if (!product) {
          throw new Error(`Product not found for cart item ${index + 1}`);
        }

        const candidateVariants = [
          ...(product.variants || []),
          ...(product.variations || []),
          ...(product.baseProduct?.variants || []),
        ];

        const requestedVariantId = String(cartItem.variationId);

        const dbVariation = candidateVariants.find((variant) => {
          const canonicalIds = [
            variant?.id,
            variant?.variantId,
            variant?.variant_id,
            variant?.printful_id,
            variant?.sync_variant_id,
            variant?.printfulVariantId,
          ]
            .filter((value) => value !== undefined && value !== null)
            .map(String);

          return canonicalIds.includes(requestedVariantId);
        });

        if (!dbVariation) {
          throw new Error(
            `Canonical variant ${cartItem.variationId} was not found for product ${product._id}`
          );
        }

        const unitPrice = Number(
          dbVariation.retail_price ??
            dbVariation.retailPrice ??
            dbVariation.price
        );

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new Error(
            `Canonical retail price is invalid for product ${product._id}, variant ${cartItem.variationId}`
          );
        }

        // A Printful sync variant ID is valid only when the product was actually
        // synced to the connected Printful store. Do not fall back to catalog IDs.
        const syncVariantId =
          dbVariation.sync_variant_id ??
          dbVariation.printfulVariantId ??
          null;

        // Catalog variant IDs are distinct from sync-store variant IDs.
        const catalogVariantId =
          dbVariation.printful_id ??
          dbVariation.variantId ??
          dbVariation.variant_id ??
          dbVariation.id ??
          null;

        return {
          cartItem,
          product,
          dbVariation,
          quantity,
          unitPrice,
          title: product.name ?? cartItem.title ?? 'Untitled product',
          syncVariantId,
          catalogVariantId,
        };
      })
    );

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

    // Stripe Tax receives only server-resolved canonical prices.
    const lineItems = resolvedCartItems.map((item, index) => ({
      amount: Math.round(
        item.unitPrice * item.quantity * discountMultiplier * 100
      ),
      reference: `${String(item.product._id)}:${String(
        item.cartItem.variationId
      )}:${index + 1}`,
      tax_behavior: 'exclusive',
    }));

    const taxCalculation = await stripe.tax.calculations.create({
      currency: 'usd',
      customer_details: {
        address: {
          line1: normalizedShippingInfo.address1,
          city: normalizedShippingInfo.city,
          state: normalizedShippingInfo.state_code,
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

    // Preserve fulfillment identifiers while adding immutable financial,
    // canonical-pricing, and locked-licensing snapshots.
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

        // Backward-compatible fields expected by current fulfillment code.
        productId: String(item.product._id),
        variationId: String(item.cartItem.variationId),
        quantity: item.quantity,
        title: item.title,
        sku: item.dbVariation.sku ?? item.cartItem.sku ?? null,
        // Set only if it is an actual Printful store sync-variant mapping.
        sync_variant_id: item.syncVariantId,
        printfulVariantId: item.syncVariantId,

        // Retain catalog identity separately for resolver/template fallback logic.
        printful_id: item.catalogVariantId,
        catalogVariantId: item.catalogVariantId,
        selectedOptions: item.cartItem.selectedOptions ?? null,
      };
    });

    const merchandiseSubtotalCents = resolvedCartItems.reduce(
      (total, item) => total + Math.round(item.unitPrice * item.quantity * 100),
      0
    );

    const discountedMerchandiseSubtotalCents = lineItems.reduce(
      (total, lineItem) => total + lineItem.amount,
      0
    );

    const shippingCents = Math.round(normalizedShippingCost * 100);

    const discountCents =
      merchandiseSubtotalCents - discountedMerchandiseSubtotalCents;

    // Stripe Tax's amount_total is the authoritative amount being charged.
    const orderTotalsSnapshot = {
      merchandiseSubtotalCents,
      discountedMerchandiseSubtotalCents,
      shippingCents,
      taxCents: taxCalculation.tax_amount_exclusive,
      discountCents,
      customerTotalCents: taxCalculation.amount_total,
      currency: 'USD',
    };

    const pendingOrder = {
      orderNumber: generatedOrderNumber,
      email: normalizedShippingInfo.email,
      shippingInfo: normalizedShippingInfo,

      // Canonical immutable purchase-time order-item snapshots.
      items: orderItemSnapshots,

      // Legacy top-level money fields retained for existing UI/routes.
      subtotal: itemsSubtotal,
      discount: discountAmount,
      shippingCost: normalizedShippingCost,
      tax: exactTaxAmount,
      total: finalAmountInCents / 100,

      // Integer-cent audit source for later settlement work.
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

      createdAt: new Date(),
    };

    const insertResult = await db.collection('orders').insertOne(pendingOrder);
    const orderId = insertResult.insertedId.toString();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        customer_email: normalizedShippingInfo.email,
        customer_name: normalizedShippingInfo.name,
        shipping_country: normalizedShippingInfo.country_code,
        order_id: orderId,
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
    console.error('STRIPE BACKEND ERROR:', err.message);

    return NextResponse.json(
      { error: err.message || 'Unable to create checkout payment' },
      { status: 500 }
    );
  }
}