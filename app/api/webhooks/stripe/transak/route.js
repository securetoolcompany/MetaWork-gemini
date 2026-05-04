import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { addCredits } from '@/lib/credits';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const TRANSAK_API_KEY = process.env.TRANSAK_API_KEY;

function verifyTransakSignature(rawBody, signature) {
  if (!TRANSAK_API_KEY) return false;
  const expected = crypto
    .createHmac('sha256', TRANSAK_API_KEY)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-transak-signature') || '';

    if (!verifyTransakSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { eventID, data } = JSON.parse(rawBody);

    if (eventID !== 'ORDER_COMPLETED' || data?.status !== 'COMPLETED') {
      return NextResponse.json({ received: true });
    }

    const [userId, packId] = (data.partnerOrderId || '').split(':');
    if (!userId || !packId) {
      return NextResponse.json({ error: 'Invalid partnerOrderId' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const transakOrderId = data.id || data.orderId;
    if (transakOrderId) {
      const existing = await db.collection('creditTransactions').findOne({ transakOrderId });
      if (existing) return NextResponse.json({ received: true, duplicate: true });
    }

    let pack;
    try {
      pack = await db.collection('creditPacks').findOne({ _id: new ObjectId(packId), active: true });
    } catch {
      return NextResponse.json({ error: 'Invalid packId' }, { status: 400 });
    }
    if (!pack) return NextResponse.json({ error: 'Pack not found' }, { status: 400 });

    const newBalance = await addCredits(userId, pack.credits);

    await db.collection('creditTransactions').insertOne({
      userId,
      transakOrderId,
      packId: pack._id.toString(),
      packName: pack.name,
      creditsAdded: pack.credits,
      amountUSDC: pack.priceUSDC,
      method: 'transak',
      transakData: data,
      createdAt: new Date(),
    });

    console.log(`[webhooks/transak] +${pack.credits} credits for user ${userId}, new balance: ${newBalance}`);
    return NextResponse.json({ success: true, creditsAdded: pack.credits });
  } catch (error) {
    console.error('[webhooks/transak]', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}