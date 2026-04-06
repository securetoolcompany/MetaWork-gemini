import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { distributeRoyalties } from '@/lib/algorand';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const payload = await req.text(); // Get raw body for Stripe signature verification
  const sig = req.headers.get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      payload, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderData = JSON.parse(session.metadata.order_details);
    
    // This now calls the function we just added to lib/algorand.js
    await distributeRoyalties(orderData);
  }

  return NextResponse.json({ received: true });
}