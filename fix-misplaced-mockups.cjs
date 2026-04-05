require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function relocateDynamicMockups() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const db = client.db(dbName);

    // 1. Find products that have a mockupUrl, but it DOES NOT contain "MetaWork/users/"
    const products = await db.collection('products').find({
      mockupUrl: { 
        $exists: true, 
        $ne: null,
        $not: /MetaWork\/users\// // Ignore ones that are already correct
      }
    }).toArray();

    console.log(`📦 Found ${products.length} products with mockups in the wrong folder structure.`);

    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
      if (!product.userId) {
        console.log(`⚠️ Skipping ${product._id} - No userId attached to product.`);
        continue;
      }

      const oldUrl = product.mockupUrl;
      
      // 2. Safely extract the exact Public ID from the Cloudinary URL
      const urlParts = oldUrl.split('/upload/');
      if (urlParts.length !== 2) {
          console.log(`⚠️ Skipping ${product._id} - URL doesn't look like a standard Cloudinary upload.`);
          continue;
      }

      let oldPublicId = urlParts[1].replace(/\.[^/.]+$/, ""); // Strip .png / .jpg
      oldPublicId = oldPublicId.replace(/^v\d+\//, '');       // Strip versioning (v12345/)

      // 3. Extract just the filename and SANITIZE IT
      let fileName = oldPublicId.split('/').pop(); 
      
      // 🔥 Convert spaces to hyphens, remove all non-alphanumeric/hyphen/underscore characters, and make lowercase
      fileName = fileName
        .replace(/\s+/g, '-')             // Replace spaces with hyphens
        .replace(/[^a-zA-Z0-9_-]/g, '')   // Remove special characters
        .toLowerCase();                   // Make it clean and uniform

      // 4. Construct the strict, correct pathway
      const newPublicId = `MetaWork/users/${product.userId}/products/mockups/${product._id.toString()}/${fileName}`;

      console.log(`\n🔄 Relocating: ${product.title}`);
      console.log(`   From: ${oldPublicId}`);
      console.log(`   To:   ${newPublicId}`);

      // Skip if they are somehow the same
      if (oldPublicId === newPublicId) continue;

      try {
        // 5. Move it in Cloudinary
        const moveResult = await cloudinary.uploader.rename(oldPublicId, newPublicId, {
          overwrite: true
        });

        // 6. Update the Database
        await db.collection('products').updateOne(
          { _id: product._id },
          { 
            $set: { 
              mockupUrl: moveResult.secure_url,
              updatedAt: new Date()
            } 
          }
        );
        console.log(`   ✅ Success!`);
        successCount++;

      } catch (cloudinaryErr) {
        console.error(`   ❌ Failed: ${cloudinaryErr.message}`);
        failCount++;
      }
    }

    console.log('\n🎉 Cleanup Complete!');
    console.log(`✅ Successfully moved & sanitized: ${successCount}`);
    console.log(`❌ Failed to move: ${failCount}`);

  } catch (err) {
    console.error('❌ Script Error:', err);
  } finally {
    await client.close();
  }
}

relocateDynamicMockups();