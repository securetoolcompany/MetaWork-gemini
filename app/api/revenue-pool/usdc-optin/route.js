import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient } from '@/lib/algorand';

export const dynamic = 'force-dynamic';

function getUsdcAssetId() {
  const id = Number(process.env.USDC_ASSET_ID);
  if (!id) {
    throw new Error('USDC_ASSET_ID is not configured');
  }
  return id;
}

function normalizeAddress(address) {
  return String(address || '').trim().toUpperCase();
}

// POST — build unsigned opt-in txn
export async function POST(request) {
  try {
    const algodClient = getAlgodClient();
    const USDC_ASSET_ID = getUsdcAssetId();

    const body = await request.json();
    const userAddress = normalizeAddress(body?.userAddress);

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }

    if (!algosdk.isValidAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid userAddress' },
        { status: 400 }
      );
    }

    console.log('Algod config', {
        network: process.env.ALGORAND_NETWORK,
        rpc: process.env.ALGORAND_TESTNET_RPC,
        hasApiKey: Boolean(process.env.ALGOD_X_API_KEY),
        apiKeyPrefix: process.env.ALGOD_X_API_KEY
            ? `${process.env.ALGOD_X_API_KEY.slice(0, 6)}...`
            : null,
        });

    const suggestedParams = await algodClient.getTransactionParams().do();

    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: userAddress,
      receiver: userAddress,
      amount: 0,
      assetIndex: USDC_ASSET_ID,
      suggestedParams,
    });

    return NextResponse.json({
      success: true,
      assetId: String(USDC_ASSET_ID),
      transaction: Buffer.from(
        algosdk.encodeUnsignedTransaction(txn)
      ).toString('base64'),
    });
  } catch (error) {
    console.error('USDC opt-in txn error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to prepare USDC opt-in transaction' },
      { status: 500 }
    );
  }
}

// PUT — submit signed opt-in txn
export async function PUT(request) {
  try {
    const algodClient = getAlgodClient();
    const USDC_ASSET_ID = getUsdcAssetId();

    const body = await request.json();
    const userAddress = normalizeAddress(body?.userAddress);
    const { signedTxn, signedTxns } = body || {};

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }

    if (!algosdk.isValidAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid userAddress' },
        { status: 400 }
      );
    }

    const hasSingle = typeof signedTxn === 'string' && signedTxn.length > 0;
    const hasGroup = Array.isArray(signedTxns) && signedTxns.length > 0;

    if (!hasSingle && !hasGroup) {
      return NextResponse.json(
        { error: 'signedTxn or signedTxns is required' },
        { status: 400 }
      );
    }

    const signedBytes = hasGroup
      ? signedTxns.map((tx) => new Uint8Array(Buffer.from(tx, 'base64')))
      : [new Uint8Array(Buffer.from(signedTxn, 'base64'))];

    const result = await algodClient.sendRawTransaction(signedBytes).do();
    const txid = result.txid || result.txId;

    await algosdk.waitForConfirmation(algodClient, txid, 10);

    return NextResponse.json({
      success: true,
      txId: txid,
      assetId: String(USDC_ASSET_ID),
      groupSize: signedBytes.length,
      message: 'USDC opt-in confirmed',
    });
  } catch (error) {
    console.error('USDC opt-in submit error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit USDC opt-in transaction' },
      { status: 500 }
    );
  }
}