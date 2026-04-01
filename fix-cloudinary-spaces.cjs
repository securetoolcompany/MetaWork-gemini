// scripts/fix-cloudinary-spaces.cjs
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function fixSpacesInCloudinary() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('metawork_db');

  // Find products that have "%20" (URL encoded space) in their mockup images
  const products = await db.collection('products').find({
    mockupImages: { $regex: "%20" }
  }).toArray();

  console.log(`🔍 Found ${products.length} products with spaces in their image URLs...`);

  for (const product of products) {
    const username = product.creatorUsername;
    const productId = product.legacyProductId || product.id || product._id.toString();

    // If there is no username or it doesn't have spaces, skip it
    if (!username || !username.includes(' ')) {
      continue;
    }

    // Cloudinary API reads actual spaces, not %20
    const oldPrefix = `metawork/users/${username}/mockups/${productId}`;

    try {
      // 1. Fetch files using the old path
      const { resources } = await cloudinary.api.resources({
        type: 'upload',
        prefix: oldPrefix,
        max_results: 50
      });

      if (resources.length === 0) {
         continue;
      }

      const newMockupImages = [];

      // 2. Rename each file to use dashes instead of spaces
      for (const res of resources) {
        const oldPublicId = res.public_id;
        
        // This cleanly replaces all spaces in the path with dashes
        // e.g., "Tremblay BJJ MMA" -> "Tremblay-BJJ-MMA"
        const newPublicId = oldPublicId.replace(/\s+/g, '-');

        if (oldPublicId !== newPublicId) {
            const result = await cloudinary.uploader.rename(oldPublicId, newPublicId, {
              overwrite: true,
              invalidate: true // Clears the cache so the old %20 link drops
            });
            newMockupImages.push(result.secure_url);
        } else {
            newMockupImages.push(res.secure_url);
        }
      }

      // 3. Update the database with the clean, dashed URLs
      if (newMockupImages.length > 0) {
          // Keep them in order (mockup_0, mockup_1)
          newMockupImages.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
          const thumbnailUrl = newMockupImages[0];

          await db.collection('products').updateOne(
            { _id: product._id },
            {
              $set: {
                thumbnailUrl: thumbnailUrl,
                mockupImages: newMockupImages
              }
            }
          );
          console.log(`✅ Fixed spaces for: ${product.title} (${newMockupImages.length} images updated)`);
      }

    } catch (error) {
      console.error(`❌ Error processing product ${productId}:`, error.message);
    }
  }

  await client.close();
  console.log('🏁 Space removal complete.');
}

fixSpacesInCloudinary();