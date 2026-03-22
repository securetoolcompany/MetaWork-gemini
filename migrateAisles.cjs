// migrateAisles.cjs - FIXED version
const fs = require('fs');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const exportPath = './metawork_filtered_export.json';

async function migrateAisles() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Load export
    console.log(`Reading from: ${exportPath}`);
    const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    
    const aisles = exportData.aisles || [];
    console.log(`Loaded ${aisles.length} aisles from export.`);
    
    // Connect to MongoDB
    await client.connect();
    console.log('Connected to MongoDB.');
    
    const db = client.db('metawork_db');
    const usersCollection = db.collection('users');
    const aislesCollection = db.collection('aisles');
    
    // Build user map - map WordPress author_id to MongoDB user
    const allUsers = await usersCollection.find({}).toArray();
    const wpIdToUser = {};
    
    // Parse user IDs to extract WordPress ID
    for (const user of allUsers) {
      // Check if user.id exists and is a string
      if (!user.id || typeof user.id !== 'string') {
        console.log(`⚠️  Skipping user with invalid id:`, user._id);
        continue;
      }
      
      // Format: user_username_WPID
      const match = user.id.match(/_(\d+)$/);
      if (match) {
        const wpId = parseInt(match[1]);
        wpIdToUser[wpId] = user;
      }
    }
    
    console.log(`Built user map with ${Object.keys(wpIdToUser).length} WordPress IDs.`);
    console.log(`Total users in DB: ${allUsers.length}`);
    
    // Debug: Show sample of mapped users
    console.log('\nChecking for the 25 previously missing users:');
    const criticalIds = [3264, 3480, 3522, 715, 3498, 4687, 4291, 3161, 2469, 829];
    let foundCount = 0;
    criticalIds.forEach(id => {
      if (wpIdToUser[id]) {
        console.log(`  ✓ ${id}: ${wpIdToUser[id].name}`);
        foundCount++;
      } else {
        console.log(`  ✗ ${id}: NOT FOUND`);
      }
    });
    console.log(`Found ${foundCount}/${criticalIds.length} sample users\n`);
    
    const toUpsert = [];
    const skipped = [];
    
    for (const aisle of aisles) {
      const authorWpId = parseInt(aisle.author_id);
      const user = wpIdToUser[authorWpId];
      
      if (!user) {
        console.log(`⚠️  Aisle ${aisle.id} "${aisle.title}" has no user for author_id ${authorWpId}`);
        skipped.push({ 
          aisleId: aisle.id, 
          title: aisle.title,
          authorId: authorWpId 
        });
        continue;
      }
      
      const aisleDoc = {
        id: `aisle_${aisle.slug}_${aisle.id}`,
        legacyAisleId: aisle.id,
        userId: user.id,
        slug: aisle.slug,
        title: aisle.title,
        description: aisle.description || '',
        headerImage: aisle.header_image || '',
        settings: {
          enabled: true,
          title: aisle.title,
          description: aisle.description || '',
          headerImage: aisle.header_image || '',
          theme: 'light',
          primaryColor: '#ea5545',
          layout: 'list',
          itemsPerPage: 8,
          sortBy: 'popular',
          showPricing: true,
          enableWatermark: true,
          customCSS: ''
        },
        featuredProducts: [],
        categories: aisle.categories || [],
        totalProducts: 0,
        totalViews: 0,
        isActive: true,
        metrics: {
          views: 0,
          uniqueVisitors: 0,
          avgTimeOnPage: 0,
          conversionRate: 0
        },
        createdAt: aisle.created_at || new Date().toISOString(),
        updatedAt: aisle.updated_at || new Date().toISOString(),
        source: 'wp_export'
      };
      
      toUpsert.push({
        updateOne: {
          filter: { legacyAisleId: aisle.id },
          update: { $set: aisleDoc },
          upsert: true
        }
      });
    }
    
    console.log(`\n=== Migration Summary ===`);
    console.log(`Prepared for upsert: ${toUpsert.length} aisles`);
    console.log(`Skipped (no user): ${skipped.length} aisles`);
    
    if (toUpsert.length > 0) {
      const result = await aislesCollection.bulkWrite(toUpsert);
      console.log('\nBulk upsert result:');
      console.log(`  Matched: ${result.matchedCount}`);
      console.log(`  Modified: ${result.modifiedCount}`);
      console.log(`  Upserted: ${result.upsertedCount}`);
    }
    
    // Final counts
    const totalAisles = await aislesCollection.countDocuments();
    const withUser = await aislesCollection.countDocuments({ userId: { $exists: true } });
    
    console.log(`\n=== Database Status ===`);
    console.log(`Total aisles: ${totalAisles}`);
    console.log(`With userId: ${withUser}`);
    
    if (skipped.length > 0) {
      console.log(`\n⚠️  Skipped ${skipped.length} aisles:`);
      skipped.slice(0, 10).forEach(s => {
        console.log(`  - "${s.title}" (author_id: ${s.authorId})`);
      });
      if (skipped.length > 10) {
        console.log(`  ... and ${skipped.length - 10} more`);
      }
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

migrateAisles();
