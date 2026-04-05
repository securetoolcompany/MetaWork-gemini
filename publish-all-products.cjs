const { MongoClient } = require('mongodb');

// Hardcoding exactly what is in your lib/mongodb.js to guarantee we hit the right DB
const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function publishAllProducts() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Cluster');
    
    // Explicitly target metawork_db just like your app does
    const db = client.db(dbName);
    console.log(`✅ Connected to database: ${dbName}`);

    const productsCollection = db.collection('products');

    const totalProducts = await productsCollection.countDocuments();
    console.log(`📦 Found ${totalProducts} total products. Proceeding to standardize...`);

    // Safety check just in case
    if (totalProducts === 0) {
        console.log("⚠️ Still 0 products. Let's see what collections actually exist here:");
        const collections = await db.listCollections().toArray();
        console.log(collections.map(c => c.name));
        return;
    }

    // Standardize all products to a clean "Published" state
    const result = await productsCollection.updateMany(
      {}, // Match all documents
      {
        $set: {
          isDraft: false,
          isPublic: true,
          status: 'active'
        },
        $unset: {
          showroomListed: "" // Completely remove this tag
        }
      }
    );

    console.log('🎉 Update Complete!');
    console.log(`✅ Matched: ${result.matchedCount}`);
    console.log(`✅ Modified: ${result.modifiedCount} (Products standardized)`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

publishAllProducts();