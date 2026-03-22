// scripts/cleanup-products-dryrun.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'metawork_db';

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found');
  process.exit(1);
}

async function dryRunCleanup() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected\n');
    
    const db = client.db(DB_NAME);
    const productsCollection = db.collection('products');
    
    console.log('🔍 DRY RUN - No data will be deleted\n');
    
    const blankProducts = await productsCollection
      .find({
        $or: [
          { userId: { $exists: false } },
          { userId: null }
        ]
      })
      .toArray();
    
    console.log(`Found ${blankProducts.length} blank products:\n`);
    
    blankProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name || product.title || 'Untitled'} (ID: ${product._id})`);
    });
    
    console.log(`\n📊 Total to delete: ${blankProducts.length}\n`);
    
  } finally {
    await client.close();
  }
}

dryRunCleanup().catch(console.error);
