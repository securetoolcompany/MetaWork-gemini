import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient } from '@/lib/algorand';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { safeJson } from '@/lib/utils';

/**
 * POST /api/ip/repair-tokens
 * Repair missing revenue token IDs by querying on-chain pool state
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const token = authHeader?.replace('Bearer ', '') || cookieToken;

    if (!token) return NextResponse.json({ error: 'Authorization required' }, { status: 401 });

    const user = verifyToken(token);
    if (!user || !user.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();

    // FIX: Use correct ownerId field and support legacy 'owner' field
    const ipsToRepair = await db.collection('ip_assets').find({
      $or: [{ ownerId: user.userId }, { owner: user.userId }],
      revenuePoolAppId: { $exists: true, $ne: null },
      $or: [
        { revenueTokenAssetId: { $exists: false } },
        { revenueTokenAssetId: null },
        { revenueTokenAssetId: 0 },
        { revenueTokenId: { $exists: false } }, // Legacy field
        { revenueTokenId: null },
        { revenueTokenId: 0 }
      ]
    }).toArray();

    console.log(`[repair-tokens] Found ${ipsToRepair.length} IPs to repair for user ${user.userId}`);

    const repaired = [];
    const failed = [];

    for (const ip of ipsToRepair) {
      const poolAppId = Number(ip.revenuePoolAppId);
      let revenueTokenId = null;
      let repairMethod = '';

      try {
        console.log(`[repair-tokens] Checking pool ${poolAppId} for IP "${ip.name}"`);

        // METHOD 1: Check Global State
        try {
          const appInfo = await algodClient.getApplicationByID(poolAppId).do();
          const globalState = appInfo.params?.['global-state'] || [];

          for (const item of globalState) {
            const key = Buffer.from(item.key, 'base64').toString();
            if (['rev_token_id', 'token_id', 'asset_id'].includes(key)) {
              const val = Number(item.value.uint);
              if (val > 0) {
                revenueTokenId = val;
                repairMethod = 'Global State';
                break;
              }
            }
          }
        } catch (gsError) {
          console.warn(`[repair-tokens] Global state check failed: ${gsError.message}`);
        }

        // METHOD 2: Check Created Assets (Fallback)
        // If the pool created the token, it MUST be in the app account's created-assets list
        if (!revenueTokenId) {
          try {
            const appAddress = algosdk.getApplicationAddress(poolAppId);
            const accountInfo = await algodClient.accountInformation(appAddress).do();
            const createdAssets = accountInfo['created-assets'] || [];

            if (createdAssets.length > 0) {
              // The pool is designed to create exactly one revenue token
              revenueTokenId = Number(createdAssets[0].index);
              repairMethod = 'App Account Created Assets';
            }
          } catch (acctError) {
             console.warn(`[repair-tokens] Account check failed: ${acctError.message}`);
          }
        }

        // UPDATE DB if found
        if (revenueTokenId && revenueTokenId > 0) {
          await db.collection('ip_assets').updateOne(
            { id: ip.id },
            { 
              $set: { 
                revenueTokenAssetId: revenueTokenId,
                revenueTokenId: revenueTokenId,
                status: 'minted' 
              }
            }
          );

          console.log(`[repair-tokens] SUCCESS: Repaired IP "${ip.name}" with Token ID ${revenueTokenId}`);
          repaired.push({ ipId: ip.id, revenueTokenId, method: repairMethod });
        } else {
          failed.push({ ipId: ip.id, reason: 'Token ID not found on-chain' });
        }
      } catch (err) {
        failed.push({ ipId: ip.id, reason: err.message });
      }
    }

    return NextResponse.json(safeJson({
      success: true,
      repairedCount: repaired.length,
      failedCount: failed.length,
      repaired,
      failed
    }));

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}