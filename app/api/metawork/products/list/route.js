import { connectToDatabase } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // 1. Extract Search Params from URL
    const { searchParams } = new URL(request.url);
    const ipOwnerId = searchParams.get('ipOwnerId');
    const requestedUserId = searchParams.get('userId');

    // 2. Authenticate the user
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 3. Connect to database
    const { db } = await connectToDatabase();

    // 4. Build the dynamic Query Object
    const query = {};

    // Logic: Decide what to fetch based on params
    if (ipOwnerId) {
      // Fetch Community Products (Used in the Community Curation Tab)
      query.ipOwnerId = ipOwnerId;
      query.userId = { $ne: decoded.userId }; // Don't show the user's own products here
    } else if (requestedUserId) {
      // Fetch specific User's Products (Used in Settings / My Products)
      query.userId = requestedUserId;
    } else {
      // Fallback: Default to the authenticated user
      query.userId = decoded.userId;
    }

    // Always exclude deleted items
    query.status = { $ne: 'deleted' };

    // 5. Execute search
    const products = await db
      .collection('products')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // 6. Map results to ensure consistent field names (id and _id)
    const processedProducts = products.map(p => ({
      ...p,
      id: p._id.toString(),      // Forces an 'id' string for the frontend dropdowns
      _id: p._id.toString(),     // Keeps the original _id as a string
      imageUrl: p.thumbnailUrl || (p.mockupImages && p.mockupImages[0]) || p.imageUrl || 'https://placehold.co/600x600?text=No+Image'
    }));

    // Make sure you are returning 'processedProducts', not the raw 'products'
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

    // Update the product in MongoDB
    const result = await db.collection('products').updateOne(
      { _id: id }, 
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