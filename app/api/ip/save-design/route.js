import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const {
      name,
      description,
      edmDesignData, // Expecting placement data from Printful Designer
      printfulProductId,
      // ... other fields
    } = body;

    // 1. Trigger Printful v2 Mockup Task
    let mockupTaskId = null;
if (printfulProductId && edmDesignData?.placements?.length) {
  // Only attempt mockup if at least one layer has a real URL
  const validPlacements = edmDesignData.placements
    .map(p => ({
      placement: p.placement,
      layers: (p.layers || [])
        .filter(l => l.url)  // ← skip null/empty URLs
        .map(l => ({ type: l.type || 'image', url: l.url, position: l.position }))
    }))
    .filter(p => p.layers.length > 0); // ← skip placements with no valid layers

  if (validPlacements.length > 0) {
    try {
      const v2Response = await fetch(`https://api.printful.com/v2/mockup-tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: [{
            catalog_product_id: parseInt(printfulProductId),
            placements: validPlacements,  // ← always a non-empty array or we skip
          }]
        }),
      });
      const taskData = await v2Response.json();
      if (!v2Response.ok) {
      console.error('v2 Mockup Task error:', v2Response.status, taskData);
    } else {
      mockupTaskId = taskData.data?.id;
    }
    } catch (e) {
      console.error('v2 Mockup Trigger Failed:', e);
    }
  }
  // If validPlacements.length === 0 → blank mockup path → mockupTaskId stays null (no crash)
}

    const { db } = await connectToDatabase();
    const ipAssetId = uuidv4();
    const ipAsset = {
      id: ipAssetId,
      ownerId: decoded.userId,
      name: name.trim(),
      mockupTaskId, 
      imageUrl: null,
      status: 'unlisted',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('ip_assets').insertOne(ipAsset);

    return NextResponse.json({ success: true, ipAssetId, mockupTaskId });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}