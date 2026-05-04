import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getCredits } from '@/lib/credits';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    const decoded = verifyToken(authHeader.substring(7));
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    const balance = await getCredits(decoded.userId);
    return NextResponse.json({ success: true, credits: balance });
  } catch (error) {
    console.error('[credits/balance]', error);
    return NextResponse.json({ error: 'Failed to fetch credit balance' }, { status: 500 });
  }
}