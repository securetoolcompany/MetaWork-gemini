import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper to generate a URL-friendly slug from a name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * GET /api/collections
 * List all collections for the authenticated user
 */
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('id');

    if (collectionId) {
      // Get single collection
      const collection = await db.collection('collections').findOne({
        id: collectionId,
        userId: decoded.userId
      });

      if (!collection) {
        return NextResponse.json(
          { error: 'Collection not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, collection });
    }

    // List all collections
    const collections = await db.collection('collections')
      .find({ userId: decoded.userId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      collections,
      totalCount: collections.length
    });

  } catch (error) {
    console.error('Get Collections API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/collections
 * Create a new collection
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, productIds, columns } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Generate slug and ensure uniqueness
    let slug = generateSlug(name);
    let slugSuffix = 0;
    let existingSlug = await db.collection('collections').findOne({ 
      userId: decoded.userId, 
      slug 
    });
    
    while (existingSlug) {
      slugSuffix++;
      slug = `${generateSlug(name)}-${slugSuffix}`;
      existingSlug = await db.collection('collections').findOne({ 
        userId: decoded.userId, 
        slug 
      });
    }

    const collectionId = uuidv4();
    const now = new Date();

    const newCollection = {
      id: collectionId,
      userId: decoded.userId,
      name: name.trim(),
      slug,
      description: description?.trim() || '',
      productIds: Array.isArray(productIds) ? productIds : [],
      columns: columns || 3,
      showHeader: true,
      createdAt: now,
      updatedAt: now
    };

    await db.collection('collections').insertOne(newCollection);

    // Update products to include this collection
    if (newCollection.productIds.length > 0) {
      await db.collection('products').updateMany(
        { id: { $in: newCollection.productIds } },
        { $addToSet: { collections: collectionId } }
      );
    }

    return NextResponse.json({
      success: true,
      collection: newCollection
    });

  } catch (error) {
    console.error('Create Collection API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/collections
 * Update an existing collection
 */
export async function PUT(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, name, description, productIds, columns, showHeader } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Verify ownership
    const existingCollection = await db.collection('collections').findOne({
      id,
      userId: decoded.userId
    });

    if (!existingCollection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData = { updatedAt: new Date() };

    if (name !== undefined) {
      updateData.name = name.trim();
      // Update slug if name changed
      let slug = generateSlug(name);
      let slugSuffix = 0;
      let existingSlug = await db.collection('collections').findOne({ 
        userId: decoded.userId, 
        slug,
        id: { $ne: id }
      });
      
      while (existingSlug) {
        slugSuffix++;
        slug = `${generateSlug(name)}-${slugSuffix}`;
        existingSlug = await db.collection('collections').findOne({ 
          userId: decoded.userId, 
          slug,
          id: { $ne: id }
        });
      }
      updateData.slug = slug;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || '';
    }

    if (columns !== undefined) {
      updateData.columns = columns;
    }

    if (showHeader !== undefined) {
      updateData.showHeader = showHeader;
    }

    // Handle product IDs update (sync both sides)
    if (productIds !== undefined) {
      const oldProductIds = existingCollection.productIds || [];
      const newProductIds = Array.isArray(productIds) ? productIds : [];

      // Products removed from collection
      const removedProducts = oldProductIds.filter(pid => !newProductIds.includes(pid));
      // Products added to collection
      const addedProducts = newProductIds.filter(pid => !oldProductIds.includes(pid));

      // Remove collection from removed products
      if (removedProducts.length > 0) {
        await db.collection('products').updateMany(
          { id: { $in: removedProducts } },
          { $pull: { collections: id } }
        );
      }

      // Add collection to added products
      if (addedProducts.length > 0) {
        await db.collection('products').updateMany(
          { id: { $in: addedProducts } },
          { $addToSet: { collections: id } }
        );
      }

      updateData.productIds = newProductIds;
    }

    await db.collection('collections').updateOne(
      { id },
      { $set: updateData }
    );

    const updatedCollection = await db.collection('collections').findOne({ id });

    return NextResponse.json({
      success: true,
      collection: updatedCollection
    });

  } catch (error) {
    console.error('Update Collection API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/collections
 * Delete a collection
 */
export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Verify ownership
    const existingCollection = await db.collection('collections').findOne({
      id,
      userId: decoded.userId
    });

    if (!existingCollection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Remove collection reference from all products
    if (existingCollection.productIds?.length > 0) {
      await db.collection('products').updateMany(
        { id: { $in: existingCollection.productIds } },
        { $pull: { collections: id } }
      );
    }

    // Delete the collection
    await db.collection('collections').deleteOne({ id });

    return NextResponse.json({
      success: true,
      message: 'Collection deleted'
    });

  } catch (error) {
    console.error('Delete Collection API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
