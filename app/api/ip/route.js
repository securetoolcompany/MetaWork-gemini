import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import algosdk from 'algosdk';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

// --- GET: Fetch IPs for the logged-in user ---
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    
    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    
    const { db } = await connectToDatabase();
    
    // Fetch IP assets for this user, supporting string and ObjectId ownerId
    const userId = decoded.userId;
    const ownerFilter = { $or: [{ ownerId: userId }] };

    if (ObjectId.isValid(userId)) {
      ownerFilter.$or.push({ ownerId: new ObjectId(userId) });
    }

    // Fetch IP assets for this user (string or ObjectId ownerId)
    const ipAssets = await db.collection('ip_assets')
      .find(ownerFilter)
      .sort({ createdAt: -1 })
      .toArray();

      console.log(
        '[API/IP] raw ip_assets',
        ipAssets.map((asset) => ({
          name: asset.name,
          mongoId: asset._id?.toString?.() || asset._id,
          id: asset.id,
          ipId: asset.ipId,
          tokenizedIpId: asset.tokenizedIpId,
          assetId: asset.assetId,
          revenuePoolAppId: asset.revenuePoolAppId,
          ownerId: asset.ownerId,
        }))
      );
    
    // JOIN with revenue_pools and products collections
    const enrichedAssets = await Promise.all(
      ipAssets.map(async (asset) => {
        // Fetch revenue pool data
        const revenuePool = await db.collection('revenue_pools').findOne({
          ipAssetId: asset.id
        });

        console.log('[API/IP] revenue pool match', {
          assetName: asset.name,
          lookupIpAssetId: asset.id,
          foundRevenuePool: !!revenuePool,
          revenuePoolIpAssetId: revenuePool?.ipAssetId,
          revenuePoolAppId: revenuePool?.appId || revenuePool?.revenuePoolAppId,
        });
        
        // Fetch products using this IP
        const products = await db.collection('products').find({ 
          'ipUsages.ipAssetId': asset.id 
        }).limit(20).toArray();
        
        // Calculate total units sold across all products
        const totalUnitsSold = products.reduce((sum, p) => sum + (p.sales || 0), 0);
        
        const resolvedId =
          asset.id || asset.ipId || asset.tokenizedIpId || asset.assetId || asset._id?.toString?.();

        console.log('[API/IP] enriched asset', {
          name: asset.name,
          mongoId: asset._id?.toString?.(),
          outgoingId: resolvedId,
          originalId: asset.id,
          ipId: asset.ipId,
          tokenizedIpId: asset.tokenizedIpId,
          assetId: asset.assetId,
          revenuePoolAppId: asset.revenuePoolAppId,
          revenuePoolIpAssetId: revenuePool?.ipAssetId,
          resolveCandidateOrder: {
            ipId: asset.ipId,
            tokenizedIpId: asset.tokenizedIpId,
            assetId: asset.assetId,
            id: asset.id,
            _id: asset._id?.toString?.(),
          },
        });

        return {
          ...asset,
          mongoId: asset._id.toString(),
          _id: asset._id.toString(),
          id: asset.id || asset.ipId || asset.tokenizedIpId || asset.assetId || asset._id.toString(),
          imageUrl: asset.imageUrl || asset.image || "",
          revenuePool: revenuePool || {
            claimableAmount: 0,
            accumulatedRevenue: 0,
            totalDeposited: 0,
            totalClaimed: 0,
            appId: asset.revenuePoolAppId
          },
          usageCount: products.length || 0,
          earnings: revenuePool?.accumulatedRevenue || 0,
          totalUnitsSold,
          products: products.map(p => ({
            id: p.id || p._id.toString(),
            title: p.title || p.name,
            price: p.price || 0,
            sales: p.sales || 0,
            thumbnailUrl: p.thumbnailUrl || p.imageUrl
          }))
        };
      })
    );
    
    return NextResponse.json({ success: true, ipAssets: enrichedAssets });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- POST: Save New IP to DB after Blockchain Success ---
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { signedTxns, ipData } = body;
    if (!ipData?.id) {
      return NextResponse.json({ error: 'Missing IP asset id' }, { status: 400 });
    }

    if (!signedTxns || !ipData) {
      return NextResponse.json({ error: 'Missing signed transactions or IP data' }, { status: 400 });
    }

    // 1. Submit Signed Transactions to Algorand
    const binaryTxs = signedTxns.map(tx => new Uint8Array(Buffer.from(tx, 'base64')));
    const { txId } = await algodClient.sendRawTransaction(binaryTxs).do();

    // Wait for confirmation
    await algosdk.waitForConfirmation(algodClient, txId, 4);

    // 2. Prepare the Asset Document for MongoDB
    const { db } = await connectToDatabase();
    const newAsset = {
      ...ipData,
      imageUrl: ipData.image,
      ownerId: decoded.userId,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    // 3. ACTUAL WRITE TO DATABASE
    const result = await db.collection('ip_assets').insertOne(newAsset);

    // 4. CREATE / UPSERT MATCHING REVENUE POOL RECORD
    await db.collection('revenue_pools').updateOne(
      { ipAssetId: newAsset.id },
      {
        $set: {
          updatedAt: new Date().toISOString(),
          appId: newAsset.revenuePoolAppId || null,
          revenuePoolAppId: newAsset.revenuePoolAppId || null,
        },
        $setOnInsert: {
          ipAssetId: newAsset.id,
          ownerId: decoded.userId,
          claimableAmount: 0,
          accumulatedRevenue: 0,
          totalDeposited: 0,
          totalClaimed: 0,
          createdAt: new Date().toISOString(),
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      id: newAsset.id,
      mongoId: result.insertedId,
      txId
    });
  } catch (error) {
    console.error('IP POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
