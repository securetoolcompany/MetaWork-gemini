import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * Verify user is admin
 */
async function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
  
  if (!token) return null;

  try {
    const decoded = verifyToken(token);
    if (!decoded?.userId) return null;

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ id: decoded.userId });
    
    if (!user?.isAdmin) return null;
    return user;
  } catch (e) {
    return null;
  }
}

/**
 * GET /api/admin/categories
 * Get all admin-defined product categories
 */
export async function GET(request) {
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const query = includeInactive ? {} : { isActive: true };

    const categories = await db.collection('admin_categories')
      .find(query)
      .sort({ sortOrder: 1, name: 1 })
      .toArray();

    return NextResponse.json({
      success: true,
      categories
    });

  } catch (error) {
    console.error('Admin Categories GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/categories
 * Create or update a category
 */
export async function POST(request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      id,           // If updating existing
      name,
      slug,
      description,
      icon,         // Lucide icon name
      sortOrder,
      isActive,
      parentId      // For nested categories
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const now = new Date();

    // Generate slug if not provided
    const categorySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (id) {
      // Update existing
      const updateData = {
        name: name.trim(),
        slug: categorySlug,
        description: description?.trim() || '',
        icon: icon || 'tag',
        sortOrder: parseInt(sortOrder) || 0,
        isActive: isActive !== false,
        parentId: parentId || null,
        updatedAt: now,
        updatedBy: admin.id
      };

      await db.collection('admin_categories').updateOne(
        { id },
        { $set: updateData }
      );

      return NextResponse.json({ success: true, category: { id, ...updateData }, updated: true });
    } else {
      // Create new
      const categoryId = uuidv4();
      const categoryData = {
        id: categoryId,
        name: name.trim(),
        slug: categorySlug,
        description: description?.trim() || '',
        icon: icon || 'tag',
        sortOrder: parseInt(sortOrder) || 0,
        isActive: isActive !== false,
        parentId: parentId || null,
        createdAt: now,
        createdBy: admin.id,
        updatedAt: now
      };

      await db.collection('admin_categories').insertOne(categoryData);

      return NextResponse.json({ success: true, category: categoryData, created: true });
    }

  } catch (error) {
    console.error('Admin Categories POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/categories
 * Delete a category
 */
export async function DELETE(request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Soft delete - just mark inactive
    await db.collection('admin_categories').updateOne(
      { id },
      { $set: { isActive: false, deletedAt: new Date(), deletedBy: admin.id } }
    );

    return NextResponse.json({ success: true, deleted: true });

  } catch (error) {
    console.error('Admin Categories DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
