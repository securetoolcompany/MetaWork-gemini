/**
 * scripts/force-fix.cjs
 * Run this from your VS Code terminal: 
 * node --env-file=.env scripts/force-fix.cjs
 */
const { connectToDatabase } = require('../lib/mongodb');

async function run() {
  console.log('🛠️ Starting Force-Fix...');
  const { db } = await connectToDatabase();
  const users = db.collection('users');

  try {
    // 1. Drop the old restrictive index first
    console.log('📉 Checking for old indexes...');
    const indexes = await users.listIndexes().toArray();
    const indexNames = indexes.map(i => i.name);

    if (indexNames.includes('walletAddress_1')) {
      await users.dropIndex('walletAddress_1');
      console.log('✅ Dropped restrictive walletAddress_1 index.');
    }

    // 2. Clean up "ghost" users that have no email AND no wallet
    // These usually happen when a registration fails halfway.
    console.log('🧹 Cleaning orphaned records...');
    const deleteResult = await users.deleteMany({
      email: { $exists: false },
      googleId: { $exists: false }
    });
    console.log(`🗑️ Removed ${deleteResult.deletedCount} orphaned records.`);

    // 3. Create the CORRECT Sparse Index
    // 'sparse: true' allows multiple users to have NO wallet address.
    console.log('🏗️ Building Sparse Index...');
    await users.createIndex(
      { walletAddress: 1 }, 
      { unique: true, sparse: true }
    );
    
    // Ensure the new wallets array index is also sparse
    await users.createIndex(
      { "wallets.address": 1 }, 
      { unique: true, sparse: true }
    );

    console.log('✨ Database repaired! Try Google Login now.');
  } catch (error) {
    console.error('❌ Repair failed:', error);
  } finally {
    process.exit(0);
  }
}

run();