// deleteWpExportData.cjs
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in .env file');
  process.exit(1);
}

async function deleteWpExportData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas\n');
    
    const db = client.db('metawork_db');
    
    // Collections that might have wp_export tagged data
    const collections = [
      'users',
      'aisles', 
      'products',
      'collections',
      'ip_assets',
      'orders',
      'revenue_pools',
      'blank_products'
    ];
    
    console.log('📊 Checking for wp_export data...\n');
    
    // First, count how many documents will be deleted
    const countsByCollection = {};
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments({ source: 'wp_export' });
        if (count > 0) {
          countsByCollection[collectionName] = count;
          console.log(`   ${collectionName}: ${count} wp_export documents found`);
        }
      } catch (error) {
        // Collection might not exist
      }
    }
    
    const totalToDelete = Object.values(countsByCollection).reduce((a, b) => a + b, 0);
    
    if (totalToDelete === 0) {
      console.log('\n✅ No wp_export data found. Database is clean!');
      return;
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⚠️  Total: ${totalToDelete} wp_export documents will be deleted`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🗑️  Deleting in 2 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Delete wp_export data
    console.log('🧹 Deleting wp_export data...\n');
    
    const results = {};
    for (const collectionName of Object.keys(countsByCollection)) {
      const collection = db.collection(collectionName);
      const result = await collection.deleteMany({ source: 'wp_export' });
      results[collectionName] = result.deletedCount;
      console.log(`   ✓ ${collectionName}: deleted ${result.deletedCount} documents`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Deletion Summary:\n');
    
    let totalDeleted = 0;
    for (const [name, count] of Object.entries(results)) {
      console.log(`   ${name}: ${count} deleted`);
      totalDeleted += count;
    }
    
    console.log(`\n   Total: ${totalDeleted} wp_export documents deleted`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Verify remaining data
    console.log('🔍 Remaining data in collections:\n');
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const total = await collection.countDocuments();
        const wpExport = await collection.countDocuments({ source: 'wp_export' });
        if (total > 0) {
          console.log(`   ${collectionName}: ${total} total (${wpExport} wp_export)`);
        }
      } catch (error) {
        // Collection might not exist
      }
    }
    
    console.log('\n✅ Cleanup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: node filterExport.cjs (to create new filtered export)');
    console.log('   2. Run: node migrateUsers.cjs (to import filtered users)');
    console.log('   3. Run: node migrateAisles.cjs (to import filtered aisles)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Connection closed');
  }
}

// Run the deletion
console.log('🚀 Delete WP Export Data');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

deleteWpExportData()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
