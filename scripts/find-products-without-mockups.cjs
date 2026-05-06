require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

const BROKEN_IDS = [
  '69d96ebbb7f20754f134ae3b','69d96ebbb7f20754f134ad7c',
  '69d96ebbb7f20754f134ad08','69d96ebbb7f20754f134adb6',
  '69d96ebbb7f20754f134ae17','69d96ebbb7f20754f134adc9',
  '69d96ebbb7f20754f134ae4e','69d96ebbb7f20754f134ad0e',
  '69d96ebbb7f20754f134adba','69d96ebbb7f20754f134adfc',
  '69d96ebbb7f20754f134adfb','69d96ebbb7f20754f134ad91',
  '69d96ebbb7f20754f134acc4',
];

const ANGLES = [
  'front','back','left','right','side',
  'detail','lifestyle','flat','model',
  'white-front','white-back','black-front','black-back',
  'natural-front','natural-back',
];

async function probeUrl(url) {
  try {
    const res = await fetch(url.replace(/\s+/g, ''), {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://securemetawork.com/',
      },
    });
    return res.ok;
  } catch { return false; }
}

function extractHash(url) {
  const filename = url.split('/').pop().replace(/\.[^.]+$/, '');
  const parts = filename.split('-');
  return parts[parts.length - 1];
}

function extractSlug(url) {
  const filename = url.split('/').pop().replace(/\.[^.]+$/, '');
  const parts = filename.split('-');
  return parts.slice(0, -1).join('-');
}

function extractDatePath(url) {
  const match = url.match(/uploads\/(\d{4}\/\d{2})\//);
  return match ? match[1] : null;
}

async function dryRun() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('metawork_db');

    const products = await db.collection('products').find({
      _id: { $in: BROKEN_IDS.map(id => new ObjectId(id)) }
    }).toArray();

    let totalFound = 0;

    for (const p of products) {
      const baseUrl = p.image || '';
      if (!baseUrl) { console.log(`⚠️  No base image for ${p.title} — skip\n`); continue; }

      const hash = extractHash(baseUrl);
      const slug = extractSlug(baseUrl);
      const datePath = extractDatePath(baseUrl);
      const ext = baseUrl.split('.').pop();

      console.log(`\n📦 ${p.title || p.name}`);
      console.log(`   base: ${baseUrl}`);

      const colorKeywords = ['white','black','natural','navy','red','blue','grey','gray','beige'];
      const slugParts = slug.split('-');
      let prefixEnd = slugParts.length;
      for (let i = slugParts.length - 1; i >= 0; i--) {
        if (colorKeywords.includes(slugParts[i])) { prefixEnd = i; break; }
      }
      const prefix = slugParts.slice(0, prefixEnd).join('-');

      const found = [];
      for (const angle of ANGLES) {
        const candidate = `https://securemetawork.com/wp-content/uploads/${datePath}/${prefix}-${angle}-${hash}.${ext}`;
        if (candidate === baseUrl) continue;

        const exists = await probeUrl(candidate);
        if (exists) {
          console.log(`  ✅ Would upload: ${candidate}`);
          found.push(candidate);
          totalFound++;
        }
      }

      if (found.length === 0) {
        console.log(`  ℹ️  No additional angles found`);
      } else {
        console.log(`  📊 ${found.length} new image(s) would be added to mockupImages`);
      }
    }

    console.log(`\n🏁 Dry run complete — ${totalFound} total new images would be uploaded across ${products.length} products`);
    console.log(`   Run the real script to apply changes.`);

  } catch (err) {
    console.error('❌ Fatal:', err);
  } finally {
    await client.close();
  }
}

dryRun();