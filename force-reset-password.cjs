require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

// --- CHANGE THESE VARIABLES TO RESET SOMEONE ---
const TARGET_USERNAME_OR_EMAIL = "nova"; 
const NEW_PASSWORD = "Password123!";
// ---------------------------------------------

async function forceResetPassword() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('metawork_db'); 

  console.log(`🔍 Looking for user: ${TARGET_USERNAME_OR_EMAIL}...`);

  try {
    // Find the user by either username or email
    const user = await db.collection('users').findOne({
      $or: [
        { username: TARGET_USERNAME_OR_EMAIL },
        { email: TARGET_USERNAME_OR_EMAIL }
      ]
    });

    if (!user) {
      console.log(`❌ Error: Could not find an account matching '${TARGET_USERNAME_OR_EMAIL}'.`);
      return;
    }

    // Hash the new password exactly how your auth system expects it
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

    // Update the database
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );

    console.log(`✅ Success! Password for '${user.username}' has been changed to: ${NEW_PASSWORD}`);

  } catch (err) {
    console.error('❌ Database error:', err);
  } finally {
    await client.close();
  }
}

forceResetPassword();