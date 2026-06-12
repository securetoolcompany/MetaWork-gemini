import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

function isAuthorized(request) {
  return request.headers.get('x-cron-secret') === process.env.CRON_SECRET;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { db } = await connectToDatabase();
  const now = new Date();

  // Find quarantined assets whose window has expired and not yet promoted
  const candidates = await db.collection('ip_assets').find({
    status:          'quarantine',
    clearsAt:        { $lte: now },
    mainnetAssetId:  null,
  }).toArray();

  const results = { promoted: [], failed: [] };

  for (const asset of candidates) {
    try {
      // TODO: replace this stub with real mintIpAsset({ network: 'mainnet', manifest: asset.mintManifest })
      // const { assetId: mainnetAssetId, appId: mainnetAppId } =
      //   await mintIpAsset({ network: 'mainnet', manifest: asset.mintManifest });

      // Stub values for local testing — remove when mint is wired up
      throw new Error('mintIpAsset mainnet stub — not yet implemented');

    } catch (err) {
      console.error(`[Cron] Promotion failed for ${asset._id}:`, err.message);

      await db.collection('ip_assets').updateOne(
        { _id: new ObjectId(asset._id) },
        {
          $inc: { promotionAttempts: 1 },
          $set: { lastPromotionError: err.message },
        }
      );

      results.failed.push({ id: asset._id, error: err.message });
    }
  }

  return NextResponse.json({
    processed:  candidates.length,
    promoted:   results.promoted,
    failed:     results.failed,
    timestamp:  now.toISOString(),
  });
}