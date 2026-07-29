// inspect-ip-assets.cjs
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first'); // Node 20+/24+/Atlas DNS fix [web:88][web:91]

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

(async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'metawork_db';

  if (!uri) {
    console.error('MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection('ip_assets');

    console.log('🔎 Fetching all IP assets from ip_assets');

    const ips = await collection
      .find({})
      .sort({ createdAt: 1 })
      .toArray();

    console.log(`\nFound ${ips.length} IP assets\n`);

    ips.forEach((ip, index) => {
      const imageUrl = ip.imageUrl || ip.thumbnailUrl || ip.image || null;

      console.log(`===== IP #${index + 1} =====`);
      console.log(' _id:        ', ip._id?.toString());
      console.log(' id:         ', ip.id);
      console.log(' name:       ', ip.name);
      console.log(' status:     ', ip.status);
      console.log(' isPublic:   ', ip.isPublic);
      console.log(' assetType:  ', ip.assetType);
      console.log(' category:   ', ip.category);
      console.log(' tags:       ', ip.tags);
      console.log(' imageUrl:   ', imageUrl);
      console.log(' ownerId:    ', ip.ownerId?.toString());
      console.log(' createdAt:  ', ip.createdAt);
      console.log(' updatedAt:  ', ip.updatedAt);
      console.log('---------------------------\n');
    });

    // Optional: raw JSON dump for diffing in an editor
    // console.log(JSON.stringify(ips, null, 2));
  } catch (err) {
    console.error('DB playground error:', err);
  } finally {
    await client.close();
  }
})();