// scripts/migrate-product-images-to-cloudinary.mjs
//
// Migrates USER product images (aisle products) from VPS → Cloudinary → MongoDB
// Skips base MFG catalog products entirely
//
// Usage:
//   node --env-file=.env.local scripts/migrate-product-images-to-cloudinary.mjs --dry-run
//   node --env-file=.env.local scripts/migrate-product-images-to-cloudinary.mjs --limit=10
//   node --env-file=.env.local scripts/migrate-product-images-to-cloudinary.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { MongoClient } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const args     = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit    = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const csvArg   = args.find(a => a.startsWith('--csv='));
const CSV_PATH = csvArg ? csvArg.split('=')[1] : path.join(ROOT, 'wc-product-export.csv');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const stats = { total: 0, migrated: 0, skipped: 0, failed: 0, errors: [] };

function normalise(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function safePublicId(str) {
  return str.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 80);
}

// ── Is this a user aisle product (not a base MFG template)? ─────
function isUserProduct(row) {
  const categories = (row['Categories'] || '').toLowerCase();
  const name       = (row['Name'] || '').toLowerCase();
  const parent     = (row['Parent'] || '').trim();
  const externalId = (row['Meta: _smpf_external_product_id'] || '').trim();

  // Skip variation children (they have a Parent ID)
  if (parent && parent !== '0') return false;

  // Skip anything categorised as MFG catalog
  if (categories.includes('mfg')) return false;
  if (categories.includes('metamanufacturing')) return false;

  // Skip base template names
  if (name.includes('metamanufacturing')) return false;
  if (name.match(/\b(custom t-shirt|ceramic mug|phone case|mug,|poster,|hoodie,)\b/) && !externalId) return false;

  // A real user product will have an external Printful product ID OR have images on the VPS
  const hasImages = (row['Images'] || '').trim().length > 0;
  return hasImages;
}

async function downloadBuffer(url) {
  const res = await fetch(url.replace(/\s+/g, ''), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': 'https://securemetawork.com/',
    },
    timeout: 30000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.buffer();
}

async function uploadToCloudinary(buffer, userId, productId, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `MetaWork/users/${userId}/mockups/${productId}`,
        public_id: 'thumbnail',
        resource_type: 'image',
        overwrite: true,
      },
      (err, result) => err ? reject(err) : resolve(result.secure_url)
    );
    stream.end(buffer);
  });
}

function parseCsv(csvPath) {
  return new Promise((resolve, reject) => {
    console.log(`📄 Parsing CSV: ${csvPath}`);
    const rows = [];
    createReadStream(csvPath)
      .pipe(parse({ columns: true, skip_empty_lines: true, bom: true, relax_quotes: true, relax_column_count: true }))
      .on('data', row => rows.push(row))
      .on('end', () => {
        const userProducts = rows.filter(isUserProduct);
        console.log(`  ✅ ${rows.length} total rows → ${userProducts.length} user aisle products (MFG skipped)\n`);
        resolve(userProducts);
      })
      .on('error', reject);
  });
}

async function migrate(db) {
  const rows = await parseCsv(CSV_PATH);
  const productsCol = db.collection('products');

  console.log('🍃 Loading MongoDB products...');
  const usersCol = db.collection('users');
  const allUsers = await usersCol.find({}, { projection: { _id: 1, username: 1 } }).toArray();
  const userIdByUsername = new Map();
  for (const u of allUsers) {
    if (u.username) userIdByUsername.set(u.username.toLowerCase(), u._id.toString());
  }
  console.log(`  ✅ ${allUsers.length} users loaded\n`);
  const allProducts = await productsCol.find({}).toArray();
  const titleIndex  = new Map();
  for (const p of allProducts) {
    const key = normalise(p.name || p.title || '');
    if (key) titleIndex.set(key, p);
  }
  console.log(`  ✅ ${allProducts.length} MongoDB products loaded\n`);

  const toProcess = limit ? rows.slice(0, limit) : rows;
  stats.total = toProcess.length;

  console.log(`🚀 Processing ${stats.total} user products${isDryRun ? ' [DRY RUN]' : ''}...\n`);

  for (let i = 0; i < toProcess.length; i++) {
    const row  = toProcess[i];
    const name = row['Name'] || '';
    const sku  = row['SKU']  || '';
    const wpId = row['ID']   || String(i);
    const rawImages = row['Images'] || '';
    const imageUrls = rawImages.split(',').map(u => u.trim()).filter(Boolean);
    const imageUrl  = imageUrls[0].replace(/\s+/g, '');

    console.log(`[${i + 1}/${toProcess.length}] "${name}"`);

    if (!imageUrl) {
      console.log(`  ⚠️  No image URL — skipping\n`);
      stats.skipped++;
      stats.errors.push({ name, reason: 'no_image_url' });
      continue;
    }

    // Match by normalised title
    const normName = normalise(name);
    let mongoProduct = titleIndex.get(normName) || null;

    if (!mongoProduct) {
      for (const [key, p] of titleIndex) {
        if (key.length > 4 && (key.includes(normName) || normName.includes(key))) {
          mongoProduct = p;
          break;
        }
      }
    }

    if (!mongoProduct && sku) {
      mongoProduct = allProducts.find(p => p.sku === sku || p.printfulSku === sku) || null;
    }

    if (!mongoProduct) {
      console.log(`  ⚠️  No MongoDB match — skipping\n`);
      stats.skipped++;
      stats.errors.push({ name, reason: 'no_mongo_match', sku, wpId });
      continue;
    }

    let userId = mongoProduct.userId?.toString() || mongoProduct.createdBy?.toString() || null;
    if (!userId) {
      const wpCats = (row['Categories'] || '').split(',').map(c => c.trim());
      for (const cat of wpCats) {
        const found = userIdByUsername.get(cat.toLowerCase());
        if (found) { userId = found; break; }
      }
    }
    if (!userId) {
      console.log(`  ⚠️  Could not resolve userId — skipping\n`);
      stats.skipped++;
      stats.errors.push({ name, reason: 'no_userId' });
      continue;
    }

    const productId = mongoProduct.legacyProductId || wpId || mongoProduct._id.toString();

    console.log(`  🖼️  ${imageUrl}`);
    console.log(`  ☁️   MetaWork/users/${userId}/mockups/${productId}/thumbnail`);

    if (isDryRun) {
      console.log(`  [DRY RUN] Would upload + update\n`);
      stats.migrated++;
      continue;
    }

    try {
      console.log(`  📥 Downloading...`);
      const buffer = await downloadBuffer(imageUrl);

      console.log(`  ⬆️  Uploading...`);
      const secureUrl = await uploadToCloudinary(buffer, userId, productId);
      console.log(`  ✅ ${secureUrl}`);

      await productsCol.updateOne(
        { _id: mongoProduct._id },
        { $set: { thumbnailUrl: secureUrl, mockupImages: [secureUrl] } }
      );
      console.log(`  💾 DB updated\n`);
      stats.migrated++;

    } catch (err) {
      stats.failed++;
      stats.errors.push({ name, reason: 'upload_error', error: err.message, imageUrl });
      console.error(`  ❌ ${err.message}\n`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('='.repeat(60));
  console.log(`✅ Migrated: ${stats.migrated}  ⚠️ Skipped: ${stats.skipped}  ❌ Failed: ${stats.failed}`);

  if (stats.errors.length) {
    const errFile = path.join(__dirname, 'migrate-errors.json');
    fs.writeFileSync(errFile, JSON.stringify(stats.errors, null, 2));
    console.log(`📋 ${stats.errors.length} issues → scripts/migrate-errors.json`);
  }

  if (isDryRun) console.log('\n⚠️  DRY RUN — no changes made');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  const missing = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'MONGODB_URI']
    .filter(k => !process.env[k]);
  if (missing.length) { console.error(`❌ Missing env: ${missing.join(', ')}`); process.exit(1); }

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV not found: ${CSV_PATH}`);
    console.error(`   Rename your export to wc-product-export.csv in the project root`);
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    await migrate(client.db(process.env.DB_NAME || undefined));
  } catch (err) {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

main();