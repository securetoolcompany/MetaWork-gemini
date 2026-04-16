// audit-product-variations.cjs
const { MongoClient } = require('mongodb');

async function runAudit() {
  // Using the exact URI and DB Name from your lib/mongodb.js
  const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
  const dbName = 'metawork_db';

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`✅ Connected to database: ${dbName}`);

    // Fetching from your products collection
    const products = await db.collection('products').find({}).toArray();
    console.log(`📦 Found ${products.length} total products.\n`);

    let missingVariationsArray = 0;
    let missingSyncIds = 0;
    let validProducts = 0;

    const report = [];

    for (const product of products) {
      if (!product.variations || !Array.isArray(product.variations) || product.variations.length === 0) {
        missingVariationsArray++;
        report.push(`❌ Product "${product.name}" (${product._id}) has NO variations array.`);
        continue;
      }

      let hasIssue = false;
      product.variations.forEach((v, index) => {
        // Look for the Printful sync ID or Printful Variant ID
        const syncId = v.sync_variant_id || v.printfulVariantId;
        
        if (!syncId) {
          hasIssue = true;
          missingSyncIds++;
          report.push(`⚠️ Product "${product.name}" (${product._id}) -> Variation [${index}] (ID: ${v.id}) is MISSING both sync_variant_id and printfulVariantId.`);
        }
      });const PRODUCTS_COLLECTION = 'products';
const ORDERS_COLLECTION = 'orders';
const OUT = {
  generatedAt: new Date().toISOString(),
  dbName: db.databaseName,
  summary: {},
  buckets: {},
  samples: {},
  recommendations: []
};

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isBlank(v) {
  return v === null || v === undefined || v === '';
}

function hasFulfillmentId(variation) {
  return !isBlank(variation?.sync_variant_id) || !isBlank(variation?.printfulVariantId);
}

function classifyProduct(p) {
  const variations = safeArray(p.variations);
  if (variations.length === 0) return 'NO_VARIATIONS';

  let missingSync = 0;
  let missingAll = 0;
  let valid = 0;

  for (const v of variations) {
    const missingSyncId = isBlank(v?.sync_variant_id);
    const missingAllIds = isBlank(v?.sync_variant_id) && isBlank(v?.printfulVariantId);
    if (missingSyncId) missingSync += 1;
    if (missingAllIds) missingAll += 1;
    if (!missingAllIds) valid += 1;
  }

  if (missingAll > 0) return 'MISSING_FULFILLMENT_IDS';
  if (missingSync > 0) return 'MISSING_SYNC_IDS';
  return 'HEALTHY';
}

function productView(p) {
  const variations = safeArray(p.variations);
  return {
    _id: p._id,
    name: p.name || null,
    slug: p.slug || null,
    status: classifyProduct(p),
    variationCount: variations.length,
    variations: variations.map(v => ({
      id: v?.id ?? null,
      name: v?.name ?? null,
      sku: v?.sku ?? null,
      sync_variant_id: v?.sync_variant_id ?? null,
      printfulVariantId: v?.printfulVariantId ?? null,
      retail_price: v?.retail_price ?? v?.price ?? null
    }))
  };
}

function orderView(o) {
  const items = safeArray(o.items);
  return {
    _id: o._id,
    orderNumber: o.orderNumber || null,
    createdAt: o.createdAt || null,
    status: o.status || null,
    fulfillmentStatus: o.fulfillmentStatus || null,
    printfulError: o.printfulError || null,
    stripePaymentId: o.stripePaymentId || null,
    printfulOrderId: o.printfulOrderId || null,
    items: items.map(i => ({
      productId: i?.productId ?? null,
      variationId: i?.variationId ?? null,
      title: i?.title ?? null,
      quantity: i?.quantity ?? null,
      sync_variant_id: i?.sync_variant_id ?? null,
      printfulVariantId: i?.printfulVariantId ?? null
    }))
  };
}

const products = db.getCollection(PRODUCTS_COLLECTION).find({}, {
  _id: 1,
  name: 1,
  slug: 1,
  variations: 1
}).toArray();

const orders = db.getCollection(ORDERS_COLLECTION).find({
  $or: [
    { fulfillmentStatus: 'failed' },
    { printfulError: { $exists: true, $ne: null } }
  ]
}, {
  _id: 1,
  orderNumber: 1,
  createdAt: 1,
  status: 1,
  fulfillmentStatus: 1,
  printfulError: 1,
  stripePaymentId: 1,
  printfulOrderId: 1,
  items: 1
}).sort({ createdAt: -1 }).toArray();

const buckets = {
  HEALTHY: [],
  NO_VARIATIONS: [],
  MISSING_FULFILLMENT_IDS: [],
  MISSING_SYNC_IDS: []
};

for (const p of products) {
  const status = classifyProduct(p);
  buckets[status].push(productView(p));
}

OUT.summary = {
  totalProducts: products.length,
  healthyProducts: buckets.HEALTHY.length,
  noVariations: buckets.NO_VARIATIONS.length,
  missingFulfillmentIds: buckets.MISSING_FULFILLMENT_IDS.length,
  missingSyncIds: buckets.MISSING_SYNC_IDS.length,
  failedOrFlaggedOrders: orders.length
};

OUT.buckets = buckets;
OUT.samples = {
  failedOrders: orders.map(orderView),
  failingProductIdsFromOrders: [...new Set(orders.flatMap(o => safeArray(o.items).map(i => String(i.productId)).filter(Boolean)))]
};
OUT.recommendations = [
  'Block checkout when the matched variation lacks sync_variant_id and printfulVariantId.',
  'Sync unsynced Printful products in the target store before allowing purchase.',
  'Update Mongo product variations with the actual sync_variant_id values from the same Printful store.',
  'Archive or delete products with no variations if they should never be sold.',
  'Review failed orders and either refund or re-run fulfillment after product sync is fixed.'
];

print('=== PRINTFUL PRODUCT AUDIT SUMMARY ===');
printjson(OUT.summary);
print('');
print('=== FAILING PRODUCT IDS REFERENCED BY ORDERS ===');
printjson(OUT.samples.failingProductIdsFromOrders);
print('');
print('=== FULL AUDIT JSON BELOW ===');
printjson(OUT);

      if (!hasIssue) validProducts++;
    }

    console.log('--- AUDIT REPORT ---');
    if (report.length === 0 && products.length > 0) {
      console.log('🎉 All products have properly formatted variations with sync IDs!');
    } else if (report.length > 0) {
      report.forEach(line => console.log(line));
    }
    
    console.log('\n--- SUMMARY ---');
    console.log(`Total Products: ${products.length}`);
    console.log(`Healthy Products: ${validProducts}`);
    console.log(`Products missing variations completely: ${missingVariationsArray}`);
    console.log(`Total Variations missing Sync IDs: ${missingSyncIds}`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.close();
  }
}

runAudit();