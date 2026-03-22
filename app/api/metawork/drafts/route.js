import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Retrieve a draft design to resume
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const externalProductId = searchParams.get('id');

    if (!externalProductId) {
      return NextResponse.json({ error: 'Missing draft ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const draft = await db.collection('draft_designs').findOne({ externalProductId });

    if (!draft) {
      return NextResponse.json({ success: false, message: 'Draft not found' });
    }

    return NextResponse.json({ success: true, draft });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: Save or Update a draft design
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    const decoded = verifyToken(token);
    const body = await request.json();

    const { db } = await connectToDatabase();
    
    const draftData = {
      externalProductId: body.externalProductId,
      userId: decoded.userId,
      catalogProductId: body.catalogProductId,
      productName: body.productName,
      selectedIPs: body.selectedIPs || [],
      // We store the EDM payload so we can re-inject it if needed
      edmDesignData: body.edmDesignData || null,
      updatedAt: new Date(),
    };

    await db.collection('draft_designs').updateOne(
      { externalProductId: body.externalProductId },
      { $set: draftData, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}