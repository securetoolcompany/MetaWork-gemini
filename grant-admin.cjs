require('dotenv').config({ path: '.env.local' });

const dns = require('node:dns');
const { MongoClient } = require('mongodb');

// Needed locally so Atlas SRV DNS resolution works.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const email = process.argv[2]?.trim().toLowerCase();
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'metawork_db';

if (!email) {
  console.error('Usage: node grant-admin.cjs user@example.com');
  process.exit(1);
}

if (!uri) {
  console.error('❌ MONGODB_URI is missing from .env.local');
  process.exit(1);
}

async function grantAdmin() {
  const client = new MongoClient(uri);

  try {
    await client.connect();

    const users = client.db(dbName).collection('users');

    const result = await users.findOneAndUpdate(
      { email },
      {
        $set: {
          role: 'admin',
          isAdmin: true,
          updatedAt: new Date(),
        },
      },
      {
        returnDocument: 'after',
      },
    );

    if (!result) {
      console.error(`❌ No existing user found for: ${email}`);
      console.error('They must first sign up / log in to create their user record.');
      process.exitCode = 1;
      return;
    }

    console.log('\n✅ Admin granted successfully\n');

    console.table([
      {
        id: result._id.toString(),
        email: result.email,
        username: result.username,
        role: result.role,
        isAdmin: result.isAdmin,
        effectiveAdmin:
          result.isAdmin === true ||
          String(result.role || '').toLowerCase() === 'admin',
      },
    ]);
  } catch (error) {
    console.error('❌ Grant-admin failed:', error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

grantAdmin();