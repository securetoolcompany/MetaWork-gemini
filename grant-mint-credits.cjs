// grant-mint-credits.cjs
// Grants 100 MetaWork mint credits to a user by email address.
// Usage: node grant-mint-credits.cjs
//
// Requires: MONGO_URL (and optionally DB_NAME) in .env.local

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const TARGET_EMAIL  = 'drpavlatos@gmail.com';
const CREDITS_TO_ADD = 150;

async function grantCredits() {
  const client = new MongoClient(process.env.MONGO_URL);

  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || 'metawork_db');
    const users = db.collection('users');

    // Verify the user exists first
    const user = await users.findOne(
      { email: TARGET_EMAIL },
      { projection: { id: 1, email: 1, credits: 1 } }
    );

    if (!user) {
      console.error(`❌ No user found with email: ${TARGET_EMAIL}`);
      process.exit(1);
    }

    const before = user.credits ?? 0;
    console.log(`👤 Found user: ${user.email} (id: ${user.id})`);
    console.log(`💳 Credits before: ${before}`);

    // Atomically increment credits
    const result = await users.findOneAndUpdate(
      { email: TARGET_EMAIL },
      {
        $inc: { credits: CREDITS_TO_ADD },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after', projection: { credits: 1 } }
    );

    const after = result?.credits ?? before + CREDITS_TO_ADD;
    console.log(`✅ Granted ${CREDITS_TO_ADD} mint credits.`);
    console.log(`💳 Credits after: ${after}`);
  } catch (err) {
    console.error('❌ Script failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

grantCredits();