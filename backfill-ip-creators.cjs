// fix-nova-ip-owners.cjs
// Usage:
//   node fix-nova-ip-owners.cjs

const dns = require('dns');
const { MongoClient } = require('mongodb');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const URI = 'mongodb+srv://metawork_db_user:TestPass123@metaworkcluster.mvwr5sw.mongodb.net/metawork_db?retryWrites=true&w=majority';
const DB_NAME = 'metawork_db';

// Nova's email
const NOVA_EMAIL = 'novadaoholbrook14@gmail.com';

// The IPs you know belong to Nova and are wrong/missing
const NOVA_IP_IDS = [
  '6a46ef0511ba399e362726ff', // already fixed
  '6a46ecf8a4051c307267ef34', // already fixed
  '6a468220a2090c690e29e7e3', // NEW: still shows chelsloveshair
];

async function run() {
  const client = new MongoClient(URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Look up Nova by email
    const nova = await db.collection('users').findOne({ email: NOVA_EMAIL });
    if (!nova) {
      console.error('Nova user not found for email', NOVA_EMAIL);
      process.exit(1);
    }

    const novaId = nova.id;
    const displayName =
      (nova.profile && nova.profile.displayName) ||
      nova.username ||
      nova.email;

    const avatar =
      (nova.profile && nova.profile.avatar) ||
      nova.avatar ||
      nova.profileImage ||
      '';

    console.log('Nova user id:', novaId);
    console.log('Nova display name:', displayName);

    const result = await db.collection('ip_assets').updateMany(
      { id: { $in: NOVA_IP_IDS } },
      {
        $set: {
          ownerId: novaId,
          ownerName: displayName,
          ownerUsername: nova.username,
          ownerAvatar: avatar,
        },
      }
    );

    console.log(
      `Matched ${result.matchedCount} documents, modified ${result.modifiedCount}`
    );
  } catch (err) {
    console.error('Fix Nova IPs error:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();