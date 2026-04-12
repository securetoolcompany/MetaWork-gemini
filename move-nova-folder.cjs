require('dotenv').config({ path: '.env.local' });
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function diagnoseCloudinary() {
  try {
    console.log('📡 Scanning Cloudinary structure... This may take a minute depending on file count.');
    
    let allResources = [];
    // Scan both the legacy lowercase and new uppercase root folders
    const prefixes = ['metawork/', 'MetaWork/'];

    for (const prefix of prefixes) {
        let nextCursor = null;
        do {
            const result = await cloudinary.api.resources({
                type: 'upload',
                prefix: prefix,
                max_results: 500,
                next_cursor: nextCursor
            });
            allResources = allResources.concat(result.resources);
            nextCursor = result.next_cursor;
        } while (nextCursor);
    }

    console.log(`\n📦 Found ${allResources.length} total files across all MetaWork folders.`);

    // Group files by their exact directory path
    const directoryMap = {};

    allResources.forEach(file => {
        const parts = file.public_id.split('/');
        parts.pop(); // Remove the actual filename so we just get the folder path
        
        const dirPath = parts.join('/') || 'ROOT';
        directoryMap[dirPath] = (directoryMap[dirPath] || 0) + 1;
    });

    // Sort alphabetically so folders and subfolders group together naturally
    const sortedDirs = Object.entries(directoryMap).sort((a, b) => a[0].localeCompare(b[0]));

    console.log("\n==================================================");
    console.log("📂 CLOUDINARY DIRECTORY MAP");
    console.log("==================================================");
    
    let currentRoot = '';

    for (const [dir, count] of sortedDirs) {
        // Just for visual grouping in the console
        const rootFolder = dir.split('/')[0] + '/' + (dir.split('/')[1] || '');
        if (rootFolder !== currentRoot) {
            console.log(`\n🗂️  ${rootFolder.toUpperCase()}`);
            currentRoot = rootFolder;
        }

        console.log(`   ├─ ${dir}  (${count} files)`);
    }
    
    console.log("\n==================================================");
    console.log("✅ Scan Complete. No files were altered.");

  } catch (err) {
    console.error('❌ Script Error:', err);
  }
}

diagnoseCloudinary();