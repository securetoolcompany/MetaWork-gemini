const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Direct configuration
cloudinary.config({
  cloud_name: 'dplnacuyy',
  api_key: '679561563472943',
  api_secret: 'ZttLpCXR6cRrRmsfF2LwY12VMJY'
});

async function deleteDuplicates() {
  // Fixed: Check and read the SAME file
  if (!fs.existsSync('filename_duplicates.json')) {
    console.error('filename_duplicates.json not found. Run findDuplicates.js first.');
    return;
  }
  
  // Fixed: Read filename_duplicates.json instead of duplicates.json
  const duplicates = JSON.parse(fs.readFileSync('filename_duplicates.json'));
  
  console.log(`Found ${duplicates.length} duplicate files to delete`);
  console.log('Deleting duplicates while keeping specified originals...\n');
  
  let totalDeleted = 0;
  
  for (let i = 0; i < duplicates.length; i++) {
    const item = duplicates[i];
    console.log(`\n${i + 1}/${duplicates.length}:`);
    console.log(`  ✓ Keeping: ${item.kept}`);
    console.log(`  ✗ Deleting: ${item.public_id}`);
    
    try {
      await cloudinary.api.delete_resources([item.public_id], { resource_type: 'image' });
      totalDeleted++;
      console.log(`  ✓ Deleted successfully`);
    } catch (error) {
      console.error(`  ✗ Error deleting:`, error.message);
    }
    
    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✓ Complete!`);
  console.log(`  Deleted: ${totalDeleted} duplicate files`);
  console.log(`${'='.repeat(60)}`);
}

deleteDuplicates().catch(console.error);
