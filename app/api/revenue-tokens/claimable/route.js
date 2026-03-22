import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { connectToDatabase } from '@/lib/mongodb';
import { safeJson } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function getLocalClient() {
  return new algosdk.Algodv2(
    process.env.ALGOD_TOKEN || '', 
    process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud', 
    process.env.ALGOD_PORT || ''
  );
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });

    const { db } = await connectToDatabase();

    // 1. Fetch relevant IPs
    const userRegex = new RegExp(`^${userAddress}$`, 'i');
    const ips = await db.collection('ip_assets').find({
      $and: [
        { revenuePoolAppId: { $exists: true, $ne: null } },
        {
          $or: [
            { 'stakeholders.address': { $regex: userRegex } },
            { ownerWallet: { $regex: userRegex } }
          ]
        }
      ]
    }).toArray();

    const algodClient = getLocalClient();
    const currentPoolId = process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID; // ACTIVE POOL ID

    // 2. Fetch User's Wallet Assets
    let userAssets = [];
    try {
      const accountInfo = await algodClient.accountInformation(userAddress).do();
      userAssets = accountInfo.assets || [];
    } catch (err) {
      console.error('Failed to fetch account info:', err.message);
    }

    const claimableTokens = [];

    for (const ip of ips) {
      // FILTER: FLUSH OUT LEGACY MINTS
      // If the IP's pool ID doesn't match the current active Global Pool, skip it.
      if (currentPoolId && String(ip.revenuePoolAppId) !== String(currentPoolId)) {
        continue; 
      }

      let revenueTokenId = Number(ip.revenueTokenAssetId || ip.revenueTokenId);
      if (!revenueTokenId) continue;

      const stakeholder = ip.stakeholders?.find(s => 
        s.address && s.address.toLowerCase() === userAddress.toLowerCase()
      );

      if (!stakeholder) continue;

      // 3. Match Logic
      const userAsset = userAssets.find(a => Number(a['asset-id']) === revenueTokenId);
      const hasOptedIn = !!userAsset;

      const existingBalance = userAsset ? Number(userAsset.amount) : 0;

      // Standard: 100 Tokens Total.
      const allocated = Math.floor(Number(stakeholder.percentage)); // 80% = 80 tokens
      const claimableAmount = Math.max(0, allocated - existingBalance);

      claimableTokens.push({
        ipId: ip.id,
        ipName: ip.name,
        imageUrl: ip.imageUrl || ip.image,
        revenueTokenId,
        revenuePoolAppId: Number(ip.revenuePoolAppId),
        stakeholderPercentage: Number(stakeholder.percentage),
        allocatedTokens: allocated.toString(),
        existingBalance: existingBalance.toString(),
        claimableAmount: claimableAmount.toString(),
        rawClaimable: claimableAmount,
        hasOptedIn,
        needsOptIn: !hasOptedIn
      });
    }

    return NextResponse.json(safeJson({
      success: true,
      items: claimableTokens
    }));

  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userAddress, revenueTokenId } = body;
    if (!userAddress || !revenueTokenId) return NextResponse.json({ error: 'Missing reqs' }, { status: 400 });

    const algodClient = getLocalClient();
    const params = await algodClient.getTransactionParams().do();

    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: userAddress,
      receiver: userAddress,
      amount: 0,
      assetIndex: Number(revenueTokenId),
      suggestedParams: params
    });

    return NextResponse.json(safeJson({ 
        success: true, 
        transaction: Buffer.from(algosdk.encodeUnsignedTransaction(optInTxn)).toString('base64') 
    }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}