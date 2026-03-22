const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const MONGODB_URI = process.env.MONGODB_URI;
const BATCH_SIZE = 15;
const ZIP_PATH = './2025.zip';
const EXPORT_JSON_PATH = './metawork_complete_export_2026-01-25_21-20-36.json';
const TEMP_DIR = './temp_extract';
const DEFAULT_COLLECTION = 'default';

// Image extensions to process
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// Categories to skip when finding username
const SKIP_CATEGORIES = ['mfg', 'academy', 'combat-sports', 'uncategorized', 'clothing', 'accessories'];

async function loadExportData() {
  console.log('Loading export data...');
  const data = await fs.readFile(EXPORT_JSON_PATH, 'utf-8');
  return JSON.parse(data);
}

function buildImageToUsernameMap(exportData) {
  console.log('Building image to username mapping...');
  
  // Step 1: Build media ID to filename map
  const mediaMap = new Map();
  exportData.media.forEach(m => {
    if (m.url && m.url.includes('/2025/')) {
      mediaMap.set(m.id, m.filename);
    }
  });
  
  console.log(`Found ${mediaMap.size} media items from 2025`);
  
  // Step 2: Map filename to username via products
  const filenameToUsername = new Map();
  
  exportData.products.forEach(product => {
    // Get username from categories - first non-organizational category
    let username = null;
    for (const cat of (product.categories || [])) {
      const slug = cat.slug.toLowerCase();
      const shouldSkip = SKIP_CATEGORIES.some(skip => slug.includes(skip));
      if (!shouldSkip) {
        username = slug;
        break;
      }
    }
    
    if (!username) return;
    
    // Get all media IDs used by this product
    const mediaIds = [];
    if (product.featured_image_id) {
      mediaIds.push(product.featured_image_id);
    }
    if (product.gallery_ids) {
      mediaIds.push(...product.gallery_ids);
    }
    
    // Map each filename to this username
    mediaIds.forEach(mediaId => {
      const filename = mediaMap.get(mediaId);
      if (filename) {
        filenameToUsername.set(filename, username);
      }
    });
  });
  
  console.log(`Mapped ${filenameToUsername.size} filenames to usernames`);
  
  // Show distribution
  const usernameCounts = new Map();
  filenameToUsername.forEach(username => {
    usernameCounts.set(username, (usernameCounts.get(username) || 0) + 1);
  });
  
  console.log('\nTop 10 usernames by image count:');
  const sorted = Array.from(usernameCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sorted.forEach(([username, count]) => {
    console.log(`  ${username}: ${count} images`);
  });
  
  return filenameToUsername;
}

async function extractZip() {
  console.log('\nExtracting ZIP file...');
  const zip = new AdmZip(ZIP_PATH);
  await fs.mkdir(TEMP_DIR, { recursive: true });
  zip.extractAllTo(TEMP_DIR, true);
  console.log('ZIP extracted successfully');
}

async function findAllImages(dir) {
  const images = [];
  
  async function scan(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const basename = path.basename(entry.name).toLowerCase();
        
        // Skip thumbnails, backups, and index files
        if (IMAGE_EXTENSIONS.includes(ext) && 
            !basename.includes('thumb') && 
            !basename.includes('backup') &&
            !basename.startsWith('index')) {
          images.push(fullPath);
        }
      }
    }
  }
  
  await scan(dir);
  return images;
}

function groupImagesByUsername(imagePaths, filenameMap) {
  console.log('\nGrouping images by username...');
  const grouped = new Map();
  let unmappedCount = 0;
  
  imagePaths.forEach(imagePath => {
    const filename = path.basename(imagePath);
    const username = filenameMap.get(filename) || 'unassigned';
    
    if (username === 'unassigned') {
      unmappedCount++;
    }
    
    if (!grouped.has(username)) {
      grouped.set(username, []);
    }
    grouped.get(username).push(imagePath);
  });
  
  console.log(`Grouped into ${grouped.size} usernames`);
  console.log(`Unmapped images: ${unmappedCount}`);
  
  grouped.forEach((images, username) => {
    console.log(`  ${username}: ${images.length} images`);
  });
  
  return grouped;
}

async function uploadBatch(imagePaths, username, startIdx) {
  const batch = imagePaths.slice(startIdx, startIdx + BATCH_SIZE);
  const results = [];
  
  for (const imagePath of batch) {
    try {
      const filename = path.basename(imagePath);
      const filenameWithoutExt = path.parse(filename).name;
      
      // Structure: metawork/ip-assets/{username}/{collection}/image
      const result = await cloudinary.uploader.upload(imagePath, {
        folder: `metawork/ip-assets/${username}/${DEFAULT_COLLECTION}`,
        public_id: filenameWithoutExt,
        resource_type: 'image',
        overwrite: false
      });
      
      results.push({
        filename,
        cloudinaryUrl: result.secure_url,
        publicId: result.public_id,
        username,
        collection: DEFAULT_COLLECTION
      });
      
      console.log(`  ✓ Uploaded: ${filename}`);
    } catch (error) {
      console.error(`  ✗ Failed to upload ${path.basename(imagePath)}:`, error.message);
    }
  }
  
  return results;
}

async function createIPAssets(db, uploadResults) {
  const ipAssets = uploadResults.map(result => ({
    title: result.filename,
    description: '',
    imageUrl: result.cloudinaryUrl,
    cloudinaryPublicId: result.publicId,
    ownerUsername: result.username,
    collection: result.collection,
    status: 'unminted',
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  
  if (ipAssets.length > 0) {
    const insertResult = await db.collection('ip_assets').insertMany(ipAssets);
    console.log(`  Created ${insertResult.insertedCount} IP asset records`);
  }
}

async function processUsername(db, username, imagePaths) {
  console.log(`\nProcessing ${username} (${imagePaths.length} images)...`);
  
  let totalUploaded = 0;
  
  for (let i = 0; i < imagePaths.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(imagePaths.length / BATCH_SIZE);
    
    console.log(`  Batch ${batchNum}/${totalBatches}...`);
    const uploadResults = await uploadBatch(imagePaths, username, i);
    
    if (uploadResults.length > 0) {
      await createIPAssets(db, uploadResults);
      totalUploaded += uploadResults.length;
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < imagePaths.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✓ Completed ${username}: ${totalUploaded}/${imagePaths.length} uploaded`);
}

async function cleanup() {
  console.log('\nCleaning up temp files...');
  await fs.rm(TEMP_DIR, { recursive: true, force: true });
  console.log('Cleanup complete');
}

async function main() {
  let client;
  
  try {
    console.log('=== MetaWork IP Asset Migration ===\n');
    
    // Load export data and build mappings
    const exportData = await loadExportData();
    const filenameMap = buildImageToUsernameMap(exportData);
    
    // Extract and find images
    await extractZip();
    const allImages = await findAllImages(TEMP_DIR);
    console.log(`\nFound ${allImages.length} total images in ZIP`);
    
    // Group by username
    const groupedImages = groupImagesByUsername(allImages, filenameMap);
    
    // Connect to MongoDB
    console.log('\nConnecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('metawork_db');
    console.log('Connected to metawork_db database');
    
    // Process each username
    let processedCount = 0;
    for (const [username, imagePaths] of groupedImages) {
      await processUsername(db, username, imagePaths);
      processedCount++;
    }
    
    console.log(`\n✓ Migration complete: ${processedCount} usernames processed`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
    await cleanup();
  }
}

main().catch(console.error);
