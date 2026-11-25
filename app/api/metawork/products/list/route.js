import { connectToDatabase } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb'; // ✅ Added ObjectId import
import {
  OFFLINE_PRODUCT_KINDS,
  OFFLINE_PROTECTED_FIELDS,
  isOfflineProductKind,
} from '@/lib/product-kinds';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ipOwnerId = searchParams.get('ipOwnerId');
    const requestedUserId = searchParams.get('userId');

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { db } = await connectToDatabase();

    // ✅ Safely create an ObjectId for robust querying
    let userObjId;
    try {
      userObjId = new ObjectId(decoded.userId);
    } catch {
      userObjId = decoded.userId;
    }

    // Always exclude deleted items
    const query = { status: { $ne: 'deleted' } };

    if (ipOwnerId) {
      query.ipOwnerId = ipOwnerId;
      query.userId = { $ne: decoded.userId }; 
    } else if (requestedUserId) {
      let reqObjId;
      try { reqObjId = new ObjectId(requestedUserId); } catch { reqObjId = requestedUserId; }
      query.$or = [
        { userId: requestedUserId }, { userId: reqObjId },
        { creatorId: requestedUserId }, { creatorId: reqObjId }
      ];
    } else {
      // ✅ Check BOTH userId and creatorId, as well as String vs ObjectId
      query.$or = [
        { userId: decoded.userId }, { userId: userObjId },
        { creatorId: decoded.userId }, { creatorId: userObjId }
      ];
    }

    const viewingSelf =
      !ipOwnerId &&
      (!requestedUserId || String(requestedUserId) === String(decoded.userId));
    if (!viewingSelf) {
      query.productKind = { $nin: [...OFFLINE_PRODUCT_KINDS] };
    }

    const products = await db
      .collection('products')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const processedProducts = products.map(p => ({
      ...p,
      id: p._id.toString(),
      _id: p._id.toString(),
      // ✅ Ensure we grab the mockup URL from wherever it's stored
      imageUrl: p.mockupUrl || p.thumbnailUrl || (p.mockupImages && p.mockupImages[0]) || p.imageUrl || 'https://placehold.co/600x600?text=No+Image'
    }));

    return NextResponse.json({ 
      success: true, 
      products: processedProducts 
    });

  } catch (error) {
    console.error('[API] Failed to fetch products:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { db } = await connectToDatabase();
    const updates = await request.json();
    const { id, ...dataToUpdate } = updates;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    let queryId;
    try { queryId = new ObjectId(id); } catch { queryId = id; }

    const patchAuth = request.headers.get('authorization') || '';
    const patchToken = patchAuth.startsWith('Bearer ')
      ? patchAuth.slice(7).trim()
      : request.cookies.get('auth_token')?.value;
    let patchUserId = null;
    try {
      patchUserId = patchToken
        ? String(verifyToken(patchToken)?.userId || '') || null
        : null;
    } catch {
      patchUserId = null;
    }
    if (!patchUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingProduct = await db.collection('products').findOne(
      { $or: [{ _id: queryId }, { id: id }] }
    );
    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const patchOwnerIds = [existingProduct.userId, existingProduct.ownerId, existingProduct.creatorId]
      .filter(Boolean)
      .map(String);
    if (!patchOwnerIds.includes(patchUserId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    delete dataToUpdate.userId;
    delete dataToUpdate.ownerId;
    delete dataToUpdate.creatorId;
    delete dataToUpdate.licensedRevenueTerms;
    delete dataToUpdate.productKind;
    delete dataToUpdate.provisioning;

    if (
      isOfflineProductKind(existingProduct.productKind) &&
      OFFLINE_PROTECTED_FIELDS.some(field => Object.prototype.hasOwnProperty.call(dataToUpdate, field))
    ) {
      return NextResponse.json(
        { code: 'PRODUCT_KIND_OFFLINE', error: 'This product kind cannot be published or listed.' },
        { status: 409 }
      );
    }

    const result = await db.collection('products').updateOne(
      { $or: [{ _id: queryId }, { id: id }] }, 
      { $set: { ...dataToUpdate, updatedAt: new Date() } }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Product updated successfully' 
    });
  } catch (error) {
    console.error('[API] Patch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}