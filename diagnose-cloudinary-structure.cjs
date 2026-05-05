// scripts/cloudinary-audit.cjs
// Run with: node scripts/cloudinary-audit.cjs

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dplnacuyy';
const API_KEY    = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('❌  Missing CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET in .env.local');
  process.exit(1);
}

const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

function get(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudinary.com',
      path,
      headers: { Authorization: `Basic ${auth}` },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function listFolders(prefix = '') {
  const endpoint = prefix
    ? `/v1_1/${CLOUD_NAME}/folders/${encodeURIComponent(prefix)}`
    : `/v1_1/${CLOUD_NAME}/folders`;
  const result = await get(endpoint);
  return result.folders || [];
}

async function listResources(prefix, maxResults = 10) {
  const endpoint = `/v1_1/${CLOUD_NAME}/resources/image?type=upload&prefix=${encodeURIComponent(prefix)}&max_results=${maxResults}`;
  const result = await get(endpoint);
  return result.resources || [];
}

async function walkFolders(prefix = '', depth = 0) {
  const indent = '  '.repeat(depth);
  const folders = await listFolders(prefix);

  if (folders.length === 0 && depth > 0) {
    // Leaf folder — show sample images
    const resources = await listResources(prefix, 3);
    if (resources.length > 0) {
      console.log(`${indent}📁 ${prefix}/`);
      resources.forEach(r => {
        console.log(`${indent}   🖼  ${r.public_id}  (${r.format}, ${Math.round(r.bytes/1024)}KB)`);
        console.log(`${indent}       URL: ${r.secure_url}`);
      });
    } else {
      console.log(`${indent}📂 ${prefix}/  [EMPTY]`);
    }
    return;
  }

  if (depth === 0 && folders.length === 0) {
    console.log('No folders found at root.');
    return;
  }

  // Filter to only MetaWork-related folders at root level
  const relevantFolders = depth === 0
    ? folders.filter(f => f.name.toLowerCase().includes('metawork') || f.path.toLowerCase().includes('metawork'))
    : folders;

  // If nothing MetaWork-specific at root, show everything
  const toWalk = (depth === 0 && relevantFolders.length === 0) ? folders : relevantFolders;

  for (const folder of toWalk) {
    console.log(`${indent}📁 ${folder.path}/`);
    if (depth < 4) {
      await walkFolders(folder.path, depth + 1);
    }
  }
}

async function searchForMockups() {
  console.log('\n🔍 Searching for mockup images...\n');
  const endpoint = `/v1_1/${CLOUD_NAME}/resources/search`;
  
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      expression: 'public_id:*mockup*',
      max_results: 20,
      sort_by: [{ created_at: 'desc' }],
    });

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUD_NAME}/resources/search`,
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        const resources = result.resources || [];
        if (resources.length === 0) {
          console.log('  No mockup images found.');
        } else {
          resources.forEach(r => {
            console.log(`  📦 ${r.public_id}`);
            console.log(`     URL: ${r.secure_url}\n`);
          });
        }
        resolve(resources);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log(`\n☁️  Cloudinary Audit — Cloud: ${CLOUD_NAME}\n`);
  console.log('━'.repeat(60));
  console.log('\n📂 FOLDER STRUCTURE:\n');

  await walkFolders('MetaWork');

  await searchForMockups();

  console.log('\n━'.repeat(60));
  console.log('✅  Audit complete.\n');
})();