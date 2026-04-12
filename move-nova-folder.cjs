require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function fullRepair() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('metawork_db');

    console.log("💉 INJECTING FULL CSV DATA SLOTS INTO 4 BACKPACKS...");
    
    const corrections = [
      { 
        id: '69db0c8c5191e20b1aa906a1', 
        name: 'Anime-style Line Art Backpack - vYzion',
        desc: 'A fun anime-style line art!',
        cats: 'Accessories, Accessories > Backpacks, Creator Marketplace, Creator Marketplace > nova, School, Creator Marketplace > vYzion',
        price: 47.50, 
        template: '94813952', 
        external: 'wc-1761083910369', 
        img: 'https://files.cdn.printful.com/products/462/16659_1712888000.png' 
      },
      { 
        id: '69db0c8e5191e20b1aa906a2', 
        name: 'Bakugo Line Art Backpack - n0va4HuB',
        desc: 'Created from Printful template #94903261',
        cats: 'Accessories, Accessories > Backpacks, Creator Marketplace, Creator Marketplace > nova, School, Creator Marketplace > vYzion',
        price: 47.50, 
        template: '94903261', 
        external: 'wc-1761259777254', 
        img: 'https://files.cdn.printful.com/products/462/16660_1712888000.png' 
      },
      { 
        id: '69db0c925191e20b1aa906a4', 
        name: 'Chinchilla Dragon Backpack - n0va4HuB',
        desc: "What's in the Bag?",
        cats: 'Accessories, Accessories > Backpacks, Creator Marketplace > nova, School, Creator Marketplace > vYzion',
        price: 47.50, 
        template: '94904762', 
        external: 'wc-1761263497599', 
        img: 'https://files.cdn.printful.com/products/462/16661_1712888000.png' 
      },
      { 
        id: '69db0c9b5191e20b1aa906a8', 
        name: "All-Over Print Minimalist Backpack from the Michael's Hub - Taiwo",
        desc: 'Quality bag designed for your the Christmas occasions and your love ones',
        cats: 'Creator Marketplace > Taiwo',
        price: 45.00, 
        template: '95507081', 
        external: 'wc-1762565457616', 
        img: 'https://res.cloudinary.com/dplnacuyy/image/upload/v1/MetaWork/products/mockups/taiwo_backpack_final.png' 
      }
    ];

    for (const item of corrections) {
      await db.collection('products').updateOne(
        { _id: new ObjectId(item.id) },
        { 
          $set: { 
            image: item.img,
            images: [item.img],
            name: item.name,
            description: item.desc,
            shortDescription: "", // CSV had NaN for these
            categories: item.cats.split(', ').map(c => c.trim()),
            price: item.price,
            status: 'published',
            isPublic: true,
            isArchived: false,
            showroomListed: true,
            isDraft: false,
            _type: 'production-synced-grouped',
            hasVariations: true,
            printfulTemplateId: item.template,
            printfulData: { 
              templateId: item.template, 
              externalProductId: item.external,
              sku: null 
            },
            legacyMetadata: { 
              _price: item.price.toString(), 
              _smpf_template_id: item.template,
              _smpf_external_product_id: item.external 
            },
            variations: [{ 
              id: Date.now(), 
              price: item.price, 
              regular_price: item.price,
              stockStatus: 'instock',
              attributes: { pa_size: 'one size' }
            }],
            updatedAt: new Date()
          },
          $unset: { imageUrl: "" }
        }
      );
      console.log(`✅ Fully Populated: ${item.name}`);
    }

    console.log("\n✨ DATA SLOT SYNC COMPLETE.");

  } catch (err) { console.error("❌ Error:", err.message); } finally { await client.close(); }
}

fullRepair();