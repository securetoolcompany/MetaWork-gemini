import { NextResponse } from 'next/server';
import algosdk from 'algosdk';

export const dynamic = 'force-dynamic';

const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
const USDC_ASSET_ID = Number(process.env.USDC_ASSET_ID);

if (!USDC_ASSET_ID) {
  throw new Error('USDC_ASSET_ID is not configured');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }

    const account = await algodClient.accountInformation(userAddress).do();
    const assets = Array.isArray(account.assets) ? account.assets : [];

    return NextResponse.json({
      success: true,
      usdcAssetId: String(USDC_ASSET_ID),
      optedIn: assets.some((a) => Number(a['asset-id']) === USDC_ASSET_ID),
      assets: assets.map((a) => ({
         assetId: String(a['asset-id']),
         amount: String(a.amount),
         isFrozen: Boolean(a['is-frozen']),
        })),
    });
  } catch (error) {
    console.error('Wallet assets error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}