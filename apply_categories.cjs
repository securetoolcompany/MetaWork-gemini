// apply_categories.js
// Actually applies the suggested categories to your database

require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

// System categories (same as preview script)
const CATEGORIES = {
  "Anime & Cartoons": ["anime", "cartoon", "manga", "animation"],
  "Combat Sports": ["fighting", "mma", "boxing", "martial arts", "combat", "ufc", "bjj"],
  "Clubs & Organizations": ["club", "organization", "team", "group"],
  "Photography": ["photo", "photograph", "picture", "image"],
  "Nature": ["nature", "natural", "wilderness", "outdoor"],
  "Wildlife": ["wildlife", "animal", "bird", "creature"],
  "Animals": ["animal", "dog", "cat", "lion", "elephant", "bear"],
  "Plants": ["plant", "flower", "tree", "leaf", "garden"],
  "Water": ["water", "ocean", "sea", "lake", "river"],
  "Landscapes": ["landscape", "scenery", "vista", "mountain", "hill"],
  "Mountains & Hills": ["mountain", "hill", "peak", "summit"],
  "People": ["people", "person", "portrait", "human", "face"],
  "Urban": ["urban", "city", "street", "building", "architecture"],
  "Drawings & Paintings": ["drawing", "painting", "sketch", "art", "illustration", "artwork"]
};

async function applyCategories() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('metawork_db');
    const collection = db.collection('ip_assets');

    // First, add empty categories field to all
    await collection.updateMany(
      {},
      { $set: { categories: [] } }
    );
    console.log('Added categories field to all documents');

    const assets = await collection.find({}).toArray();
    let categorized = 0;
    let skipped = 0;

    for (const asset of assets) {
      const matches = new Set();
      const searchText = [
        asset.name || '',
        asset.description || '',
        ...(asset.tags || [])
      ].join(' ').toLowerCase();

      // Find matching categories
      for (const [category, keywords] of Object.entries(CATEGORIES)) {
        for (const keyword of keywords) {
          if (searchText.includes(keyword)) {
            matches.add(category);
          }
        }
      }

      if (matches.size > 0) {
        await collection.updateOne(
          { _id: asset._id },
          { $set: { categories: Array.from(matches) } }
        );
        categorized++;
      } else {
        skipped++;
      }
    }

    console.log(`\n✓ Categorized: ${categorized} assets`);
    console.log(`✗ Skipped (no match): ${skipped} assets`);
    console.log('\nDone! Review skipped assets and categorize manually.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

applyCategories();