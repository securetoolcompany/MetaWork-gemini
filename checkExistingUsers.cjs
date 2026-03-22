// checkExistingUsers.cjs
const fs = require('fs');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

const missingUserIds = [
  3264, 3480, 3522, 715, 3498, 4687, 4291, 3161, 2469, 829,
  3845, 3426, 3262, 4332, 3089, 3528, 3369, 3361, 3025, 4196,
  918, 698, 3303, 2659, 3665
];

async function checkUsers() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db('metawork_db');
    const usersCollection = db.collection('users');
    
    // Read the missing users file
    const missingUsers = JSON.parse(
      fs.readFileSync('./missing-users-import.json', 'utf8')
    );
    
    console.log('Checking which users already exist...\n');
    
    const alreadyExists = [];
    const needsImport = [];
    
    for (const user of missingUsers) {
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) {
        alreadyExists.push({ name: user.name, email: user.email });
      } else {
        needsImport.push(user);
      }
    }
    
    console.log(`Already in database: ${alreadyExists.length} users`);
    if (alreadyExists.length > 0) {
      alreadyExists.forEach(u => console.log(`  ✓ ${u.name} (${u.email})`));
    }
    
    console.log(`\nNeeds import: ${needsImport.length} users`);
    if (needsImport.length > 0) {
      needsImport.forEach(u => console.log(`  - ${u.name} (${u.email})`));
    }
    
    const totalUsers = await usersCollection.countDocuments();
    console.log(`\nTotal users in database: ${totalUsers}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

checkUsers();
