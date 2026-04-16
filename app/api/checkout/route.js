import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { ObjectId } = await import('mongodb');
    const body = await req.json();
    const { items, shippingInfo, shippingCost, promoCode } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    // 1. Calculate Base Subtotal & Discounts
    const itemsSubtotal = items.reduce((acc, item) => {
      return acc + (parseFloat(item.priceSnapshot || item.price) * item.quantity);
    }, 0);

    let discountAmount = 0;
    if (promoCode) {
      if (promoCode === 'SAVE10') discountAmount = 10.00;
      else if (promoCode === 'HALFOFF') discountAmount = itemsSubtotal * 0.5;
    }

    // Prevent negative subtotal
    discountAmount = Math.min(discountAmount, itemsSubtotal);
    const discountedSubtotal = itemsSubtotal - discountAmount;

    // Calculate proportional discount multiplier to avoid overcharging tax
    // e.g. A $10 discount on a $50 cart = 0.8 multiplier applied to all items
    const discountMultiplier = itemsSubtotal > 0 ? (discountedSubtotal / itemsSubtotal) : 1;

    // 2. ASK STRIPE FOR THE EXACT TAX AMOUNT (International & Domestic)
    const lineItems = items.map((item) => ({
      // Apply the discount directly to the line item so Stripe taxes the right amount
      amount: Math.round(parseFloat(item.priceSnapshot || item.price) * item.quantity * discountMultiplier * 100),
      reference: item.title || item.name || 'Item',
      tax_behavior: 'exclusive',
    }));

    // Generate the tax calculation with shipping properly separated
    const taxCalculation = await stripe.tax.calculations.create({
      currency: 'usd',
      customer_details: {
        address: {
          line1: shippingInfo.address1,
          city: shippingInfo.city,
          state: shippingInfo.state_code,
          postal_code: shippingInfo.zip,
          country: shippingInfo.country_code,
        },
        address_source: 'shipping',
      },
      line_items: lineItems,
      shipping_cost: parseFloat(shippingCost || 0) > 0 ? {
        amount: Math.round(parseFloat(shippingCost) * 100),
        tax_behavior: 'exclusive',
      } : undefined,
    });

    const finalAmountInCents = taxCalculation.amount_total;
    const exactTaxAmount = taxCalculation.tax_amount_exclusive / 100;

    // 3. ENRICH ITEMS WITH SYNC IDs & CREATE PENDING ORDER
    const { db } = await connectToDatabase(); 

    const enrichedItems = await Promise.all(items.map(async (cartItem) => {
      const dbProduct = await db.collection('products').findOne({ _id: new ObjectId(cartItem.productId) });
      
      const dbVariation = dbProduct?.variations?.find(v => 
        v.id.toString() === cartItem.variationId?.toString() || 
        v.printfulVariantId?.toString() === cartItem.variationId?.toString()
      );

      // --- ADD THESE LOGS ---
      console.log(`\n[Enrichment Diagnostic] Processing Cart Item:`, cartItem.title || cartItem.productId);
      console.log(`[Enrichment Diagnostic] -> Cart Variation ID:`, cartItem.variationId);
      console.log(`[Enrichment Diagnostic] -> Found matching DB Product:`, !!dbProduct);
      console.log(`[Enrichment Diagnostic] -> Found matching DB Variation:`, !!dbVariation);
      if (dbVariation) {
        console.log(`[Enrichment Diagnostic] -> Extracted Sync ID:`, dbVariation.sync_variant_id || dbVariation.printfulVariantId);
      } else if (dbProduct?.variations) {
         // If we found the product but no variation matched, log what variations DO exist so you can spot the mismatch
         console.log(`[Enrichment Diagnostic] -> DB Product Variations available:`, dbProduct.variations.map(v => v.id));
      }

      return {
        ...cartItem,
        // THIS IS THE KEY: ensure the 10-digit ID is attached to the item
        sync_variant_id: dbVariation?.sync_variant_id || dbVariation?.printfulVariantId || null,
        title: dbProduct?.name || cartItem.title
      };
    }));
    
    const generatedOrderNumber = Math.floor(100000 + Math.random() * 900000).toString();
    
    const pendingOrder = {
      orderNumber: generatedOrderNumber,
      email: shippingInfo.email.toLowerCase().trim(),
      shippingInfo: shippingInfo,
      items: enrichedItems, // SAVE THE ENRICHED ITEMS INSTEAD
      subtotal: itemsSubtotal,
      discount: discountAmount,
      shippingCost: parseFloat(shippingCost || 0),
      tax: exactTaxAmount,
      total: finalAmountInCents / 100,
      status: 'pending', 
      createdAt: new Date(),
    };

    const insertResult = await db.collection('orders').insertOne(pendingOrder);
    const orderId = insertResult.insertedId.toString();

    // 4. CREATE THE PAYMENT INTENT
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        customer_email: shippingInfo.email,
        customer_name: shippingInfo.name,
        order_id: orderId, 
        shipping_country: shippingInfo.country_code,
        applied_promo: promoCode || 'none',
        discount_amount: discountAmount.toFixed(2),
        stripe_tax_calculation_id: taxCalculation.id, 
        tax_collected: exactTaxAmount.toFixed(2)
      },
    });

    // Return the secret to the frontend so it can render the card inputs safely
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderNumber: generatedOrderNumber,
      amountSubtotal: taxCalculation.amount_subtotal,
      amountTax: taxCalculation.tax_amount_exclusive,
      amountTotal: taxCalculation.amount_total,
    });
  } catch (err) {
    console.error("STRIPE BACKEND ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}