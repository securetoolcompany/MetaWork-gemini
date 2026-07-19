import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

// Refactored to fire-and-forget or execute rapidly without polling bottlenecks
async function generatePrintfulMockup(productId, templateId) {
  const token = process.env.PRINTFUL_API_KEY;
  const storeId = process.env.PRINTFUL_STORE_ID || 18472468;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-PF-Store-ID': storeId,
  };

  const { db } = await connectToDatabase();

  // 1. Get template FIRST (Fast GET request)
  const templateRes = await fetch(`https://api.printful.com/product-templates/${templateId}`, { headers });
  const templateData = await templateRes.json();
  if (!templateRes.ok) throw new Error(`Template fetch failed: ${JSON.stringify(templateData)}`);
  const template = templateData.result;

  const realProductId = template.product_id || template.productid || null;
  const availableVariants = template.available_variant_ids || [];
  if (!realProductId) throw new Error('Template missing productid');
  if (!availableVariants.length) throw new Error('Template has no available_variant_ids');
  const catalogId = realProductId;
  const variantId = availableVariants[0];

  // 2. Get product from DB
  const product = await db.collection('products').findOne({ externalProductId: productId });
  
  const templatePlacements = Array.isArray(template.placements)
    ? template.placements
    : (template.templates || []).flatMap(t => t.placements || []);

  const placementConfigs = templatePlacements
    .map(p => {
      let rawLayers = p.layers || [];
      if (!rawLayers.length && p.options) {
        const fileOption = p.options.find(o => o.value && (String(o.value).includes('http') || o.id === 'item_url'));
        if (fileOption) rawLayers = [{ image_url: fileOption.value }];
      }

      const validLayers = rawLayers
        .filter(l => l && (l.image_url || l.url || l.item_url))
        .map(l => ({ 
          type: 'file', 
          url: l.image_url || l.url || l.item_url 
        }));

      let determinedTechnique = p.technique_key || p.technique;
      if (!determinedTechnique) {
        const displayName = String(p.display_name || '').toLowerCase();
        const techniqueDisplay = String(p.technique_display_name || '').toLowerCase();
        if (displayName.includes('embroidery') || techniqueDisplay.includes('embroider')) {
          determinedTechnique = 'EMBROIDERY';
        } else if (techniqueDisplay.includes('all-over') || techniqueDisplay.includes('sublimation')) {
          determinedTechnique = 'CUT-SEW';
        } else {
          determinedTechnique = 'dtg';
        }
      }

      return {
        placement: p.placement,
        technique: determinedTechnique,
        layers: validLayers,
      };
    })
    .filter(p => p.layers.length > 0);

  // Fallback ONLY if EDM template had zero image layers anywhere
  if (placementConfigs.length === 0 && product?.selectedIPs?.[0]) {
    const ip = product.selectedIPs[0];
    const fallbackUrl = ip.publicUrl || ip.thumbnailUrl || ip.url || ip.imageUrl || null;
    
    if (fallbackUrl) {
      let baseTemplateTechnique = templatePlacements[0]?.technique_key || templatePlacements[0]?.technique;
      if (!baseTemplateTechnique && templatePlacements[0]) {
        const techniqueDisplay = String(templatePlacements[0].technique_display_name || '').toLowerCase();
        if (techniqueDisplay.includes('all-over') || techniqueDisplay.includes('sublimation')) {
          baseTemplateTechnique = 'CUT-SEW';
        } else if (techniqueDisplay.includes('embroider')) {
          baseTemplateTechnique = 'EMBROIDERY';
        }
      }
      if (!baseTemplateTechnique) baseTemplateTechnique = 'dtg';

      const placementTargets = templatePlacements.length > 0 
        ? templatePlacements.map(tp => tp.placement)
        : ['front', 'back'];

      placementTargets.forEach(placementName => {
        placementConfigs.push({
          placement: placementName,
          technique: baseTemplateTechnique,
          layers: [{ type: 'file', url: fallbackUrl }]
        });
      });
    }
  }

  if (placementConfigs.length === 0) {
    console.warn('❌ No placements with images found in template OR selectedIPs');
    return { mockupUrl: null, placementConfigs: [] };
  }

  // Build options blueprint
  const allowedProductOptions = Array.isArray(template.product?.options)
    ? template.product.options.map(o => String(o.id || o.name).toLowerCase())
    : [];

  const rawOptions = [
    ...(template.product_options || []).map(opt => ({ id: opt.id || opt.name, value: opt.value })),
    ...(Array.isArray(template.option_data?.[0]) ? template.option_data[0] : template.option_data || []),
  ];

  const productOptions = rawOptions
    .map((opt) => ({ name: opt?.id || opt?.name, value: opt?.value }))
    .filter((opt) => {
      if (!opt.name || opt.value === undefined || opt.value === null || opt.value === "") return false;
      if (allowedProductOptions.length === 0) {
        const isEmbroideryTech = placementConfigs.some(p => p.technique === 'EMBROIDERY');
        if (!isEmbroideryTech && (opt.name.includes('thread') || opt.name.includes('stitch'))) return false;
        return true;
      }
      return allowedProductOptions.includes(String(opt.name).toLowerCase());
    });

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

  // Dispatch the generation task asynchronously, but DO NOT poll it synchronously
  try {
    fetch('https://api.printful.com/v2/mockup-tasks', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    }).catch(err => console.error('Background mockup task error:', err));
  } catch (err) {
    console.error('Failed to dispatch async mockup task:', err);
  }

  // Return parsed configurations immediately so the database can update instantly
  return { mockupUrl: template.mockup_file_url || null, placementConfigs };
}

const ENSURE_SYNC_PATH = '/api/products/ensure-sync';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

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
      return NextResponse.json({ error: 'externalProductId and baseProduct are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const products = db.collection('products');
    const now = new Date();

    const existingProduct = await products.findOne({
      userId: decoded.userId,
      externalProductId,
    });

    const result = await products.findOneAndUpdate(
      { userId: decoded.userId, externalProductId },
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
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Process layouts instantly without executing 3-minute polling delays
    if (printfulTemplateId) {
      try {
        console.log('🔍 Processing configurations instantly...', { externalProductId, templateId: printfulTemplateId });
        const mockupResult = await generatePrintfulMockup(externalProductId, printfulTemplateId);

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
      } catch (e) {
        console.warn('Configuration extraction warning:', e.message);
      }
    }

    // Background push to sync endpoints
    try {
      const vercelUrl = process.env.VERCEL_URL;
      const publicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const baseUrl = publicBaseUrl || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000');

      fetch(`${baseUrl}${ENSURE_SYNC_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    return NextResponse.json({ error: err.message || 'Failed to save draft' }, { status: 500 });
  }
}