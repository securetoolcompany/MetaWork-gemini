import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

async function generatePrintfulMockup(productId, templateId) {
  const res = await fetch('https://api.printful.com/mockup-generator', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product_id: productId.split('-')[0],  // Extract Printful catalog ID
      template: templateId,
      format: 'jpg'
    })
  });
  
  if (!res.ok) {
    throw new Error(`Printful failed: ${res.status}`);
  }
  
  const data = await res.json();
  return data.result?.url;
}

export const dynamic = 'force-dynamic';

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) return 'https:' + trimmed;
  return trimmed;
}

function getProductImageUrl(product) {
  if (product.mockupUrl) return normalizeImageUrl(product.mockupUrl);
  if (product.thumbnailUrl) return normalizeImageUrl(product.thumbnailUrl);
  if (product.mockupImages && product.mockupImages.length > 0 && product.mockupImages[0]) return normalizeImageUrl(product.mockupImages[0]);
  if (product.imageUrl) return normalizeImageUrl(product.imageUrl);
  if (product.images && product.images.length > 0 && product.images[0]) return normalizeImageUrl(product.images[0]);
  return null;
}
  
function isValidObjectId(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(str);
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });

    const { db } = await connectToDatabase();
    
    let product = await db.collection('products').findOne({ id: id });
    if (!product && isValidObjectId(id)) {
      product = await db.collection('products').findOne({ _id: new ObjectId(id) });
    }
    if (!product) {
      product = await db.collection('products').findOne({ legacyProductId: id });
    }
    
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    let rawImages =
  (Array.isArray(product.mockupImages) && product.mockupImages.length > 0 && product.mockupImages) ||
  (product.thumbnailUrl ? [product.thumbnailUrl] : null) ||
  (product.mockupUrl ? [product.mockupUrl] : null) ||
  (product.imageUrl ? [product.imageUrl] : null) ||
  (Array.isArray(product.images) && product.images.length > 0 && product.images) ||
  [];

    const allImages = [
  product.thumbnailUrl,
  product.mockupUrl,
  ...(Array.isArray(product.mockupImages) ? product.mockupImages : []),
  product.imageUrl,
  ...(Array.isArray(product.mockupUrls) ? product.mockupUrls : []),
  ...(Array.isArray(product.images) ? product.images : []),
]
  .map(normalizeImageUrl)
  .filter(Boolean);

const uniqueImages = [...new Set(allImages)];

    const normalizedProduct = {
      ...product,
      id: product._id.toString(),
      name: String(product.title || product.name || ''),
      title: String(product.title || product.name || ''),
      description: typeof product.description === 'string' ? product.description : null,
      thumbnailUrl: normalizeImageUrl(product.thumbnailUrl),
      images: uniqueImages,
      imageUrl: uniqueImages[0] || null,
      mockupUrl: uniqueImages[0] || null,
      variations: Array.isArray(product.variations) ? product.variations : [],
    };

    const creatorId = product.userId || product.creatorId;

    const creatorLookupValues = [
      creatorId,
      product.userId,
      product.creatorId,
    ]
      .filter(Boolean)
      .map(String);

    const creatorLookupOr = [
      { id: { $in: creatorLookupValues } },
      { username: { $in: creatorLookupValues } },
    ];

    const objectIds = creatorLookupValues
      .filter(ObjectId.isValid)
      .map((value) => new ObjectId(value));

    if (objectIds.length > 0) {
      creatorLookupOr.push({ _id: { $in: objectIds } });
    }

    const creator =
      creatorLookupOr.length > 0
        ? await db.collection('users').findOne(
            { $or: creatorLookupOr },
            { projection: { password: 0 } }
          )
        : null;

    let aisle = null;

    if (creator) {
      const creatorUserIds = [
        creator.id,
        creator._id?.toString(),
        creator.username,
      ]
        .filter(Boolean)
        .map(String);

      aisle = await db.collection('aisles').findOne(
        {
          userId: { $in: creatorUserIds },
          isActive: { $ne: false },
        },
        {
          projection: { slug: 1 },
        }
      );
    }

    const productIdForExclusion = product.id || product._id?.toString();
    let relatedProducts = [];
    if (creatorId) {
      relatedProducts = await db.collection('products')
        .find({
          $and: [
            { $or: [{ id: { $ne: productIdForExclusion } }, { _id: { $ne: product._id } }] },
            { $or: [{ userId: creatorId }, { creatorId: creatorId }] }
          ],
          isVisible: true,
        })
        .limit(4)
        .toArray();
    }

    return NextResponse.json({
      success: true,
      product: {
        ...normalizedProduct,
        description: typeof product.description === 'string' ? product.description : null,
      },
      creator: creator ? {
        id: String(creator.id || creator._id?.toString() || ''),
        username: String(creator.username || ''),
        name: String(creator.name || creator.displayName || creator.username || ''),
        avatar: creator.avatar || creator.avatarUrl || null,
        bio: typeof creator.bio === 'string' ? creator.bio : null,
        aisleSlug:
          aisle?.slug ||
          creator?.aisleSettings?.slug ||
          creator?.username ||
          null,
      } : null,
      relatedProducts: relatedProducts.map(p => ({
        id: p.id || p._id?.toString(),
        title: p.title || p.name,
        name: p.title || p.name,
        price: p.price,
        imageUrl: getProductImageUrl(p),
        description: typeof p.description === 'string' ? p.description : null,
      }))
    });

  } catch (error) {
    console.error('❌ Product API Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

// Increment viewCount on product page load
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const filter = isValidObjectId(id)
      ? { $or: [{ _id: new ObjectId(id) }, { id: id }] }
      : { id: id };

    const result = await db.collection('products').updateOne(
      filter,
      {
        $inc: { viewCount: 1 },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST viewCount Error:', error);
    return NextResponse.json({ success: false, error: 'Server Error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const updates = await request.json();
    const { db } = await connectToDatabase();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    // --- ENFORCE PRICING LOGIC HERE ---
    if (updates.variants && updates.variants.length > 0) {
      const baseVariant = updates.variants.reduce((min, v) => 
        ((v.cost || 0) < (min.cost || 0)) ? v : min, updates.variants[0]
      );
      
      const markup = parseFloat(baseVariant.retail_price || baseVariant.price || 0) - parseFloat(baseVariant.cost || 0);

      updates.variants = updates.variants.map(variant => {
        const calculatedPrice = parseFloat((parseFloat(variant.cost || 0) + markup).toFixed(2));
        return {
          ...variant,
          retail_price: calculatedPrice,
          price: calculatedPrice
        };
      });

      updates.price = updates.variants[0].price;
    }
    // ----------------------------------

    const filter = isValidObjectId(id) 
      ? { $or: [{ _id: new ObjectId(id) }, { id: id }] }
      : { id: id };

    const result = await db.collection('products').updateOne(
      filter,
      { 
        $set: { 
          ...updates, 
          updatedAt: new Date() 
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    if (updates.printfulTemplateId) {
      try {
        const mockupUrl = await generatePrintfulMockup(id, updates.printfulTemplateId);
        await db.collection('products').updateOne(
          filter,
          { $set: { mockupUrl } }
        );
        console.log('✅ Mockup generated:', mockupUrl);
      } catch (e) {
        console.warn('Mockup failed:', e.message);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Product updated successfully',
      result 
    });

  } catch (error) {
    console.error('❌ PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}