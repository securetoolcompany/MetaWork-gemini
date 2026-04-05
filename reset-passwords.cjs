require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = "mongodb://metawork_db_user:TestPass123@ac-zpaazct-shard-00-00.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-01.mvwr5sw.mongodb.net:27017,ac-zpaazct-shard-00-02.mvwr5sw.mongodb.net:27017/?ssl=true&replicaSet=atlas-k91915-shard-0&authSource=admin&appName=MetaWorkCluster";
const dbName = 'metawork_db';

async function resetUserPasswords() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const db = client.db(dbName);

    const newPassword = "Password123!";
    console.log(`\n🔐 Hashing universal password: '${newPassword}'...`);
    
    // Hash the password securely so the frontend accepts it
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const users = await db.collection('users').find({}).toArray();
    console.log(`\n👤 Found ${users.length} users. Commencing universal password reset...\n`);

    console.log('==================================================');
    console.log('📋 USER LOGIN CREDENTIALS');
    console.log('==================================================');

    let successCount = 0;
    let missingEmailCount = 0;

    for (const user of users) {
      // Hunt for the email (checking both common fields from your WordPress export)
      const email = user.email || user.contactEmail;
      
      // Get a friendly name for the console output
      const displayName = user.profile?.displayName || user.name || user.username || "Unknown User";

      if (!email) {
        console.log(`   ⚠️ Skipped [${displayName}]: No email address found.`);
        missingEmailCount++;
        continue;
      }

      // Update the user's password in the database
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { password: hashedPassword, updatedAt: new Date() } }
      );

      console.log(`   ✅ ${displayName.padEnd(30)} | ${email}`);
      successCount++;
    }

    console.log('\n==================================================');
    console.log('🎉 PASSWORD RESET COMPLETE');
    console.log(`✅ Accounts Updated: ${successCount}`);
    console.log(`⚠️ Skipped (No Email): ${missingEmailCount}`);
    console.log(`\n🔑 All updated accounts now use the password: ${newPassword}`);
    console.log('==================================================');

  } catch (err) {
    console.error('❌ Script Error:', err);
  } finally {
    await client.close();
  }
}

resetUserPasswords();