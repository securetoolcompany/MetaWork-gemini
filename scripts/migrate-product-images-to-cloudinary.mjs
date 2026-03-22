// scripts/scrape-and-migrate-product-images.mjs
import { MongoClient } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const WOOCOMMERCE_BASE = 'https://securemetawork.com';

// Stats
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
  errors: []
};

// Cache usernames
const usernameCache = new Map();

async function downloadImage(url, referer) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': referer || 'https://securemetawork.com/',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  return response.buffer();
}

async function uploadToCloudinary(imageBuffer, username, productId, filename) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `metawork/products/${username}/mockups/${productId}`,
        public_id: filename,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(imageBuffer);
  });
}

async function findUsername(db, categories) {
  if (!categories || categories.length === 0) {
    return null;
  }

  for (const category of categories) {
    if (usernameCache.has(category)) {
      const cachedResult = usernameCache.get(category);
      if (cachedResult) return cachedResult;
      continue;
    }

    const user = await db.collection('users').findOne(
      { username: category },
      { projection: { username: 1 } }
    );

    if (user) {
      usernameCache.set(category, user.username);
      return user.username;
    } else {
      usernameCache.set(category, null);
    }
  }

  return null;
}

async function scrapeProductImages(productUrl) {
  try {
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`Product page not found: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const images = [];
    
    // Try to find product images - WooCommerce typically uses these selectors
    // Main product image
    const mainImg = $('.woocommerce-product-gallery__image img').first().attr('src');
    if (mainImg) {
      images.push(mainImg);
    }
    
    // Gallery images
    $('.woocommerce-product-gallery__image img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });
    
    // Fallback: any product images
    if (images.length === 0) {
      $('img[class*="product"]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.includes('/uploads/')) {
          images.push(src);
        }
      });
    }
    
    return images.filter(img => img && img.startsWith('http'));
  } catch (error) {
    throw new Error(`Scrape failed: ${error.message}`);
  }
}

function getProductUrl(product) {
  // Try different URL patterns
  if (product.permalink) {
    return product.permalink;
  }
  
  if (product.slug) {
    return `${WOOCOMMERCE_BASE}/product/${product.slug}/`;
  }
  
  if (product.legacyProductId) {
    return `${WOOCOMMERCE_BASE}/?p=${product.legacyProductId}`;
  }
  
  return null;
}

async function migrateProductImages(db) {
  const productsCollection = db.collection('products');
  
  // Find ALL products (we'll filter by username)
  let products = await productsCollection.find({}).toArray();
  
  // Filter to only products with valid usernames
  const validProducts = [];
  for (const product of products) {
    const username = await findUsername(db, product.categories);
    if (username) {
      validProducts.push({ ...product, _username: username });
    }
  }
  
  if (limit) {
    validProducts.splice(limit);
  }
  
  stats.total = validProducts.length;
  console.log(`\n🔍 Found ${stats.total} products with valid usernames${isDryRun ? ' (DRY RUN)' : ''}\n`);
  
  for (let i = 0; i < validProducts.length; i++) {
    const product = validProducts[i];
    const productId = product.legacyProductId || product._id.toString();
    const username = product._username;
    const title = product.title || product.name || 'Untitled';
    
    console.log(`\n[${i + 1}/${validProducts.length}] Processing: ${title}`);
    console.log(`  👤 Username: ${username}`);
    console.log(`  🆔 Product ID: ${productId}`);
    
    try {
      const productUrl = getProductUrl(product);
      
      if (!productUrl) {
        console.log(`  ⚠️  Could not determine product URL`);
        stats.skipped++;
        continue;
      }
      
      console.log(`  🌐 Product URL: ${productUrl}`);
      
      if (isDryRun) {
        console.log(`  [DRY RUN] Would scrape and migrate images`);
        stats.migrated++;
        continue;
      }
      
      // Scrape images from live site
      console.log(`  🕷️  Scraping product page...`);
      const imageUrls = await scrapeProductImages(productUrl);
      
      if (imageUrls.length === 0) {
        console.log(`  ⚠️  No images found on product page`);
        stats.skipped++;
        continue;
      }
      
      console.log(`  📸 Found ${imageUrls.length} images`);
      
      const updates = {
        originalUrls: {
          thumbnail: product.thumbnailUrl,
          mockups: product.mockupImages || []
        }
      };
      
      // Upload first image as thumbnail
      console.log(`  📥 Downloading thumbnail...`);
      const thumbnailBuffer = await downloadImage(imageUrls[0], productUrl);
      const thumbnailUrl = await uploadToCloudinary(thumbnailBuffer, username, productId, 'thumbnail');
      updates.thumbnailUrl = thumbnailUrl;
      console.log(`  ✅ Thumbnail migrated: ${thumbnailUrl}`);
      
      // Upload remaining images as mockups
      const mockupUrls = [];
      for (let j = 0; j < imageUrls.length; j++) {
        console.log(`  📥 Downloading mockup ${j + 1}/${imageUrls.length}...`);
        const mockupBuffer = await downloadImage(imageUrls[j], productUrl);
        const mockupUrl = await uploadToCloudinary(mockupBuffer, username, productId, `mockup_${j}`);
        mockupUrls.push(mockupUrl);
        console.log(`  ✅ Mockup ${j + 1} migrated`);
      }
      
      updates.mockupImages = mockupUrls;
      
      // Update database
      await productsCollection.updateOne(
        { _id: product._id },
        { $set: updates }
      );
      stats.migrated++;
      console.log(`  💾 Database updated`);
      
      // Rate limiting
      if (i < validProducts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      stats.failed++;
      stats.errors.push({ product: title, url: getProductUrl(product), error: error.message });
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total products processed: ${stats.total}`);
  console.log(`Successfully migrated: ${stats.migrated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(({ product, url, error }) => {
      console.log(`  - ${product}`);
      console.log(`    URL: ${url}`);
      console.log(`    Error: ${error}`);
    });
  }
  
  if (isDryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made');
  }
  
  console.log('='.repeat(60) + '\n');
}

async function main() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Missing Cloudinary configuration');
    process.exit(1);
  }
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ Missing MONGODB_URI');
    process.exit(1);
  }
  
  console.log('🚀 Starting product image scraping and migration...\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    await migrateProductImages(db);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

main();
