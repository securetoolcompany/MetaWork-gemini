import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient } from '@/lib/algorand';
import { invalidateAccountCache } from '@/lib/algorand-rate-limit';

export const dynamic = 'force-dynamic';

function normalizeAddress(address) {
  return String(address || '').trim().toUpperCase();
}

function getRevenueTokenId(value) {
  const id = Number(value);
  if (!id) throw new Error('revenueTokenId is required');
  return id;
}

/**
 * POST – build an unsigned ASA opt-in transaction for the given revenueTokenId.
 */
export async function POST(request) {
  try {
    const algodClient = getAlgodClient();
    const body = await request.json();
    const userAddress = normalizeAddress(body?.userAddress);
    const revenueTokenId = getRevenueTokenId(body?.revenueTokenId);

    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }
    if (!algosdk.isValidAddress(userAddress)) {
      return NextResponse.json({ error: 'Invalid userAddress' }, { status: 400 });
    }

    const suggestedParams = await algodClient.getTransactionParams().do();

    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: userAddress,
      receiver: userAddress,
      amount: 0,
      assetIndex: revenueTokenId,
      suggestedParams,
    });

    return NextResponse.json({
      success: true,
      revenueTokenId: String(revenueTokenId),
      transaction: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64'),
    });
  } catch (error) {
    console.error('[REV-OPTIN][POST] ERROR:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to prepare revenue token opt-in transaction' },
      { status: 500 }
    );
  }
}

/**
 * PUT – submit a signed ASA opt-in transaction and wait for confirmation.
 */
export async function PUT(request) {
  try {
    const algodClient = getAlgodClient();
    const body = await request.json();
    const userAddress = normalizeAddress(body?.userAddress);
    const revenueTokenId = getRevenueTokenId(body?.revenueTokenId);
    const signedTxn = body?.signedTxn;

    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }
    if (!algosdk.isValidAddress(userAddress)) {
      return NextResponse.json({ error: 'Invalid userAddress' }, { status: 400 });
    }
    if (!signedTxn) {
      return NextResponse.json({ error: 'signedTxn is required' }, { status: 400 });
    }

    const signedBytes = new Uint8Array(Buffer.from(signedTxn, 'base64'));
    const result = await algodClient.sendRawTransaction([signedBytes]).do();
    const txid = result.txid || result.txId;

    await algosdk.waitForConfirmation(algodClient, txid, 10);
    invalidateAccountCache(userAddress);

    return NextResponse.json({
      success: true,
      txId: txid,
      revenueTokenId: String(revenueTokenId),
      message: 'Revenue token opt-in confirmed',
    });
  } catch (error) {
    console.error('[REV-OPTIN][PUT] ERROR:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit revenue token opt-in transaction' },
      { status: 500 }
    );
  }
}