// inspect-blank-product.cjs
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first'); // Node 24 + Atlas DNS fix

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const PRODUCT_NAME_REGEX = /Pom-Pom Beanie/i; // change this if you want another product

(async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'metawork_db';

  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('blank_products');

    console.log('🔎 Searching blank_products for:', PRODUCT_NAME_REGEX);

    const doc = await collection.findOne(
      { catalogProductName: PRODUCT_NAME_REGEX },
      {
        projection: {
          _id: 0,
          catalogProductId: 1,
          catalogProductName: 1,
          hasAvailableVariants: 1,
          isFullyOutOfStock: 1,
          inStockVariantCount: 1,
          totalVariants: 1,
          thumbnailUrl: 1,
          variants: 1
        }
      }
    );

    if (!doc) {
      console.log('❌ No matching product found.');
    } else {
      console.log('✅ Found product document:');
      console.dir(doc, { depth: 3, colors: true });
    }
  } catch (err) {
    console.error('DB playground error:', err);
  } finally {
    await client.close();
  }
})();