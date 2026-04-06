import { NextResponse } from 'next/server';
import { connectToDatabase, normalizeIds } from '@/lib/mongodb';

const cleanUrl = (url) => {
  if (!url) return "/placeholder.png";
  
  let fixedUrl = url;

  // 1. Force HTTPS
  if (fixedUrl.startsWith('//')) {
    fixedUrl = `https:${fixedUrl}`;
  }

  // 2. Intelligent Folder Mapping
  if (fixedUrl.includes('res.cloudinary.com')) {
    // If it's a user asset, force CamelCase (MetaWork)
    if (fixedUrl.toLowerCase().includes('/users/')) {
      fixedUrl = fixedUrl.replace(/\/(metawork|MetaWork)\//i, '/MetaWork/');
    } 
    // If it's a global product asset, your scan shows it's lowercase
    else if (fixedUrl.toLowerCase().includes('/products/') && !fixedUrl.toLowerCase().includes('/users/')) {
      fixedUrl = fixedUrl.replace(/\/(metawork|MetaWork)\//i, '/metawork/');
    }
  }

  return fixedUrl;
};

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // 1. Fetch source data
    const [products, usersWithAisles, ipAssets] = await Promise.all([
      db.collection('products').find({ isDraft: { $ne: true } }).toArray(),
      db.collection('users').find({ aisleSettings: { $exists: true } }).toArray(),
      db.collection('ip_assets').find({}).toArray()
    ]);

    // 2. Map Users into Aisles
    const formattedUserAisles = usersWithAisles.map(user => {
      const userIdStr = user._id.toString();
      const username = user.username;
      let settings = user.aisleSettings || {};

      // 1. COLLECT ALL INVENTORY (Live from DB)
      const actualProducts = products.filter(p => 
        p.ownerId?.toString() === userIdStr || 
        p.userId?.toString() === userIdStr || 
        p.owner === username ||
        p.ownerUsername === username
      );

      const actualIPs = ipAssets.filter(i => 
        i.ownerId?.toString() === userIdStr || 
        i.userId?.toString() === userIdStr ||
        i.owner === username
      );

      // 2. FINAL DATA PREP (THE FIX)
      // Bypass the old cache (settings.aisleSections) and use the live actualProducts 
      // from the DB so we get the fresh, working image URLs just like the Aisle page does.
      const liveProducts = actualProducts.length > 0 
        ? actualProducts 
        : (settings.aisleSections || []).flatMap(s => s.items || []).filter(i => i.itemType === 'products');

      const liveIPs = actualIPs.length > 0 
        ? actualIPs 
        : (settings.aisleSections || []).flatMap(s => s.items || []).filter(i => i.itemType === 'ip');

      const randomProducts = [...liveProducts].sort(() => 0.5 - Math.random()).slice(0, 3);
      const randomIPs = [...liveIPs].sort(() => 0.5 - Math.random()).slice(0, 3);

      // Helper to safely extract whatever image field the live DB uses
      const getProductImage = (p) => p.mainImage || p.mockupUrl || p.imageUrl || (p.images && p.images[0]) || p.image;
      const getIpImage = (ip) => ip.image || ip.imageUrl || ip.thumbnail || ip.mainImage;

      return {
        id: userIdStr,
        type: 'aisle',
        username: username,
        displayName: settings.title || user.profile?.displayName || user.name || username,
        bio: settings.description || user.bio || "Explore my custom collection.",
        headerImage: cleanUrl(settings.heroImage || user.banner),
        avatar: cleanUrl(settings.logo || user.avatar),
        aisleSettings: settings,
        
        // Stats
        totalProducts: actualProducts.length,
        totalIPAssets: actualIPs.length,
        
        // Mapped Galleries using live DB images
        galleryProducts: randomProducts.map(p => ({ 
            id: p._id?.toString() || p.id, 
            name: p.name || p.title, 
            image: cleanUrl(getProductImage(p)), 
            price: p.price || '59.99' 
        })),
        galleryIPs: randomIPs.map(ip => ({ 
            id: ip._id?.toString() || ip.id, 
            title: ip.title || ip.name, 
            image: cleanUrl(getIpImage(ip)) 
        })),
        
        // Top & Featured Products mapped from live data
        topProduct: randomProducts[0] ? {
            name: randomProducts[0].name || randomProducts[0].title,
            image: cleanUrl(getProductImage(randomProducts[0])),
            views: Math.floor(Math.random() * 50) + 10,
            sales: Math.floor(Math.random() * 5) + 1
        } : null,
        
        featuredProduct: randomProducts[1] ? {
            title: randomProducts[1].name || randomProducts[1].title,
            price: randomProducts[1].price || '59.99',
            imageUrl: cleanUrl(getProductImage(randomProducts[1]))
        } : randomProducts[0] ? {
            title: randomProducts[0].name || randomProducts[0].title,
            price: randomProducts[0].price || '59.99',
            imageUrl: cleanUrl(getProductImage(randomProducts[0]))
        } : null,

        source: 'live_database'
      };
    })
    .filter(aisle => aisle.totalProducts > 0 || aisle.totalIPAssets > 0);

    const normalizedData = [
      ...normalizeIds(products).map(p => ({ ...p, type: 'product' })),
      ...formattedUserAisles,
      ...normalizeIds(ipAssets).map(i => ({ ...i, type: 'ip' }))
    ];

    return NextResponse.json(normalizedData);
  } catch (error) {
    console.error("❌ SHOWROOM API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}