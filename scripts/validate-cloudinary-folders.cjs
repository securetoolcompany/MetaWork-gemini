// scripts/deep-clean-shop.cjs
require('dotenv').config();
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const CLOUDINARY_ROOT = 'metawork/products';

/**
 * Robust extraction for "Name-Username" or "Name - Username"
 */
function extractUsername(title) {
  if (!title || !title.includes('-')) return null;
  const parts = title.split('-');
  return parts[parts.length - 1].trim();
}

async function syncAndClean() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  const client = await MongoClient.connect(uri);
  const db = client.db('metawork_db');
  const collection = db.collection('products');

  const products = await collection.find({ source: 'wp_export' }).toArray();
  console.log(`--- Deep Cleaning ${products.length} Products ---`);

  for (const product of products) {
    const username = extractUsername(product.title);
    const productId = product.legacyProductId;

    // If we can't even get a username/ID, hide it immediately
    if (!username || !productId) {
      await collection.updateOne({ _id: product._id }, { $set: { isVisible: false } });
      console.log(`⚠️  HIDDEN (Format): ${product.title}`);
      continue;
    }

    const folderPath = `${CLOUDINARY_ROOT}/${username}/mockups/${productId}`;

    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folderPath,
        max_results: 1
      });

      const hasFiles = result.resources && result.resources.length > 0;

      await collection.updateOne(
        { _id: product._id },
        { $set: { isVisible: hasFiles } }
      );

      if (hasFiles) {
        console.log(`✅ VISIBLE: ${username} | ${productId}`);
      } else {
        console.log(`❌ HIDDEN (Empty): ${username} | ${productId}`);
      }

    } catch (error) {
      console.log(`❌ HIDDEN (No Folder): ${username} | ${productId}`);
      await collection.updateOne({ _id: product._id }, { $set: { isVisible: false } });
    }
  }

  await client.close();
  console.log('--- Deep Clean Finished ---');
}

syncAndClean();