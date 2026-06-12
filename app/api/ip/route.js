import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import algosdk from 'algosdk';

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
    
    // Fetch IP assets
    const ipAssets = await db.collection('ip_assets')
      .find({ ownerId: decoded.userId })
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

// --- POST: Testnet mint → quarantine state ---
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { ipData, shareholders } = body;

    if (!ipData) {
      return NextResponse.json({ error: 'Missing IP data' }, { status: 400 });
    }

    // ── 1. Build mint manifest ────────────────────────────────────────────
    const mintManifest = {
      assetName:        ipData.title || ipData.name,
      unitName:         ipData.unitName || 'MWIP',
      metadataUri:      ipData.metadataUri || null,
      imageUri:         ipData.image || ipData.imageUrl || null,
      ipIdentifier:     ipData.ipIdentifier || ipData.id || null,
      shareholders:     shareholders || [],
      poolKey:          ipData.poolKey || null,
      poolCreationParams: ipData.poolCreationParams || null,
    };

    // ── 2. Testnet mint (stub — wire up revenue_pool_v6 here) ─────────────
    // TODO: call mintIpAsset({ network: 'testnet', manifest: mintManifest })
    // For now we record the quarantine state without a live testnet mint
    // so the DB flow can be tested end-to-end independently.
    const testnetAssetId = null;  // replace with real result when wired up
    const testnetAppId   = process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID || null;

    // ── 3. Persist quarantine record ──────────────────────────────────────
    const { db } = await connectToDatabase();
    const clearsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const newAsset = {
      ...ipData,
      imageUrl:           ipData.image || ipData.imageUrl,
      ownerId:            decoded.userId,
      createdAt:          new Date().toISOString(),

      // lifecycle fields
      status:             'quarantine',
      clearsAt:           clearsAt,
      testnetAssetId:     testnetAssetId,
      testnetAppId:       testnetAppId ? String(testnetAppId) : null,
      mainnetAssetId:     null,
      mainnetAppId:       null,
      mintManifest:       mintManifest,
      promotionAttempts:  0,
      lastPromotionError: null,
    };

    const result = await db.collection('ip_assets').insertOne(newAsset);

    // ── 4. Return public-safe response ────────────────────────────────────
    return NextResponse.json({
      success:  true,
      id:       result.insertedId,
      status:   'quarantine',
      clearsAt: clearsAt.toISOString(),
      name:     mintManifest.assetName,
      image:    mintManifest.imageUri,
      message:  'Asset is pending verification. It will go live within 48 hours.',
    }, { status: 201 });

  } catch (error) {
    console.error('IP POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}