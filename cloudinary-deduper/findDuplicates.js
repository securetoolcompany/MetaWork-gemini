const cloudinary = require('cloudinary').v2;
const imghash = require('imghash');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Direct configuration
cloudinary.config({
  cloud_name: 'dplnacuyy',
  api_key: '679561563472943',
  api_secret: 'ZttLpCXR6cRrRmsfF2LwY12VMJY'
});

// Function to download image to buffer
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function findDuplicates() {
  console.log('Fetching ALL assets from Cloudinary...');
  
  let allAssets = [];
  let nextCursor = null;
  
  // Fetch ALL assets (no prefix filter)
  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      max_results: 500,
      next_cursor: nextCursor
    });
    
    allAssets = allAssets.concat(result.resources);
    nextCursor = result.next_cursor;
    console.log(`Fetched ${allAssets.length} assets so far...`);
  } while (nextCursor);
  
  console.log(`Total assets: ${allAssets.length}`);
  console.log('Computing perceptual hashes...');
  
  const hashes = {};
  let processed = 0;
  let errors = 0;
  
  for (const asset of allAssets) {
    try {
      // Use thumbnail URL to save bandwidth
      const thumbUrl = asset.secure_url.replace('/upload/', '/upload/w_200/');
      
      // Download image to buffer
      const imageBuffer = await downloadImage(thumbUrl);
      
      // Calculate hash from buffer
      const hash = await imghash.hash(imageBuffer, 16);
      
      if (!hashes[hash]) {
        hashes[hash] = [];
      }
      hashes[hash].push({
        public_id: asset.public_id,
        url: asset.secure_url,
        format: asset.format,
        bytes: asset.bytes,
        created_at: asset.created_at
      });
      
      processed++;
      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${allAssets.length} (${errors} errors)`);
      }
    } catch (error) {
      errors++;
      console.error(`Error processing ${asset.public_id}: ${error.message}`);
    }
  }
  
  // Find duplicate groups
  const duplicateGroups = Object.entries(hashes)
    .filter(([hash, assets]) => assets.length > 1)
    .map(([hash, assets]) => assets);
  
  console.log(`\nProcessed: ${processed}/${allAssets.length}`);
  console.log(`Errors: ${errors}`);
  console.log(`Found ${duplicateGroups.length} duplicate groups`);
  
  // Save to file
  const report = {
    totalAssets: allAssets.length,
    processedAssets: processed,
    errors: errors,
    duplicateGroups: duplicateGroups.length,
    groups: duplicateGroups
  };
  
  fs.writeFileSync('duplicates.json', JSON.stringify(report, null, 2));
  console.log('Saved to duplicates.json');
  
  // Print summary
  duplicateGroups.forEach((group, index) => {
    console.log(`\nGroup ${index + 1} (${group.length} duplicates):`);
    group.forEach(asset => {
      console.log(`  - ${asset.public_id} (${asset.format}, ${Math.round(asset.bytes/1024)}KB)`);
    });
  });
}

findDuplicates().catch(console.error);
