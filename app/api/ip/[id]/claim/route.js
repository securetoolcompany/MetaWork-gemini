import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    
    const decoded = verifyToken(token);
    const { id } = params;
    const { appId, amount } = await request.json();
    
    const { db } = await connectToDatabase();
    
    // Update revenue pool - move claimable to claimed
    await db.collection('revenue_pools').updateOne(
      { ipAssetId: _id },
      {
        $inc: {
          totalClaimed: amount,
          claimableAmount: -amount
        },
        $set: {
          lastClaimDate: new Date()
        }
      }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
