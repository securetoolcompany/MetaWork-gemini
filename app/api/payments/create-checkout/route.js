import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Keep these in sync with CREDIT_PACKAGES in InsufficientCreditsModal.jsx
const PACKAGES = {
  credits_1:  { qty: 1,  priceUsd: 499  },  // cents
  credits_3:  { qty: 3,  priceUsd: 1299 },
  credits_5:  { qty: 5,  priceUsd: 1999 },
  credits_10: { qty: 10, priceUsd: 3499 },
};

export async function POST(req) {
  try {
    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.substring(7));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { priceId, quantity, successUrl, cancelUrl } = await req.json();

    const pack = PACKAGES[priceId];
    if (!pack) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pack.priceUsd,
            product_data: {
              name: `${pack.qty} Mint Credit${pack.qty > 1 ? 's' : ''}`,
              description: `MetaWork IP/Product mint credits — ${pack.qty} credit${pack.qty > 1 ? 's' : ''}`,
            },
          },
        },
      ],
      metadata: {
        userId: decoded.userId,
        creditsToAdd: pack.qty,
        priceId,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[payments/create-checkout]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}