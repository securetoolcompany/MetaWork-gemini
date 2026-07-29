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
      .find({
        $or: [
          { ownerId: decoded.userId },
          { ownerId: new ObjectId(decoded.userId) }
        ]
      })
      .sort({ createdAt: -1 })
      .toArray();
    
    // JOIN with revenue_pools and products collections
    const enrichedAssets = await Promise.all(
      ipAssets.map(async (asset) => {
        // Fetch revenue pool data
        const revenuePool = await db.collection('revenue_pools').findOne({
          ipAssetId: asset.id
        });
        
        // Fetch products using this IP
        const products = await db.collection('products').find({ 
          'ipUsages.ipAssetId': asset.id 
        }).limit(20).toArray();
        
        // Calculate total units sold across all products
        const totalUnitsSold = products.reduce((sum, p) => sum + (p.sales || 0), 0);
        
        return {
          ...asset,
          id: asset._id.toString(),
          _id: asset._id.toString(),
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
          totalUnitsSold: totalUnitsSold,
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

    return NextResponse.json({ 
      success: true, 
      id: result.insertedId,
      txId 
    });
  } catch (error) {
    console.error('IP POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
