// scripts/init-db.js
const { ensureUserIndexes } = require('../lib/mongodb');

async function run() {
  console.log('🚀 Starting Database Initialization...');
  
  try {
    // This calls the logic we just added to lib/mongodb.js
    await ensureUserIndexes();
    
    console.log('✨ Migration complete. Database is now ready for multi-chain and merge testing.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

run();