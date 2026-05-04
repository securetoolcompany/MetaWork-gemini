import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.substring(7));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { priceId } = await req.json();

    const { db } = await connectToDatabase();
    const pack = await db.collection('creditPacks').findOne({
      _id: new ObjectId(priceId),
      active: true,
    });

    if (!pack) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pack.priceUSDC * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: decoded.userId,
        creditsToAdd: pack.credits,
        packId: priceId,
        packName: pack.name,
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('[checkout/credits]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}