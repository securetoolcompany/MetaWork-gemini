import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/products/[id]/reviews
 * Fetch all reviews for a product
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
    
    // Fetch reviews sorted by newest first
    const reviews = await db.collection('reviews')
      .find({ productId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Populate user info for each review
    const reviewsWithUsers = await Promise.all(
      reviews.map(async (review) => {
        let user = null;
        if (review.userId) {
          // Try both id formats
          if (ObjectId.isValid(review.userId)) {
            user = await db.collection('users').findOne(
              { $or: [{ id: review.userId }, { _id: new ObjectId(review.userId) }] },
              { projection: { username: 1, name: 1, avatar: 1 } }
            );
          } else {
            user = await db.collection('users').findOne(
              { id: review.userId },
              { projection: { username: 1, name: 1, avatar: 1 } }
            );
          }
        }
        
        return {
          _id: review._id.toString(),
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          date: review.createdAt, // Fallback for dialog
          userName: user?.name || user?.username || 'Anonymous',
          userAvatar: user?.avatar || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      reviews: reviewsWithUsers,
    });

  } catch (error) {
    console.error('❌ Reviews GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products/[id]/reviews
 * Submit a new review for a product
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    if (!comment || comment.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Check if product exists (try multiple ID formats)
    let product = await db.collection('products').findOne({ id: id });
    
    if (!product && ObjectId.isValid(id)) {
      product = await db.collection('products').findOne({ _id: new ObjectId(id) });
    }

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Create review
    const review = {
      productId: id,
      // userId: userId || null, // Add this when you have auth
      rating: parseInt(rating),
      comment: comment.trim(),
      createdAt: new Date(),
    };

    const result = await db.collection('reviews').insertOne(review);

    // Update product average rating
    const allReviews = await db.collection('reviews')
      .find({ productId: id })
      .toArray();
    
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    
    // Update using the same ID format we found the product with
    const updateQuery = product.id ? { id: product.id } : { _id: product._id };
    
    await db.collection('products').updateOne(
      updateQuery,
      { 
        $set: { 
          rating: parseFloat(avgRating.toFixed(1)),
          reviewCount: allReviews.length
        } 
      }
    );

    return NextResponse.json({
      success: true,
      review: {
        _id: result.insertedId.toString(),
        ...review,
      },
    });

  } catch (error) {
    console.error('❌ Reviews POST Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server Error' },
      { status: 500 }
    );
  }
}
