import dotenv from 'dotenv';
dotenv.config();

import { connectToDatabase } from '../lib/mongodb.js';

async function fixDuplicateUsernames() {
  const { db } = await connectToDatabase();
  const users = db.collection('users');

  console.log('🔍 Finding duplicate usernames...\n');

  // Find all duplicate usernames
  const duplicates = await users.aggregate([
    { $match: { username: { $ne: null, $exists: true } } },
    { $group: { 
      _id: "$username", 
      count: { $sum: 1 }, 
      docs: { $push: { id: "$_id", username: "$username" } }
    }},
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  console.log(`Found ${duplicates.length} duplicate username(s)\n`);

  for (const dup of duplicates) {
    const originalUsername = dup._id;
    const docs = dup.docs;
    
    console.log(`👤 Username: ${originalUsername} (${docs.length} duplicates)`);
    
    // Keep first one as-is, add number suffix to others
    for (let i = 1; i < docs.length; i++) {
      const newUsername = `${originalUsername}-${i}`;
      
      await users.updateOne(
        { _id: docs[i].id },
        { $set: { username: newUsername } }
      );
      
      console.log(`  ✅ Updated ${docs[i].id}: ${originalUsername} → ${newUsername}`);
    }
    console.log('');
  }

  console.log('✅ All duplicate usernames fixed!');
  console.log('📝 Now try running /api/init again\n');
  
  process.exit(0);
}

fixDuplicateUsernames().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
