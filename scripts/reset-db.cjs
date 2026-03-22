/**
 * scripts/reset-db.cjs
 * DANGER: Clears all users and rebuilds indexes from scratch.
 */
const { connectToDatabase } = require('../lib/mongodb');

async function run() {
  console.log('🛑 Starting Database Reset...');
  
  const { db } = await connectToDatabase();
  const users = db.collection('users');

  try {
    // 1. Drop the collection to wipe data and indexes
    console.log('🧹 Dropping users collection...');
    try {
      await users.drop();
      console.log('✅ Collection dropped.');
    } catch (e) {
      console.log('ℹ️ Collection didn\'t exist or already dropped.');
    }

    // 2. Re-create the collection (optional, happens on first insert)
    // 3. Rebuild the optimized indexes
    console.log('🏗️ Building fresh indexes with sparse/multi-chain support...');

    // Username: Required for everyone
    await users.createIndex({ username: 1 }, { unique: true });

    // Email: Unique but sparse (allows wallet-only users)
    await users.createIndex({ email: 1 }, { unique: true, sparse: true });

    // GoogleID: Unique but sparse (allows non-google users)
    await users.createIndex({ googleId: 1 }, { unique: true, sparse: true });

    // Primary Wallet (Legacy): Unique but sparse
    await users.createIndex({ walletAddress: 1 }, { unique: true, sparse: true });

    // Multi-chain Array: Unique but sparse 
    await users.createIndex({ "wallets.address": 1 }, { unique: true, sparse: true });

    console.log('✨ Database reset and indexed successfully!');
  } catch (error) {
    console.error('❌ Reset failed:', error);
  } finally {
    process.exit(0);
  }
}

run();