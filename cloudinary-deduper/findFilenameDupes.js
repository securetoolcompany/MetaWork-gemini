const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: 'dplnacuyy',
  api_key: '679561563472943',
  api_secret: 'ZttLpCXR6cRrRmsfF2LwY12VMJY'
});

function normalizeFilename(filename) {
  // Remove extension
  let base = filename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
  
  // Remove common duplicate patterns:
  // - (1), (2), (3), etc.
  // - -1, -2, -3, etc.
  // - _1, _2, _3, etc.
  // - -copy, _copy
  // - (copy), (Copy)
  base = base.replace(/[\s_-]?\(?\d+\)?$/i, ''); // xxx (1), xxx-1, xxx_1
  base = base.replace(/[\s_-]?copy$/i, ''); // xxx-copy, xxx_copy
  base = base.replace(/[\s_-]?\(copy\)$/i, ''); // xxx (copy)
  
  return base.toLowerCase().trim();
}

async function findStructuredDuplicates() {
  console.log('Fetching all IP assets...');
  
  let allAssets = [];
  let nextCursor = null;
  
  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'metawork/ip-assets',
      max_results: 500,
      next_cursor: nextCursor
    });
    
    allAssets = allAssets.concat(result.resources);
    nextCursor = result.next_cursor;
    console.log(`Fetched ${allAssets.length} assets...`);
  } while (nextCursor);
  
  console.log(`\nGrouping by normalized filename...`);
  
  // Group by normalized filename
  const filenameGroups = {};
  
  allAssets.forEach(asset => {
    const filename = asset.public_id.split('/').pop();
    const normalizedName = normalizeFilename(filename);
    
    if (!filenameGroups[normalizedName]) {
      filenameGroups[normalizedName] = [];
    }
    
    filenameGroups[normalizedName].push({
      public_id: asset.public_id,
      original_filename: filename,
      url: asset.secure_url,
      format: asset.format,
      bytes: asset.bytes,
      created_at: asset.created_at
    });
  });
  
  // Find duplicates
  const duplicates = Object.entries(filenameGroups)
    .filter(([normalized, assets]) => assets.length > 1)
    .map(([normalized, assets]) => ({
      normalized_name: normalized,
      count: assets.length,
      assets: assets.sort((a, b) => b.bytes - a.bytes) // Sort by size, largest first
    }));
  
  console.log(`\nFound ${duplicates.length} structured duplicate groups\n`);
  
  // Show all groups
  duplicates.forEach((group, idx) => {
    console.log(`${idx + 1}. Normalized: "${group.normalized_name}" (${group.count} copies):`);
    group.assets.forEach(asset => {
      console.log(`   - ${asset.original_filename}`);
      console.log(`     Path: ${asset.public_id}`);
      console.log(`     Size: ${Math.round(asset.bytes/1024)}KB, Format: ${asset.format}`);
    });
    console.log('');
  });
  
  // Create deletion plan (keep largest, delete rest)
  const deletionPlan = [];
  duplicates.forEach(group => {
    const toDelete = group.assets.slice(1);
    toDelete.forEach(asset => {
      deletionPlan.push({
        public_id: asset.public_id,
        original_filename: asset.original_filename,
        normalized_name: group.normalized_name,
        bytes: asset.bytes,
        format: asset.format,
        kept_file: group.assets[0].original_filename,
        kept_path: group.assets[0].public_id
      });
    });
  });
  
  fs.writeFileSync('structured_duplicates.json', JSON.stringify(deletionPlan, null, 2));
  console.log(`\nSaved ${deletionPlan.length} files to delete in structured_duplicates.json`);
  console.log('Review and run deleteStructuredDuplicates() to remove them.');
}

async function deleteStructuredDuplicates() {
  if (!fs.existsSync('structured_duplicates.json')) {
    console.error('structured_duplicates.json not found.');
    return;
  }
  
  const toDelete = JSON.parse(fs.readFileSync('structured_duplicates.json'));
  
  console.log(`Deleting ${toDelete.length} duplicate files...\n`);
  
  let deleted = 0;
  
  // Delete in batches of 100
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const publicIds = batch.map(item => item.public_id);
    
    try {
      console.log(`Deleting batch ${Math.floor(i/100) + 1} (${batch.length} files)...`);
      await cloudinary.api.delete_resources(publicIds);
      deleted += batch.length;
      console.log(`  ✓ Deleted ${deleted}/${toDelete.length}`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ✗ Error:`, error.message);
    }
  }
  
  console.log(`\n✓ Complete! Deleted ${deleted} duplicate files`);
}

// Run analysis
findStructuredDuplicates().catch(console.error);
