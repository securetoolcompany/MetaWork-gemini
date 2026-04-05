require('dotenv').config({ path: '.env.local' }); // Make sure it reads your Next.js env file
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("❌ MONGODB_URI is missing in your .env.local file.");
  process.exit(1);
}

// 1. Define all the categories we want to inject
const CATEGORIES_TO_SEED = [
  // --- PRODUCT CATEGORIES ---
  { type: 'accessories', names: ['Accessories', 'Activewear', 'Backpacks', 'Clothing', 'Combat Sports', 'Dresses, Skirts & Blouses', 'Embroidered Patches', 'Fightwear', 'Fitness & Sports', 'Formalwear', 'Gym Bags', 'Gymwear', 'Headwear', 'Hoodies', 'Jersey', 'Pants and Shorts', 'Patches', 'Phone Cases', 'Purses & Tote Bags', 'Rash Guards', 'Schoolwear', 'Shirts', 'Shoes', 'Sleepwear', 'Streetwear', 'Swimwear'] },
  { type: 'home', names: ['Bathroom', 'Bedroom', 'Blankets', 'Computers', 'Drinkware', 'Home Decor', 'Kitchen', 'Magnets & Stickers', 'Office', 'Pets', 'Pillows & Cases', 'Posters & Wall Art', 'Sitting Room', 'Tech'] },
  { type: 'school', names: ['Backpacks', 'School', 'Schoolwear'] },

  // --- IP ASSET CATEGORIES (Prefixed with ip- to prevent overlap) ---
  { type: 'ip-type', names: ['Illustration', 'Logo & Icon', 'Pattern & Texture', 'Typography', '3D Model', 'Photography'] },
  { type: 'ip-style', names: ['Anime & Manga', 'Cyberpunk', 'Minimalist', 'Vintage & Retro', 'Street Art', 'Realistic', 'Cartoon'] },
  { type: 'ip-usage', names: ['Merch Designs', 'Social Media', 'Game Assets', 'Apparel Print', 'Brand Identity'] },
  { type: 'ip-theme', names: ['Esports & Gaming', 'Nature & Wildlife', 'Sci-Fi & Fantasy', 'Spiritual', 'Corporate'] },

  // --- AISLE CATEGORIES (Prefixed with aisle- to prevent overlap) ---
  { type: 'aisle-audience', names: ['Kids & Family', 'Sports & Combat Sports', 'Music & Entertainment', 'Esports & Gaming', 'Nature & Wildlife', 'Sci‑Fi & Fantasy', 'Spiritual & Mythology', 'Corporate & Professional'] },
  { type: 'aisle-style', names: ['Anime & Manga', 'Graffiti & Street Art', 'Comic / Graphic Novel', 'Minimalist', 'Abstract & Geometric', 'Retro & Vintage', 'Cyberpunk & Futuristic', 'Realistic', 'Cartoon & Kawaii', 'Surreal & Dreamlike', 'Pop Art', 'Typography & Lettering', 'Photography'] },
  { type: 'aisle-medium', names: ['Digital Illustration', 'Vector Art', 'Pixel Art', '3D / CGI', 'Watercolor', 'Ink & Line Art', 'Acrylic / Oil Painting', 'Mixed Media / Collage', 'Pencil / Sketch', 'Printmaking / Screenprint', 'Photography'] },
  { type: 'aisle-useCase', names: ['Logo & Brand Assets', 'Mascots & Characters', 'Twitch & Stream Overlays', 'Social Media Content Packs', 'Merch‑Ready Designs', 'Commission Slots', 'Corporate Illustration', 'Album & Cover Art', 'Book & Editorial Illustration', 'Icons & UI Assets', 'Backgrounds & Environments', 'Photography Packs'] },
];

async function seedCategories() {
  console.log("⏳ Connecting to MongoDB...");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const categoriesCol = db.collection('categories');

    console.log("✅ Connected! Starting category seed...\n");
    let totalAdded = 0;

    // Loop through our groups
    for (const group of CATEGORIES_TO_SEED) {
      const type = group.type;
      
      for (const name of group.names) {
        // Using upsert so we don't accidentally create duplicates if you run this twice
        const result = await categoriesCol.updateOne(
          { name: name, type: type }, // Match criteria
          { 
            $setOnInsert: { 
              name: name, 
              type: type, 
              isActive: true, 
              createdAt: new Date().toISOString() 
            } 
          },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          console.log(`➕ Added: [${type}] -> ${name}`);
          totalAdded++;
        }
      }
    }

    console.log(`\n🎉 Seeding complete! Added ${totalAdded} new categories to the database.`);

  } catch (error) {
    console.error("❌ Error seeding categories:", error);
  } finally {
    await client.close();
    console.log("🔌 Database connection closed.");
  }
}

seedCategories();