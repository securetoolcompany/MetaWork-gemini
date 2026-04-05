require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function linkMovedMockups() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const db = client.db(dbName);

    // 1. Scan the NEW folder structure in Cloudinary
    console.log('\n📡 Scanning new Cloudinary folders...');
    let resources = [];
    let nextCursor = null;

    do {
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'MetaWork/users/', 
            max_results: 500,
            next_cursor: nextCursor
        });
        resources = resources.concat(result.resources);
        nextCursor = result.next_cursor;
    } while (nextCursor);

    // Filter down to just product mockups
    const mockups = resources.filter(r => r.public_id.includes('/products/mockups/'));
    console.log(`📦 Found ${mockups.length} mockups safely in their new homes.`);

    let successCount = 0;
    let failCount = 0;

    // 2. Link them to the DB
    for (const file of mockups) {
        const parts = file.public_id.split('/');
        // Format: MetaWork/users/[userId]/products/mockups/[productId]/[fileName]
        // Indexes:  0      /  1   /   2    /    3   /    4   /     5     /    6
        
        if (parts.length < 7) continue;
        
        const productId = parts[5];
        const numericId = parseInt(productId, 10);

        // 🔥 Bulletproof Database Filter (Catches Strings, Numbers, and legacy wpIds)
        const productFilter = {
            $or: [
                { id: productId },
                { id: numericId },
                { legacyProductId: numericId }, // ✅ Added this!
                { legacyProductId: productId }, // ✅ Added this!
                { _id: productId }
            ]
        };
        try { productFilter.$or.push({ _id: new ObjectId(productId) }); } catch(e){}

        // See if the product exists
        const product = await db.collection('products').findOne(productFilter);

        if (product) {
            const updateDoc = {
                $set: { updatedAt: new Date() },
                $addToSet: { mockupUrls: file.secure_url } // Add to array so we don't overwrite if there are multiple
            };

            // If it's the primary mockup (usually ending in 0 or 1), set it as the main cover image too
            if (file.public_id.includes('mockup-0') || file.public_id.includes('mockup_0') || !product.mockupUrl) {
                updateDoc.$set.mockupUrl = file.secure_url;
            }

            await db.collection('products').updateOne(
                { _id: product._id },
                updateDoc
            );

            console.log(`✅ Linked mockup to Product: ${product.title || productId}`);
            successCount++;
        } else {
            console.log(`❌ Still can't find Product ID '${productId}' in DB. It may have been deleted.`);
            failCount++;
        }
    }

    console.log('\n🎉 Linking Complete!');
    console.log(`✅ Successfully connected to DB: ${successCount}`);
    console.log(`❌ Products not found in DB: ${failCount}`);

  } catch (err) {
    console.error('❌ Script Error:', err);
  } finally {
    await client.close();
  }
}

linkMovedMockups();