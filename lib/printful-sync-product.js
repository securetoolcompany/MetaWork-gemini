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
      'X-PF-Store-Id': String(PRINTFUL_STORE_ID),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Printful API error]', res.status, text);
    throw new Error(`Printful API error ${res.status}: ${text}`);
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
  return (syncVariants || [])
    .map((sv) => ({
      sync_variant_id: sv?.id ? String(sv.id) : null,
      variant_id: sv?.variant_id ? Number(sv.variant_id) : null,
      external_id: sv?.external_id || null,
      retail_price: sv?.retail_price || null,
      sku: sv?.sku || null,
      name: sv?.name || null,
    }))
    .filter((v) => v.sync_variant_id && v.variant_id);
}

function buildCanonicalRetailPriceByVariantId(productDoc) {
  const canonicalVariants = Array.isArray(productDoc?.variants)
    ? productDoc.variants
    : [];

  const prices = new Map();

  for (const variant of canonicalVariants) {
    const variantId =
      variant?.variant_id ??
      variant?.variantId ??
      variant?.printful_id ??
      variant?.id;

    const rawRetailPrice = variant?.retail_price;

    if (
      variantId === undefined ||
      variantId === null ||
      rawRetailPrice === undefined ||
      rawRetailPrice === null ||
      rawRetailPrice === ""
    ) {
      throw new Error(
        "[printful-sync-product] Every synced variant must have a canonical variant ID and retail_price"
      );
    }

    const retailPrice = Number(rawRetailPrice);

    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
      throw new Error(
        `[printful-sync-product] Invalid canonical retail_price for variant ${variantId}`
      );
    }

    prices.set(String(variantId), retailPrice.toFixed(2));
  }

  return prices;
}

function getCanonicalRetailPrice(retailPriceByVariantId, variantId) {
  const retailPrice = retailPriceByVariantId.get(String(variantId));

  if (!retailPrice) {
    throw new Error(
      `[printful-sync-product] Missing canonical retail_price for Printful variant ${variantId}`
    );
  }

  return retailPrice;
}

async function updateExistingSyncVariantPrices(
  syncVariants,
  retailPriceByVariantId
) {
  for (const syncVariant of syncVariants || []) {
    const syncVariantId = syncVariant?.id;
    const catalogVariantId = syncVariant?.variant_id;

    if (!syncVariantId || !catalogVariantId) {
      throw new Error(
        "[printful-sync-product] Existing Printful sync variant is missing an ID or catalog variant ID"
      );
    }

    const retailPrice = getCanonicalRetailPrice(
      retailPriceByVariantId,
      catalogVariantId
    );

    await callPrintful(`/store/variants/${syncVariantId}`, {
      method: "PUT",
      body: {
        retail_price: retailPrice,
      },
    });
    syncVariant.retail_price = retailPrice;
  }
}

function normalizePrintFileUrl(input) {
  if (!input) return input;

  const value = String(input).trim();

  if (/^https?:\/\//i.test(value)) {
    return value.replace('/ipfs/ipfs/', '/ipfs/');
  }

  const cleaned = value
    .replace(/^ipfs:\/\//i, '')
    .replace(/^ipfs\//i, '');

  return `https://gateway.pinata.cloud/ipfs/${cleaned}`;
}

export async function ensurePrintfulSyncProduct(productDoc, options = {}) {
  const { skipMockup = false } = options;

  if (!PRINTFUL_API_KEY || !PRINTFUL_STORE_ID) {
    throw new Error('[printful-sync-product] Missing API key or store ID env vars');
  }

  if (!productDoc?.printfulTemplateId) {
    throw new Error('[printful-sync-product] No printfulTemplateId on product');
  }

  const externalProductId = productDoc.externalProductId?.toString();
  const productName =
  productDoc.name || productDoc.baseProduct?.name || 'MetaWork Product';

  let rawCatalogProductId =
    productDoc.baseProduct?.product_id ??
    productDoc.baseProduct?.printfulProductId ??
    productDoc.baseProduct?.productId ??
    productDoc.product_id ??
    productDoc.catalogProductId ??
    productDoc.baseProduct?.catalogProductId ??
    null;

  if (
    (!rawCatalogProductId || !Number.isFinite(Number(rawCatalogProductId))) &&
    productDoc.printfulTemplateId
  ) {
    try {
      const templateData = await callPrintful(
        `/product-templates/${productDoc.printfulTemplateId}`
      );
      rawCatalogProductId =
        templateData?.result?.product_id ??
        templateData?.result?.productid ??
        rawCatalogProductId;
    } catch (err) {
      console.error(
        '[printful-sync-product] Failed to derive catalogProductId from template:',
        err.message
      );
    }
  }

  const catalogProductId =
    rawCatalogProductId !== null &&
    rawCatalogProductId !== undefined &&
    rawCatalogProductId !== ''
      ? Number(rawCatalogProductId)
      : null;

  const sourceVariants = (
    productDoc.baseProduct?.variants ||
    productDoc.variants ||
    productDoc.variations ||
    []
  ).filter((v) => v && v.inStock !== false);

  const variantIds = sourceVariants
    .map((v) => v?.variantId || v?.printful_id || v?.id)
    .filter(Boolean)
    .map((id) => Number(id));

  const retailPriceByVariantId =
    buildCanonicalRetailPriceByVariantId(productDoc);
  
    if (!externalProductId) {
    throw new Error('[printful-sync-product] Missing externalProductId');
  }

  if (!Number.isFinite(catalogProductId) || catalogProductId <= 0) {
    throw new Error(
      `[printful-sync-product] Missing catalogProductId (raw: ${rawCatalogProductId})`
    );
  }

  if (variantIds.length === 0) {
    throw new Error('[printful-sync-product] No variantIds available for sync product creation');
  }

    // Prefer first-party EDM placement assets when available
    const filesFromOriginalAssets = (productDoc.originalPlacementAssets || [])
      .map((asset) => {
        const url = normalizePrintFileUrl(asset.normalizedUrl || asset.originalUrl);
        if (!url) return null;

        return {
          type: asset.placementName || 'front',
          url,
        };
      })
      .filter(Boolean);

    const filesFromPlacementConfigs = (productDoc.printfulPlacementConfigs || [])
      .flatMap((p) =>
        (p.layers || [])
          .map((l) => ({
            type: p.placement,
            url: normalizePrintFileUrl(l?.url),
          }))
          .filter((f) => f.url)
      );

    const files = filesFromOriginalAssets.length > 0
      ? filesFromOriginalAssets
      : filesFromPlacementConfigs;

        const hasEdmTemplateId = Boolean(productDoc.printfulTemplateId);

    if (files.length === 0) {
      const err = new Error(
        hasEdmTemplateId
          ? '[printful-sync-product] EDM template has no capturable print file — sync product cannot be created without a real file (needs mockup re-upload via product-edit dialog)'
          : '[printful-sync-product] No placement files available for sync product creation'
      );
      err.code = 'NEEDS_REVIEW_NO_FILES';
      throw err;
    }

  let syncProductId = productDoc.printfulSyncProductId || null;

  if (syncProductId) {
    console.log(
      '[printful-sync-product] Attempting to fetch existing sync product:',
      syncProductId
    );

    let data;

    try {
      data = await callPrintful(`/store/products/${syncProductId}`);
    } catch (err) {
      console.error(
        '[printful-sync-product] Failed to fetch existing sync product:',
        err.message
      );
      syncProductId = null;
    }

    if (data) {
      const result = data?.result || {};
      const syncProduct = result?.sync_product || result;
      const syncVariants = result?.sync_variants || [];

      /*
      * Deliberately allow this failure to stop the sync. A pricing failure
      * must never be handled by attempting to create another product.
      */
      await updateExistingSyncVariantPrices(
        syncVariants,
        retailPriceByVariantId
      );

      const mockupUrl =
        syncProduct?.thumbnail_url ||
        syncProduct?.thumbnail ||
        syncProduct?.preview_image ||
        null;

      return {
        printfulSyncProductId: String(syncProductId),
        mockupUrl: mockupUrl || null,
        variantMappings: buildVariantMappingsFromSyncVariants(syncVariants),
      };
    }
  }

  console.log('[printful-sync-product][create-input]', {
    externalProductId,
    printfulTemplateId: productDoc.printfulTemplateId,
    catalogProductId,
    variantIdsCount: variantIds.length,
    variantIdsPreview: variantIds.slice(0, 5),
    filesCount: files.length,
    firstFile: files[0] || null,
  });

    const createPayload = {
      sync_product: {
        name: productName,
        description: buildProductDescription(productDoc),
        external_id: externalProductId,
      },
      sync_variants: variantIds.map((vid) => ({
        external_id: `${externalProductId}-${vid}`,
        variant_id: Number(vid),
        retail_price: getCanonicalRetailPrice(
          retailPriceByVariantId,
          vid
        ),
        files,
      })),
    };

  let createRes;
  try {
    createRes = await callPrintful('/store/products', {
      method: 'POST',
      body: createPayload,
    });
  } catch (err) {
    // Handle "external_id already exists" by trying to reuse the existing sync product
    const message = String(err?.message || '').toLowerCase();
    if (
      message.includes('external_id already exists') ||
      message.includes('product with this external_id already exists')
    ) {
      console.warn(
        '[printful-sync-product] external_id already exists, attempting to reuse existing sync product'
      );

      try {
        // Search for existing sync product by external_id
        const searchRes = await callPrintful(`/store/products?search=${encodeURIComponent(externalProductId)}`);
        const results = searchRes?.result || [];

        const existing = Array.isArray(results)
          ? results.find((item) => {
              const syncProduct = item?.sync_product || item;
              return String(syncProduct?.external_id || '') === String(externalProductId);
            })
          : null;

        if (!existing) {
          console.error(
            '[printful-sync-product] No existing sync product found for external_id despite duplicate error',
            externalProductId
          );
          throw err;
        }

        const existingSyncProduct = existing?.sync_product || existing;

        const existingProductDetail = await callPrintful(
          `/store/products/${existingSyncProduct.id}`
        );

        const existingProductResult = existingProductDetail?.result || {};
        const existingSyncProductDetail =
          existingProductResult?.sync_product || existingProductResult;

        const existingSyncVariants =
          existingProductResult?.sync_variants || [];

        const existingMockupUrl =
          existingSyncProductDetail?.thumbnail_url ||
          existingSyncProductDetail?.thumbnail ||
          existingSyncProductDetail?.preview_image ||
          null;

        await updateExistingSyncVariantPrices(
          existingSyncVariants,
          retailPriceByVariantId
        );

        const variantMappings = buildVariantMappingsFromSyncVariants(
          existingSyncVariants
        );

        return {
          printfulSyncProductId: String(existingSyncProduct.id),
          mockupUrl: existingMockupUrl || null,
          variantMappings,
        };
      } catch (reuseErr) {
        console.error(
          '[printful-sync-product] Failed to reuse existing sync product after duplicate external_id:',
          reuseErr.message
        );
        throw err;
      }
    }

    console.error('[printful-sync-product] Sync product creation request failed:', err);
    throw err;
  }

  syncProductId =
    createRes?.result?.sync_product?.id ||
    createRes?.result?.id ||
    null;

  const variantMappings = buildVariantMappingsFromSyncVariants(
    createRes?.result?.sync_variants || []
  );

  if (!syncProductId) {
    console.error('[printful-sync-product] Unexpected create response:', createRes);
    throw new Error('[printful-sync-product] Printful did not return a sync product id');
  }

  let mockupUrl = null;
  if (!skipMockup && catalogProductId && variantIds.length > 0) {
    try {
      mockupUrl = await generateMockupFromTemplate({
        catalogProductId,
        syncProductId,
        variantIds,
        placementConfigs: productDoc.printfulPlacementConfigs || [],
      });
    } catch (err) {
      console.error('❌ Mockup generation failed:', err.message);
    }
  }

  return {
    printfulSyncProductId: String(syncProductId),
    mockupUrl: mockupUrl || null,
    variantMappings,
  };
}

async function generateMockupFromTemplate({
  catalogProductId,
  syncProductId,
  variantIds,
  placementConfigs = [],
}) {
  const placements = placementConfigs.map((p) => {
    const placement = {
      placement: p.placement,
      layers: (p.layers || []).map((l) => ({
        type: 'file',
        url: normalizePrintFileUrl(l.url),
      })),
    };

    if (p.technique) {
      placement.technique = p.technique;
    }

    return placement;
  });

  const body = {
    format: 'jpg',
    products: [
      {
        source: 'catalog',
        catalog_product_id: catalogProductId ? Number(catalogProductId) : undefined,
        catalog_variant_ids: variantIds.map((id) => Number(id)),
        placements: placements.length > 0 ? placements : [],
      },
    ],
  };

  const create = await callPrintful('/v2/mockup-tasks', {
    method: 'POST',
    body,
  });

  const taskId = create.result.id;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  await delay(10000);

  let attempts = 0;
  while (attempts < 30) {
    const task = await callPrintful(`/v2/mockup-tasks/${taskId}`);

    if (task.result.status === 'completed' && task.result.mockups?.length > 0) {
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
    items: items.map((item) => ({
      sync_variant_id: item.sync_variant_id || item.printfulVariantId,
      quantity: item.quantity,
    })),
    draft: true,
  };

  return await callPrintful('/orders', {
    method: 'POST',
    body,
  });
}