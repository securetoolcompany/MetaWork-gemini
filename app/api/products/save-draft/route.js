import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

async function generatePrintfulMockup(productId, templateId) {
  const token = process.env.PRINTFUL_API_KEY;
  const storeId = process.env.PRINTFUL_STORE_ID || 18472468;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-PF-Store-ID': storeId,
  };

  const { db } = await connectToDatabase();

  // 1. Get template FIRST
  const templateRes = await fetch(`https://api.printful.com/product-templates/${templateId}`, { headers });
  const templateData = await templateRes.json();
  if (!templateRes.ok) throw new Error(`Template fetch failed: ${JSON.stringify(templateData)}`);
  const template = templateData.result;

  const realProductId = template.productid;
  const availableVariants = template.available_variant_ids || [];
  if (!realProductId) throw new Error('Template missing productid');
  if (!availableVariants.length) throw new Error('Template has no available_variant_ids');
  const catalogId = realProductId;
  const variantId = availableVariants[0];

  // 2. Get product from DB - PRIORITIZE selectedIPs image data
  const product = await db.collection('products').findOne({ externalProductId: productId });
  
  // Build placement configs directly from the EDM template (preserves ALL placements)
  const templatePlacements = (template.templates || []).flatMap(t => t.placements || []);
  const placementConfigs = templatePlacements
    .map(p => ({
      placement: p.placement,
      technique: p.technique || 'dtg',
      layers: (p.layers || [])
        .filter(l => l.type === 'image' && (l.image_url || l.url))
        .map(l => ({ type: 'file', url: l.image_url || l.url })),
    }))
    .filter(p => p.layers.length > 0);

  // Fallback ONLY if EDM template had zero image layers anywhere (legacy/manual path)
  if (placementConfigs.length === 0 && product?.selectedIPs?.[0]) {
    const ip = product.selectedIPs[0];
    const fallbackUrl = ip.publicUrl || ip.thumbnailUrl || ip.url || ip.imageUrl || null;
    if (fallbackUrl) {
      placementConfigs.push({ placement: 'front', technique: 'dtg', layers: [{ type: 'file', url: fallbackUrl }] });
    }
  }

  console.log('PLACEMENT DEBUG:', { placementConfigs, selectedIPs: product?.selectedIPs?.[0] });

  if (placementConfigs.length === 0) {
    console.warn('❌ No placements with images found in template OR selectedIPs');
    return null;
  }

  // 3. Build product options from template
  const allOptions = [
    ...(template.product_options || []).map(opt => ({ id: opt.id || opt.name, value: opt.value })),
    ...(Array.isArray(template.option_data?.[0]) ? template.option_data[0] : template.option_data || [])
  ];
  const stitchColor = allOptions.find(opt => opt.id === "stitch_color")?.value || "white";

    // 5. CRITICAL FIX: Only create task if we have image + valid placement
  const body = {
    format: "png",
    products: [{
      source: "catalog",
      catalog_product_id: catalogId,
      catalog_variant_ids: [variantId],
      product_options: [{ name: "stitch_color", value: stitchColor }],
      placements: placementConfigs,
    }]
  };

  // 6. Create + poll task
  const taskRes = await fetch('https://api.printful.com/v2/mockup-tasks', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const taskData = await taskRes.json();
  if (!taskRes.ok) throw new Error(`Task creation failed: ${JSON.stringify(taskData)}`);

  // Poll for completion
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 15000));
    const statusRes = await fetch(`https://api.printful.com/v2/mockup-tasks?id=${taskData.result.id}`, { headers });
    const statusData = await statusRes.json();
    
    if (statusData.result.status === 'completed') {
      return { mockupUrl: statusData.result.catalog_variant_mockups[0].mockup_url, placementConfigs };
    }
  }
  throw new Error('Mockup generation timeout (3min)');
}

const ENSURE_SYNC_PATH = '/api/products/ensure-sync';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // 1) Auth like your other routes
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.substring(7) ||
      request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // 2) Body from client
    const body = await request.json();
    const {
      externalProductId,
      printfulTemplateId,
      selectedIPs,
      baseProduct,
      name,
      costAnalysis,
    } = body;

    if (!externalProductId || !baseProduct) {
      return NextResponse.json(
        { error: 'externalProductId and baseProduct are required' },
        { status: 400 }
      );
    }

    // 3) DB connection
    const { db } = await connectToDatabase();
    const products = db.collection('products');

    const now = new Date();

    // 4) Upsert draft for this user
    const existingProduct = await products.findOne({
      userId: decoded.userId,
      externalProductId,
    });

    const result = await products.findOneAndUpdate(
      {
        userId: decoded.userId,
        externalProductId,
      },
      {
        $set: {
          userId: decoded.userId,
          externalProductId,
          printfulTemplateId: printfulTemplateId || null,
          selectedIPs: selectedIPs || [],
          baseProduct,
          name: name || baseProduct?.name || 'Untitled Design',
          costAnalysis: costAnalysis || null,
          status: 'draft',
          printfulSyncProductId: existingProduct?.printfulSyncProductId || null,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    // Generate mockup if template provided
    if (printfulTemplateId) {
      try {
        console.log('🔍 Generating mockup...', {
          externalProductId,
          templateId: printfulTemplateId,
          userId: decoded.userId
        });
        const mockupResult = await generatePrintfulMockup(externalProductId, printfulTemplateId);
        await products.updateOne(
          { externalProductId },
          { $set: { mockupUrl: mockupResult?.mockupUrl, printfulPlacementConfigs: mockupResult?.placementConfigs || [] } }
        );
        console.log('✅ Mockup generated:', mockupResult?.mockupUrl);
      } catch (e) {
        console.warn('Mockup failed:', e.message);
      }
    } else {
      console.log('⚠️ Skipping mockup – no printfulTemplateId');
    }

    // Fire-and-forget: trigger sync product + mockup generation
    try {
      const vercelUrl = process.env.VERCEL_URL;
      const publicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      const baseUrl =
        publicBaseUrl ||
        (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000');

      fetch(`${baseUrl}${ENSURE_SYNC_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Reuse the same auth token so the route can identify the user
          'Authorization': authHeader || `Bearer ${token}`,
        },
        body: JSON.stringify({ externalProductId }),
      }).catch((err) => {
        console.error('Failed to trigger ensure-sync:', err);
      });
    } catch (err) {
      console.error('Error scheduling ensure-sync:', err);
    }

    return NextResponse.json(
      {
        success: true,
        draftId: result.value?._id?.toString(),
        externalProductId,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('❌ save-draft error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to save draft' },
      { status: 500 }
    );
  }
}