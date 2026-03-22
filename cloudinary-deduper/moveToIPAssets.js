const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Direct configuration
cloudinary.config({
  cloud_name: 'dplnacuyy',
  api_key: '679561563472943',
  api_secret: 'ZttLpCXR6cRrRmsfF2LwY12VMJY'
});

async function moveFilesToIPAssets() {
  if (!fs.existsSync('duplicates.json')) {
    console.error('duplicates.json not found.');
    return;
  }
  
  const report = JSON.parse(fs.readFileSync('duplicates.json'));
  const groups = report.groups;
  
  console.log('Analyzing which files were kept and need to be moved...\n');
  
  let movedCount = 0;
  let alreadyInPlace = 0;
  let toMove = [];
  
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    
    // Sort by file size to find what was kept (largest)
    const sortedGroup = [...group].sort((a, b) => b.bytes - a.bytes);
    const keptFile = sortedGroup[0];
    
    // Check if kept file is NOT in metawork/ip-assets/
    if (!keptFile.public_id.startsWith('metawork/ip-assets/')) {
      // Find if there was a metawork/ip-assets version that got deleted
      const ipAssetVersion = group.find(asset => 
        asset.public_id.startsWith('metawork/ip-assets/')
      );
      
      if (ipAssetVersion) {
        toMove.push({
          source: keptFile.public_id,
          target: ipAssetVersion.public_id,
          bytes: keptFile.bytes,
          format: keptFile.format
        });
      }
    } else {
      alreadyInPlace++;
    }
  }
  
  console.log(`Analysis complete:`);
  console.log(`  Already in metawork/ip-assets/: ${alreadyInPlace}`);
  console.log(`  Need to move: ${toMove.length}`);
  console.log(`\nFiles to move:\n`);
  
  // Save move plan
  fs.writeFileSync('move_plan.json', JSON.stringify(toMove, null, 2));
  console.log('Saved move plan to move_plan.json\n');
  
  // Preview first 10
  toMove.slice(0, 10).forEach((move, idx) => {
    console.log(`${idx + 1}. FROM: ${move.source}`);
    console.log(`   TO:   ${move.target}`);
    console.log(`   Size: ${Math.round(move.bytes/1024)}KB, Format: ${move.format}\n`);
  });
  
  if (toMove.length > 10) {
    console.log(`... and ${toMove.length - 10} more (see move_plan.json)\n`);
  }
  
  // Ask for confirmation
  console.log('Review move_plan.json, then run executeMove() to proceed.');
}

async function executeMove() {
  if (!fs.existsSync('move_plan.json')) {
    console.error('move_plan.json not found. Run moveFilesToIPAssets() first.');
    return;
  }
  
  const toMove = JSON.parse(fs.readFileSync('move_plan.json'));
  
  console.log(`Starting to move ${toMove.length} files...\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < toMove.length; i++) {
    const move = toMove[i];
    
    try {
      console.log(`[${i + 1}/${toMove.length}] Moving ${move.source.split('/').pop()}...`);
      
      // Rename (move) the file in Cloudinary
      await cloudinary.uploader.rename(
        move.source,
        move.target,
        { overwrite: true, invalidate: true }
      );
      
      successCount++;
      console.log(`  ✓ Moved to ${move.target}`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      errorCount++;
      console.error(`  ✗ Error: ${error.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✓ Move complete!`);
  console.log(`  Successfully moved: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`${'='.repeat(60)}`);
}

// Run analysis first
// moveFilesToIPAssets().catch(console.error);

executeMove().catch(console.error);
