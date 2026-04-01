// scripts/migrate-cloudinary-folders.cjs
require('dotenv').config({ path: '.env.local' });const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const OLD_ROOT = 'metawork/products';
const NEW_ROOT = 'metawork/users';

// Fallback if creatorUsername isn't set yet
function extractUsername(title) {
  const match = title?.match(/\s-\s(.+)$/);
  return match ? match[1].trim() : null;
}

async function migrateCloudinaryStructure() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('metawork_db'); // Make sure this matches your DB name

  // 1. Find all products that still have the old path in their images
  const products = await db.collection('products').find({
    mockupImages: { $regex: OLD_ROOT }
  }).toArray();

  console.log(`🔍 Found ${products.length} products needing migration to '${NEW_ROOT}'...`);

  for (const product of products) {
    // Resolve the username and productId
    const username = product.creatorUsername || extractUsername(product.title);
    const productId = product.legacyProductId || product.id || product._id.toString();

    if (!username || !productId) {
      console.log(`⚠️ Skipping product ${product._id}: Missing username or productId`);
      continue;
    }

    const oldPrefix = `${OLD_ROOT}/${username}/mockups/${productId}`;
    
    try {
      // 2. Fetch exactly what files exist in the old Cloudinary folder
      const { resources } = await cloudinary.api.resources({
        type: 'upload',
        prefix: oldPrefix,
        max_results: 50
      });

      if (resources.length === 0) {
         console.log(`⏭️ No files found at ${oldPrefix}. Moving on...`);
         continue;
      }

      const newMockupImages = [];

      // 3. Move each file to the new location
      for (const res of resources) {
        const oldPublicId = res.public_id;
        // Replace just the root part of the path
        const newPublicId = oldPublicId.replace(OLD_ROOT, NEW_ROOT);
        
        // Use Cloudinary's rename API
        const result = await cloudinary.uploader.rename(oldPublicId, newPublicId, {
          overwrite: true,
          invalidate: true // Clears the CDN cache for the old image
        });

        newMockupImages.push(result.secure_url);
      }

      // Sort images nicely (mockup_0, mockup_1, etc.)
      newMockupImages.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const thumbnailUrl = newMockupImages[0];

      // 4. Update the product in MongoDB
      await db.collection('products').updateOne(
        { _id: product._id },
        { 
          $set: { 
            thumbnailUrl, 
            mockupImages: newMockupImages 
          } 
        }
      );

      console.log(`✅ Migrated: ${product.title} (${newMockupImages.length} images moved)`);

    } catch (error) {
      console.error(`❌ Error processing product ${productId}:`, error.message);
    }
  }

  await client.close();
  console.log('🏁 Cloudinary structure migration complete.');
}

migrateCloudinaryStructure();