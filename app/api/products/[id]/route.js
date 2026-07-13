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

    let rawImages = product.mockupImages || product.images || [];
    if (rawImages.length === 0) {
      const fallbackImg = product.mockupUrl || product.imageUrl || product.thumbnailUrl;
      if (fallbackImg) rawImages = [fallbackImg];
    }

    let allImages = [];
    if (Array.isArray(product.images)) allImages.push(...product.images);
    if (Array.isArray(product.mockupImages)) allImages.push(...product.mockupImages);
    if (Array.isArray(product.mockupUrls)) allImages.push(...product.mockupUrls); 
    if (product.mockupUrl) allImages.push(product.mockupUrl);
    if (product.imageUrl) allImages.push(product.imageUrl);
    if (product.thumbnailUrl) allImages.push(product.thumbnailUrl);

    const uniqueImages = [...new Set(allImages.filter(Boolean))];

    const normalizedProduct = {
        ...product,
        id: product._id.toString(),
        name: product.title || product.name,
        images: uniqueImages, 
        imageUrl: uniqueImages[0] || null,
        mockupUrl: uniqueImages[0] || null
    };

    let creator = null;
    const creatorId = product.userId || product.creatorId;
    if (creatorId) {
      creator = await db.collection('users').findOne({ id: creatorId }, { projection: { password: 0 } });
      if (!creator && isValidObjectId(creatorId)) {
        creator = await db.collection('users').findOne({ _id: new ObjectId(creatorId) }, { projection: { password: 0 } });
      }
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
      product: normalizedProduct,
      creator: creator ? {
        id: creator.id || creator._id?.toString(),
        username: creator.username,
        name: creator.name || creator.displayName || creator.username,
        avatar: creator.avatar || creator.avatarUrl,
        bio: creator.bio
      } : null,
      relatedProducts: relatedProducts.map(p => ({
        id: p.id || p._id?.toString(),
        title: p.title || p.name,
        name: p.title || p.name,
        price: p.price,
        imageUrl: getProductImageUrl(p)
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