import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    const decoded = verifyToken(token);
    const body = await request.json();

    // Determine technique from synced DB data, fallback to dtg
    const preferredTechnique = body.blankData?.printTechniques?.[0] || 'dtg';

    const v2Res = await fetch('https://api.printful.com/v2/mockup-tasks', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        format: 'jpg',
        products: [{
          source: 'catalog',
          catalog_product_id: Number(body.catalogProductId),
          catalog_variant_ids: body.edmDesignData.variant_ids || [],
          placements: body.edmDesignData.placements?.map(p => ({
            placement: p.placement,
            technique: preferredTechnique,
            layers: p.layers?.map(l => ({ type: 'file', url: l.url, position: l.position }))
          }))
        }]
      })
    });
    
    const taskData = await v2Res.json();
    const { db } = await connectToDatabase();
    
    await db.collection('products').insertOne({
      ...body,
      userId: decoded.userId,
      techniqueUsed: preferredTechnique,
      mockupTaskId: taskData.data?.id,
      createdAt: new Date()
    });

    return NextResponse.json({ success: true, taskId: taskData.data?.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}