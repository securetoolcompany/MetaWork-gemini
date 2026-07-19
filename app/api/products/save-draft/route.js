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

// ADD THIS LOG BLOCK HERE
console.log('[save-draft][template-shape]', {
  templateId,
  templateKeys: template ? Object.keys(template) : null,
  productid: template?.productid ?? null,
  product_id: template?.product_id ?? null,
  product: template?.product ?? null,
  available_variant_ids: template?.available_variant_ids ?? null,
  templatesCount: Array.isArray(template?.templates) ? template.templates.length : null,
  firstTemplateKeys: template?.templates?.[0] ? Object.keys(template.templates[0]) : null,
  firstPlacementsCount: Array.isArray(template?.templates?.[0]?.placements)
    ? template.templates[0].placements.length
    : null,
  firstPlacementSample: template?.templates?.[0]?.placements?.[0] ?? null,
  placementsCount: Array.isArray(template?.placements) ? template.placements.length : null,
firstPlacementKeys: template?.placements?.[0] ? Object.keys(template.placements[0]) : null,
firstPlacementLayerKeys: template?.placements?.[0]?.layers?.[0]
  ? Object.keys(template.placements[0].layers[0])
  : null,
firstPlacementSampleTopLevel: template?.placements?.[0] ?? null,
});

  const realProductId = template.product_id || template.productid || null;
  const availableVariants = template.available_variant_ids || [];
  if (!realProductId) throw new Error('Template missing productid');
  if (!availableVariants.length) throw new Error('Template has no available_variant_ids');
  const catalogId = realProductId;
  const variantId = availableVariants[0];

  // 2. Get product from DB - PRIORITIZE selectedIPs image data
  const product = await db.collection('products').findOne({ externalProductId: productId });
  
  // Build placement configs directly from the EDM template (preserves ALL placements)
  const templatePlacements = Array.isArray(template.placements)
    ? template.placements
    : (template.templates || []).flatMap(t => t.placements || []);
    const placementConfigs = templatePlacements
    .map(p => ({
      placement: p.placement,
      technique: p.technique || 'dtg',
      layers: (p.layers || [])
        .filter(l => l.image_url || l.url)
        .map(l => ({ type: 'file', url: l.image_url || l.url })),
    }))
    .filter(p => p.layers.length > 0);

    // ADD THIS LOG BLOCK HERE
console.log('[save-draft][placements-derived]', {
  templateId,
  templatePlacementsCount: templatePlacements.length,
  placementConfigsCount: placementConfigs.length,
  placementNames: placementConfigs.map(p => p.placement),
  firstPlacementConfig: placementConfigs[0] || null,
});

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
  const rawOptions = [
    ...(template.product_options || []).map(opt => ({
      id: opt.id || opt.name,
      value: opt.value,
    })),
    ...(Array.isArray(template.option_data?.[0])
      ? template.option_data[0]
      : template.option_data || []),
  ];

  const productOptions = rawOptions
    .map((opt) => ({
      name: opt?.id || opt?.name,
      value: opt?.value,
    }))
    .filter(
      (opt) =>
        opt.name &&
        opt.value !== undefined &&
        opt.value !== null &&
        opt.value !== ""
    );

  console.log('[save-draft][product-options-derived]', {
    templateId,
    rawOptions,
    productOptions,
  });

    // 5. CRITICAL FIX: Only create task if we have image + valid placement
  const body = {
    format: "png",
    products: [{
      source: "catalog",
      catalog_product_id: catalogId,
      catalog_variant_ids: [variantId],
      product_options: productOptions,
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
      const mockupUrl =
        statusData?.result?.catalog_variant_mockups?.[0]?.mockup_url ||
        statusData?.result?.mockups?.[0]?.url ||
        null;

      return { mockupUrl, placementConfigs };
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

        const mockupResult = await generatePrintfulMockup(
          externalProductId,
          printfulTemplateId
        );

        if (mockupResult) {
          await products.updateOne(
            { externalProductId },
            {
              $set: {
                mockupUrl: mockupResult.mockupUrl || null,
                printfulPlacementConfigs: mockupResult.placementConfigs || [],
              },
            }
          );
        }

        const updatedProduct = await products.findOne(
          { externalProductId },
          {
            projection: {
              externalProductId: 1,
              printfulTemplateId: 1,
              printfulPlacementConfigs: 1,
            },
          }
        );

        console.log('[save-draft][db-after-mockup-update]', {
          externalProductId,
          printfulTemplateId: updatedProduct?.printfulTemplateId ?? null,
          placementConfigsCount: updatedProduct?.printfulPlacementConfigs?.length ?? 0,
          firstPlacementConfig: updatedProduct?.printfulPlacementConfigs?.[0] ?? null,
        });

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