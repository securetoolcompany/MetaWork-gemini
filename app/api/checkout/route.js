import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { items, shippingInfo } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    // To fix the error, we use top-level parameters that are compatible with automatic_tax
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'cashapp'], 
      
      // 1. Contact Pre-fill
      customer_email: shippingInfo?.email,

      // 2. Shipping Address Collection (Required for International)
      shipping_address_collection: {
        allowed_countries: [
          'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'JP', 'MX', 'BR', 
          'NL', 'BE', 'AT', 'DK', 'FI', 'IE', 'NO', 'PT', 'SE', 'CH', 'NZ'
        ],
      },

      // 3. Tax Calculation (Now compatible)
      automatic_tax: { enabled: true },

      line_items: items.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: { 
            name: item.title || item.name,
            images: item.thumbnailUrl ? [item.thumbnailUrl] : [],
          },
          tax_behavior: 'exclusive',
          unit_amount: Math.round(parseFloat(item.priceSnapshot || item.price) * 100),
        },
        quantity: item.quantity,
      })),

      // We remove payment_intent_data.shipping to resolve the conflict.
      // Stripe will now use the email and the user's saved Stripe profile 
      // (if they have one) to pre-fill, or they will quickly enter it once.

      metadata: {
        customer_email: shippingInfo?.email || '',
        shipping_name: shippingInfo?.name || '',
        // We still pass the address in metadata so your webhooks can save it to your DB
        shipping_address_line1: shippingInfo?.address1 || '',
        shipping_city: shippingInfo?.city || '',
        shipping_state: shippingInfo?.state_code || '',
        shipping_zip: shippingInfo?.zip || '',
        shipping_country: shippingInfo?.country_code || '',
      },

      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/showroom?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/showroom?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("STRIPE BACKEND ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}