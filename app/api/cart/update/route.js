import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { CART_COLLECTION, normalizeCart } from '@/lib/models/Cart';
import { getSessionId, getUserSession } from '@/lib/cart-session';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/cart/update
 * 
 * Update item quantity in cart.
 * Body: { productId, variationId, quantity }
 * If quantity is 0, removes the item from cart.
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { productId, variationId, quantity } = body;
    
    // Validate required fields
    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId is required' },
        { status: 400 }
      );
    }
    
    if (!variationId) {
      return NextResponse.json(
        { success: false, error: 'variationId is required' },
        { status: 400 }
      );
    }
    
    if (quantity === undefined || quantity === null) {
      return NextResponse.json(
        { success: false, error: 'quantity is required' },
        { status: 400 }
      );
    }
    
    // Validate quantity
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json(
        { success: false, error: 'Quantity must be a non-negative integer' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Get session info
    const { userId } = await getUserSession();
    const sessionId = await getSessionId();
    
    // Build query
    const query = userId ? { userId } : sessionId ? { sessionId } : null;
    
    if (!query) {
      return NextResponse.json(
        { success: false, error: 'No cart session found' },
        { status: 404 }
      );
    }
    
    let result;
    
    if (qty === 0) {
      // Remove item from cart
      result = await db.collection(CART_COLLECTION).findOneAndUpdate(
        query,
        {
          $pull: {
            items: {
              productId: String(productId),
              variationId: String(variationId)
            }
          },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
    } else {
      // Update item quantity
      result = await db.collection(CART_COLLECTION).findOneAndUpdate(
        {
          ...query,
          'items.productId': String(productId),
          'items.variationId': String(variationId)
        },
        {
          $set: {
            'items.$.quantity': qty,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );
    }
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Cart or item not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      cart: normalizeCart(result),
      updated: { productId, variationId, quantity: qty }
    });
    
  } catch (error) {
    console.error('❌ Cart Update Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update cart' },
      { status: 500 }
    );
  }
}
