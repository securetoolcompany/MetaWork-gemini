require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function activateAisles() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db('metawork_db'); // Double check your DB name

  console.log("🚀 Activating aisles and publishing all inventory...");

  try {
    // 1. Force all products to be active & public
    const productResult = await db.collection('products').updateMany(
      {},
      { $set: { status: 'active', isPublished: true, visibility: 'public' } }
    );
    console.log(`✅ Activated ${productResult.modifiedCount} Products.`);

    // 2. Force all IP assets to be active & public (checking both common collection names)
    const ipCollection = await db.listCollections({ name: 'ipAssets' }).hasNext() ? 'ipAssets' : 'ip_assets';
    const ipResult = await db.collection(ipCollection).updateMany(
      {},
      { $set: { status: 'active', isPublished: true, visibility: 'public' } }
    );
    console.log(`✅ Activated ${ipResult.modifiedCount} IP Assets.`);

    // 3. Turn on the Aisles on all Profiles
    const profileResult = await db.collection('profiles').updateMany(
      {},
      { 
        $set: { 
          "aisleSettings.isPublished": true,
          "aisleSettings.maintenanceMode": false,
          isAisleActive: true,
          status: 'active'
        } 
      }
    );
    console.log(`✅ Flipped the switch to 'ON' for ${profileResult.modifiedCount} Aisles.`);

    // 4. Auto-curate the Aisles (puts all their items on the page automatically)
    const profiles = await db.collection('profiles').find({}).toArray();
    let curatedCount = 0;

    for (const profile of profiles) {
       const username = profile.username;
       if (!username) continue;
       
       // Find everything belonging to this user
       const userProducts = await db.collection('products').find({ creatorUsername: username }).toArray();
       const userIpAssets = await db.collection(ipCollection).find({ 
           $or: [{ creatorUsername: username }, { owner: username }] 
       }).toArray();
       
       const productIds = userProducts.map(p => p._id.toString());
       const ipAssetIds = userIpAssets.map(ip => ip._id.toString());

       // Inject the items directly into their profile's layout array
       if (productIds.length > 0 || ipAssetIds.length > 0) {
           await db.collection('profiles').updateOne(
               { _id: profile._id },
               { 
                 $set: { 
                    "aisleSettings.featuredProducts": productIds,
                    "aisleSettings.featuredIP": ipAssetIds,
                    // If your Aisle uses a sectioned layout system, this populates it:
                    "aisleSettings.curatedSections": [
                       {
                          id: "default-products",
                          title: "My Products",
                          type: "products",
                          items: productIds
                       },
                       {
                          id: "default-ip",
                          title: "My IP Assets",
                          type: "ip_assets",
                          items: ipAssetIds
                       }
                    ]
                 } 
               }
           );
           curatedCount++;
       }
    }
    console.log(`✅ Auto-curated and populated grids for ${curatedCount} user Aisles.`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await client.close();
    console.log('🏁 All Aisles are now live and fully stocked!');
  }
}

activateAisles();