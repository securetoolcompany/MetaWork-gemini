// migrateIPOnly.cjs - Fast parallel Lumise upload
require('dotenv').config();
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const BATCH_SIZE = 15; // Upload 15 at once

async function uploadBatch(batch, username) {
  const results = await Promise.allSettled(
    batch.map(async (media) => {
      try {
        const filename = media.url.split('/').pop().replace(/\.(jpg|png|jpeg|gif)$/i, '');
        const result = await cloudinary.uploader.upload(media.url, {
          folder: `metawork/ip-assets/${username}`,
          public_id: filename,
          resource_type: 'image'
        });
        return { media, cloudinaryUrl: result.secure_url };
      } catch (error) {
        throw new Error(`Failed: ${error.message}`);
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed = results.filter(r => r.status === 'rejected');

  return { successful, failed };
}

async function main() {
  console.log('Loading export...\n');
  const exportData = JSON.parse(fs.readFileSync('metawork_complete_export_2026-01-25_21-20-36.json', 'utf-8'));

  // Filter ONLY Lumise designs (in lumise_data folder)
  const lumiseMedia = exportData.media.filter(m => {
    const url = m.url || '';
    return url.includes('lumise_data/');
  });

  console.log(`Found ${lumiseMedia.length} Lumise design files\n`);

  // Build username map from products
  console.log('Mapping images to IP owners via product categories...');
  const imageToUsername = new Map();

  for (const product of exportData.products) {
    // Find username category (skip MFG categories)
    let username = null;
    for (const cat of product.categories || []) {
      const catName = cat.name.toLowerCase();
      if (!catName.includes('mfg') && 
          !catName.includes('academy') && 
          !catName.includes('combat sports') &&
          !catName.includes('clothing') &&
          !catName.includes('accessories') &&
          !catName.includes('activewear')) {
        username = cat.name;
        break;
      }
    }

    if (username) {
      // Map featured image
      if (product.featured_image_id) {
        imageToUsername.set(product.featured_image_id, username);
      }

      // Map gallery images
      for (const imgId of product.gallery_ids || []) {
        imageToUsername.set(imgId, username);
      }
    }
  }

  console.log(`Mapped ${imageToUsername.size} product images to usernames\n`);

  // Group Lumise designs by username
  const byUsername = {};
  let unmappedCount = 0;

  for (const media of lumiseMedia) {
    const username = imageToUsername.get(media.id);

    if (username) {
      if (!byUsername[username]) byUsername[username] = [];
      byUsername[username].push(media);
    } else {
      unmappedCount++;
      // Default to admin for unmapped (we'll fix later)
      if (!byUsername['admin']) byUsername['admin'] = [];
      byUsername['admin'].push(media);
    }
  }

  console.log(`Grouped into ${Object.keys(byUsername).length} IP owners`);
  console.log(`${unmappedCount} designs not linked to products (assigned to 'admin')\n`);

  console.log('=== Uploading to Cloudinary ===\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('metawork');
  const ipAssets = db.collection('ip_assets');

  let totalUploaded = 0;
  let totalFailed = 0;

  for (const [username, designs] of Object.entries(byUsername)) {
    console.log(`Uploading ${designs.length} designs for ${username}...`);

    // Upload in batches
    for (let i = 0; i < designs.length; i += BATCH_SIZE) {
      const batch = designs.slice(i, i + BATCH_SIZE);
      const { successful, failed } = await uploadBatch(batch, username);

      // Insert successful uploads as IP assets
      if (successful.length > 0) {
        const ipRecords = successful.map(({ media, cloudinaryUrl }) => ({
          title: media.title || media.url.split('/').pop(),
          description: media.description || '',
          imageUrl: cloudinaryUrl,
          cloudinaryPublicId: cloudinaryUrl.split('/').slice(-2).join('/').split('.')[0],
          ownerUsername: username, // We'll link to real user_id later
          status: 'unminted',
          originalWordpressId: media.id,
          createdAt: new Date(media.date),
          updatedAt: new Date()
        }));

        await ipAssets.insertMany(ipRecords);
      }

      totalUploaded += successful.length;
      totalFailed += failed.length;

      process.stdout.write(`  ✓ ${totalUploaded} uploaded, ${totalFailed} failed\r`);
    }
    console.log(`\n  ✓ Done with ${username}\n`);
  }

  console.log(`\n=== Complete ===`);
  console.log(`Total uploaded: ${totalUploaded}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`IP assets created: ${totalUploaded}`);

  await client.close();
}

main().catch(console.error);
