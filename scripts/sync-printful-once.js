import { MongoClient } from 'mongodb';

// ============================================
// HARDCODED CONFIGURATION
// ============================================
const PRINTFUL_API_KEY = 'yrhwYB9qs52Z1DKf4LiEn3hJXpS7iWAL05l4bGJg';
const MONGODB_URI = 'mongodb+srv://metawork_db_user:TestPass123@metaworkcluster.mvwr5sw.mongodb.net/metawork_db?retryWrites=true&w=majority';
const DATABASE_NAME = 'metawork_db';
const COLLECTION_NAME = 'blank_products';

const PRINTFUL_API_BASE = 'https://api.printful.com';
const RATE_LIMIT_DELAY = 500; 

async function fetchPrintfulAPI(endpoint) {
  const response = await fetch(`${PRINTFUL_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Printful API Error: ${response.status}`);
  const data = await response.json();
  return data.result;
}

/**
 * REWRITTEN: Transform logic to capture Hex Codes and prevent duplicates
 */
function transformProductData(printfulProduct, detailedProduct) {
  const now = new Date();
  const uniqueVariantsMap = new Map();
  const shippingRegions = new Set();
  
  // Capturing regions from the main product if variants lack it
  if (detailedProduct?.product?.files) {
     // Optional: logic to parse technical files if needed
  }

  (detailedProduct?.variants || []).forEach(v => {
    // Unique key to prevent duplicates: "Size-Color"
    const key = `${v.size}-${v.color}`.toLowerCase();
    
    // Capture availability
    if (v.availability) {
      v.availability.forEach(loc => {
        if (loc.region) shippingRegions.add(loc.region);
      });
    }

    if (!uniqueVariantsMap.has(key)) {
      uniqueVariantsMap.set(key, {
        variantId: v.id,
        sku: v.sku || '',
        size: v.size || '',
        color: v.color || '',
        // FIX: Capture primary hex code or fallback to secondary, then gray
        colorCode: v.color_code || v.color_code2 || '#555555',
        price: parseFloat(v.price || 0),
        inStock: v.in_stock !== false
      });
    }
  });

  const uniqueVariants = Array.from(uniqueVariantsMap.values());

  // Formatting description for your UI
  const rawDescription = detailedProduct?.product?.description || printfulProduct.description || '';
  const formattedDescription = rawDescription
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n• ');

  return {
    catalogProductId: printfulProduct.id,
    catalogProductName: printfulProduct.title,
    printfulId: printfulProduct.id,
    
    // Technique and Metadata
    preferredTechnique: detailedProduct?.product?.techniques?.[0]?.display_name || 'Standard',
    availableColors: [...new Set(uniqueVariants.map(v => v.color).filter(Boolean))],
    availableSizes: [...new Set(uniqueVariants.map(v => v.size).filter(Boolean))],
    
    // Origin data - using Printful's "origin_country" metadata
    producedIn: detailedProduct?.product?.origin_country || 'International',
    shipsTo: [...shippingRegions].join(', ') || 'Global',
    
    description: '• ' + formattedDescription,
    variants: uniqueVariants, // This is now de-duplicated
    
    basePrice: uniqueVariants[0]?.price || 0,
    isActive: true,
    lastSyncedAt: now,
    updatedAt: now,
  };
}

async function fetchAllPrintfulProducts() {
  console.log('📦 Fetching products...');
  return await fetchPrintfulAPI('/products');
}

async function fetchProductDetails(productId) {
  return await fetchPrintfulAPI(`/products/${productId}`);
}

async function syncPrintfulCatalog() {
  console.log('🚀 Starting Catalog Sync...');
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    const products = await fetchAllPrintfulProducts();
    console.log(`✅ Found ${products.length} products to sync.`);

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      try {
        const detailed = await fetchProductDetails(product.id);
        if (!detailed) continue;

        const transformed = transformProductData(product, detailed);
        
        await collection.updateOne(
          { catalogProductId: product.id },
          { $set: transformed },
          { upsert: true }
        );

        console.log(`[${i + 1}/${products.length}] Synced: ${product.title}`);
        await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
      } catch (err) {
        console.error(`❌ Error on ${product.title}:`, err.message);
      }
    }
    console.log('\n✨ Sync complete!');
  } finally {
    await client.close();
  }
}

syncPrintfulCatalog();