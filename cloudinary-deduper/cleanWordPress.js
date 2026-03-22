const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Direct configuration
cloudinary.config({
  cloud_name: 'dplnacuyy',
  api_key: '679561563472943',
  api_secret: 'ZttLpCXR6cRrRmsfF2LwY12VMJY'
});

async function analyzeWordPressImages() {
  console.log('Fetching WordPress images...');
  
  let wpImages = [];
  let nextCursor = null;
  
  // Get all securemetawork.com images
  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'securemetawork.com',
      max_results: 500,
      next_cursor: nextCursor
    });
    
    wpImages = wpImages.concat(result.resources);
    nextCursor = result.next_cursor;
    console.log(`Found ${wpImages.length} WordPress files...`);
  } while (nextCursor);
  
  console.log(`\nFetching metawork/ip-assets images...`);
  
  let ipAssets = [];
  nextCursor = null;
  
  // Get all metawork/ip-assets images
  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'metawork/ip-assets',
      max_results: 500,
      next_cursor: nextCursor
    });
    
    ipAssets = ipAssets.concat(result.resources);
    nextCursor = result.next_cursor;
    console.log(`Found ${ipAssets.length} IP assets...`);
  } while (nextCursor);
  
  // Filter WordPress images to only lumise_data/images (actual IP content)
  const wpIPImages = wpImages.filter(img => 
    img.public_id.includes('/lumise_data/images/')
  );
  
  console.log(`\nWordPress IP images (lumise_data/images): ${wpIPImages.length}`);
  console.log(`System files (plugins, themes, etc): ${wpImages.length - wpIPImages.length}`);
  
  // Build a map of IP asset filenames
  const ipAssetNames = new Set();
  ipAssets.forEach(asset => {
    const filename = asset.public_id.split('/').pop();
    ipAssetNames.add(filename);
  });
  
  // Find WordPress IP images that DON'T exist in metawork/ip-assets
  const uniqueWPImages = wpIPImages.filter(wpImg => {
    const filename = wpImg.public_id.split('/').pop();
    return !ipAssetNames.has(filename);
  });
  
  console.log(`\nUnique WordPress IP images (need to move): ${uniqueWPImages.length}`);
  
  if (uniqueWPImages.length > 0) {
    console.log('\nUnique images to save:');
    uniqueWPImages.forEach(img => {
      console.log(`  - ${img.public_id} (${Math.round(img.bytes/1024)}KB)`);
    });
    
    // Create move plan for unique images
    const movePlan = uniqueWPImages.map(img => {
      const filename = img.public_id.split('/').pop();
      return {
        source: img.public_id,
        target: `metawork/ip-assets/unassigned/default/${filename}`,
        bytes: img.bytes,
        format: img.format
      };
    });
    
    fs.writeFileSync('save_unique_wp_images.json', JSON.stringify(movePlan, null, 2));
    console.log('\nSaved move plan to save_unique_wp_images.json');
    console.log('Review this file, then run moveUniqueImages() to save them before deleting WordPress folder.');
  } else {
    console.log('\n✓ All WordPress IP images already exist in metawork/ip-assets!');
    console.log('Safe to delete entire securemetawork.com folder.');
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY:');
  console.log(`  WordPress system files: ${wpImages.length - wpIPImages.length}`);
  console.log(`  WordPress IP images (already in metawork): ${wpIPImages.length - uniqueWPImages.length}`);
  console.log(`  WordPress IP images (unique, need to save): ${uniqueWPImages.length}`);
  console.log(`${'='.repeat(60)}`);
}

async function moveUniqueImages() {
  if (!fs.existsSync('save_unique_wp_images.json')) {
    console.error('save_unique_wp_images.json not found.');
    return;
  }
  
  const toMove = JSON.parse(fs.readFileSync('save_unique_wp_images.json'));
  
  if (toMove.length === 0) {
    console.log('No unique images to move!');
    return;
  }
  
  console.log(`Moving ${toMove.length} unique WordPress images to metawork/ip-assets...\n`);
  
  let successCount = 0;
  
  for (let i = 0; i < toMove.length; i++) {
    const move = toMove[i];
    
    try {
      console.log(`[${i + 1}/${toMove.length}] Moving ${move.source.split('/').pop()}...`);
      
      await cloudinary.uploader.rename(
        move.source,
        move.target,
        { overwrite: false }
      );
      
      successCount++;
      console.log(`  ✓ Saved to ${move.target}`);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
  }
  
  console.log(`\n✓ Saved ${successCount} unique images to metawork/ip-assets`);
}

async function deleteWordPressFolder() {
  console.log('Deleting all securemetawork.com files...\n');
  
  try {
    const result = await cloudinary.api.delete_resources_by_prefix(
      'securemetawork.com',
      { resource_type: 'image' }
    );
    
    console.log('✓ WordPress folder deleted!');
    console.log(result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run analysis first
// analyzeWordPressImages().catch(console.error);

moveUniqueImages().catch(console.error);

