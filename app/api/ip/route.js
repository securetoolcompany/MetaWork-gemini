import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import {
  getAlgodClient,
  waitForConfirmation,
} from '@/lib/algorand';

export const dynamic = 'force-dynamic';

// --- GET: Fetch IPs for the logged-in user ---
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.substring(7) ||
      request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Auth required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const userId = decoded.userId;
    const ownerFilter = { $or: [{ ownerId: userId }] };

    if (ObjectId.isValid(userId)) {
      ownerFilter.$or.push({ ownerId: new ObjectId(userId) });
    }

    const ipAssets = await db
      .collection('ip_assets')
      .find(ownerFilter)
      .sort({ createdAt: -1 })
      .toArray();

    const enrichedAssets = await Promise.all(
      ipAssets.map(async (asset) => {
        const revenuePool = await db
          .collection('revenue_pools')
          .findOne({ ipAssetId: asset.id });

        const products = await db
          .collection('products')
          .find({ 'ipUsages.ipAssetId': asset.id })
          .limit(20)
          .toArray();

        const totalUnitsSold = products.reduce(
          (sum, product) => sum + (product.sales || 0),
          0
        );

        return {
          ...asset,
          mongoId: asset._id.toString(),
          _id: asset._id.toString(),
          id:
            asset.id ||
            asset.ipId ||
            asset.tokenizedIpId ||
            asset.assetId ||
            asset._id.toString(),
          imageUrl: asset.imageUrl || asset.image || '',
          revenuePool: revenuePool || {
            claimableAmount: 0,
            accumulatedRevenue: 0,
            totalDeposited: 0,
            totalClaimed: 0,
            appId: asset.revenuePoolAppId,
          },
          usageCount: products.length || 0,
          earnings: revenuePool?.accumulatedRevenue || 0,
          totalUnitsSold,
          products: products.map((product) => ({
            id: product.id || product._id.toString(),
            title: product.title || product.name,
            price: product.price || 0,
            sales: product.sales || 0,
            thumbnailUrl: product.thumbnailUrl || product.imageUrl,
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      ipAssets: enrichedAssets,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// --- POST: Save new IP to DB after MainNet blockchain success ---
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.substring(7) ||
      request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Auth required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { signedTxns, ipData } = body;

    if (!ipData?.id) {
      return NextResponse.json(
        { error: 'Missing IP asset id' },
        { status: 400 }
      );
    }

    if (!Array.isArray(signedTxns) || signedTxns.length === 0) {
      return NextResponse.json(
        { error: 'Missing signed transactions' },
        { status: 400 }
      );
    }

    const binaryTxs = signedTxns.map((tx) =>
      new Uint8Array(Buffer.from(tx, 'base64'))
    );

    const algodClient = getAlgodClient('mainnet');

    const { txid } = await algodClient
      .sendRawTransaction(binaryTxs)
      .do();

    await waitForConfirmation(txid, 4, 'mainnet');

    const { db } = await connectToDatabase();

    const newAsset = {
      ...ipData,
      imageUrl: ipData.image,
      ownerId: decoded.userId,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    const result = await db
      .collection('ip_assets')
      .insertOne(newAsset);

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
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      id: newAsset.id,
      mongoId: result.insertedId,
      txId: txid,
    });
  } catch (error) {
    console.error('IP POST Error:', error);

    return NextResponse.json(
      { error: error.message || 'Failed to save IP asset' },
      { status: 500 }
    );
  }
}