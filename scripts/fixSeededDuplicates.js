// scripts/fixSeededDuplicates.js
import dotenv from 'dotenv';
dotenv.config(); // This will load .env automatically

import { connectToDatabase } from '../lib/mongodb.js';

async function fixSeededDuplicates() {
  const { db } = await connectToDatabase();
  const users = db.collection('users');

  console.log('🔍 Finding duplicate emails...\n');

  const duplicates = await users.aggregate([
    { $match: { email: { $ne: null, $exists: true } } },
    { $group: { 
      _id: "$email", 
      count: { $sum: 1 }, 
      docs: { $push: { id: "$_id", email: "$email" } }
    }},
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  console.log(`Found ${duplicates.length} duplicate email(s)\n`);

  for (const dup of duplicates) {
    const originalEmail = dup._id;
    const docs = dup.docs;
    
    console.log(`📧 Email: ${originalEmail} (${docs.length} duplicates)`);
    
    for (let i = 1; i < docs.length; i++) {
      const [localPart, domain] = originalEmail.split('@');
      const newEmail = `${localPart}+${i}@${domain}`;
      
      await users.updateOne(
        { _id: docs[i].id },
        { $set: { email: newEmail } }
      );
      
      console.log(`  ✅ Updated ${docs[i].id}: ${originalEmail} → ${newEmail}`);
    }
    console.log('');
  }

  console.log('✅ All duplicates fixed!');
  console.log('📝 Now try running /api/init again\n');
  
  process.exit(0);
}

fixSeededDuplicates().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
