// lib/printful-sync-product.js

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_STORE_ID = process.env.PRINTFUL_STORE_ID;

async function callPrintful(endpoint, options = {}) {
  if (!PRINTFUL_API_KEY) {
    throw new Error('Missing PRINTFUL_API_KEY');
  }

  const url = `https://api.printful.com${endpoint}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': PRINTFUL_STORE_ID,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Printful API error]', res.status, text);
    throw new Error(`Printful API error ${res.status}`);
  }

  return res.json();
}

function buildProductDescription(productDoc) {
  const username = productDoc.ownerUsername || productDoc.creatorUsername || null;
  if (username) {
    return `Designed by ${username} with MetaWork.tools!`;
  }
  return 'Created with love using MetaWork.tools';
}

function buildVariantMappingsFromSyncVariants(syncVariants = []) {
  return (syncVariants || []).map((sv) => ({
    sync_variant_id: sv?.id ? String(sv.id) : null,
    variant_id: sv?.variant_id ? Number(sv.variant_id) : null,
    external_id: sv?.external_id || null,
    retail_price: sv?.retail_price || null,
    sku: sv?.sku || null,
    name: sv?.name || null,
  })).filter((v) => v.sync_variant_id && v.variant_id);
}

function normalizeLocalVariantId(v) {
  return String(v?.printful_id || v?.variantId || v?.id || '');
}

/**
 * Ensure there is a Printful sync product for this MetaWork product,
 * based on its EDM template.
 */
export async function ensurePrintfulSyncProduct(productDoc, options = {}) {
  const { skipMockup = false } = options;
  if (!PRINTFUL_API_KEY || !PRINTFUL_STORE_ID) {
    console.error('[printful-sync-product] Missing API key or store ID env vars');
    return { printfulSyncProductId: null, mockupUrl: null, variantMappings: [] };
  }

  if (!productDoc?.printfulTemplateId) {
    console.error('[printful-sync-product] No printfulTemplateId on product');
    return { printfulSyncProductId: null, mockupUrl: null, variantMappings: [] };
  }

  const externalProductId = productDoc.externalProductId?.toString();
  const productName = productDoc.name || productDoc.baseProduct?.name || 'MetaWork Product';
  const catalogProductId = Number(productDoc.baseProduct?.catalogProductId || productDoc.baseProduct?.id);
  const variantIds = (productDoc.baseProduct?.variants || [])
    ?.map(v => v.variantId || v.id)
    .filter(Boolean) || [];

  let syncProductId = productDoc.printfulSyncProductId || null;

        // 1. If we have sync product ID, fetch it first
    if (syncProductId) {
      console.log('[printful-sync-product] Attempting to fetch existing sync product:', syncProductId);
      try {
        const data = await callPrintful(`/store/products/${syncProductId}`);
        const result = data?.result || {};
        const syncProduct = result?.sync_product || result;
        const syncVariants = result?.sync_variants || [];
        const mockupUrl =
          syncProduct?.thumbnail_url ||
          syncProduct?.thumbnail ||
          syncProduct?.preview_image ||
          null;

        console.log('[printful-sync-product] Fetched existing sync product OK. syncVariants count:', syncVariants.length);

        return {
          printfulSyncProductId: String(syncProductId),
          mockupUrl: mockupUrl || null,
          variantMappings: buildVariantMappingsFromSyncVariants(syncVariants),
        };
      } catch (err) {
        console.error('[printful-sync-product] Failed to fetch existing sync product:', err.message);
        syncProductId = null; // Force recreate
      }
    } else {
      console.log('[printful-sync-product] No existing syncProductId — will attempt creation');
    }

    // 2. CREATE sync product from EDM template
    let newSyncProductId = null;
    let variantMappings = [];

    console.log('[printful-sync-product] printfulTemplateId:', productDoc.printfulTemplateId, 'variantIds:', variantIds);

    if (productDoc.printfulTemplateId && variantIds.length > 0) {
      try {
        console.log('[printful-sync-product] Calling POST /products to create sync product...');
        
console.log('[printful-sync-product][input-shape]', {
  externalProductId,
  printfulTemplateId: productDoc.printfulTemplateId,
  catalogProductId,
  variantIdsCount: variantIds.length,
  variantIdsPreview: variantIds.slice(0, 5),
  placementConfigsCount: (productDoc.printfulPlacementConfigs || []).length,
  placementConfigNames: (productDoc.printfulPlacementConfigs || []).map(p => p.placement),
  firstPlacementConfig: productDoc.printfulPlacementConfigs?.[0] || null,
});

        const files = (productDoc.printfulPlacementConfigs || []).flatMap(p =>
              p.layers.map(l => ({ type: p.placement, url: l.url }))
            );
        
// ADD THIS LOG BLOCK HERE
console.log('[printful-sync-product][files-derived]', {
  filesCount: files.length,
  firstFile: files[0] || null,
  filesByType: files.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {}),
});

        const createRes = await callPrintful('/store/products', {
          method: 'POST',
          body: {
            sync_product: {
              name: productName,
              description: buildProductDescription(productDoc),
              external_id: externalProductId,
            },

            sync_variants: variantIds.map((vid) => ({
              external_id: `${externalProductId}-${vid}`,
              variant_id: Number(vid),
              files, // same placement files applied to every size/color variant
            })),
            edm_template_id: productDoc.printfulTemplateId
          }
        });

        newSyncProductId = createRes?.result?.id || createRes?.result?.sync_product?.id || null;
        variantMappings = buildVariantMappingsFromSyncVariants(
          createRes?.result?.sync_variants || []
        );

        console.log('✅ Created sync product:', newSyncProductId, 'variants:', variantMappings.length);
        syncProductId = newSyncProductId;
      } catch (err) {
        console.error('❌ Sync product creation failed:', err.message);
      }
    }

    // 3. Generate mockup from sync product or catalog
  let mockupUrl = null;
  if (!skipMockup && (syncProductId || catalogProductId) && variantIds.length > 0) {
    try {
      mockupUrl = await generateMockupFromTemplate({
        catalogProductId,
        syncProductId,
        variantIds,
        placementConfigs: productDoc.printfulPlacementConfigs || []
      });
    } catch (err) {
      console.error('❌ Mockup generation failed:', err.message);
    }
  }

    return {
      printfulSyncProductId: syncProductId?.toString() || null,
      mockupUrl: mockupUrl || null,
      variantMappings
    };
  }


async function generateMockupFromTemplate({ catalogProductId, syncProductId, variantIds, placementConfigs = [] }) {
  const placements = placementConfigs.map(p => ({
    placement: p.placement,
    technique: p.technique || 'dtg',
    layers: p.layers.map(l => ({ type: 'file', url: l.url })),
  }));

console.log('[printful-sync-product][mockup-input]', {
  catalogProductId,
  syncProductId,
  variantIdsCount: variantIds.length,
  variantIdsPreview: variantIds.slice(0, 5),
  placementConfigsCount: placementConfigs.length,
  placementsCount: placements.length,
  placementNames: placements.map(p => p.placement),
  firstPlacement: placements[0] || null,
});

  const body = {
    format: 'jpg',
    products: [{
      source: 'catalog',
      catalog_product_id: catalogProductId ? Number(catalogProductId) : undefined,
      catalog_variant_ids: variantIds.map(id => Number(id)),
      placements: placements.length > 0 ? placements : [],
    }]
  };

  const create = await callPrintful('/v2/mockup-tasks', {
    method: 'POST',
    body
  });

  const taskId = create.result.id;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  await delay(10000);

  let attempts = 0;
  while (attempts < 30) {
    const task = await callPrintful(`/v2/mockup-tasks/${taskId}`);

    if (task.result.status === 'completed' && task.result.mockups?.length > 0) {
      console.log('✅ Mockup ready:', task.result.mockups[0].url);
      return task.result.mockups[0].url;
    }

    if (task.result.status === 'failed') {
      console.error('❌ Mockup task failed:', task.result);
      return null;
    }

    await delay(10000);
    attempts++;
  }

  console.error('⏰ Mockup timeout after 5min');
  return null;
}

export async function createPrintfulOrder(shippingInfo, items) {
  const body = {
    recipient: {
      name: shippingInfo.name,
      address1: shippingInfo.address,
      city: shippingInfo.city,
      state_code: shippingInfo.state,
      country_code: shippingInfo.country,
      zip: shippingInfo.zip,
    },
    items: items.map(item => ({
      sync_variant_id: item.sync_variant_id || item.printfulVariantId,
      quantity: item.quantity,
    })),
    // Setting to true creates a draft; false for immediate fulfillment
    draft: true 
  };

  return await callPrintful('/orders', {
    method: 'POST',
    body
  });
}