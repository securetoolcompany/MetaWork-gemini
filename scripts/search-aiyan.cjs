require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function searchForAiyan() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('metawork_db');
    
    console.log('🔍 Searching for "aiyan" in users collection...\n');
    
    const users = await db.collection('users').find({
      $or: [
        { username: { $regex: 'aiyan', $options: 'i' } },
        { name: { $regex: 'aiyan', $options: 'i' } },
        { email: { $regex: 'aiyan', $options: 'i' } },
        { displayName: { $regex: 'aiyan', $options: 'i' } },
        { bio: { $regex: 'aiyan', $options: 'i' } }
      ]
    }).toArray();
    
    if (users.length > 0) {
      console.log(`✅ Found ${users.length} user(s) with "aiyan":\n`);
      users.forEach(u => {
        console.log(`📋 User:`);
        console.log(`   _id: ${u._id}`);
        console.log(`   id: ${u.id || 'N/A'}`);
        console.log(`   username: ${u.username || 'N/A'}`);
        console.log(`   name: ${u.name || 'N/A'}`);
        console.log(`   email: ${u.email || 'N/A'}`);
        console.log(`   displayName: ${u.displayName || 'N/A'}`);
        console.log('---\n');
      });
    } else {
      console.log('❌ No users found with "aiyan"');
      
      console.log('\n🔍 Searching for "ana" AND "rose" separately...\n');
      
      const anaUsers = await db.collection('users').find({
        $or: [
          { username: { $regex: 'ana', $options: 'i' } },
          { name: { $regex: 'ana', $options: 'i' } }
        ]
      }).toArray();
      
      console.log(`Found ${anaUsers.length} users with "ana":`);
      anaUsers.forEach(u => {
        console.log(`   - username: "${u.username}", name: "${u.name || 'N/A'}", email: "${u.email}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

searchForAiyan();
