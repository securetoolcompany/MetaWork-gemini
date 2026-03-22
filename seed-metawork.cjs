// seed-metawork.cjs - Enhanced MetaWork Database Seed Script
require('dotenv').config({ path: '.env' });
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

// UPDATE THIS with your MongoDB connection string
const MONGO_URI = process.env.MONGO_URL;
const DB_NAME = 'metawork_db';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name';

// Helper functions
const generateUserId = () => `user_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});
const generateAlgorandAddress = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  return Array(58).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
};
const generateHash = (prefix = 'Qm') => `${prefix}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 10)}`;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const randomHex = () => randomChoice(['1a1a2e', 'e94560', '16213e', '00fff5', '0f3460', '134e4a', '10b981', '2d3561', 'f07b3f', 'ea5545', 'fdf498', '2c3e50', '8e44ad', 'ff6b6b', '4ecdc4', '45b7d1', 'f38181', '95e1d3', 'f8b500', 'c44569']);

// Enhanced data arrays
const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Sage', 'River', 'Dakota', 'Skylar', 'Cameron', 'Finley', 'Rowan', 'Phoenix', 'Eden', 'Jules', 'Kai', 'Blake'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Hernandez', 'Lopez', 'Chen', 'Kim', 'Nguyen', 'Patel', 'Anderson', 'Taylor', 'Moore', 'Jackson', 'White'];
const studioNames = ['Digital', 'Cosmic', 'Retro', 'Urban', 'Nature', 'Abstract', 'Minimal', 'Vibrant', 'Pixel', 'Vector', 'Neon', 'Quantum', 'Stellar', 'Echo', 'Wave', 'Prism', 'Luna', 'Nova', 'Zen', 'Flux'];
const studioSuffixes = ['Studios', 'Designs', 'Art Co', 'Creative', 'Lab', 'Works', 'House', 'Collective', 'Media', 'Arts', 'Workshop', 'Agency', 'Atelier', 'Studio'];
const locations = ['San Francisco, CA', 'New York, NY', 'Los Angeles, CA', 'Austin, TX', 'Seattle, WA', 'Portland, OR', 'Denver, CO', 'Miami, FL', 'Chicago, IL', 'Boston, MA', 'Atlanta, GA', 'Phoenix, AZ', 'Nashville, TN', 'San Diego, CA', 'Minneapolis, MN'];

const detailedBios = {
  'ip-only': [
    'Character designer and world-builder crafting unique IP for games, animation, and merchandising. 5+ years experience in digital art and storytelling.',
    'Illustrator specializing in mascot design and brand characters. Creating memorable IP that resonates with audiences across all age groups.',
    'Concept artist developing original characters and universes. Available for licensing and collaboration opportunities.',
    'Visual storyteller bringing imaginative worlds to life through character design and narrative art.',
    'Independent IP creator focusing on diverse characters and inclusive storytelling for modern audiences.'
  ],
  'products-only': [
    'Print-on-demand specialist turning art into wearable fashion. Focusing on sustainable, high-quality apparel that makes a statement.',
    'Lifestyle product curator with an eye for trends and timeless design. Building a brand that celebrates creativity and self-expression.',
    'Apparel designer merging streetwear aesthetics with artistic expression. Every piece tells a story.',
    'Creator of premium merchandise that bridges art and everyday life. Quality-focused and community-driven.',
    'Product designer crafting unique apparel and accessories for conscious consumers.',
    'Fashion-forward creator specializing in limited edition prints and exclusive drops.',
    'Building a lifestyle brand one thoughtfully designed product at a time.'
  ],
  'both': [
    'Full-stack creator: from character IP to product design. Building a comprehensive creative brand with licensed products across multiple categories.',
    'Artist and entrepreneur creating original IP and bringing it to life through premium merchandise. Passionate about creator ownership.',
    'Designer developing iconic characters and transforming them into lifestyle products. Creator-first approach to brand building.',
    'Multimedia creator bringing original characters to life through art, animation, and wearable products.',
    'Building an IP empire from concept to consumer, one creation at a time.',
    'Independent creator developing original characters and monetizing through smart product strategy.',
    'Bridging the gap between IP creation and physical products with a Web3-native approach.',
    'Creator economy pioneer building a sustainable business through original IP and strategic merchandising.'
  ]
};

const socialHandles = ['art', 'designs', 'studio', 'creates', 'creative', 'works', 'visuals', 'illustrations', 'lab', 'collective'];
const taglines = ['Creator', 'Designer', 'Artist', 'Illustrator', 'Brand Builder', 'Visual Storyteller', 'Character Designer', 'Product Creator', 'IP Developer', 'Creative Director'];

const ipCategories = ['illustration', 'photography', 'abstract', 'typography', 'pattern', 'character-design', 'mascot', 'logo'];
const ipNames = ['Neon Samurai', 'Cyber Dragon', 'Digital Sunset', 'Abstract Waves', 'Geometric Dreams', 'Urban Jungle', 'Retro Vibes', 'Cosmic Journey', 'Mountain Vista', 'Ocean Blues', 'Forest Whispers', 'City Lights', 'Desert Mirage', 'Arctic Aurora', 'Tropical Paradise', 'Galaxy Spiral', 'Quantum Flux', 'Binary Code', 'Synth Wave', 'Pixel Heart', 'Neon Dreams', 'Crystal Cavern', 'Electric Storm', 'Mystic Portal', 'Stellar Void'];
const ipDescriptions = [
  'A unique digital artwork exploring the intersection of technology and nature.',
  'Original character design featuring bold colors and dynamic composition.',
  'Abstract exploration of form and space in the digital realm.',
  'Minimalist illustration with maximum impact and emotional resonance.',
  'Vibrant artwork celebrating contemporary culture and aesthetics.',
  'Detailed illustration perfect for commercial and editorial use.',
  'Modern take on classic themes with a fresh perspective.',
  'Eye-catching design that stands out in any application.',
  'Character concept ready for animation, games, or merchandise.',
  'Limited edition artwork with exclusive licensing rights.'
];

const productTitles = ['Unisex Premium T-Shirt', 'Eco-Friendly Hoodie', 'Classic Crew Neck', 'Performance Tank Top', 'Vintage Wash Tee', 'Oversized Streetwear Shirt', 'Slim Fit Polo', 'Athletic Performance Shirt', 'Cropped Fashion Tee', 'Long Sleeve Comfort Shirt', 'Graphic Design Hoodie', 'Minimalist Tee', 'Bold Statement Shirt', 'Artistic Expression Top', 'Limited Edition Print Tee'];
const productDescriptions = [
  'Premium quality cotton blend for ultimate comfort and durability.',
  'Eco-conscious design meets contemporary style.',
  'Classic fit that never goes out of fashion.',
  'Performance fabric perfect for active lifestyles.',
  'Vintage-inspired design with modern sensibilities.',
  'Statement piece that elevates any wardrobe.',
  'Timeless design with attention to detail.',
  'Limited edition artwork on premium apparel.'
];

const catalogProducts = [
  {id: 679, name: 'Unisex Performance Crew Neck T-Shirt | A4 N3142', type: 'tshirt'},
  {id: 71, name: 'Bella + Canvas Unisex Jersey Short Sleeve Tee', type: 'tshirt'},
  {id: 146, name: 'Unisex Heavy Cotton Tee | Gildan 5000', type: 'tshirt'},
  {id: 380, name: 'Unisex Premium Hoodie | Bella + Canvas 3719', type: 'hoodie'},
  {id: 398, name: 'Unisex Organic Cotton T-Shirt | Stanley/Stella', type: 'tshirt'}
];

const categories = [
  'Activewear', 'Fightwear', 'Formalwear', 'Headwear', 'Patches', 
  'Phone Cases', 'Purses & Tote Bags', 'Schoolwear', 'Streetwear', 'Swimwear',
  'Bedroom', 'Kitchen', 'Magnets & Stickers', 'Pets', 'Posters & Wall Art', 'Tech',
  'Backpacks', 'Study'
];const tags = ['cyberpunk', 'retro', 'minimal', 'abstract', 'nature', 'urban', 'vintage', 'modern', 'bold', 'subtle', 'colorful', 'monochrome', 'geometric', 'organic', 'futuristic'];

// Use real Cloudinary URLs after upload
const generateCloudinaryUrl = (folder, filename) => {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/v1/metawork/${folder}/${filename}.png`;
};

const generateProductMockup = (index, catalogProduct) => {
  const type = catalogProduct.type;
  // Match upload pattern: tshirts=even, hoodies=odd
  let imageIndex;
  if (type === 'tshirt') {
    imageIndex = (index * 2) % 50; // Maps to 0, 2, 4, 6, 8...
  } else { // hoodie
    imageIndex = ((index * 2) + 1) % 50; // Maps to 1, 3, 5, 7, 9...
  }
  return generateCloudinaryUrl('products', `${type}_${imageIndex}`);
};


const generateUserAvatar = (index) => {
  const avatarIndex = index % 20;
  return generateCloudinaryUrl('avatars', `avatar_${avatarIndex}`);
};

const generateUserBanner = (index) => {
  const bannerIndex = index % 20;
  return generateCloudinaryUrl('banners', `banner_${bannerIndex}`);
};

const generateAisleHeader = (index) => {
  const headerIndex = index % 20;
  return generateCloudinaryUrl('aisle-headers', `header_${headerIndex}`);
};

const generateIPAssetImage = (index) => {
  const ipIndex = index % 60;
  return generateCloudinaryUrl('ip-assets', `ip_${ipIndex}`);
};


const createUser = (type, hashedPassword, index) => {
  const firstName = randomChoice(firstNames);
  const lastName = randomChoice(lastNames);
  const studioName = `${randomChoice(studioNames)} ${randomChoice(studioSuffixes)}`;
  const useStudio = Math.random() > 0.5;
  const name = useStudio ? studioName : `${firstName} ${lastName}`;
  
  // Make username unique by adding index
  const baseUsername = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const username = `${baseUsername}-${index}`;
  
  const initials = name.split(' ').map(w => w[0]).join('');
  
  return {
    id: generateUserId(),
    name,
    email: useStudio ? `${username.replace(/-/g, '')}@metawork.app` : `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index}@metawork.app`,
    username,
    bio: randomChoice(detailedBios[type]),
    tagline: randomChoice(taglines),
    location: randomChoice(locations),
    website: `https://${username}.com`,
    avatar: generateUserAvatar(index),
    banner: generateUserBanner(index),

    
    // Contact details
    contactEmail: useStudio ? `hello@${username}.com` : `${firstName.toLowerCase()}.${index}@${baseUsername}.com`,
    phone: Math.random() > 0.6 ? `+1-${randomInt(200, 999)}-${randomInt(200, 999)}-${randomInt(1000, 9999)}` : null,
    socialLinks: {
      twitter: Math.random() > 0.3 ? `https://twitter.com/${username}_${randomChoice(socialHandles)}` : null,
      instagram: Math.random() > 0.2 ? `https://instagram.com/${username}_${randomChoice(socialHandles)}` : null,
      linkedin: Math.random() > 0.5 ? `https://linkedin.com/in/${username}` : null,
      tiktok: Math.random() > 0.6 ? `https://tiktok.com/@${username}` : null,
      youtube: Math.random() > 0.7 ? `https://youtube.com/@${username}` : null
    },
    
    // Aisle settings with full data
    aisleSettings: {
      enabled: true,
      title: `${name}'s Creator Aisle`,
      description: randomChoice(detailedBios[type]),
      headerImage: generateAisleHeader(index),
      theme: randomChoice(['dark', 'light', 'retro', 'neon', 'minimal']),
      primaryColor: `#${randomHex()}`,
      layout: randomChoice(['grid', 'masonry', 'list']),
      itemsPerPage: randomChoice([8, 12, 16, 20]),
      sortBy: randomChoice(['recent', 'popular', 'name', 'price-low', 'price-high']),
      showPricing: Math.random() > 0.2,
      enableWatermark: Math.random() > 0.5,
      customCSS: '',
      featuredProducts: [],
      categories: randomChoice([
        ['apparel'],
        ['apparel', 'accessories'],
        ['artwork', 'prints'],
        ['home-decor', 'lifestyle'],
        ['apparel', 'artwork', 'accessories']
      ])
    },
    
    password: hashedPassword,
    authMethod: 'email',
    membershipTier: randomChoice(['free', 'free', 'free', 'pro']),
    role: 'creator',
    verified: Math.random() > 0.3,
    stats: {
      totalProducts: 0,
      totalSales: randomInt(0, 250),
      totalRevenue: 0,
      aisleViews: randomInt(100, 5000),
      followers: randomInt(10, 1500),
            following: randomInt(5, 800)
    },
    preferences: {
      emailNotifications: Math.random() > 0.4,
      newsletter: Math.random() > 0.3,
      publicProfile: Math.random() > 0.2
    },
    wallets: [],
    createdAt: randomDate(new Date('2024-06-01'), new Date('2025-11-01')),
    updatedAt: new Date(),
    _type: type
  };
};

async function seedDatabase() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('\n✅ Connected to MongoDB Atlas');
    console.log(`📦 Database: ${DB_NAME}\n`);
    
    const db = client.db(DB_NAME);
    
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      db.collection('users').deleteMany({}),
      db.collection('products').deleteMany({}),
      db.collection('ip_assets').deleteMany({}),
      db.collection('revenue_pools').deleteMany({}),
      db.collection('collections').deleteMany({}),
      db.collection('aisles').deleteMany({}),
      db.collection('auth_nonces').deleteMany({})
    ]);
    console.log('✅ Cleared all collections\n');
    
    console.log('🔐 Hashing passwords...');
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    console.log('✅ Password hashed\n');
    
    // CREATE 20 USERS
    console.log('👥 Creating 20 users...');
    const users = [];
    for (let i = 0; i < 7; i++) users.push(createUser('ip-only', hashedPassword, i));
    for (let i = 7; i < 17; i++) users.push(createUser('products-only', hashedPassword, i));
    for (let i = 17; i < 20; i++) users.push(createUser('both', hashedPassword, i));
    
    await db.collection('users').insertMany(users);
    console.log(`✅ Inserted ${users.length} users (7 IP-only, 10 products-only, 3 both)\n`);
    
    // CREATE IP ASSETS
    console.log('🎨 Creating IP assets...');
    const ipAssets = [];
    const revenuePoolsData = [];
    const ipUsers = users.filter(u => u._type === 'ip-only' || u._type === 'both');
    
    for (const user of ipUsers) {
      const numAssets = randomInt(3, 6);
      for (let i = 0; i < numAssets; i++) {
        const ipId = `ip_${generateUUID()}`;
        const walletAddress = generateAlgorandAddress();
        const appId = randomInt(95000000, 99999999);
        const nftAssetId = randomInt(750000000, 759999999);
        const tokenAssetId = randomInt(750000000, 759999999);
        
        const ipAsset = {
          id: ipId,
          name: `${randomChoice(ipNames)} #${randomInt(1, 999)}`,
          description: randomChoice(ipDescriptions),
          category: randomChoice(ipCategories),
          imageUrl: generateIPAssetImage(i + (ipUsers.indexOf(user) * 10)),
          metadataUrl: `https://gateway.pinata.cloud/ipfs/${generateHash()}/metadata.json`,
          metadataHash: generateHash(),
          ownerId: user.id,
          ownerWallet: walletAddress,
          stakeholders: [{ userId: user.id, percentage: 100, role: 'creator' }],
          status: randomChoice(['active', 'active', 'active', 'pending']),
          createdAt: randomDate(user.createdAt, new Date()),
          nftAssetId,
          revenuePoolAddress: walletAddress,
          revenuePoolAppId: appId,
          revenueTokenAssetId: tokenAssetId,
          licensingTerms: randomChoice(['commercial', 'personal', 'editorial']),
          tags: Array.from({length: randomInt(2, 5)}, () => randomChoice(tags))
        };
        ipAssets.push(ipAsset);
        
        const totalDeposited = randomInt(50, 500);
        const totalClaimed = randomInt(10, Math.max(10, totalDeposited - 10));
        const accumulated = totalDeposited - totalClaimed;
        revenuePoolsData.push({
          id: `pool_${generateUUID()}`,
          ipAssetId: ipId,
          appId,
          ownerWallet: walletAddress,
          totalDeposited,
          totalClaimed,
          accumulatedRevenue: accumulated,
          claimableAmount: Math.floor(accumulated * 0.95),
          lastClaimDate: randomDate(ipAsset.createdAt, new Date()),
          createdAt: ipAsset.createdAt,
          updatedAt: new Date()
        });
      }
    }
    
    if (ipAssets.length > 0) {
      await db.collection('ip_assets').insertMany(ipAssets);
      await db.collection('revenue_pools').insertMany(revenuePoolsData);
      console.log(`✅ Inserted ${ipAssets.length} IP assets and ${revenuePoolsData.length} revenue pools\n`);
    }
    
    // CREATE PRODUCTS
    console.log('🛍️  Creating products...');
    const products = [];
    const productUsers = users.filter(u => u._type === 'products-only' || u._type === 'both');
    
    let productCounter = 0;
    for (const user of productUsers) {
      const numProducts = randomInt(4, 8);
      const userIpAssets = ipAssets.filter(ip => ip.ownerId === user.id);
      
      for (let i = 0; i < numProducts; i++) {
        const catalogProduct = randomChoice(catalogProducts);
        const basePrice = randomInt(20, 50);
        const baseCost = randomInt(8, 18);
        const markup = randomInt(0, 5);
        const totalCost = baseCost + markup;
        const useIpAsset = userIpAssets.length > 0 && Math.random() > 0.3;
        const linkedIpAsset = useIpAsset ? randomChoice(userIpAssets) : null;
        const linkedRevenuePool = linkedIpAsset ? revenuePoolsData.find(rp => rp.ipAssetId === linkedIpAsset.id) : null;
        
        const productTitle = randomChoice(productTitles);
        const mockupImages = [
          generateProductMockup(productCounter, catalogProduct),
          generateProductMockup(productCounter + 10, catalogProduct),
          generateProductMockup(productCounter + 20, catalogProduct)
        ];

        
        const product = {
          id: `prod_${generateUUID()}`,
          userId: user.id,
          externalProductId: generateUUID(),
          printfulTemplateId: null,
          catalogProductId: catalogProduct.id,
          catalogProductName: catalogProduct.name,
          catalogVariantIds: [],
          designs: [],
          title: productTitle,
          description: randomChoice(productDescriptions),
          price: basePrice,
          compareAtPrice: Math.random() > 0.7 ? basePrice + randomInt(5, 15) : null,
          categories: Array.from(
            {length: randomInt(1, 3)}, 
              () => randomChoice(categories)
            ).filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
          tags: Array.from({length: randomInt(2, 5)}, () => randomChoice(tags)),
          ipUsages: linkedIpAsset ? [{ ipAssetId: linkedIpAsset.id, percentage: 100 }] : [],
          baseProductCost: baseCost,
          adminMarkup: markup,
          totalProductionCost: totalCost,
          profitMargin: basePrice - totalCost,
          verificationStatus: randomChoice(['verified', 'unverified', 'unverified']),
          minted: false,
          showroomListed: Math.random() > 0.3,
          isPublic: Math.random() > 0.4,
          status: randomChoice(['draft', 'active', 'active', 'active']),
          collections: [],
          ipAssetId: linkedIpAsset ? linkedIpAsset.id : null,
          revenuePoolId: linkedRevenuePool ? linkedRevenuePool.id : null,
          mockupImages,
          thumbnailUrl: mockupImages[0],
          colors: Array.from({length: randomInt(2, 5)}, () => randomChoice(['Black', 'White', 'Navy', 'Gray', 'Red', 'Blue', 'Green'])),
          sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
          views: randomInt(50, 2000),
          sales: randomInt(0, 100),
          createdAt: randomDate(user.createdAt, new Date()),
          updatedAt: new Date()
        };
        products.push(product);
        productCounter++;
      }
    }
    
    if (products.length > 0) {
      await db.collection('products').insertMany(products);
      console.log(`✅ Inserted ${products.length} products\n`);
    }
    
    // CREATE AISLES
    console.log('🏪 Creating aisles...');
    const aisles = [];
    for (const user of users) {
      const userProducts = products.filter(p => p.userId === user.id && p.showroomListed);
      const featuredProducts = userProducts.slice(0, 3).map(p => p.id);
      
      // Update user's aisle settings with featured products
      await db.collection('users').updateOne(
        { id: user.id },
        { 
          $set: { 
            'aisleSettings.featuredProducts': featuredProducts,
            'stats.totalProducts': products.filter(p => p.userId === user.id).length
          }
        }
      );
      
      const aisle = {
        id: `aisle_${generateUUID()}`,
        userId: user.id,
        slug: user.username,
        title: user.aisleSettings.title,
        description: user.aisleSettings.description,
        headerImage: user.aisleSettings.headerImage,
        settings: user.aisleSettings,
        featuredProducts,
        totalProducts: userProducts.length,
        totalViews: user.stats.aisleViews,
        isActive: userProducts.length > 0,
        metrics: {
          views: user.stats.aisleViews,
          uniqueVisitors: randomInt(50, Math.floor(user.stats.aisleViews * 0.7)),
          avgTimeOnPage: randomInt(30, 180),
          conversionRate: (randomInt(1, 15) / 100).toFixed(2)
        },
        createdAt: user.createdAt,
        updatedAt: new Date()
      };
      aisles.push(aisle);
    }
    
    if (aisles.length > 0) {
      await db.collection('aisles').insertMany(aisles);
      console.log(`✅ Inserted ${aisles.length} aisles\n`);
    }
    
    // CREATE PLATFORM SETTINGS
    console.log('⚙️  Creating platform settings...');
    await db.collection('platform_settings').insertOne({
      key: 'platform_wallet',
      algorandWallet: generateAlgorandAddress(),
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date()
    });
    console.log('✅ Inserted platform settings\n');
    
    // SUMMARY
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 SEEDING COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`  • ${users.length} users created`);
    console.log(`    - ${users.filter(u => u._type === 'ip-only').length} IP-only users`);
    console.log(`    - ${users.filter(u => u._type === 'products-only').length} products-only users`);
    console.log(`    - ${users.filter(u => u._type === 'both').length} users with both`);
    console.log(`  • ${ipAssets.length} IP assets created`);
    console.log(`  • ${revenuePoolsData.length} revenue pools created`);
    console.log(`  • ${products.length} products created`);
    console.log(`  • ${aisles.length} aisles created`);
    console.log(`  • 1 platform settings document created\n`);
    console.log('🔑 Login credentials for all users:');
    console.log('   Email: any user email from database');
    console.log('   Password: Password123!\n');
    console.log('📷 Image hosting: Cloudinary');
    console.log(`   Cloud: ${CLOUDINARY_CLOUD_NAME}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the seed function
seedDatabase();

