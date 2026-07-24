import { NextResponse } from 'next/server';
import { connectToDatabase, normalizeIds } from '@/lib/mongodb';

const cleanUrl = (url) => {
  if (!url) return "/placeholder.png";
  let fixedUrl = url;

  if (fixedUrl.startsWith('//')) {
    fixedUrl = `https:${fixedUrl}`;
  }

  if (fixedUrl.includes('res.cloudinary.com')) {
    if (fixedUrl.toLowerCase().includes('/users/')) {
      fixedUrl = fixedUrl.replace(/\/(metawork|MetaWork)\//i, '/MetaWork/');
    } else if (fixedUrl.toLowerCase().includes('/products/') && !fixedUrl.toLowerCase().includes('/users/')) {
      fixedUrl = fixedUrl.replace(/\/(metawork|MetaWork)\//i, '/metawork/');
    }
  }

  return fixedUrl;
};

function normalizeProductImageFields(product) {
  const allImages = [
    product.thumbnailUrl,
    product.mockupUrl,
    ...(Array.isArray(product.mockupImages) ? product.mockupImages : []),
    product.imageUrl,
    product.image,
    ...(Array.isArray(product.images) ? product.images : []),
  ]
    .filter(Boolean)
    .map(cleanUrl)
    .filter((url) => url && url !== "/placeholder.png");

  const uniqueImages = [...new Set(allImages)];
  const primaryImage = uniqueImages[0] || "/placeholder.png";

  return {
    ...product,
    name: product.name || product.title,
    thumbnailUrl: primaryImage,
    imageUrl: primaryImage,
    images: uniqueImages.length > 0 ? uniqueImages : [primaryImage],
  };
}

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // 1. Fetch Source Data
    const [products, usersWithAisles, ipAssets] = await Promise.all([
      db.collection('products').find({ isDraft: { $ne: true } }).toArray(),
      db.collection('users').find({ aisleSettings: { $exists: true } }).toArray(),
      db.collection('ip_assets').find({}).toArray()
    ]);

    // 2. Map Users into Aisles (Lightweight / Lazy Ready)
    const formattedUserAisles = usersWithAisles.map(user => {
      const userIdStr = user._id.toString();
      const username = user.username;
      const settings = user.aisleSettings || {};

      // Just grab the counts for the showroom UI indicators. 
      // The deep image arrays are NO LONGER mapped here.
      const actualProductsCount = products.filter(p => 
        p.ownerId?.toString() === userIdStr || 
        p.userId?.toString() === userIdStr || 
        p.owner === username ||
        p.ownerUsername === username
      ).length;

      const actualIPsCount = ipAssets.filter(i => 
        i.ownerId?.toString() === userIdStr || 
        i.userId?.toString() === userIdStr ||
        i.owner === username
      ).length;

      return {
        id: userIdStr,
        type: 'aisle',
        username: username,
        displayName: settings.title || user.profile?.displayName || user.name || username,
        bio: settings.description || user.bio || "Explore my custom collection.",
        headerImage: cleanUrl(settings.heroImage || user.banner),
        avatar: cleanUrl(settings.logo || user.avatar),
        
        // Base Stats 
        stats: user.stats || { views: 0, sales: 0 },
        totalProducts: actualProductsCount,
        totalIPAssets: actualIPsCount,
        
        source: 'live_database_lazy'
      };
    }).filter(aisle => aisle.totalProducts > 0 || aisle.totalIPAssets > 0);

    const normalizedData = [
      ...normalizeIds(products).map(p => ({
        ...normalizeProductImageFields(p),
        type: 'product'
      })),
      ...formattedUserAisles,
      ...normalizeIds(ipAssets).map(i => ({ ...i, type: 'ip' }))
    ];

    return NextResponse.json(normalizedData);
  } catch (error) {
    console.error("❌ SHOWROOM API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}