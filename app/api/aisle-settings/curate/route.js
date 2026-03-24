import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    const decoded = verifyToken(token);
    const { productId, action, mockupIndex } = await request.json();
    const { db } = await connectToDatabase();

    const user = await db.collection('users').findOne({ _id: decoded.userId });
    let approved = user.aisleSettings?.approvedCommunityProducts || [];

    if (action === 'approve') {
      // Add if not already there
      if (!approved.find(p => p.productId === productId)) {
        approved.push({ productId, primaryMockupIndex: mockupIndex || 0 });
      }
    } else if (action === 'deny') {
      approved = approved.filter(p => p.productId !== productId);
    } else if (action === 'update_mockup') {
      approved = approved.map(p => 
        p.productId === productId ? { ...p, primaryMockupIndex: mockupIndex } : p
      );
    }

    await db.collection('users').updateOne(
      { _id: decoded.userId },
      { $set: { 'aisleSettings.approvedCommunityProducts': approved } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}