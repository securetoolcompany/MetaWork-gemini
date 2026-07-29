// app/api/cron/sync-printful/route.js

import { NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes for cron
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Stubbed response for now to keep builds green.
  // TODO: Re-wire sync-printful-once.js as a proper module export.
  return NextResponse.json({
    success: true,
    message: 'Printful catalog sync endpoint is currently disabled.',
  });
}