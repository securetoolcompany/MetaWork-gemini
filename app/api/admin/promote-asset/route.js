import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

function isAuthorized(request) {
  return request.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assetId, action } = await request.json();
  // action: "promote" | "fail"

  if (!assetId || !action) {
    return NextResponse.json({ error: 'assetId and action are required' }, { status: 400 });
  }

  const { db } = await connectToDatabase();
  const asset = await db.collection('ip_assets').findOne({ _id: new ObjectId(assetId) });
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  if (action === 'fail') {
    await db.collection('ip_assets').updateOne(
      { _id: new ObjectId(assetId) },
      { $set: { status: 'failed' } }
    );
    return NextResponse.json({ success: true, status: 'failed' });
  }

  if (action === 'promote') {
    // TODO: wire up mintIpAsset({ network: 'mainnet', manifest: asset.mintManifest })
    return NextResponse.json(
      { error: 'mainnet mint not yet implemented — wire up mintIpAsset first' },
      { status: 501 }
    );
  }

  return NextResponse.json({ error: 'Invalid action. Use "promote" or "fail"' }, { status: 400 });
}