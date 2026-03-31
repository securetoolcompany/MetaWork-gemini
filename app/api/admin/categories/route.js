// app/api/admin/categories/route.js
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

async function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.substring(7) || request.cookies.get('auth_token')?.value;
  if (!token) return null;
  try {
    const decoded = verifyToken(token);
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ id: decoded.userId });
    return user?.isAdmin ? user : null;
  } catch (e) { return null; }
}

export async function GET(request) {
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'ip', 'product', or 'aisle'
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // NEW: Filter by type if provided
    const query = { 
      ...(includeInactive ? {} : { isActive: true }),
      ...(type ? { type } : {}) 
    };

    const categories = await db.collection('admin_categories')
      .find(query)
      .sort({ sortOrder: 1, name: 1 })
      .toArray();

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { id, name, type, slug, description, icon, sortOrder, isActive } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and Type are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const categorySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const categoryData = {
      name: name.trim(),
      type, // 'ip', 'product', or 'aisle'
      slug: categorySlug,
      description: description || '',
      icon: icon || 'tag',
      sortOrder: parseInt(sortOrder) || 0,
      isActive: isActive !== false,
      updatedAt: new Date(),
      updatedBy: admin.id
    };

    if (id) {
      await db.collection('admin_categories').updateOne({ id }, { $set: categoryData });
      return NextResponse.json({ success: true, updated: true });
    } else {
      const newCategory = { ...categoryData, id: uuidv4(), createdAt: new Date() };
      await db.collection('admin_categories').insertOne(newCategory);
      return NextResponse.json({ success: true, category: newCategory });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const { db } = await connectToDatabase();

    // Use hard delete or soft delete based on your preference
    await db.collection('admin_categories').deleteOne({ id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}