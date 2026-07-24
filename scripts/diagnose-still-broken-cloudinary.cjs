// scripts/diagnose-still-broken-cloudinary.cjs

const path = require('path');
const fs = require('fs');
const dns = require('dns');
const axios = require('axios');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Force DNS (Atlas SRV compatibility)
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function httpStatus(url) {
  if (!url) return { ok: false, status: null, error: 'no-url' };

  try {
    // HEAD is cheaper; some CDNs don’t allow HEAD, so fallback to GET
    const res = await axios.head(url, { timeout: 5000 });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (headErr) {
    try {
      const res = await axios.get(url, { timeout: 5000 });
      return { ok: res.status >= 200 && res.status < 300, status: res.status };
    } catch (getErr) {
      return {
        ok: false,
        status: getErr.response?.status || null,
        error: getErr.message,
      };
    }
  }
}

async function main() {
  const jsonPath = path.join(__dirname, '..', 'broken-cloudinary-products.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const brokenList = JSON.parse(raw);

  console.log(`Loaded ${brokenList.length} products from broken-cloudinary-products.json\n`);

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI env var');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();

  const dbName = 'metawork_db'; // same DB your app uses
  const db = client.db(dbName);
  const productsColl = db.collection('products');

  const stillBroken = [];
  let checked = 0;

  for (const entry of brokenList) {
    checked++;
    const { _id, title: snapshotTitle, url: snapshotUrl } = entry;

    // Fetch current product doc
    const doc = await productsColl.findOne({ _id: new ObjectId(_id) });

    if (!doc) {
      console.log(`⚠️ Product ${_id} not found in DB, skipping.`);
      continue;
    }

    const currentImages = doc.images || [];
    const candidateUrl = currentImages[0]; // primary image in DB

    if (!candidateUrl) {
      console.log(`ℹ️ Product ${_id} has no images array entry, skipping.`);
      continue;
    }

    // Check HTTP status of the current DB image URL
    const statusInfo = await httpStatus(candidateUrl);

    if (!statusInfo.ok) {
      console.log(
        `❌ Still broken: ${_id} | status=${statusInfo.status} | url=${candidateUrl}`
      );
      stillBroken.push({
        _id,
        snapshotTitle,
        snapshotUrl,
        currentUrl: candidateUrl,
        httpStatus: statusInfo.status,
        httpError: statusInfo.error,
      });
    } else {
      console.log(`✅ OK now: ${_id} | status=${statusInfo.status} | url=${candidateUrl}`);
    }
  }

  await client.close();

  const outPath = path.join(
    __dirname,
    '..',
    'still-broken-cloudinary-products.json'
  );
  fs.writeFileSync(outPath, JSON.stringify(stillBroken, null, 2), 'utf8');

  console.log(`\nChecked ${checked} products.`);
  console.log(`Still broken: ${stillBroken.length}`);
  console.log(`Wrote ${stillBroken.length} entries to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});