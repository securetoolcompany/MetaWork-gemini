import { NextResponse } from 'next/server';
// Note: You may need to move your sync script logic into a lib folder 
// or simply paste the logic inside this GET function.
import { MongoClient } from 'mongodb';

export const maxDuration = 300; // 5 minutes (critical for catalog sync)
export const dynamic = 'force-dynamic';

export async function GET(req) {
  // 1. Security Check (Matches the CRON_SECRET you set in Vercel)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    console.log('🔄 Automated Sync Started');

    // 2. Paste your 'syncPrintfulCatalog' logic here 
    // or call the function if you exported it from your script file.
    
    // For now, we return a success message so you can verify the route works.
    return NextResponse.json({ 
      success: true, 
      message: 'Sync triggered. Monitoring via logs.' 
    });

  } catch (error) {
    console.error('❌ Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}