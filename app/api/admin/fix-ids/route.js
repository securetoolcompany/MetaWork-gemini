import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Guard against missing Mongo env at request time (not at module top-level)
  if (!process.env.MONGO_URL) {
    return NextResponse.json(
      { success: false, error: 'MONGO_URL not configured' },
      { status: 500 }
    );
  }

  try {
    const NEW_POOL_ID = process.env.NEXT_PUBLIC_REVENUE_POOL_APP_ID;

    if (!NEW_POOL_ID) {
      return NextResponse.json(
        { success: false, error: 'No New Pool ID found in .env' },
        { status: 500 }
      );
    }

    console.log('[Fix-DB] Connecting to MongoDB...');
    const { db } = await connectToDatabase();

    console.log(`[Fix-DB] Updating IPs to target pool: ${NEW_POOL_ID}`);

    // Update all IP assets that have a revenuePoolAppId and it's not the new one
    const result = await db.collection('ip_assets').updateMany(
      {
        revenuePoolAppId: { $exists: true, $ne: NEW_POOL_ID },
      },
      {
        $set: { revenuePoolAppId: NEW_POOL_ID },
      }
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Database Migration Complete',
        matched_documents: result.matchedCount,
        modified_documents: result.modifiedCount,
        target_pool_id: NEW_POOL_ID,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('Fix ID Error:', e);
    return NextResponse.json(
      {
        success: false,
        error: e.message,
        stack: e.stack,
      },
      { status: 500 }
    );
  }
}