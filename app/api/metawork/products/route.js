import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  return trimmed;
}

function getProductImageUrl(product) {
  if (product.thumbnailUrl) {
    return normalizeImageUrl(product.thumbnailUrl);
  }
  if (product.mockupImages && product.mockupImages.length > 0 && product.mockupImages[0]) {
    return normalizeImageUrl(product.mockupImages[0]);
  }
  if (product.imageUrl) {
    return normalizeImageUrl(product.imageUrl);
  }
  if (product.images && product.images.length > 0 && product.images[0]) {
    return normalizeImageUrl(product.images[0]);
  }
  return null;
}

function normalizeId(doc) {
  if (!doc) return doc;
  if (!doc.id && doc._id) {
    doc.id = doc._id.toString();
  }
  if (doc._id) {
    doc._id = doc._id.toString();
  }
  return doc;
}

V

/**
 * PUT /api/metawork/products
 * Handle bulk or generic product updates
 */
export async function PUT(request) {
  try {
    const updates = await request.json();
    const { id, ...dataToUpdate } = updates;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('products').updateOne(
      { $or: [
        { id: id },
        { _id: /^[a-fA-F0-9]{24}$/.test(id) ? new (require('mongodb').ObjectId)(id) : id }
      ]},
      { $set: { ...dataToUpdate, updatedAt: new Date() } }
    );

    // CRITICAL: This JSON response stops the SyntaxError
    return NextResponse.json({ 
      success: true, 
      message: 'Product synced successfully',
      matchedCount: result.matchedCount 
    });

  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update', message: error.message }, 
      { status: 500 }
    );
  }
}