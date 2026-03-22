// app/api/metawork/products/list/route.js
import { connectToDatabase } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // 1. Authenticate the user
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // 2. Connect to database
    const { db } = await connectToDatabase();
    
    // 3. Fetch ONLY the authenticated user's products
    const products = await db
      .collection('products')
      .find({ 
        userId: decoded.userId,  // ← FILTER BY AUTHENTICATED USER
        status: { $ne: 'deleted' }
      })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ products });
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

    // Update the product in MongoDB
    const result = await db.collection('products').updateOne(
      { _id: typeof id === 'string' ? id : id }, // Adjust if using ObjectId
      { $set: { ...dataToUpdate, updatedAt: new Date() } }
    );

    // CRITICAL: Returning JSON prevents the "Unexpected end of JSON" error
    return NextResponse.json({ 
      success: true, 
      message: 'Product updated successfully' 
    });
  } catch (error) {
    console.error('[API] Patch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}