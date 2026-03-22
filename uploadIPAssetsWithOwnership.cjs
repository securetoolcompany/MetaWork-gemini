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
const MAPPING_FILE = './lumise_filename_mapping.json';
const TEMP_DIR = './temp_extract';
const DEFAULT_COLLECTION = 'default';

// Image extensions to process
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

async function loadFilenameMapping() {
  console.log('Loading filename to owner mapping...');
  const data = await fs.readFile(MAPPING_FILE, 'utf-8');
  const mapping = JSON.parse(data);
  
  console.log(`Loaded ${Object.keys(mapping.filename_to_owner).length} filename mappings`);
  console.log(`Total Lumise images: ${mapping.lumise_images.length}`);
  
  return mapping;
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
        const basename = entry.name.toLowerCase();
        
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

function groupImagesByOwner(imagePaths, filenameMapping) {
  console.log('\nGrouping images by owner...');
  const grouped = new Map();
  const filenameToOwner = filenameMapping.filename_to_owner;
  
  imagePaths.forEach(imagePath => {
    const filename = path.basename(imagePath);
    const owner = filenameToOwner[filename] || 'unassigned';
    
    if (!grouped.has(owner)) {
      grouped.set(owner, []);
    }
    grouped.get(owner).push(imagePath);
  });
  
  console.log(`Grouped into ${grouped.size} owners`);
  
  // Sort by count
  const sorted = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);
  sorted.forEach(([owner, images]) => {
    console.log(`  ${owner}: ${images.length} images`);
  });
  
  return grouped;
}

async function uploadBatch(imagePaths, owner, startIdx) {
  const batch = imagePaths.slice(startIdx, startIdx + BATCH_SIZE);
  const results = [];
  
  for (const imagePath of batch) {
    try {
      const filename = path.basename(imagePath);
      const filenameWithoutExt = path.parse(filename).name;
      
      // For Dynamic Folder Mode: use asset_folder + use_asset_folder_as_public_id_prefix
      const assetFolder = `metawork/ip-assets/${owner}/${DEFAULT_COLLECTION}`;
      
      const result = await cloudinary.uploader.upload(imagePath, {
        asset_folder: assetFolder,
        public_id: filenameWithoutExt,
        use_asset_folder_as_public_id_prefix: true,
        resource_type: 'image',
        overwrite: false
      });
      
      results.push({
        filename,
        cloudinaryUrl: result.secure_url,
        publicId: result.public_id,
        owner,
        collection: DEFAULT_COLLECTION
      });
      
      console.log(`  ✓ Uploaded: ${assetFolder}/${filename}`);
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
    ownerUsername: result.owner,
    collection: result.collection,
    tags: [], // Can be populated later
    categories: [], // Can be populated later
    status: 'unminted',
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  
  if (ipAssets.length > 0) {
    const insertResult = await db.collection('ip_assets').insertMany(ipAssets);
    console.log(`  Created ${insertResult.insertedCount} IP asset records`);
  }
}

async function processOwner(db, owner, imagePaths) {
  console.log(`\nProcessing ${owner} (${imagePaths.length} images)...`);
  
  let totalUploaded = 0;
  
  for (let i = 0; i < imagePaths.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(imagePaths.length / BATCH_SIZE);
    
    console.log(`  Batch ${batchNum}/${totalBatches}...`);
    const uploadResults = await uploadBatch(imagePaths, owner, i);
    
    if (uploadResults.length > 0) {
      await createIPAssets(db, uploadResults);
      totalUploaded += uploadResults.length;
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < imagePaths.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✓ Completed ${owner}: ${totalUploaded}/${imagePaths.length} uploaded`);
}

async function cleanup() {
  console.log('\nCleaning up temp files...');
  await fs.rm(TEMP_DIR, { recursive: true, force: true });
  console.log('Cleanup complete');
}

async function main() {
  let client;
  
  try {
    console.log('=== MetaWork IP Asset Migration (Dynamic Folders Mode) ===\n');
    
    // Load filename to owner mapping
    const filenameMapping = await loadFilenameMapping();
    
    // Extract and find images
    await extractZip();
    const allImages = await findAllImages(TEMP_DIR);
    console.log(`\nFound ${allImages.length} total images in ZIP`);
    
    // Group by owner
    const groupedImages = groupImagesByOwner(allImages, filenameMapping);
    
    // Connect to MongoDB
    console.log('\nConnecting to MongoDB...');
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('metawork_db');
    console.log('Connected to metawork_db database');
    
    // Process each owner
    let processedCount = 0;
    for (const [owner, imagePaths] of groupedImages) {
      await processOwner(db, owner, imagePaths);
      processedCount++;
    }
    
    console.log(`\n✓ Migration complete: ${processedCount} owners processed`);
    console.log('\nSummary:');
    console.log('  - Images uploaded to Cloudinary Dynamic Folders:');
    console.log('    metawork/ip-assets/{owner}/default/');
    console.log('  - Unassigned images in: metawork/ip-assets/unassigned/default/');
    console.log('  - MongoDB records created in metawork_db.ip_assets');
    console.log('  - You can reassign ownership later through the admin interface');
    
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
