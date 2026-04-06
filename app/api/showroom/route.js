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
    if (fixedUrl.includes('/users/')) {
      fixedUrl = fixedUrl.replace(/\/metawork\//gi, '/MetaWork/');
    } 
    // If it's a global product asset, your scan shows it's lowercase
    else if (fixedUrl.includes('/products/')) {
      fixedUrl = fixedUrl.replace(/\/MetaWork\//gi, '/metawork/');
    }
  }

  return fixedUrl;
};

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // 1. Fetch source data
    // Note: We still fetch products/ipAssets for the other "Shop By" tabs
    const [products, usersWithAisles, ipAssets] = await Promise.all([
      db.collection('products').find({ isDraft: { $ne: true } }).toArray(),
      db.collection('users').find({ aisleSettings: { $exists: true } }).toArray(),
      db.collection('ip_assets').find({}).toArray()
    ]);

    // 2. Map Users into Aisles using the "aisleSections" snapshots
    // app/api/showroom/route.js

    const formattedUserAisles = usersWithAisles.map(user => {
      const userIdStr = user._id.toString();
      const username = user.username;
      let settings = user.aisleSettings || null;

      // 1. COLLECT ALL INVENTORY (Checking all possible DB relation fields)
      const actualProducts = products.filter(p => 
        p.ownerId?.toString() === userIdStr || 
        p.userId?.toString() === userIdStr || // This catches Boxing Fit University
        p.owner === username ||
        p.ownerUsername === username
      );

      const actualIPs = ipAssets.filter(i => 
        i.ownerId?.toString() === userIdStr || 
        i.userId?.toString() === userIdStr ||
        i.owner === username
      );

      // 2. GENERATE DEFAULT AISLE IF USER HASN'T CURATED ONE
      // If they have no sections defined, we build them virtually
      if (!settings || !settings.aisleSections || settings.aisleSections.length === 0) {
        const randomColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        
        settings = {
          ...settings,
          title: settings?.title || user.profile?.displayName || user.name || username,
          description: settings?.description || user.bio || "Explore my custom collection.",
          accentColor: settings?.accentColor || randomColors[Math.floor(Math.random() * randomColors.length)],
          logo: settings?.logo || user.avatar || "/placeholder-avatar.png",
          heroImage: settings?.heroImage || user.banner || null,
          aisleSections: []
        };

        if (actualProducts.length > 0) {
          settings.aisleSections.push({
            id: "default_products",
            title: "All Products",
            items: actualProducts.map(p => ({
              id: p._id?.toString() || p.id,
              itemType: 'products',
              title: p.name || p.title,
              imageUrl: p.mainImage || p.imageUrl || p.mockupUrl || (p.images && p.images[0]) || "/placeholder.png",
              price: p.price
            }))
          });
        }

        if (actualIPs.length > 0) {
          settings.aisleSections.push({
            id: "default_ip",
            title: "IP Assets",
            items: actualIPs.map(ip => ({
              id: ip._id?.toString() || ip.id,
              itemType: 'ip',
              title: ip.title || ip.name,
              imageUrl: ip.image || ip.imageUrl || "/placeholder.png"
            }))
          });
        }
      }

      // 3. FINAL DATA PREP (Unified for Card and Modal)
      const allPinnedItems = (settings.aisleSections || []).flatMap(section => section.items || []);
      const aisleProducts = allPinnedItems.filter(item => item.itemType === 'products');
      const aisleIPs = allPinnedItems.filter(item => item.itemType === 'ip');

      const randomProducts = [...aisleProducts].sort(() => 0.5 - Math.random()).slice(0, 3);
      const randomIPs = [...aisleIPs].sort(() => 0.5 - Math.random()).slice(0, 3);

      return {
        id: userIdStr,
        type: 'aisle',
        username: username,
        displayName: settings.title,
        bio: settings.description,
        headerImage: settings.heroImage,
        avatar: settings.logo,
        aisleSettings: settings,
        totalProducts: aisleProducts.length,
        totalIPAssets: aisleIPs.length,
        galleryProducts: randomProducts.map(p => ({ id: p.id, name: p.title, image: p.imageUrl, price: p.price })),
        galleryIPs: randomIPs.map(ip => ({ id: ip.id, title: ip.title, image: ip.imageUrl })),
        source: user.aisleSettings ? 'user_curated' : 'system_default'
      };
    })
    // 4. GATEKEEPER: Still only show people with at least 1 item
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