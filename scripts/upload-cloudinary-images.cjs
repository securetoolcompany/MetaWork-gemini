// upload-cloudinary-images.cjs - Bulk upload diverse images to Cloudinary
require('dotenv').config({ path: '.env' });
const https = require('https');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Picsum photo service (more reliable than Unsplash for automation)
const getRandomImageUrl = (width, height, seed) => {
  return `https://picsum.photos/${width}/${height}?random=${seed}`;
};

// Download image from URL with redirect following
const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    const request = (currentUrl) => {
      https.get(currentUrl, { 
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }, response => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(filepath);
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`  📥 Downloaded: ${path.basename(filepath)}`);
          resolve(filepath);
        });

        file.on('error', err => {
          fs.unlink(filepath, () => {});
          reject(err);
        });
      }).on('error', err => {
        reject(err);
      });
    };

    request(url);
  });
};

// Upload to Cloudinary
const uploadToCloudinary = async (localPath, cloudinaryPath) => {
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      public_id: cloudinaryPath,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      format: 'png'
    });
    console.log(`  ✅ Uploaded: ${cloudinaryPath}.png`);
    return result;
  } catch (error) {
    console.error(`  ❌ Failed: ${cloudinaryPath}`, error.message);
    throw error;
  }
};

// Main upload function
async function uploadImages() {
  console.log('\n🚀 Starting Cloudinary Image Upload\n');
  console.log(`📷 Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}\n`);

  // Create temp directory
  const tempDir = path.join(__dirname, 'temp_images');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const totalImages = 60;
  let uploaded = 0;
  let failed = 0;

  try {
    // 1. Upload 20 Avatars (400x400)
    console.log('👤 Uploading 20 avatars (400x400)...\n');
    for (let i = 0; i < 20; i++) {
      try {
        const seed = Date.now() + i;
        const imageUrl = getRandomImageUrl(400, 400, seed);
        const tempPath = path.join(tempDir, `avatar_${i}.jpg`);
        
        console.log(`[${i + 1}/20] Processing avatar_${i}...`);
        await downloadImage(imageUrl, tempPath);
        await uploadToCloudinary(tempPath, `metawork/avatars/avatar_${i}`);
        
        fs.unlinkSync(tempPath);
        uploaded++;
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`  ❌ Error on avatar_${i}:`, err.message);
        failed++;
      }
    }

    // 2. Upload 20 Banners (1200x300)
    console.log('\n🎨 Uploading 20 banners (1200x300)...\n');
    for (let i = 0; i < 20; i++) {
      try {
        const seed = Date.now() + i + 1000;
        const imageUrl = getRandomImageUrl(1200, 300, seed);
        const tempPath = path.join(tempDir, `banner_${i}.jpg`);
        
        console.log(`[${i + 1}/20] Processing banner_${i}...`);
        await downloadImage(imageUrl, tempPath);
        await uploadToCloudinary(tempPath, `metawork/banners/banner_${i}`);
        
        fs.unlinkSync(tempPath);
        uploaded++;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`  ❌ Error on banner_${i}:`, err.message);
        failed++;
      }
    }

    // 3. Upload 20 Headers (1200x400)
    console.log('\n🖼️  Uploading 20 aisle headers (1200x400)...\n');
    for (let i = 0; i < 20; i++) {
      try {
        const seed = Date.now() + i + 2000;
        const imageUrl = getRandomImageUrl(1200, 400, seed);
        const tempPath = path.join(tempDir, `header_${i}.jpg`);
        
        console.log(`[${i + 1}/20] Processing header_${i}...`);
        await downloadImage(imageUrl, tempPath);
        await uploadToCloudinary(tempPath, `metawork/aisle-headers/header_${i}`);
        
        fs.unlinkSync(tempPath);
        uploaded++;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`  ❌ Error on header_${i}:`, err.message);
        failed++;
      }
    }

    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir).forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
      fs.rmdirSync(tempDir);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 UPLOAD COMPLETE!\n');
    console.log(`📊 Summary:`);
    console.log(`  • ${uploaded}/${totalImages} images uploaded successfully`);
    console.log(`  • ${failed} failed`);
    console.log(`  • 20 avatars (400x400)`);
    console.log(`  • 20 banners (1200x300)`);
    console.log(`  • 20 headers (1200x400)\n`);
    console.log('🔗 Sample images:');
    console.log(`   https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/metawork/avatars/avatar_0`);
    console.log(`   https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/metawork/banners/banner_0`);
    console.log(`   https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/metawork/aisle-headers/header_0\n`);
    console.log('✅ Next step: Hard refresh your browser (Ctrl+Shift+R) to see new images!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Upload Error:', error);
    process.exit(1);
  }
}

// Run the upload
uploadImages();
