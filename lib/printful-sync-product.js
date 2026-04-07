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

/**
 * Ensure there is a Printful sync product for this MetaWork product,
 * based on its EDM template.
 */
export async function ensurePrintfulSyncProduct(productDoc) {
  if (!PRINTFUL_API_KEY || !PRINTFUL_STORE_ID) {
    console.error('[printful-sync-product] Missing API key or store ID env vars');
    return { printfulSyncProductId: null, mockupUrl: null };
  }

  if (!productDoc?.printfulTemplateId) {
    console.error('[printful-sync-product] No printfulTemplateId on product');
    return { printfulSyncProductId: null, mockupUrl: null };
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
    try {
      const data = await callPrintful(`/v2/products/${syncProductId}`);
      const mockupUrl = data?.result?.sync_product?.thumbnail ||
                       data?.result?.sync_product?.preview_image ||
                       null;
      return {
        printfulSyncProductId: syncProductId.toString(),
        mockupUrl: mockupUrl || null,
      };
    } catch (err) {
      console.error('[printful-sync-product] Failed to fetch existing sync product:', err.message);
      syncProductId = null; // Force recreate
    }
  }

  // 2. CREATE sync product from EDM template
  let newSyncProductId = null;
  if (productDoc.printfulTemplateId && variantIds.length > 0) {
    try {
      const createRes = await callPrintful('/products', {  // ← /products not /sync-products
        method: 'POST',
        body: {
          sync_product: {                    // ← Required wrapper object
            name: productName,
            external_id: externalProductId,
          },
          sync_variants: variantIds.map(vid => ({  // ← Required wrapper array
            external_id: `${externalProductId}-${vid}`,  // ← Unique per variant
            variant_id: Number(vid),
            files: [],                       // ← Required, even empty
          })),
          edm_template_id: productDoc.printfulTemplateId
        }
      });
      newSyncProductId = createRes.result.id;
      console.log('✅ Created sync product:', newSyncProductId);
      syncProductId = newSyncProductId;
    } catch (err) {
      console.error('❌ Sync product creation failed:', err.message);
    }
  }

  // 3. Generate mockup from sync product or catalog
  let mockupUrl = null;
  if ((syncProductId || catalogProductId) && variantIds.length > 0) {
    try {
      mockupUrl = await generateMockupFromTemplate({
        catalogProductId,
        syncProductId,
        variantIds
      });
    } catch (err) {
      console.error('❌ Mockup generation failed:', err.message);
    }
  }

  return {
    printfulSyncProductId: syncProductId?.toString() || null,
    mockupUrl: mockupUrl || null
  };
}


async function generateMockupFromTemplate({ catalogProductId, syncProductId, variantIds }) {
  const body = {
    format: 'jpg',
    products: [{
      source: syncProductId ? 'sync_product' : 'catalog',
      sync_product_id: syncProductId || undefined,
      catalog_product_id: catalogProductId || undefined,
      catalog_variant_ids: variantIds.map(id => Number(id)),
      placements: []
    }]
  };

  const create = await callPrintful('/v2/mockup-tasks', {
    method: 'POST',
    body
  });

  const taskId = create.result.id;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // Poll every 10s (Printful minimum)
  await delay(10000);

  let attempts = 0;
  while (attempts < 30) {  // 5 min max
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
      sync_variant_id: item.printfulVariantId,
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