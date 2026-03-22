// scripts/scan-cloudinary-extensions.cjs
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function scanCloudinaryFolders() {
  const rootPath = 'metawork/products';
  console.log(`--- Scanning Cloudinary path: ${rootPath} ---\n`);

  try {
    // 1. Get all subfolders (Usernames)
    const { folders: userFolders } = await cloudinary.api.sub_folders(rootPath);

    for (const userFolder of userFolders) {
      const mockupsPath = `${userFolder.path}/mockups`;
      console.log(`👤 User Folder: ${userFolder.name}`);

      try {
        // 2. Get product ID folders inside /mockups
        const { folders: idFolders } = await cloudinary.api.sub_folders(mockupsPath);

        for (const idFolder of idFolders) {
          // 3. List all images inside each ID folder
          const { resources } = await cloudinary.api.resources({
            type: 'upload',
            prefix: idFolder.path,
            max_results: 50
          });

          const extensions = resources.map(r => r.format).join(', ');
          console.log(`   📦 ID ${idFolder.name}: [${extensions}]`);
          
          resources.forEach(r => {
             console.log(`      -> ${r.public_id.split('/').pop()}.${r.format}`);
          });
        }
      } catch (err) {
        console.log(`   ⚠️  No /mockups folder found for ${userFolder.name}`);
      }
      console.log('---');
    }
  } catch (error) {
    console.error('Error scanning Cloudinary:', error.message);
  }
}

scanCloudinaryFolders();