// app/api/cron/sync-printful/route.js

import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { syncPrintfulCatalogWithAvailability } from '../../../../scripts/sync-printful-once';

export const maxDuration = 300; // 5 minutes for cron
export const dynamic = 'force-dynamic';

export async function GET(req) {
  // 1. Security check using CRON_SECRET
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    console.log('🔄 Automated Printful Catalog Sync Started (cron)');

    const client = await clientPromise;
    const result = await syncPrintfulCatalogWithAvailability(client);

    return NextResponse.json({
      success: true,
      message: 'Printful catalog + availability sync completed.',
      summary: result
    });
  } catch (error) {
    console.error('[cron/sync-printful] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}