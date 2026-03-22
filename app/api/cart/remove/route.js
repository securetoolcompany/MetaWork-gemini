import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { CART_COLLECTION, normalizeCart } from '@/lib/models/Cart';
import { getSessionId, getUserSession } from '@/lib/cart-session';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/cart/remove
 * 
 * Remove item from cart.
 * Body: { productId, variationId }
 */
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { productId, variationId } = body;
    
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
    
    // Use atomic $pull operation to remove item
    const result = await db.collection(CART_COLLECTION).findOneAndUpdate(
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
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Cart not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      cart: normalizeCart(result),
      removed: { productId, variationId }
    });
    
  } catch (error) {
    console.error('❌ Cart Remove Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove item from cart' },
      { status: 500 }
    );
  }
}
