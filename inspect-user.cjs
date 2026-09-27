require('dotenv').config({ path: '.env.local' });

const dns = require('node:dns');
const { MongoClient } = require('mongodb');

// Required on this machine/network so MongoDB Atlas SRV lookups work.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const email = (process.argv[2] || 'vyzion82@gmail.com').trim().toLowerCase();
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'metawork_db';

if (!uri) {
  console.error('❌ MONGODB_URI is missing from .env.local');
  process.exit(1);
}

async function inspectUser() {
  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(dbName);
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      console.error(`❌ No user found with email: ${email}`);
      process.exitCode = 1;
      return;
    }

    const safeUser = { ...user };

    if (safeUser.password) {
      safeUser.password = '[REDACTED]';
    }

    console.log('\n=== FULL USER RECORD (PASSWORD REDACTED) ===\n');
    console.dir(safeUser, { depth: null, colors: true });

    const effectiveAdmin =
      user.isAdmin === true ||
      String(user.role || '').toLowerCase() === 'admin';

    console.log('\n=== ADMIN CHECK ===\n');
    console.table([
      {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role ?? null,
        isAdmin: user.isAdmin ?? null,
        effectiveAdmin,
      },
    ]);
  } catch (error) {
    console.error('❌ Inspect failed:', error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

inspectUser();