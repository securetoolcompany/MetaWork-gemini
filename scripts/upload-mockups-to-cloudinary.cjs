// scripts/upload-mockups-to-cloudinary.js
require('dotenv').config({ path: '.env' });
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const sharp = require('sharp');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper to generate simple product mockups using canvas-like approach
async function generateProductMockup(text, bgColor, textColor, width, height) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
            fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
        ${text.split('\n')[0]}
      </text>
      <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="32" 
            fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
        ${text.split('\n')[1] || ''}
      </text>
    </svg>
  `;
  
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

// Upload to Cloudinary
async function uploadToCloudinary(buffer, folder, public_id) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id,
        resource_type: 'image',
        overwrite: true
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

// Color palette for variety
const colors = [
  { bg: '#1a1a2e', text: '#ffffff' },
  { bg: '#e94560', text: '#ffffff' },
  { bg: '#16213e', text: '#00fff5' },
  { bg: '#0f3460', text: '#ffffff' },
  { bg: '#134e4a', text: '#10b981' },
  { bg: '#2d3561', text: '#f07b3f' },
  { bg: '#2c3e50', text: '#ecf0f1' },
  { bg: '#8e44ad', text: '#ffffff' },
  { bg: '#ff6b6b', text: '#ffffff' },
  { bg: '#4ecdc4', text: '#1a1a2e' },
];

async function generateAndUploadMockups() {
  console.log('🎨 Starting mockup generation and upload...\n');

  // 1. Generate Product Mockups (T-shirts and Hoodies)
  console.log('📦 Generating product mockups...');
  const productTypes = ['tshirt', 'hoodie'];
  const creatorNames = ['Digital', 'Cosmic', 'Urban', 'Luna', 'Wave', 'Prism'];
  
  let uploadCount = 0;
  for (let i = 0; i < 50; i++) {
    const type = productTypes[i % 2];
    const creator = creatorNames[i % creatorNames.length];
    const color = colors[i % colors.length];
    const text = `${creator}\n${type.toUpperCase()}`;
    
    try {
      const buffer = await generateProductMockup(text, color.bg, color.text, 800, 800);
      const result = await uploadToCloudinary(buffer, 'metawork/products', `${type}_${i}`);
      console.log(`  ✅ Uploaded: ${result.public_id}`);
      uploadCount++;
    } catch (error) {
      console.error(`  ❌ Failed to upload ${type}_${i}:`, error.message);
    }
  }

  // 2. Generate User Avatars
  console.log('\n👤 Generating user avatars...');
  const initials = ['DS', 'CA', 'UR', 'LN', 'WV', 'PR', 'NV', 'ZN', 'FX', 'QT'];
  for (let i = 0; i < 20; i++) {
    const initial = initials[i % initials.length];
    const color = colors[i % colors.length];
    
    try {
      const buffer = await generateProductMockup(initial, color.bg, color.text, 400, 400);
      const result = await uploadToCloudinary(buffer, 'metawork/avatars', `avatar_${i}`);
      console.log(`  ✅ Uploaded: ${result.public_id}`);
      uploadCount++;
    } catch (error) {
      console.error(`  ❌ Failed to upload avatar_${i}:`, error.message);
    }
  }

  // 3. Generate User Banners
  console.log('\n🖼️  Generating user banners...');
  const names = ['Digital Studios', 'Cosmic Art', 'Urban Works', 'Luna Creative', 'Wave Lab'];
  for (let i = 0; i < 20; i++) {
    const name = names[i % names.length];
    const color = colors[i % colors.length];
    
    try {
      const buffer = await generateProductMockup(name, color.bg, color.text, 1200, 300);
      const result = await uploadToCloudinary(buffer, 'metawork/banners', `banner_${i}`);
      console.log(`  ✅ Uploaded: ${result.public_id}`);
      uploadCount++;
    } catch (error) {
      console.error(`  ❌ Failed to upload banner_${i}:`, error.message);
    }
  }

  // 4. Generate Aisle Headers
  console.log('\n🏪 Generating aisle headers...');
  for (let i = 0; i < 20; i++) {
    const name = `${names[i % names.length]}\nCollection`;
    const color = colors[i % colors.length];
    
    try {
      const buffer = await generateProductMockup(name, color.bg, color.text, 1920, 400);
      const result = await uploadToCloudinary(buffer, 'metawork/aisle-headers', `header_${i}`);
      console.log(`  ✅ Uploaded: ${result.public_id}`);
      uploadCount++;
    } catch (error) {
      console.error(`  ❌ Failed to upload header_${i}:`, error.message);
    }
  }

  // 5. Generate IP Asset Images
  console.log('\n🎨 Generating IP asset images...');
  for (let i = 0; i < 60; i++) {
    const color = colors[i % colors.length];
    
    try {
      const buffer = await generateProductMockup('IP\nASSET', color.bg, color.text, 600, 600);
      const result = await uploadToCloudinary(buffer, 'metawork/ip-assets', `ip_${i}`);
      console.log(`  ✅ Uploaded: ${result.public_id}`);
      uploadCount++;
    } catch (error) {
      console.error(`  ❌ Failed to upload ip_${i}:`, error.message);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎉 Upload Complete!`);
  console.log(`📊 Total Images Uploaded: ${uploadCount}`);
  console.log(`☁️  Cloudinary Folder: metawork/`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

generateAndUploadMockups().catch(console.error);
