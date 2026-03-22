require('dotenv').config();
const { MongoClient } = require('mongodb');

// Your MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in environment variables');
  console.error('Make sure you have a .env file with MONGODB_URI=your-connection-string');
  process.exit(1);
}

async function fixRevenuePoolIds() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(); // Uses default database from connection string
    
    // Get all revenue pools
    const revenuePools = await db.collection('revenue_pools').find().toArray();
    console.log(`📊 Found ${revenuePools.length} revenue pools to check`);
    
    let updated = 0;
    let notFound = 0;
    
    for (const pool of revenuePools) {
      console.log(`\n🔍 Checking pool with ipAssetId: ${pool.ipAssetId}`);
      
      // Try to find matching IP asset using multiple strategies
      const ipAsset = await db.collection('ip_assets').findOne({
        $or: [
          { id: pool.ipAssetId },                    // Exact match
          { revenueTokenAssetId: pool.ipAssetId },   // Match by token ID
          { nftAssetId: pool.ipAssetId },            // Match by NFT ID
          { revenuePoolAppId: pool.appId }           // Match by app ID
        ]
      });
      
      if (ipAsset) {
        const newId = ipAsset._id.toString();
        console.log(`  ✅ Found matching IP asset: ${ipAsset.name}`);
        console.log(`  📝 Updating ipAssetId from ${pool.ipAssetId} to ${newId}`);
        
        await db.collection('revenue_pools').updateOne(
          { _id: pool._id },
          { $set: { ipAssetId: newId } }
        );
        
        updated++;
      } else {
        console.log(`  ❌ No matching IP asset found for pool ${pool.id}`);
        notFound++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`❌ Not found: ${notFound}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
fixRevenuePoolIds();
