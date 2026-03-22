// Admin Analytics Mock Data

// Platform-wide metrics
export const platformMetrics = {
  totalRevenue: 45847.50,
  platformFee: 4584.75, // 10% of total revenue
  totalCreators: 12,
  activeCreators: 8,
  totalProducts: 54,
  totalSales: 479,
  avgOrderValue: 95.71,
  growthRate: 24.5,
  lastMonthRevenue: 12847.30,
  thisMonthRevenue: 15234.80,
};

// Top earning creators
export const topCreators = [
  {
    id: 1,
    username: 'rogue-combat-club',
    name: 'Rogue Combat Club',
    avatar: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=100&h=100&fit=crop',
    totalEarnings: 12847.50,
    productSales: 8234.25,
    ipRoyalties: 3456.75,
    adRevenue: 986.50,
    tips: 170.00,
    salesCount: 156,
    productsCount: 18,
    joinDate: '2023-08-15',
    status: 'active'
  },
  {
    id: 2,
    username: 'urban-artists',
    name: 'Urban Artists Collective',
    avatar: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=100&h=100&fit=crop',
    totalEarnings: 9234.80,
    productSales: 5678.90,
    ipRoyalties: 2890.40,
    adRevenue: 565.50,
    tips: 100.00,
    salesCount: 98,
    productsCount: 12,
    joinDate: '2023-09-22',
    status: 'active'
  },
  {
    id: 3,
    username: 'tech-esports',
    name: 'Tech eSports',
    avatar: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100&h=100&fit=crop',
    totalEarnings: 7456.90,
    productSales: 4567.80,
    ipRoyalties: 2234.10,
    adRevenue: 555.00,
    tips: 100.00,
    salesCount: 87,
    productsCount: 9,
    joinDate: '2023-10-10',
    status: 'active'
  },
  {
    id: 4,
    username: 'nature-vibes',
    name: 'Nature Vibes Studio',
    avatar: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=100&h=100&fit=crop',
    totalEarnings: 5678.40,
    productSales: 3456.20,
    ipRoyalties: 1890.20,
    adRevenue: 282.00,
    tips: 50.00,
    salesCount: 64,
    productsCount: 7,
    joinDate: '2023-11-05',
    status: 'active'
  },
  {
    id: 5,
    username: 'pixel-art-pro',
    name: 'Pixel Art Pro',
    avatar: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=100&h=100&fit=crop',
    totalEarnings: 4234.60,
    productSales: 2567.80,
    ipRoyalties: 1456.80,
    adRevenue: 180.00,
    tips: 30.00,
    salesCount: 45,
    productsCount: 5,
    joinDate: '2023-12-01',
    status: 'active'
  },
];

// Best selling products (across all creators)
export const bestSellingProducts = [
  {
    id: 1,
    name: 'Dragon Fighter Tee',
    creator: 'Rogue Combat Club',
    creatorId: 1,
    category: "Men's T-Shirt",
    basePrice: 19.99,
    retailPrice: 24.99,
    salesCount: 156,
    totalRevenue: 3898.44,
    creatorEarnings: 780.00,
    ipOwnerEarnings: 390.00,
    platformFee: 389.84,
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    ipUsed: 'Dragon Logo',
    ipOwnerId: 1
  },
  {
    id: 2,
    name: 'Urban Graffiti Hoodie',
    creator: 'Urban Artists Collective',
    creatorId: 2,
    category: 'Unisex Hoodie',
    basePrice: 39.99,
    retailPrice: 49.99,
    salesCount: 98,
    totalRevenue: 4899.02,
    creatorEarnings: 980.00,
    ipOwnerEarnings: 294.00,
    platformFee: 489.90,
    imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop',
    ipUsed: 'Abstract Pattern',
    ipOwnerId: 2
  },
  {
    id: 3,
    name: 'Tech Logo Mug',
    creator: 'Tech eSports',
    creatorId: 3,
    category: '11oz Mug',
    basePrice: 12.99,
    retailPrice: 16.99,
    salesCount: 234,
    totalRevenue: 3975.66,
    creatorEarnings: 936.00,
    ipOwnerEarnings: 585.00,
    platformFee: 397.57,
    imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop',
    ipUsed: null,
    ipOwnerId: null
  },
  {
    id: 4,
    name: 'Nature Vibes Tote',
    creator: 'Nature Vibes Studio',
    creatorId: 4,
    category: 'Tote Bag',
    basePrice: 16.99,
    retailPrice: 21.99,
    salesCount: 145,
    totalRevenue: 3188.55,
    creatorEarnings: 725.00,
    ipOwnerEarnings: 362.50,
    platformFee: 318.86,
    imageUrl: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop',
    ipUsed: 'Mountain Landscape',
    ipOwnerId: 4
  },
  {
    id: 5,
    name: 'Pixel Warrior Stickers',
    creator: 'Pixel Art Pro',
    creatorId: 5,
    category: 'Sticker Sheet',
    basePrice: 8.99,
    retailPrice: 11.99,
    salesCount: 312,
    totalRevenue: 3740.88,
    creatorEarnings: 936.00,
    ipOwnerEarnings: 780.00,
    platformFee: 374.09,
    imageUrl: 'https://images.unsplash.com/photo-1611003228941-98852ba62227?w=400&h=400&fit=crop',
    ipUsed: 'Pixel Character',
    ipOwnerId: 5
  },
];

// Detailed sales with revenue splits
export const detailedSales = [
  {
    id: 1,
    orderId: 'ORD-2024-001',
    date: '2024-01-18',
    product: 'Dragon Fighter Tee',
    productId: 1,
    basePrice: 19.99,
    retailPrice: 24.99,
    quantity: 2,
    totalSale: 49.98,
    // Revenue split breakdown
    storeOwner: 'Rogue Combat Club',
    storeOwnerId: 1,
    storeOwnerEarnings: 10.00, // Markup profit (24.99 - 19.99) * 2
    ipOwner: 'Rogue Combat Club',
    ipOwnerId: 1,
    ipRoyalty: 5.00, // $2.50 per use
    platformFee: 5.00, // 10% of total
    printfulCost: 29.98, // Base cost for fulfillment
    customer: 'John Doe',
    customerEmail: 'john@example.com',
    status: 'completed',
    payoutStatus: 'paid'
  },
  {
    id: 2,
    orderId: 'ORD-2024-002',
    date: '2024-01-18',
    product: 'Urban Graffiti Hoodie',
    productId: 2,
    basePrice: 39.99,
    retailPrice: 49.99,
    quantity: 1,
    totalSale: 49.99,
    storeOwner: 'Urban Artists Collective',
    storeOwnerId: 2,
    storeOwnerEarnings: 10.00,
    ipOwner: 'Abstract Art Studio',
    ipOwnerId: 6,
    ipRoyalty: 3.00,
    platformFee: 5.00,
    printfulCost: 31.99,
    customer: 'Sarah Johnson',
    customerEmail: 'sarah@example.com',
    status: 'completed',
    payoutStatus: 'paid'
  },
  {
    id: 3,
    orderId: 'ORD-2024-003',
    date: '2024-01-17',
    product: 'Tech Logo Mug',
    productId: 3,
    basePrice: 12.99,
    retailPrice: 16.99,
    quantity: 3,
    totalSale: 50.97,
    storeOwner: 'Tech eSports',
    storeOwnerId: 3,
    storeOwnerEarnings: 12.00,
    ipOwner: null, // No IP used
    ipOwnerId: null,
    ipRoyalty: 0,
    platformFee: 5.10,
    printfulCost: 33.87,
    customer: 'Mike Chen',
    customerEmail: 'mike@example.com',
    status: 'completed',
    payoutStatus: 'pending'
  },
];

// Payout records
export const payoutRecords = [
  {
    id: 1,
    creatorId: 1,
    creatorName: 'Rogue Combat Club',
    amount: 2847.50,
    period: 'December 2023',
    startDate: '2023-12-01',
    endDate: '2023-12-31',
    status: 'completed',
    paidDate: '2024-01-05',
    method: 'Bank Transfer',
    walletAddress: '0x742d35f8a9b3c2e1',
    breakdown: {
      productSales: 1680.50,
      ipRoyalties: 540.75,
      adRevenue: 486.25,
      tips: 140.00
    }
  },
  {
    id: 2,
    creatorId: 2,
    creatorName: 'Urban Artists Collective',
    amount: 1456.80,
    period: 'December 2023',
    startDate: '2023-12-01',
    endDate: '2023-12-31',
    status: 'completed',
    paidDate: '2024-01-05',
    method: 'Crypto',
    walletAddress: '0x8a9b4c5d6e7f8g9h',
    breakdown: {
      productSales: 890.30,
      ipRoyalties: 445.50,
      adRevenue: 96.00,
      tips: 25.00
    }
  },
  {
    id: 3,
    creatorId: 1,
    creatorName: 'Rogue Combat Club',
    amount: 3456.90,
    period: 'January 2024',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    status: 'pending',
    paidDate: null,
    method: 'Bank Transfer',
    walletAddress: '0x742d35f8a9b3c2e1',
    breakdown: {
      productSales: 2134.50,
      ipRoyalties: 890.40,
      adRevenue: 362.00,
      tips: 70.00
    }
  },
];

// Report filters and saved reports
export const reportTemplates = [
  {
    id: 1,
    name: 'Best Selling Shirts Last Month',
    filters: {
      category: "Men's T-Shirt",
      dateRange: 'last_month',
      sortBy: 'sales',
      minSales: 10
    },
    createdBy: 'admin',
    createdAt: '2024-01-15'
  },
  {
    id: 2,
    name: 'Top IP Earners This Quarter',
    filters: {
      dateRange: 'this_quarter',
      sortBy: 'ipRoyalties',
      minEarnings: 100
    },
    createdBy: 'admin',
    createdAt: '2024-01-10'
  },
  {
    id: 3,
    name: 'Products Without IP',
    filters: {
      hasIP: false,
      sortBy: 'sales'
    },
    createdBy: 'admin',
    createdAt: '2024-01-05'
  },
];

// Monthly trends
export const monthlyTrends = [
  { month: 'Jul 2023', revenue: 18234.50, sales: 234, creators: 6 },
  { month: 'Aug 2023', revenue: 22456.80, sales: 289, creators: 7 },
  { month: 'Sep 2023', revenue: 26789.20, sales: 334, creators: 8 },
  { month: 'Oct 2023', revenue: 31234.90, sales: 378, creators: 9 },
  { month: 'Nov 2023', revenue: 36890.40, sales: 412, creators: 10 },
  { month: 'Dec 2023', revenue: 42567.80, sales: 456, creators: 11 },
  { month: 'Jan 2024', revenue: 45847.50, sales: 479, creators: 12 },
];
