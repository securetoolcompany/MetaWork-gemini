import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import {
  CART_COLLECTION,
  GUEST_CART_TTL_MS,
  createCartItem,
  createCartDocument,
  mergeCartItems,
  normalizeCart
} from '@/lib/models/Cart';
import {
  getOrCreateSessionId,
  setSessionCookie,
  clearSessionCookie,
  getSessionId,
  getUserSession,
  checkCartMerge
} from '@/lib/cart-session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cart
 * 
 * Fetch current user's cart.
 * This is the merge orchestrator - if logged-in user has a guest cart cookie,
 * it merges items and deletes the guest cart.
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const { needsMerge, userId, sessionId } = await checkCartMerge();
    
    // MERGE FLOW: User is logged in AND has a guest session cookie
    if (needsMerge && userId && sessionId) {
      console.log(`🛒 Cart merge triggered for userId=${userId}, sessionId=${sessionId}`);
      
      // Fetch both carts
      const [userCart, guestCart] = await Promise.all([
        db.collection(CART_COLLECTION).findOne({ userId }),
        db.collection(CART_COLLECTION).findOne({ sessionId })
      ]);
      
      if (guestCart && guestCart.items?.length > 0) {
        // Merge guest items into user cart
        const mergedItems = mergeCartItems(
          userCart?.items || [],
          guestCart.items
        );
        
        // Update or create user cart with merged items
        const result = await db.collection(CART_COLLECTION).findOneAndUpdate(
          { userId },
          {
            $set: {
              items: mergedItems,
              updatedAt: new Date()
            },
            $setOnInsert: {
              userId,
              createdAt: new Date()
            }
          },
          { upsert: true, returnDocument: 'after' }
        );
        
        // Delete guest cart
        await db.collection(CART_COLLECTION).deleteOne({ sessionId });
        
        // Clear the session cookie
        await clearSessionCookie();
        
        console.log(`✅ Cart merge complete: ${mergedItems.length} items`);
        
        return NextResponse.json({
          success: true,
          cart: normalizeCart(result),
          merged: true
        });
      } else {
        // No guest cart items to merge, just clear the cookie
        await clearSessionCookie();
        
        // Delete empty guest cart if exists
        if (guestCart) {
          await db.collection(CART_COLLECTION).deleteOne({ sessionId });
        }
      }
    }
    
    // NORMAL FLOW: Get cart for current user/guest
    let cart = null;
    
    if (userId) {
      // Logged-in user
      cart = await db.collection(CART_COLLECTION).findOne({ userId });
    } else {
      // Guest user
      const currentSessionId = sessionId || (await getSessionId());
      if (currentSessionId) {
        cart = await db.collection(CART_COLLECTION).findOne({ sessionId: currentSessionId });
      }
    }
    
    return NextResponse.json({
      success: true,
      cart: normalizeCart(cart),
      merged: false
    });
    
  } catch (error) {
    console.error('❌ Cart GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cart
 * 
 * Add item to cart.
 * Body: { productId, variationId, quantity }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { productId, variationId, quantity = 1 } = body;
    
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
    
    // Validate productId format
    if (!ObjectId.isValid(productId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid productId format' },
        { status: 400 }
      );
    }
    
    // Validate quantity
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      return NextResponse.json(
        { success: false, error: 'Quantity must be a positive integer' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Fetch product to snapshot price/title/thumbnail
    const product = await db.collection('products').findOne({
      _id: new ObjectId(productId)
    });
    
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // Validate variation exists in product (only if product has variations)
    const hasVariations = product.variations?.length > 0;
    
    if (hasVariations) {
      const variationExists = product.variations.some(v => 
        String(v.id) === String(variationId) || 
        String(v._id) === String(variationId)
      );
      
      if (!variationExists) {
        return NextResponse.json(
          { success: false, error: 'Variation not found in product' },
          { status: 400 }
        );
      }
    }
    // If product has no variations, any variationId is accepted (use "default" or product ID)
    
    // Get or create session
    const { userId } = await getUserSession();
    let sessionId = null;
    
    if (!userId) {
      // Guest user - get or create session
      const { sessionId: sid, isNew } = await getOrCreateSessionId();
      sessionId = sid;
      
      if (isNew) {
        await setSessionCookie(sessionId);
      }
    }
    
    // Build cart item
    const cartItem = createCartItem(product, variationId, qty);
    
    // Build query
    const query = userId ? { userId } : { sessionId };
    
    // Check if item already exists in cart
    const existingCart = await db.collection(CART_COLLECTION).findOne({
      ...query,
      'items.productId': cartItem.productId,
      'items.variationId': cartItem.variationId
    });
    
    let result;
    
    if (existingCart) {
      // Item exists - increment quantity
      result = await db.collection(CART_COLLECTION).findOneAndUpdate(
        {
          ...query,
          'items.productId': cartItem.productId,
          'items.variationId': cartItem.variationId
        },
        {
          $inc: { 'items.$.quantity': qty },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );
    } else {
      // Item doesn't exist - add new item
      const updateDoc = {
        $push: { items: cartItem },
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          ...(userId ? { userId } : { sessionId }),
          createdAt: new Date(),
          ...(!userId ? { expiresAt: new Date(Date.now() + GUEST_CART_TTL_MS) } : {})
        }
      };
      
      result = await db.collection(CART_COLLECTION).findOneAndUpdate(
        query,
        updateDoc,
        { upsert: true, returnDocument: 'after' }
      );
    }
    
    return NextResponse.json({
      success: true,
      cart: normalizeCart(result),
      itemAdded: cartItem
    });
    
  } catch (error) {
    console.error('❌ Cart POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add item to cart' },
      { status: 500 }
    );
  }
}
