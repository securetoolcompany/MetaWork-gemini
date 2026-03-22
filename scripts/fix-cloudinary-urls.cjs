// scripts/sync-from-cloudinary.cjs
require('dotenv').config();
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const CLOUDINARY_ROOT = 'metawork/products';

function extractUsername(title) {
  const match = title.match(/\s-\s(.+)$/);
  return match ? match[1].trim() : null;
}

async function syncProducts() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('metawork_db');
  const products = await db.collection('products').find({ source: 'wp_export' }).toArray();

  console.log(`Syncing ${products.length} products with actual Cloudinary files...`);

  for (const product of products) {
    const username = extractUsername(product.title);
    const productId = product.legacyProductId;

    if (!username || !productId) continue;

    const folderPath = `${CLOUDINARY_ROOT}/${username}/mockups/${productId}`;

    try {
      // 1. Fetch exactly what files exist in this folder from Cloudinary
      const { resources } = await cloudinary.api.resources({
        type: 'upload',
        prefix: folderPath,
        max_results: 50
      });

      if (resources.length === 0) {
        console.log(`⚠️  Empty: ${username}/${productId}`);
        continue;
      }

      // 2. Map existing resources to full secure URLs
      // Sort them by filename (mockup_0, mockup_1...)
      const mockupImages = resources
        .sort((a, b) => a.public_id.localeCompare(b.public_id, undefined, { numeric: true }))
        .map(r => r.secure_url);

      // 3. Set Thumbnail to the first available image (since mockup_0 might be missing)
      const thumbnailUrl = mockupImages[0];

      await db.collection('products').updateOne(
        { _id: product._id },
        { $set: { thumbnailUrl, mockupImages } }
      );

      console.log(`✅ Updated ${product.title} (${mockupImages.length} images)`);

    } catch (err) {
      console.error(`❌ Error fetching ${folderPath}:`, err.message);
    }
  }

  await client.close();
  console.log('Sync complete.');
}

syncProducts();