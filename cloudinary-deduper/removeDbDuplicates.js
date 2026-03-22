const { MongoClient } = require('mongodb');
const fs = require('fs');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://metawork_db_user:TestPass123@metaworkcluster.mvwr5sw.mongodb.net/metawork_db?retryWrites=true&w=majority';
const DB_NAME = 'metawork_db';

async function removeDuplicateAssets() {
  const duplicates = JSON.parse(fs.readFileSync('filename_duplicates.json'));
  
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  
  console.log(`Removing ${duplicates.length} duplicate IP asset entries from database...\n`);
  
  let totalRemoved = 0;
  
  for (const item of duplicates) {
    const deletedPublicId = item.public_id;
    
    // Build the full Cloudinary URL pattern to match
    const urlPattern = `https://res.cloudinary.com/dplnacuyy/image/upload/`;
    
    console.log(`Removing: ${deletedPublicId}`);
    
    // Delete from ip_assets collection where imageUrl contains this public_id
    const result = await db.collection('ip_assets').deleteMany({
      imageUrl: { $regex: deletedPublicId.replace(/\./g, '\\.') }
    });
    
    if (result.deletedCount > 0) {
      console.log(`  ✓ Deleted ${result.deletedCount} record(s)`);
      totalRemoved += result.deletedCount;
    } else {
      console.log(`  ⚠ No records found`);
    }
  }
  
  await client.close();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✓ Database cleanup complete!`);
  console.log(`  Removed: ${totalRemoved} duplicate IP asset records`);
  console.log(`${'='.repeat(60)}`);
}

removeDuplicateAssets().catch(console.error);
