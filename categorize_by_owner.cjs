// categorize_by_owner.js
// Categorize IP assets based on owner/creator

require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

// Owner → Category mappings
const OWNER_CATEGORIES = {
  // Username variations to match
  'nova': ['Anime & Cartoons'],
  'nova4hub': ['Anime & Cartoons'],
  'cherechydraws': ['Photography', 'Urban'],
  '777jc': ['Anime & Cartoons'],
  'mr ilustraion': ['Anime & Cartoons'],
  'belali': ['Anime & Cartoons'],
  'tremblay bjj': ['Combat Sports'],
  'rise': ['Combat Sports']
};

async function categorizeByOwner() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db('metawork_db');
    const ipAssets = db.collection('ip_assets');
    const users = db.collection('users');

    // Get all users to map userId to username
    const allUsers = await users.find({}).toArray();
    const userIdToUsername = {};
    allUsers.forEach(user => {
      userIdToUsername[user.id] = (user.username || '').toLowerCase();
    });

    console.log('Owner-based Categorization Report');
    console.log('='.repeat(70));

    let totalCategorized = 0;

    // Process each owner mapping
    for (const [ownerPattern, categories] of Object.entries(OWNER_CATEGORIES)) {
      const ownerLower = ownerPattern.toLowerCase();

      // Find matching user IDs
      const matchingUserIds = Object.entries(userIdToUsername)
        .filter(([userId, username]) => 
          username.includes(ownerLower) || 
          ownerLower.includes(username)
        )
        .map(([userId]) => userId);

      if (matchingUserIds.length === 0) {
        console.log(`\n⚠ No users found matching: "${ownerPattern}"`);
        continue;
      }

      // Find assets owned by these users
      const assets = await ipAssets.find({
        ownerId: { $in: matchingUserIds }
      }).toArray();

      if (assets.length === 0) {
        console.log(`\n⚠ No assets found for: "${ownerPattern}"`);
        continue;
      }

      // Update assets with categories
      const result = await ipAssets.updateMany(
        { ownerId: { $in: matchingUserIds } },
        { 
          $addToSet: { 
            categories: { $each: categories }
          }
        }
      );

      console.log(`\n✓ ${ownerPattern}`);
      console.log(`  Matched users: ${matchingUserIds.length}`);
      console.log(`  Assets updated: ${result.modifiedCount}`);
      console.log(`  Categories added: ${categories.join(', ')}`);

      totalCategorized += result.modifiedCount;
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n✓ Total assets categorized: ${totalCategorized}`);

    // Get final stats
    const stats = await ipAssets.aggregate([
      {
        $project: {
          hasCat: { $gt: [{ $size: { $ifNull: ['$categories', []] } }, 0] }
        }
      },
      {
        $group: {
          _id: null,
          withCategories: { $sum: { $cond: ['$hasCat', 1, 0] } },
          withoutCategories: { $sum: { $cond: ['$hasCat', 0, 1] } },
          total: { $sum: 1 }
        }
      }
    ]).toArray();

    if (stats.length > 0) {
      const stat = stats[0];
      console.log(`\nFinal Statistics:`);
      console.log(`  With categories: ${stat.withCategories} (${Math.round(stat.withCategories/stat.total*100)}%)`);
      console.log(`  Without categories: ${stat.withoutCategories} (${Math.round(stat.withoutCategories/stat.total*100)}%)`);
      console.log(`  Total assets: ${stat.total}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\nDone! Remaining assets can be categorized via admin dashboard.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

categorizeByOwner();
