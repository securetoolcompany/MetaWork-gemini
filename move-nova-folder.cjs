require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const axios = require('axios');
const xml2js = require('xml2js');

async function directLinkFix() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  const client = new MongoClient(process.env.MONGODB_URI);
  const parser = new xml2js.Parser();
  const NOVA_USER_ID = "6976ba9474b6ffa77d502a2c";

  // These are the confirmed working direct image paths
  const ASSETS = [
    {
      id: "660762",
      url: "https://securemetawork.com/wp-content/uploads/2025/10/all-over-print-minimalist-backpack-white-front-68fac15322b96.jpg",
      title: "Bakugo Line Art Backpack -n0va4HuB"
    },
    {
      id: "660781",
      url: "https://securemetawork.com/wp-content/uploads/2025/10/all-over-print-minimalist-backpack-white-front-68fab57ae9023.jpg",
      title: "Chinchilla Dragon Backpack - n0va4HuB"
    },
    {
      id: "660771",
      url: "https://securemetawork.com/wp-content/uploads/2025/10/all-over-print-minimalist-backpack-white-front-68f805e6a6a8d.jpg",
      title: "The Dragon's Lair Pillow Case - n0va4HuB"
    },
    {
      id: "660783",
      url: "https://securemetawork.com/wp-content/uploads/2025/10/spiral-notebook-white-front-68fada21631ec-600x600.jpg",
      title: "Katsuki Bakugou Spiral Notebook - n0va4HuB"
    }
  ];

  try {
    const xmlData = fs.readFileSync('./metawork product export.xml', 'utf8');
    const result = await parser.parseStringPromise(xmlData);
    const items = result.rss.channel[0].item;

    await client.connect();
    const db = client.db('metawork_db');

    for (const asset of ASSETS) {
      console.log(`🚀 Forcing Sync for: ${asset.title}`);

      try {
        // 1. Get image buffer through your local machine
        const response = await axios.get(asset.url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // 2. Stream to Cloudinary
        const uploadPath = `MetaWork/users/${NOVA_USER_ID}/products/mockups/${asset.id}/main`;
        const cldRes = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { public_id: uploadPath, overwrite: true, resource_type: "image" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(buffer);
        });

        // 3. Find metadata in XML
        const xmlItem = items.find(i => i['wp:post_id'][0] === asset.id);
        const metaMap = {};
        if (xmlItem && xmlItem['wp:postmeta']) {
          xmlItem['wp:postmeta'].forEach(m => {
            metaMap[m['wp:meta_key'][0]] = m['wp:meta_value'][0];
          });
        }

        // 4. Upsert into MongoDB
        const productDoc = {
          userId: NOVA_USER_ID,
          name: asset.title,
          description: xmlItem ? xmlItem['content:encoded'][0].replace(/<[^>]*>?/gm, '').trim() : "Restored Nova Asset",
          image: cldRes.secure_url,
          price: parseFloat(metaMap._price || 0),
          status: "active",
          showroomListed: true,
          isPublic: true,
          isDraft: false,
          printfulData: {
            templateId: metaMap._smpf_template_id || asset.id,
            sku: metaMap._sku || null
          },
          legacyMetadata: metaMap,
          updatedAt: new Date()
        };

        await db.collection('products').updateOne(
          { name: asset.title, userId: NOVA_USER_ID },
          { $set: productDoc },
          { upsert: true }
        );

        console.log(`✅ Success: ${asset.title} is live.`);

      } catch (err) {
        console.error(`❌ Error syncing ${asset.title}:`, err.message);
      }
    }

  } finally {
    await client.close();
  }
}

directLinkFix();