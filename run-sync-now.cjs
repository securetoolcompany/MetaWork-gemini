// run-sync-now.cjs (temporary, don't commit)
const dns = require('dns');

// Force Node to use Google's public DNS servers for all lookups
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();

    const { syncPrintfulCatalogWithAvailability } = await import(
      './scripts/sync-printful-once.js'
    );

    const result = await syncPrintfulCatalogWithAvailability(client);
    console.log('Sync result:', result);
  } catch (err) {
    console.error('Sync failed:', err);
  } finally {
    await client.close();
  }
})();