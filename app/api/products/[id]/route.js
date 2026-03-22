import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/**
 * Helper: Normalize image URL - adds https: prefix if needed
 * Priority: thumbnailUrl > mockupImages[0] > imageUrl > images[0]
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  
  // Add https: prefix if URL starts with //
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  
  return trimmed;
}

/**
 * Helper: Get best available image from product
 * Priority: thumbnailUrl > mockupImages[0] > imageUrl > images[0]
 */
function getProductImageUrl(product) {
  // Try thumbnailUrl first
  if (product.thumbnailUrl) {
    return normalizeImageUrl(product.thumbnailUrl);
  }
  
  // Try mockupImages array
  if (product.mockupImages && product.mockupImages.length > 0 && product.mockupImages[0]) {
    return normalizeImageUrl(product.mockupImages[0]);
  }
  
  // Try imageUrl
  if (product.imageUrl) {
    return normalizeImageUrl(product.imageUrl);
  }
  
  // Try images array
  if (product.images && product.images.length > 0 && product.images[0]) {
    return normalizeImageUrl(product.images[0]);
  }
  
  return null;
}

/**
 * Helper: Check if string is valid ObjectId
 */
function isValidObjectId(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(str);
}

/**
 * GET /api/products/[id]
 * Fetch a single product by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    
    console.log(`🔍 Looking up product: ${id}`);
    
    // Try multiple lookup strategies
    let product = null;
    
    // Strategy 1: Try by id field
    product = await db.collection('products').findOne({ id: id });
    
    // Strategy 2: Try by _id if it's a valid ObjectId
    if (!product && isValidObjectId(id)) {
      console.log(`  → Trying ObjectId lookup for: ${id}`);
      product = await db.collection('products').findOne({ _id: new ObjectId(id) });
    }
    
    // Strategy 3: Try by legacyProductId (WordPress products)
    if (!product) {
      console.log(`  → Trying legacyProductId lookup for: ${id}`);
      product = await db.collection('products').findOne({ legacyProductId: id });
    }
    
    if (!product) {
      console.log(`❌ Product not found: ${id}`);
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }
    
    console.log(`✅ Found product: ${product.title || product.name || id}`);

    // Normalize product ID and image URL
    const normalizedProduct = {
      ...product,
      id: product.id || product._id?.toString(),
      _id: product._id?.toString(),
      imageUrl: getProductImageUrl(product),
      images: product.mockupImages || product.images || []
    };

    // Fetch creator info
    let creator = null;
    const creatorId = product.userId || product.creatorId;
    if (creatorId) {
      // Try by id field first
      creator = await db.collection('users').findOne(
        { id: creatorId },
        { projection: { password: 0 } }
      );
      
      // If not found and valid ObjectId, try _id
      if (!creator && isValidObjectId(creatorId)) {
        creator = await db.collection('users').findOne(
          { _id: new ObjectId(creatorId) },
          { projection: { password: 0 } }
        );
      }
    }

    // Fetch related products - ONLY from same creator
    const productIdForExclusion = product.id || product._id?.toString();
    let relatedProducts = [];
    
    if (creatorId) {
      relatedProducts = await db.collection('products')
        .find({
          // Exclude current product
          $and: [
            { 
              $or: [
                { id: { $ne: productIdForExclusion } },
                { _id: { $ne: product._id } }
              ]
            },
            // Only same creator
            {
              $or: [
                { userId: creatorId },
                { creatorId: creatorId }
              ]
            }
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
    return NextResponse.json(
      { success: false, error: 'Server Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/products/[id]
 * Update product fields
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const updates = await request.json();
    const { db } = await connectToDatabase();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    // Determine query filter (handle both raw ObjectId and string ID)
    const filter = isValidObjectId(id) 
      ? { $or: [{ _id: new ObjectId(id) }, { id: id }] }
      : { id: id };

    // Perform the update
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
        await db.collection('products').updateOne(  // ← COMPLETE THIS
          filter,
          { $set: { mockupUrl } }
        );
        console.log('✅ Mockup generated:', mockupUrl);
      } catch (e) {
        console.warn('Mockup failed:', e.message);
      }
    }

    // Return success (no duplicate check)
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