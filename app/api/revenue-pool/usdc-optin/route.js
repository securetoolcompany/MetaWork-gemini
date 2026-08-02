import { NextResponse } from 'next/server';
import algosdk from 'algosdk';

export const dynamic = 'force-dynamic';

const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
const USDC_ASSET_ID = Number(process.env.USDC_ASSET_ID);

if (!USDC_ASSET_ID) {
  throw new Error('USDC_ASSET_ID is not configured');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }

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
      assetId: USDC_ASSET_ID,
      transaction: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64'),
    });
  } catch (error) {
    console.error('USDC opt-in txn error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}