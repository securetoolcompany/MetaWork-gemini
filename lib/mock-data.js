// Mock data for MetaWork Creator Hub

export const ipAssets = [
  {
    id: 1,
    name: "Dragon Logo",
    imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop",
    status: "approved",
    usageCount: 12,
    earnings: 340.50,
    category: "Logo",
    description: "Fierce dragon logo perfect for gaming brands and athletic wear",
    tags: "dragon, gaming, fierce, logo, esports",
    licensingFee: 2.50,
    isPublic: true
  },
  {
    id: 2,
    name: "Gym Mascot",
    imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop",
    status: "approved",
    usageCount: 8,
    earnings: 220.00,
    category: "Artwork",
    description: "Motivational gym mascot character for fitness apparel",
    tags: "fitness, gym, motivation, workout, athletic",
    licensingFee: 2.75,
    isPublic: true
  },
  {
    id: 3,
    name: "Abstract Pattern",
    imageUrl: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400&h=400&fit=crop",
    status: "approved",
    usageCount: 15,
    earnings: 425.75,
    category: "Pattern",
    description: "Modern geometric pattern suitable for all product types",
    tags: "abstract, geometric, modern, pattern, colorful",
    licensingFee: 1.75,
    isPublic: true
  },
  {
    id: 4,
    name: "Tiger Mascot",
    imageUrl: "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=400&h=400&fit=crop",
    status: "pending",
    usageCount: 0,
    earnings: 0,
    category: "Logo",
    description: "Bold tiger design for sports teams and outdoor brands",
    tags: "tiger, wildlife, sports, bold, mascot",
    licensingFee: 3.00,
    isPublic: true
  },
  {
    id: 5,
    name: "Neon Typography",
    imageUrl: "https://images.unsplash.com/photo-1516414447565-b14be0adf13e?w=400&h=400&fit=crop",
    status: "approved",
    usageCount: 22,
    earnings: 680.50,
    category: "Typography",
    description: "Retro neon text style perfect for vintage aesthetics",
    tags: "neon, retro, vintage, typography, 80s",
    licensingFee: 3.25,
    isPublic: true
  },
  {
    id: 6,
    name: "Nature Photography",
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop",
    status: "approved",
    usageCount: 5,
    earnings: 150.25,
    category: "Photography",
    description: "Stunning mountain landscape for outdoor apparel",
    tags: "nature, mountains, landscape, outdoor, scenic",
    licensingFee: 4.00,
    isPublic: false // Private IP - owner only
  },
  {
    id: 7,
    name: "Skull Art",
    imageUrl: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&h=400&fit=crop",
    status: "rejected",
    usageCount: 0,
    earnings: 0,
    category: "Artwork",
    description: "Detailed skull illustration with artistic flair",
    tags: "skull, art, gothic, dark, illustration",
    licensingFee: 2.00,
    isPublic: true
  },
  {
    id: 8,
    name: "Wave Pattern",
    imageUrl: "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=400&h=400&fit=crop",
    status: "approved",
    usageCount: 18,
    earnings: 495.00,
    category: "Pattern",
    description: "Ocean wave abstract design for beach and surf wear",
    tags: "waves, ocean, beach, surf, pattern",
    licensingFee: 2.25,
    isPublic: true
  },
  {
    id: 9,
    name: "Minimalist Logo",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop",
    status: "pending",
    usageCount: 0,
    earnings: 0,
    category: "Logo",
    description: "Clean and modern logo design for minimal aesthetics",
    tags: "minimal, clean, modern, simple, logo",
    licensingFee: 1.50,
    isPublic: false // Private IP - owner only
  },
  {
    id: 10,
    name: "Galaxy Artwork",
    imageUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=400&fit=crop",
    status: "approved",
    usageCount: 30,
    earnings: 890.00,
    category: "Artwork",
    description: "Stunning galaxy space art for cosmic themes",
    tags: "space, galaxy, cosmic, stars, universe",
    licensingFee: 2.95,
    isPublic: true
  }
];

export const baseProducts = [
  {
    id: 1,
    name: "Men's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    basePrice: 19.99,
    category: "Apparel"
  },
  {
    id: 2,
    name: "Women's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400&h=400&fit=crop",
    basePrice: 19.99,
    category: "Apparel"
  },
  {
    id: 3,
    name: "Unisex Hoodie",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    basePrice: 39.99,
    category: "Apparel"
  },
  {
    id: 4,
    name: "11oz Mug",
    imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop",
    basePrice: 12.99,
    category: "Drinkware"
  },
  {
    id: 5,
    name: "Sticker Sheet",
    imageUrl: "https://images.unsplash.com/photo-1527850484057-dcc2e1bb6dc7?w=400&h=400&fit=crop",
    basePrice: 8.99,
    category: "Accessories"
  },
  {
    id: 6,
    name: "Tote Bag",
    imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop",
    basePrice: 16.99,
    category: "Accessories"
  }
];

export const userProducts = [
  {
    id: 1,
    name: "Dragon Fighter Tee",
    baseProduct: "Men's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    price: 24.99,
    salesCount: 23,
    earnings: 437.00,
    status: "live",
    isPublic: true,
    description: "Bold dragon design perfect for gamers and fantasy fans"
  },
  {
    id: 2,
    name: "Gym Motivation Hoodie",
    baseProduct: "Unisex Hoodie",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    price: 44.99,
    salesCount: 15,
    earnings: 325.50,
    status: "live",
    isPublic: true,
    description: "Stay motivated with this inspiring fitness hoodie"
  },
  {
    id: 3,
    name: "Abstract Waves Mug",
    baseProduct: "11oz Mug",
    imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop",
    price: 16.99,
    salesCount: 42,
    earnings: 680.20,
    status: "live",
    isPublic: true,
    description: "Sip in style with ocean-inspired wave patterns"
  },
  {
    id: 4,
    name: "Neon Dreams Tee",
    baseProduct: "Women's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400&h=400&fit=crop",
    price: 22.99,
    salesCount: 31,
    earnings: 589.75,
    status: "live",
    isPublic: false,
    description: "Retro neon vibes for the modern woman"
  },
  {
    id: 5,
    name: "Galaxy Explorer Tote",
    baseProduct: "Tote Bag",
    imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop",
    price: 21.99,
    salesCount: 18,
    earnings: 340.25,
    status: "live",
    isPublic: true,
    description: "Carry the cosmos with this stunning galaxy tote"
  },
  {
    id: 6,
    name: "Tiger Spirit Tee",
    baseProduct: "Men's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    price: 24.99,
    salesCount: 0,
    earnings: 0,
    status: "draft",
    isPublic: false,
    description: "Unleash your inner beast with this fierce tiger design"
  },
  {
    id: 7,
    name: "Mountain Vista Hoodie",
    baseProduct: "Unisex Hoodie",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    price: 42.99,
    salesCount: 9,
    earnings: 175.50,
    status: "live",
    isPublic: true,
    description: "Adventure awaits with stunning mountain scenery"
  },
  {
    id: 8,
    name: "Wave Pattern Stickers",
    baseProduct: "Sticker Sheet",
    imageUrl: "https://images.unsplash.com/photo-1527850484057-dcc2e1bb6dc7?w=400&h=400&fit=crop",
    price: 11.99,
    salesCount: 56,
    earnings: 450.80,
    status: "live",
    isPublic: true,
    description: "Decorate with these beautiful ocean wave stickers"
  },
  {
    id: 9,
    name: "Dragon Power Mug",
    baseProduct: "11oz Mug",
    imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop",
    price: 15.99,
    salesCount: 27,
    earnings: 380.60,
    status: "live",
    isPublic: true,
    description: "Start your day with mythical power"
  },
  {
    id: 10,
    name: "Geometric Dreams Tee",
    baseProduct: "Women's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400&h=400&fit=crop",
    price: 23.99,
    salesCount: 0,
    earnings: 0,
    status: "draft",
    isPublic: false,
    description: "Modern geometric patterns for the style-conscious"
  },
  {
    id: 11,
    name: "Urban Street Hoodie",
    baseProduct: "Unisex Hoodie",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    price: 39.99,
    salesCount: 34,
    earnings: 720.50,
    status: "live",
    isPublic: true,
    description: "Street style meets comfort in this urban hoodie"
  },
  {
    id: 12,
    name: "Sunset Vibes Tote",
    baseProduct: "Tote Bag",
    imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop",
    price: 19.99,
    salesCount: 45,
    earnings: 615.25,
    status: "live",
    isPublic: true,
    description: "Carry the warmth of sunset wherever you go"
  },
  {
    id: 13,
    name: "Cosmic Energy Mug",
    baseProduct: "11oz Mug",
    imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop",
    price: 14.99,
    salesCount: 38,
    earnings: 445.80,
    status: "live",
    isPublic: true,
    description: "Fuel your morning with cosmic energy"
  },
  {
    id: 14,
    name: "Retro Wave Tee",
    baseProduct: "Men's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    price: 26.99,
    salesCount: 29,
    earnings: 560.75,
    status: "live",
    isPublic: true,
    description: "Ride the retro wave with synthwave-inspired design"
  },
  {
    id: 15,
    name: "Warrior Spirit Hoodie",
    baseProduct: "Unisex Hoodie",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    price: 46.99,
    salesCount: 21,
    earnings: 485.50,
    status: "live",
    isPublic: true,
    description: "Channel your inner warrior with this bold design"
  },
  {
    id: 16,
    name: "Neon Nights Stickers",
    baseProduct: "Sticker Sheet",
    imageUrl: "https://images.unsplash.com/photo-1527850484057-dcc2e1bb6dc7?w=400&h=400&fit=crop",
    price: 9.99,
    salesCount: 67,
    earnings: 580.25,
    status: "live",
    isPublic: true,
    description: "Light up your laptop with neon city stickers"
  },
  {
    id: 17,
    name: "Ocean Breeze Tee",
    baseProduct: "Women's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400&h=400&fit=crop",
    price: 24.99,
    salesCount: 41,
    earnings: 695.40,
    status: "live",
    isPublic: true,
    description: "Feel the ocean breeze in this fresh summer tee"
  },
  {
    id: 18,
    name: "Phoenix Rising Tee",
    baseProduct: "Men's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    price: 27.99,
    salesCount: 33,
    earnings: 612.75,
    status: "live",
    isPublic: true,
    description: "Rise from the ashes with this powerful phoenix design"
  },
  {
    id: 19,
    name: "Arctic Wolf Hoodie",
    baseProduct: "Unisex Hoodie",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    price: 43.99,
    salesCount: 26,
    earnings: 545.20,
    status: "live",
    isPublic: true,
    description: "Embrace your wild side with this arctic wolf design"
  },
  {
    id: 20,
    name: "Cyber Punk Mug",
    baseProduct: "11oz Mug",
    imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop",
    price: 16.99,
    salesCount: 35,
    earnings: 425.60,
    status: "live",
    isPublic: true,
    description: "Enter the cyber future with every sip"
  },
  {
    id: 21,
    name: "Tropical Paradise Tote",
    baseProduct: "Tote Bag",
    imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop",
    price: 22.99,
    salesCount: 39,
    earnings: 595.80,
    status: "live",
    isPublic: true,
    description: "Escape to paradise with tropical vibes"
  },
  {
    id: 22,
    name: "Lightning Strike Tee",
    baseProduct: "Women's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400&h=400&fit=crop",
    price: 25.99,
    salesCount: 30,
    earnings: 545.25,
    status: "live",
    isPublic: true,
    description: "Strike with power in this electric design"
  },
  {
    id: 23,
    name: "Samurai Honor Hoodie",
    baseProduct: "Unisex Hoodie",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    price: 48.99,
    salesCount: 19,
    earnings: 445.75,
    status: "live",
    isPublic: true,
    description: "Honor the way of the samurai with this design"
  },
  {
    id: 24,
    name: "Galaxy Dreams Stickers",
    baseProduct: "Sticker Sheet",
    imageUrl: "https://images.unsplash.com/photo-1527850484057-dcc2e1bb6dc7?w=400&h=400&fit=crop",
    price: 10.99,
    salesCount: 72,
    earnings: 655.40,
    status: "live",
    isPublic: true,
    description: "Dream among the stars with galaxy stickers"
  },
  {
    id: 25,
    name: "Graffiti Art Tee",
    baseProduct: "Men's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    price: 28.99,
    salesCount: 24,
    earnings: 485.60,
    status: "live",
    isPublic: true,
    description: "Wear art on your sleeve with graffiti style"
  },
  {
    id: 26,
    name: "Forest Spirit Mug",
    baseProduct: "11oz Mug",
    imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop",
    price: 15.99,
    salesCount: 44,
    earnings: 525.80,
    status: "live",
    isPublic: true,
    description: "Connect with nature through forest spirits"
  },
  {
    id: 27,
    name: "Minimal Zen Tote",
    baseProduct: "Tote Bag",
    imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop",
    price: 20.99,
    salesCount: 36,
    earnings: 515.25,
    status: "live",
    isPublic: true,
    description: "Find peace in minimalist zen design"
  },
  {
    id: 28,
    name: "Flame Dragon Hoodie",
    baseProduct: "Unisex Hoodie",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    price: 45.99,
    salesCount: 28,
    earnings: 605.40,
    status: "live",
    isPublic: true,
    description: "Unleash the fire with flame dragon design"
  },
  {
    id: 29,
    name: "Digital Matrix Tee",
    baseProduct: "Women's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400&h=400&fit=crop",
    price: 23.99,
    salesCount: 37,
    earnings: 595.75,
    status: "live",
    isPublic: true,
    description: "Enter the digital realm with matrix code"
  },
  {
    id: 30,
    name: "Ancient Runes Stickers",
    baseProduct: "Sticker Sheet",
    imageUrl: "https://images.unsplash.com/photo-1527850484057-dcc2e1bb6dc7?w=400&h=400&fit=crop",
    price: 11.99,
    salesCount: 58,
    earnings: 565.80,
    status: "live",
    isPublic: true,
    description: "Unlock ancient mysteries with rune stickers"
  },
  {
    id: 31,
    name: "Steampunk Gears Mug",
    baseProduct: "11oz Mug",
    imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop",
    price: 17.99,
    salesCount: 31,
    earnings: 425.25,
    status: "live",
    isPublic: true,
    description: "Victorian future meets your morning brew"
  },
  {
    id: 32,
    name: "Sunset Beach Tee",
    baseProduct: "Men's T-Shirt",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    price: 25.99,
    salesCount: 42,
    earnings: 695.40,
    status: "live",
    isPublic: true,
    description: "Catch the sunset on the beach every day"
  },
  {
    id: 33,
    name: "Crystal Magic Hoodie",
    baseProduct: "Unisex Hoodie",
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop",
    price: 44.99,
    salesCount: 25,
    earnings: 535.60,
    status: "live",
    isPublic: true,
    description: "Harness crystal energy with mystical design"
  },
  {
    id: 34,
    name: "Space Explorer Tote",
    baseProduct: "Tote Bag",
    imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop",
    price: 21.99,
    salesCount: 40,
    earnings: 585.25,
    status: "live",
    isPublic: true,
    description: "Explore the cosmos in style"
  }
];

export const salesData = [
  {
    id: 1,
    productName: "Abstract Waves Mug",
    date: "2024-01-18",
    amount: 16.99,
    status: "completed"
  },
  {
    id: 2,
    productName: "Dragon Fighter Tee",
    date: "2024-01-18",
    amount: 24.99,
    status: "completed"
  },
  {
    id: 3,
    productName: "Neon Dreams Tee",
    date: "2024-01-17",
    amount: 22.99,
    status: "processing"
  },
  {
    id: 4,
    productName: "Wave Pattern Stickers",
    date: "2024-01-17",
    amount: 11.99,
    status: "completed"
  },
  {
    id: 5,
    productName: "Gym Motivation Hoodie",
    date: "2024-01-16",
    amount: 44.99,
    status: "completed"
  },
  {
    id: 6,
    productName: "Galaxy Explorer Tote",
    date: "2024-01-16",
    amount: 21.99,
    status: "completed"
  },
  {
    id: 7,
    productName: "Dragon Power Mug",
    date: "2024-01-15",
    amount: 15.99,
    status: "completed"
  },
  {
    id: 8,
    productName: "Neon Dreams Tee",
    date: "2024-01-15",
    amount: 22.99,
    status: "processing"
  }
];

export const earningsData = [
  { date: "2024-01", amount: 450.25 },
  { date: "2024-02", amount: 520.50 },
  { date: "2024-03", amount: 380.75 },
  { date: "2024-04", amount: 680.00 },
  { date: "2024-05", amount: 590.00 },
  { date: "2024-06", amount: 226.00 }
];

// Creator Profiles for Aisles
export const creatorProfiles = [
  {
    slug: "rogue-combat-club",
    name: "Rogue Combat Club",
    bio: "Official merchandise from Rogue Combat Club. Premium gear for fighters and fans.",
    bannerUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=300&fit=crop",
    avatarUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=128&h=128&fit=crop",
    socials: {
      twitter: "https://twitter.com/roguecombat",
      instagram: "https://instagram.com/roguecombat",
      website: "https://roguecombat.com"
    },
    category: "Fitness & Sports",
    adRevenueSplit: 0.7,
    aisleSettings: {
      theme: 'dark-professional',
      accentColor: '#3b82f6',
      fontPairing: 'inter-system',
      productsPerRow: 3,
      cardStyle: 'standard',
      headerStyle: 'full-banner',
      defaultSort: 'newest',
      showPoweredBy: true,
      allowReviews: true,
      showSalesCounter: true,
      adSettings: {
        header: true,
        sidebar: false,
        inGrid: true,
        inGridFrequency: 8
      },
      tipJarEnabled: true,
      tipJarWallet: "0x742d35f8a9b3c2e1",
      tipPresets: [5, 10, 25],
      tipButtonText: "Support My Work",
      tipPlacement: 'both'
    },
    collections: [
      { 
        id: 1, 
        name: "Summer Drop", 
        productIds: [1, 3, 5], 
        columns: 3,
        description: "Limited summer collection",
        showHeader: true
      },
      { 
        id: 2, 
        name: "Fighter Essentials", 
        productIds: [2, 4, 6], 
        columns: 4,
        description: "Core gear for every fighter",
        showHeader: true
      }
    ],
    stats: {
      totalProducts: 18,
      totalSales: 156,
      trending: true,
      featured: false
    }
  },
  {
    slug: "urban-artists-collective",
    name: "Urban Artists Collective",
    bio: "Street art meets fashion. Limited drops, unlimited creativity.",
    bannerUrl: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=1200&h=300&fit=crop",
    avatarUrl: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=128&h=128&fit=crop",
    socials: {
      instagram: "https://instagram.com/urbanartists",
      tiktok: "https://tiktok.com/@urbanartists"
    },
    category: "Art & Design",
    adRevenueSplit: 0.7,
    aisleSettings: {
      theme: 'bold-vibrant',
      accentColor: '#e94560',
      fontPairing: 'montserrat-roboto',
      productsPerRow: 4,
      cardStyle: 'minimal',
      headerStyle: 'compact',
      defaultSort: 'best-selling',
      showPoweredBy: false,
      allowReviews: true,
      showSalesCounter: false,
      adSettings: {
        header: false,
        sidebar: true,
        inGrid: false,
        inGridFrequency: 6
      },
      tipJarEnabled: false,
      tipJarWallet: null,
      tipPresets: [10, 20, 50],
      tipButtonText: "Buy Me a Coffee",
      tipPlacement: 'header'
    },
    collections: [
      { 
        id: 1, 
        name: "New Arrivals", 
        productIds: [7, 8], 
        columns: 2,
        description: "Fresh off the press",
        showHeader: true
      }
    ],
    stats: {
      totalProducts: 12,
      totalSales: 89,
      trending: false,
      featured: true
    }
  },
  {
    slug: "tech-esports-gaming",
    name: "Tech eSports",
    bio: "Pro gaming team merch. Level up your style.",
    bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=300&fit=crop",
    avatarUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=128&h=128&fit=crop",
    socials: {
      twitter: "https://twitter.com/techesports",
      twitch: "https://twitch.tv/techesports"
    },
    category: "Gaming",
    adRevenueSplit: 0.7,
    aisleSettings: {
      theme: 'dark-professional',
      accentColor: '#8b5cf6',
      fontPairing: 'inter-system',
      productsPerRow: 3,
      cardStyle: 'detailed',
      headerStyle: 'full-banner',
      defaultSort: 'trending',
      showPoweredBy: true,
      allowReviews: true,
      showSalesCounter: true,
      adSettings: {
        header: true,
        sidebar: true,
        inGrid: true,
        inGridFrequency: 6
      },
      tipJarEnabled: true,
      tipJarWallet: "0x9f8e24a5c7b1d3f2",
      tipPresets: [5, 15, 25],
      tipButtonText: "Support the Team",
      tipPlacement: 'floating'
    },
    collections: [],
    stats: {
      totalProducts: 24,
      totalSales: 234,
      trending: true,
      featured: true
    }
  }
];

// Ad Revenue Data
export const adEarnings = [
  {
    creatorSlug: "rogue-combat-club",
    period: "2024-01-01 to 2024-01-07",
    impressions: 12450,
    clicks: 234,
    earnings: 23.40,
    status: "claimable"
  },
  {
    creatorSlug: "rogue-combat-club",
    period: "2023-12-25 to 2023-12-31",
    impressions: 10234,
    clicks: 187,
    earnings: 18.70,
    status: "claimable"
  },
  {
    creatorSlug: "rogue-combat-club",
    period: "2023-12-18 to 2023-12-24",
    impressions: 15678,
    clicks: 298,
    earnings: 29.80,
    status: "claimed"
  }
];

// Tips Data
export const tips = [
  {
    id: 1,
    creatorSlug: "rogue-combat-club",
    date: "2024-01-15",
    supporter: "0x8f3a7b2e9d1c4f5a",
    amount: 10.00,
    message: "Love your work! Keep it up! 🔥"
  },
  {
    id: 2,
    creatorSlug: "rogue-combat-club",
    date: "2024-01-14",
    supporter: "0x2b4e8c9f3a6d1e7b",
    amount: 25.00,
    message: "Amazing designs!"
  },
  {
    id: 3,
    creatorSlug: "rogue-combat-club",
    date: "2024-01-12",
    supporter: "0x5c7f2a9e4b8d3c1f",
    amount: 5.00,
    message: ""
  }
];

// Claims History
export const claimsHistory = [
  {
    id: 1,
    date: "2024-01-10",
    amount: 156.40,
    type: "Ad Revenue",
    transaction: "0x742d...3f8a",
    status: "completed"
  },
  {
    id: 2,
    date: "2024-01-05",
    amount: 89.30,
    type: "Ad Revenue",
    transaction: "0x9f2e...7b1c",
    status: "completed"
  },
  {
    id: 3,
    date: "2023-12-28",
    amount: 234.50,
    type: "Multiple",
    transaction: "0x4a7b...2e9d",
    status: "completed"
  }
];

export const earningsBreakdown = [
  {
    id: 1,
    date: "2024-01-18",
    product: "Abstract Waves Mug",
    type: "Product Sale",
    amount: 16.99,
    status: "paid"
  },
  {
    id: 2,
    date: "2024-01-18",
    product: "Dragon Logo IP",
    type: "IP Royalty",
    amount: 5.00,
    status: "paid"
  },
  {
    id: 3,
    date: "2024-01-17",
    product: "Wave Pattern Stickers",
    type: "Product Sale",
    amount: 11.99,
    status: "pending"
  },
  {
    id: 4,
    date: "2024-01-17",
    product: "Neon Typography IP",
    type: "IP Royalty",
    amount: 7.50,
    status: "pending"
  },
  {
    id: 5,
    date: "2024-01-16",
    product: "Gym Motivation Hoodie",
    type: "Product Sale",
    amount: 44.99,
    status: "paid"
  },
  {
    id: 6,
    date: "2024-01-16",
    product: "Galaxy Artwork IP",
    type: "IP Royalty",
    amount: 10.00,
    status: "paid"
  },
  {
    id: 7,
    date: "2024-01-15",
    product: "Dragon Fighter Tee",
    type: "Product Sale",
    amount: 24.99,
    status: "paid"
  },
  {
    id: 8,
    date: "2024-01-15",
    product: "Abstract Pattern IP",
    type: "IP Royalty",
    amount: 6.00,
    status: "paid"
  }
];
