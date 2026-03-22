import { connectToDatabase } from '../lib/mongodb.js';

async function fixDuplicates() {
  const { db } = await connectToDatabase();
  const users = db.collection('users');

  // Find duplicate emails
  const duplicates = await users.aggregate([
    { $match: { email: { $ne: null } } },
    { $group: { _id: "$email", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  console.log('Found duplicate emails:', duplicates);

  // Fix: Keep the first user, remove email from duplicates
  for (const dup of duplicates) {
    const [keepId, ...removeIds] = dup.ids;
    console.log(`Keeping ${keepId}, removing email from:`, removeIds);
    
    // Option A: Remove email from duplicates (they can use wallet/Google)
    await users.updateMany(
      { _id: { $in: removeIds } },
      { $unset: { email: "" } }
    );
    
    // OR Option B: Delete duplicate users entirely (uncomment if preferred)
    // await users.deleteMany({ _id: { $in: removeIds } });
  }

  console.log('✅ Duplicates fixed!');
  process.exit(0);
}

fixDuplicates();