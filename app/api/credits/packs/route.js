import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const packs = await db
      .collection('creditPacks')
      .find({ active: true })
      .sort({ sortOrder: 1 })
      .toArray();
    return NextResponse.json({ success: true, packs });
  } catch (error) {
    console.error('[credits/packs]', error);
    return NextResponse.json({ error: 'Failed to fetch packs' }, { status: 500 });
  }
}