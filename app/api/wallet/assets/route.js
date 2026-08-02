import { NextResponse } from 'next/server';
import { getAlgodClient, getUsdcAssetId } from '@/lib/algorand';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
    }

    const algodClient = getAlgodClient();
    const USDC_ASSET_ID = getUsdcAssetId();

    const account = await algodClient.accountInformation(userAddress).do();
    const assets = Array.isArray(account.assets) ? account.assets : [];
    const usdcIdBig = BigInt(USDC_ASSET_ID);

    return NextResponse.json({
      success: true,
      usdcAssetId: String(USDC_ASSET_ID),
      optedIn: assets.some((a) => BigInt(a['asset-id'] ?? 0) === usdcIdBig),
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