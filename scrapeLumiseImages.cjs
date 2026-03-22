// scrapeLumiseImages.cjs - Scrape and upload Lumise design files
require('dotenv').config();
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const cheerio = require('cheerio');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const BATCH_SIZE = 15;
const BASE_URL = 'https://securemetawork.com/wp-content/uploads/lumise_data/images/2025';

// Months to scrape
const MONTHS = ['03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

async function scrapeDirectoryListing(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    const imageFiles = [];
    $('a').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && (href.endsWith('.png') || href.endsWith('.jpg') || href.endsWith('.jpeg') || href.endsWith('.webp'))) {
        // Skip thumbnails and backups
        if (!href.includes('-thumb') && !href.includes('_backup')) {
          imageFiles.push(href);
        }
      }
    });
    
    return imageFiles;
  } catch (error) {
    console.log(`  ⚠️  Could not scrape ${url}: ${error.message}`);
    return [];
  }
}

async function uploadBatch(batch) {
  const results = await Promise.allSettled(
    batch.map(async (url) => {
      try {
        const filename = url.split('/').pop().replace(/\.(jpg|png|jpeg|gif|webp)$/i, '');
        const result = await cloudinary.uploader.upload(url, {
          folder: 'metawork/ip-assets/admin',
          public_id: filename,
          resource_type: 'image'
        });
        return { url, cloudinaryUrl: result.secure_url, filename };
      } catch (error) {
        throw new Error(`Failed: ${error.message}`);
      }
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed = results.filter(r => r.status === 'rejected');
  
  return { successful, failed };
}

async function main() {
  console.log('=== Scraping Lumise Design Files ===\n');
  
  const allImages = [];
  
  // Scrape each month folder
  for (const month of MONTHS) {
    const url = `${BASE_URL}/${month}/`;
    console.log(`Scraping ${url}...`);
    const images = await scrapeDirectoryListing(url);
    
    if (images.length > 0) {
      console.log(`  ✓ Found ${images.length} images in month ${month}`);
      allImages.push(...images.map(img => `${BASE_URL}/${month}/${img}`));
    }
  }
  
  console.log(`\n✓ Total images found: ${allImages.length}\n`);
  
  if (allImages.length === 0) {
    console.log('No images found. Exiting.');
    return;
  }
  
  console.log('=== Uploading to Cloudinary ===\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('metawork');
  const ipAssets = db.collection('ip_assets');
  
  let totalUploaded = 0;
  let totalFailed = 0;
  
  // Upload in batches
  for (let i = 0; i < allImages.length; i += BATCH_SIZE) {
    const batch = allImages.slice(i, i + BATCH_SIZE);
    const { successful, failed } = await uploadBatch(batch);
    
    // Insert successful uploads as IP assets
    if (successful.length > 0) {
      const ipRecords = successful.map(({ url, cloudinaryUrl, filename }) => ({
        title: filename,
        description: '',
        imageUrl: cloudinaryUrl,
        cloudinaryPublicId: cloudinaryUrl.split('/').slice(-2).join('/').split('.')[0],
        ownerUsername: 'admin',
        status: 'unminted',
        originalSourceUrl: url,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      await ipAssets.insertMany(ipRecords);
    }
    
    totalUploaded += successful.length;
    totalFailed += failed.length;
    
    process.stdout.write(`  ✓ ${totalUploaded} uploaded, ${totalFailed} failed\r`);
  }
  
  console.log(`\n\n=== Complete ===`);
  console.log(`Total uploaded: ${totalUploaded}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`IP assets created: ${totalUploaded}`);
  console.log(`\nAll designs assigned to 'admin' - assign to real owners next.`);
  
  await client.close();
}

main().catch(console.error);
