// uploadFromZip.cjs - Extract and upload Lumise designs from ZIP
require('dotenv').config();
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const BATCH_SIZE = 15;
const ZIP_PATH = '2025.zip';
const EXTRACT_PATH = './temp_lumise_extract';

async function uploadBatch(batch) {
  const results = await Promise.allSettled(
    batch.map(async (filePath) => {
      try {
        const filename = path.basename(filePath, path.extname(filePath));
        const result = await cloudinary.uploader.upload(filePath, {
          folder: 'metawork/ip-assets/admin',
          public_id: filename,
          resource_type: 'image'
        });
        return { filePath, cloudinaryUrl: result.secure_url, filename };
      } catch (error) {
        throw new Error(`Failed: ${error.message}`);
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed = results.filter(r => r.status === 'rejected');

  return { successful, failed };
}

function getAllImageFiles(dir) {
  const imageFiles = [];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

  function traverse(currentPath) {
    const items = fs.readdirSync(currentPath);

    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else {
        const ext = path.extname(item).toLowerCase();
        // Skip thumbnails and backups
        if (imageExtensions.includes(ext) && 
            !item.includes('-thumb') && 
            !item.includes('_backup') &&
            !item.includes('index.html')) {
          imageFiles.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return imageFiles;
}

async function main() {
  console.log('=== Extracting ZIP ===\n');

  // Extract ZIP
  const zip = new AdmZip(ZIP_PATH);
  zip.extractAllTo(EXTRACT_PATH, true);
  console.log(`✓ Extracted to ${EXTRACT_PATH}\n`);

  // Find all image files
  console.log('Finding all image files...');
  const imageFiles = getAllImageFiles(EXTRACT_PATH);
  console.log(`✓ Found ${imageFiles.length} image files\n`);

  if (imageFiles.length === 0) {
    console.log('No images found. Exiting.');
    return;
  }

  console.log('=== Uploading to Cloudinary ===\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('metawork');
  const ipAssets = db.collection('ip_assets');

  let totalUploaded = 0;
  let totalFailed = 0;

  // Upload in batches
  for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
    const batch = imageFiles.slice(i, i + BATCH_SIZE);
    const { successful, failed } = await uploadBatch(batch);

    // Insert successful uploads as IP assets
    if (successful.length > 0) {
      const ipRecords = successful.map(({ filePath, cloudinaryUrl, filename }) => ({
        title: filename,
        description: '',
        imageUrl: cloudinaryUrl,
        cloudinaryPublicId: cloudinaryUrl.split('/').slice(-2).join('/').split('.')[0],
        ownerUsername: 'admin',
        status: 'unminted',
        originalFilePath: filePath,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await ipAssets.insertMany(ipRecords);
    }

    totalUploaded += successful.length;
    totalFailed += failed.length;

    process.stdout.write(`  ✓ ${totalUploaded} uploaded, ${totalFailed} failed\r`);
  }

  console.log(`\n\n=== Complete ===`);
  console.log(`Total uploaded: ${totalUploaded}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`IP assets created: ${totalUploaded}`);

  // Clean up extracted files
  console.log(`\nCleaning up temporary files...`);
  fs.rmSync(EXTRACT_PATH, { recursive: true, force: true });
  console.log(`✓ Removed ${EXTRACT_PATH}`);

  console.log(`\nAll designs assigned to 'admin' - ready to assign to real owners.`);

  await client.close();
}

main().catch(console.error);