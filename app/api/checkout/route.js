import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { items } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      // Change from automatic_payment_methods to payment_method_types
      payment_method_types: ['card', 'cashapp'], 
      line_items: items.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: { 
            name: item.name,
            images: item.image ? [item.image] : [],
          },
          unit_amount: Math.round(parseFloat(item.price) * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/showroom?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/showroom?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("STRIPE BACKEND ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}