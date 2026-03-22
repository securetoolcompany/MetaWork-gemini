// scripts/cleanup-non-wp-products.cjs
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function cleanupProducts() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  const client = await MongoClient.connect(uri);
  const db = client.db('metawork_db');
  const collection = db.collection('products');

  // Define the filter: anything NOT coming from wp_export
  const filter = { source: { $ne: 'wp_export' } };

  // --- CONFIGURATION ---
  const IS_DRY_RUN = false; // Set to false to actually delete
  // ---------------------

  try {
    if (IS_DRY_RUN) {
      const count = await collection.countDocuments(filter);
      const samples = await collection.find(filter).limit(5).toArray();
      
      console.log(`[DRY RUN] Found ${count} products that are NOT 'wp_export'.`);
      console.log('Sample of documents to be deleted:');
      samples.forEach(p => console.log(` - ID: ${p._id} | Title: ${p.title} | Source: ${p.source || 'undefined'}`));
      
      console.log('\nTo delete these, set IS_DRY_RUN = false in the script.');
    } else {
      console.log('Deleting non-wp_export products...');
      const result = await collection.deleteMany(filter);
      console.log(`Successfully deleted ${result.deletedCount} products.`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  } finally {
    await client.close();
    process.exit(0);
  }
}

cleanupProducts();