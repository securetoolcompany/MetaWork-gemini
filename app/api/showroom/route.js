import { NextResponse } from 'next/server';
import { connectToDatabase, normalizeIds } from '@/lib/mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // Support both legacy products and new products while strictly excluding drafts
    const productFilter = {
      isDraft: { $ne: true }, // Explicitly hide new drafts
      status: { $ne: 'draft' }, // Hide legacy drafts just in case
      $or: [
        { showroomListed: true }, // New product visibility tag
        { status: { $in: ['live', 'active'] } }, // Legacy visibility tag
        { isPublic: true } // Standard fallback
      ]
    };

    // parallel fetch from the three source collections
    const [products, aisles, ipAssets] = await Promise.all([
      db.collection('products').find(productFilter).toArray(),
      db.collection('aisles').find({}).toArray(),
      db.collection('ip_assets').find({}).toArray() // FIXED NAME HERE
    ]);

    // Add explicit type tags to make the frontend's job easy
    const normalizedData = [
      ...normalizeIds(products).map(p => ({ ...p, type: 'product' })),
      ...normalizeIds(aisles).map(a => ({ ...a, type: 'aisle' })),
      ...normalizeIds(ipAssets).map(i => ({ ...i, type: 'ip' }))
    ];

    console.log(`📡 SHOWROOM SYNC: P(${products.length}) A(${aisles.length}) IP(${ipAssets.length})`);

    return NextResponse.json(normalizedData);
  } catch (error) {
    console.error("❌ SHOWROOM API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}