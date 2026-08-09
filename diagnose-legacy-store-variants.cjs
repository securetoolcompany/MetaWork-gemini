// backfill-legacy-external-product-id.cjs
// Copies legacyMetadata._smpf_external_product_id onto a top-level
// externalProductId field for legacy (WooCommerce-origin) products that are
// missing it. This is what /my-products and app/api/printful/edm-nonce
// rely on to open these products in the EDM.
//
// Usage:
//   node backfill-legacy-external-product-id.cjs

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'metawork_db';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is missing in .env.local');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('✅ Connected to MongoDB\n');

  const db = client.db(DB_NAME);

  const legacyProducts = await db
    .collection('products')
    .find({ legacyMetadata: { $exists: true }, externalProductId: { $exists: false } })
    .toArray();

  console.log(`🔍 Found ${legacyProducts.length} legacy products missing externalProductId\n`);

  let updated = 0;
  let skipped = 0;

  for (const product of legacyProducts) {
    const legacyExternalId = product.legacyMetadata?._smpf_external_product_id;
    if (!legacyExternalId) {
      console.log(`⚠️  Skipping ${product.name} (${product._id}) — no _smpf_external_product_id found`);
      skipped++;
      continue;
    }

    await db.collection('products').updateOne(
      { _id: product._id },
      { $set: { externalProductId: legacyExternalId } }
    );
    updated++;
    console.log(`   ✓ Set externalProductId=${legacyExternalId} for ${product.name} (${product._id})`);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Legacy products missing externalProductId: ${legacyProducts.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no source ID to copy): ${skipped}`);

  await client.close();
}

main().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});