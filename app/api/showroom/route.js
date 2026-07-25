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

const HIDDEN_SHOWROOM_AISLES = new Set([
  'legionmma',
  'und1sputed arizona',
  'wallet-br5rldln',
  'demoaccount-1',
  'lymber',
  'invictus gym',
]);

function hasUsableImage(item) {
  const rawImage = item?.imageUrl || item?.thumbnailUrl || item?.image || '';
  if (!rawImage || typeof rawImage !== 'string') return false;

  const lower = rawImage.trim().toLowerCase();

  if (!lower) return false;
  if (lower.includes('placeholder')) return false;
  if (lower.includes('null')) return false;
  if (lower.includes('undefined')) return false;
  if (lower === 'https://files.cdn.printful.com/') return false;

  return true;
}

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

    const [products, usersWithAisles, ipAssets] = await Promise.all([
      db.collection('products').find({
        isDraft: { $ne: true },
        status: { $ne: 'draft' },
        $or: [
          { showroomListed: true },
          { status: { $in: ['live', 'active'] } },
          { isPublic: true }
        ]
      }).toArray(),
      db.collection('users').find({ aisleSettings: { $exists: true } }).toArray(),
      db.collection('ip_assets').find({
        $or: [
          { isPublic: true },
          { status: { $in: ['active', 'live'] } }
        ]
      }).toArray()
    ]);

    const formattedUserAisles = usersWithAisles
      .map(user => {
        const userIdStr = user._id.toString();
        const username = user.username || '';
        const settings = user.aisleSettings || {};
        const displayName = settings.title || user.profile?.displayName || user.name || username;

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
          username,
          displayName,
          bio: settings.description || user.bio || "Explore my custom collection.",
          headerImage: cleanUrl(settings.heroImage || user.banner),
          avatar: cleanUrl(settings.logo || user.avatar),
          stats: user.stats || { views: 0, sales: 0 },
          totalProducts: actualProductsCount,
          totalIPAssets: actualIPsCount,
          source: 'live_database_lazy'
        };
      })
      .filter(aisle => {
        const candidates = [aisle.username, aisle.displayName]
          .filter(Boolean)
          .map(v => String(v).trim().toLowerCase());

        const isHidden = candidates.some(v => HIDDEN_SHOWROOM_AISLES.has(v));

        return !isHidden && (aisle.totalProducts > 0 || aisle.totalIPAssets > 0);
      });

    const normalizedProducts = normalizeIds(products)
      .map(p => ({
        ...normalizeProductImageFields(p),
        type: 'product'
      }))
      .filter(hasUsableImage);

    const normalizedIPAssets = normalizeIds(ipAssets)
      .map(i => ({
        ...i,
        imageUrl: cleanUrl(i.imageUrl || i.thumbnailUrl || i.image),
        type: 'ip'
      }))
      .filter(hasUsableImage);

    const normalizedData = [
      ...normalizedProducts,
      ...formattedUserAisles,
      ...normalizedIPAssets
    ];

    return NextResponse.json(normalizedData);
  } catch (error) {
    console.error("❌ SHOWROOM API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}