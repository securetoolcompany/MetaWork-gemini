import { NextResponse } from 'next/server';
import { connectToDatabase, normalizeIds } from '@/lib/mongodb';
import {
  toPublicProductListing,
  toPublicIpListing,
} from '@/lib/public-listing-serializers';
import {
  showroomProductEligibility,
  publicIpEligibility,
} from '@/lib/public-inventory-eligibility';
import { getAisleDisplayState } from '@/lib/aisle-displayability';

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

const ownerKeysOf = (item) =>
  [
    item.ownerId,
    item.userId,
    item.creatorId,
    item.owner,
    item.ownerUsername,
    item.creatorUsername,
    item.username,
  ]
    .filter(Boolean)
    .map((v) => String(v));

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    const [products, usersWithAisles, ipAssets] = await Promise.all([
      db.collection('products').find(showroomProductEligibility()).toArray(),
      db.collection('users').find({ aisleSettings: { $exists: true } }).toArray(),
      db.collection('ip_assets').find(publicIpEligibility()).toArray()
    ]);

    const stateByKey = new Map();
    const aisleStates = usersWithAisles.map((user) => {
      const keys = new Set(
        [user._id, user.id, user.username].filter(Boolean).map(String)
      );
      const matches = (item) => ownerKeysOf(item).some((k) => keys.has(k));
      const userProducts = products.filter(matches);
      const userIps = ipAssets.filter(matches);
      const collections = (user.collections || []).filter((c) => c?.active !== false);
      const state = getAisleDisplayState(user, userProducts, userIps, collections);
      keys.forEach((k) => stateByKey.set(k, state));
      return { user, state };
    });

    const stateFor = (item) => {
      for (const k of ownerKeysOf(item)) {
        const s = stateByKey.get(k);
        if (s) return s;
      }
      return null;
    };

    const formattedUserAisles = aisleStates
      .filter(({ state }) => state.ok)
      .map(({ user, state }) => {
        const userIdStr = user._id.toString();
        const username = user.username || '';
        const settings = user.aisleSettings || {};
        const displayName = settings.title || user.profile?.displayName || user.name || username;

        return {
          id: userIdStr,
          type: 'aisle',
          username,
          displayName,
          bio: settings.description || user.bio || "Explore my custom collection.",
          headerImage: cleanUrl(settings.heroImage || user.banner),
          avatar: cleanUrl(settings.logo || user.avatar),
          stats: user.stats || { views: 0, sales: 0 },
          totalProducts: state.placedProductIds.size,
          totalIPAssets: state.placedIpIds.size,
          source: 'live_database_lazy'
        };
      })
      .filter(aisle => {
        const candidates = [aisle.username, aisle.displayName]
          .filter(Boolean)
          .map(v => String(v).trim().toLowerCase());

        return !candidates.some(v => HIDDEN_SHOWROOM_AISLES.has(v));
      });

    const visibleProducts = products.filter((p) => {
      const s = stateFor(p);
      return Boolean(
        s?.ok &&
          (s.placedProductIds.has(String(p._id)) ||
            (p.id && s.placedProductIds.has(String(p.id))))
      );
    });

    const visibleIpAssets = ipAssets.filter((i) => {
      const s = stateFor(i);
      return Boolean(
        s?.ok &&
          (s.placedIpIds.has(String(i._id)) ||
            (i.id && s.placedIpIds.has(String(i.id))))
      );
    });

    const normalizedProducts = normalizeIds(visibleProducts)
      .map(p => ({
        ...toPublicProductListing(normalizeProductImageFields(p)),
        type: 'product'
      }))
      .filter(hasUsableImage);

    const normalizedIPAssets = normalizeIds(visibleIpAssets)
      .map(i => ({
        ...toPublicIpListing(i),
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
