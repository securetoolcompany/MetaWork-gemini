import { NextResponse } from 'next/server';
import { getArcMetrics } from '../../../../../lib/tokenized-funds/galaxy-usdc-arc/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const metrics = await getArcMetrics();

  return NextResponse.json(
    metrics
      ? { metrics }
      : { error: 'Live vault metrics are temporarily unavailable.' },
    {
      status: metrics ? 200 : 502,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
