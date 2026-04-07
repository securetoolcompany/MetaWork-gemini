import { NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    // Auth check using the correct helper identified in your logs
    const token = req.cookies.get('auth_token')?.value;
    const user = token ? getUserFromToken(token) : null;

    const { productId, variationId, quantity, shippingInfo } = await req.json();

    if (!productId || !shippingInfo) {
      return NextResponse.json({ error: 'Missing required order data' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Correctly query the 'products' collection using the native driver
    const product = await db.collection('products').findOne({ 
      _id: new ObjectId(productId) 
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found in database' }, { status: 404 });
    }

    // If user is logged in, save the address to their profile automatically
    if (user?.userId) {
      try {
        const queryId = new ObjectId(user.userId);
        await db.collection('users').updateOne(
          { _id: queryId },
          { 
            $set: { 
              shippingAddress: shippingInfo,
              updatedAt: new Date()
            } 
          }
        );
      } catch (e) {
        console.error('Failed to save address to profile:', e.message);
      }
    }

    // This is the bridge point. 
    // Data is now verified against DB and ready for Printful.
    console.log('✅ Fulfillment Bridge Received Verified Data:', {
      product: product.name,
      recipient: shippingInfo.name,
      address: shippingInfo.address1
    });

    return NextResponse.json({ 
      success: true, 
      message: "Bridge successful: Order verified and recipient data captured.",
      orderId: `MW-${Math.floor(Math.random() * 100000)}` 
    });

  } catch (error) {
    console.error('[Checkout Bridge Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}