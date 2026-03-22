// importMissingUsers.cjs - UPDATED with upsert logic
const fs = require('fs');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI not found in .env file');
  process.exit(1);
}

async function importUsers() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('✓ Connected to MongoDB Atlas\n');
    
    const db = client.db('metawork_db');
    const usersCollection = db.collection('users');
    
    // Read the missing users file
    const missingUsers = JSON.parse(
      fs.readFileSync('./missing-users-import.json', 'utf8')
    );
    
    console.log(`Found ${missingUsers.length} users to import\n`);
    
    let insertedCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    // Insert users one by one to handle duplicates gracefully
    for (const user of missingUsers) {
      try {
        // Check if user already exists
        const existing = await usersCollection.findOne({ email: user.email });
        
        if (existing) {
          console.log(`⊘ Skipped (exists): ${user.name} (${user.email})`);
          skippedCount++;
        } else {
          await usersCollection.insertOne(user);
          console.log(`✓ Inserted: ${user.name} (${user.email})`);
          insertedCount++;
        }
      } catch (error) {
        console.log(`✗ Error: ${user.name} - ${error.message}`);
        errors.push({ user: user.name, error: error.message });
      }
    }
    
    console.log(`\n=== Import Summary ===`);
    console.log(`✓ Successfully inserted: ${insertedCount} users`);
    console.log(`⊘ Skipped (already exist): ${skippedCount} users`);
    console.log(`✗ Errors: ${errors.length} users`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(e => console.log(`  - ${e.user}: ${e.error}`));
    }
    
    // Verify the total user count
    const totalUsers = await usersCollection.countDocuments();
    console.log(`\nTotal users in collection: ${totalUsers}`);
    
  } catch (error) {
    console.error('Error importing users:', error.message);
    throw error;
  } finally {
    await client.close();
    console.log('\n✓ Connection closed');
  }
}

// Run the import
importUsers()
  .then(() => {
    console.log('\n✓ Import completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Import failed:', error);
    process.exit(1);
  });
