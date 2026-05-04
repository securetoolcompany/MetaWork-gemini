/**
 * POST /api/credits/purchase
 * Verifies an on-chain USDC.algo payment by txId + note,
 * then adds credits to the authenticated user.
 *
 * Body: { txId, note, packId }
 * Headers: Authorization: Bearer <jwt>
 */

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { addCredits } from '@/lib/credits';
import { USDC_ASSET_ID, dollarToMicro } from '@/lib/usdc';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const TREASURY_ADDRESS = process.env.METAWORK_TREASURY_ADDRESS;
const INDEXER_URL =
  process.env.ALGORAND_TESTNET_INDEXER || 'https://testnet-idx.algonode.cloud';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.substring(7));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!TREASURY_ADDRESS) {
      console.error('[credits/purchase] METAWORK_TREASURY_ADDRESS not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { txId, note, packId } = await request.json();
    if (!txId || !note || !packId) {
      return NextResponse.json({ error: 'txId, note, and packId are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Idempotency
    const existing = await db.collection('creditTransactions').findOne({ txId });
    if (existing) {
      return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 });
    }

    // Load pack
    const pack = await db
      .collection('creditPacks')
      .findOne({ _id: new ObjectId(packId), active: true });
    if (!pack) {
      return NextResponse.json({ error: 'Invalid or inactive pack' }, { status: 400 });
    }

    const expectedMicro = dollarToMicro(pack.priceUSDC);

    // Verify on-chain
    const txnRes = await fetch(`${INDEXER_URL}/v2/transactions/${txId}`);
    if (!txnRes.ok) {
      return NextResponse.json(
        { error: 'Transaction not found on chain. It may still be pending — try again in a moment.' },
        { status: 400 }
      );
    }
    const txnData = await txnRes.json();
    const txn = txnData.transaction;
    if (!txn) {
      return NextResponse.json({ error: 'Invalid transaction data' }, { status: 400 });
    }

    const transfer = txn['asset-transfer-transaction'];
    if (!transfer) {
      return NextResponse.json({ error: 'Not an asset transfer transaction' }, { status: 400 });
    }
    if (Number(transfer['asset-id']) !== USDC_ASSET_ID) {
      return NextResponse.json({ error: 'Wrong asset — must be USDC.algo' }, { status: 400 });
    }
    if (transfer.receiver !== TREASURY_ADDRESS) {
      return NextResponse.json({ error: 'Wrong receiver address' }, { status: 400 });
    }
    if (Number(transfer.amount) !== expectedMicro) {
      return NextResponse.json(
        { error: `Wrong amount. Expected ${expectedMicro} micro-USDC for this pack.` },
        { status: 400 }
      );
    }

    const onChainNote = txn.note
      ? Buffer.from(txn.note, 'base64').toString('utf8')
      : '';
    if (onChainNote !== note) {
      return NextResponse.json(
        { error: 'Note mismatch — cannot verify this payment belongs to your order' },
        { status: 400 }
      );
    }

    // Award credits
    const newBalance = await addCredits(decoded.userId, pack.credits);

    // Record transaction
    await db.collection('creditTransactions').insertOne({
      userId: decoded.userId,
      txId,
      note,
      packId: pack._id.toString(),
      packName: pack.name,
      creditsAdded: pack.credits,
      amountUSDC: pack.priceUSDC,
      method: 'pera_qr',
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, creditsAdded: pack.credits, newBalance });
  } catch (error) {
    console.error('[credits/purchase]', error);
    return NextResponse.json({ error: 'Purchase verification failed' }, { status: 500 });
  }
}