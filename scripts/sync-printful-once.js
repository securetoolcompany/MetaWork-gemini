// scripts/sync-printful-once.js

const PRINTFUL_API_BASE = 'https://api.printful.com';
const RATE_LIMIT_DELAY = 500;

const CURATED_PRODUCT_IDS = [
  71, 145, 380, // T-Shirts
  146, 320,     // Hoodies
  312, 506,     // Hats
  19, 281,      // Mugs
  1, 171,       // Posters
  56, 233,      // Phone Cases
  83,           // Bags
  358           // Stickers
];

async function fetchPrintfulAPI(endpoint) {
  const apiKey = process.env.PRINTFUL_API_KEY;
  if (!apiKey) {
    throw new Error('PRINTFUL_API_KEY is not set');
  }

  const response = await fetch(`${PRINTFUL_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Printful API Error: ${response.status} ${text}`
    );
  }

  const data = await response.json();
  return data.result;
}

/**
 * Transform logic to capture hex codes, prevent duplicate variants,
 * record availability, and compute a canonical thumbnailUrl.
 */
function transformProductData(printfulProduct, detailedProduct) {
  const now = new Date();
  const uniqueVariantsMap = new Map();
  const shippingRegions = new Set();

  (detailedProduct?.variants || []).forEach(v => {
    if (Array.isArray(v.availability)) {
      v.availability.forEach(loc => {
        if (loc.region) shippingRegions.add(loc.region);
      });
    }
  });

  (detailedProduct?.variants || []).forEach(v => {
    const key = `${v.size || ''}-${v.color || ''}`.toLowerCase();

    const inStock = v.in_stock !== false; // v1 uses in_stock boolean

    // Attempt to find a hex color in any value
    const foundHex = Object.values(v).find(
      val => typeof val === 'string' && val.startsWith('#')
    );

    if (!uniqueVariantsMap.has(key)) {
      uniqueVariantsMap.set(key, {
        variantId: v.id,
        id: v.id,
        sku: v.sku || '',
        size: v.size || '',
        color: v.color || '',
        colorCode: v.color_code || v.color_code2 || foundHex || null,
        price: parseFloat(v.price || v.retail_price || 0),
        retail_price: parseFloat(v.retail_price || v.price || 0),
        inStock,
        availability_regions: v.availability_regions || {},
        files: v.files || [],
        options: v.options || []
      });
    }
  });

  const uniqueVariants = Array.from(uniqueVariantsMap.values());
  const inStockVariantCount = uniqueVariants.filter(v => v.inStock).length;
  const totalVariants = uniqueVariants.length;
  const hasAvailableVariants = inStockVariantCount > 0;
  const isFullyOutOfStock = inStockVariantCount === 0;

  // Compute canonical thumbnailUrl once and persist it
  let thumbnailUrl = null;

  // 1. Prefer product-level summary images from Printful
  thumbnailUrl =
    detailedProduct?.product?.image ||
    detailedProduct?.product?.thumbnail_url ||
    printfulProduct.image ||
    printfulProduct.thumbnail_url ||
    null;

  // 2. If missing, fall back to the first usable file across all variants
  if (!thumbnailUrl) {
    for (const v of uniqueVariants) {
      for (const f of v.files || []) {
        const preview =
          f.previewUrl ||
          f.preview_url ||
          f.url ||
          null;
        if (preview) {
          thumbnailUrl = preview;
          break;
        }
      }
      if (thumbnailUrl) break;
    }
  }

  const rawDescription =
    detailedProduct?.product?.description ||
    printfulProduct.description ||
    '';
  const formattedDescription = rawDescription
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n• ');

  const availableColors = [
    ...new Set(uniqueVariants.map(v => v.color).filter(Boolean))
  ];
  const availableSizes = [
    ...new Set(uniqueVariants.map(v => v.size).filter(Boolean))
  ];

  const productMeta = detailedProduct?.product || {};

  return {
    catalogProductId: printfulProduct.id,
    catalogProductName: printfulProduct.title,
    printfulId: printfulProduct.id,

    preferredTechnique:
      productMeta.techniques?.[0]?.display_name || 'Standard',
    availableColors,
    availableSizes,

    producedIn: productMeta.origin_country || 'International',
    shipsTo: [...shippingRegions].join(', ') || 'Global',

    description: formattedDescription ? '• ' + formattedDescription : '',

    variants: uniqueVariants,
    basePrice: uniqueVariants[0]?.price || 0,

    // availability summary
    hasAvailableVariants,
    isFullyOutOfStock,
    inStockVariantCount,
    totalVariants,
    isActive: hasAvailableVariants,

    // canonical thumbnail written into DB
    thumbnailUrl,

    lastSyncedAt: now,
    updatedAt: now,

    type_name: printfulProduct.type_name,
    main_category_id: printfulProduct.main_category_id,
    image: printfulProduct.image,
    thumbnail_url: printfulProduct.thumbnail_url,
    is_accessory: printfulProduct.is_accessory || false,
    avg_price: printfulProduct.avg_price || null
  };
}

async function fetchAllPrintfulProducts() {
  console.log('📦 Fetching catalog products from Printful...');
  return await fetchPrintfulAPI('/products');
}

async function fetchProductDetails(productId) {
  return await fetchPrintfulAPI(`/products/${productId}`);
}

/**
 * Main exported sync function.
 * Accepts a connected MongoClient (e.g. from lib/mongodb's clientPromise).
 * Does NOT create or close its own connection, and does NOT auto-run.
 */
async function syncPrintfulCatalogWithAvailability(client) {
  console.log('🚀 Starting Catalog Sync (with availability + thumbnails)...');

  const dbName = process.env.MONGODB_DB || 'metawork_db';
  const db = client.db(dbName);
  const collection = db.collection('blank_products');

  const allProducts = await fetchAllPrintfulProducts();
  console.log(`✅ Found ${allProducts.length} products in catalog.`);

  // You can switch back to CURATED_PRODUCT_IDS if you only want a subset
  const productsToSync = allProducts;

  console.log(`🔎 Syncing ${productsToSync.length} products...`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < productsToSync.length; i++) {
    const product = productsToSync[i];

    try {
      const detailed = await fetchProductDetails(product.id);
      if (!detailed) {
        console.warn(`⚠️ No detailed data for product ${product.id}`);
        continue;
      }

      const transformed = transformProductData(product, detailed);

      await collection.updateOne(
        { catalogProductId: product.id },
        { $set: transformed },
        { upsert: true }
      );

      successCount++;
      const state =
        transformed.isFullyOutOfStock
          ? 'FULLY_OUT_OF_STOCK'
          : transformed.hasAvailableVariants
          ? 'HAS_STOCK'
          : 'UNKNOWN';

      console.log(
        `[${i + 1}/${productsToSync.length}] Synced: ${product.title} ` +
        `(state=${state}, inStockVariantCount=${transformed.inStockVariantCount}, totalVariants=${transformed.totalVariants}, thumbnailUrl=${transformed.thumbnailUrl || 'none'})`
      );

      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
    } catch (err) {
      errorCount++;
      console.error(
        `❌ Error on ${product.title} (${product.id}):`,
        err.message
      );
    }
  }

  console.log(
    `\n✨ Catalog + availability + thumbnail sync complete! Success: ${successCount}, Errors: ${errorCount}`
  );

  return { successCount, errorCount, total: productsToSync.length };
}

export { syncPrintfulCatalogWithAvailability };