require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

async function extractAllUsers() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('metawork_db'); // Your actual database name

    
    // Fetch all users
    const users = await db.collection('users')
      .find({})
      .project({ 
        password: 0 // Exclude password field for security
      })
      .toArray();
    
    console.log(`\n📊 Found ${users.length} users:\n`);
    
    // Display users in a readable format
    users.forEach((user, index) => {
      console.log(`${index + 1}. User:`);
      console.log(`   _id: ${user._id}`);
      console.log(`   id: ${user.id || 'N/A'}`);
      console.log(`   username: ${user.username || 'N/A'}`);
      console.log(`   email: ${user.email || 'N/A'}`);
      console.log(`   name: ${user.name || user.displayName || 'N/A'}`);
      console.log(`   createdAt: ${user.createdAt || 'N/A'}`);
      console.log('---');
    });
    
    // Save to JSON file
    const fs = require('fs');
    fs.writeFileSync(
      'users-export.json', 
      JSON.stringify(users, null, 2)
    );
    console.log('\n💾 Users saved to users-export.json');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

extractAllUsers();
