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
 * GET /api/admin/product-pricing
 * Get all product pricing overrides
 */
export async function GET(request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    let query = {};
    if (productId) {
      query.printfulProductId = productId === 'global' ? 'global' : parseInt(productId);
    }

    const pricingRules = await db.collection('admin_product_pricing')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Get global default if exists
    const globalDefault = pricingRules.find(r => r.printfulProductId === 'global');

    return NextResponse.json({
      success: true,
      pricingRules,
      globalDefault
    });

  } catch (error) {
    console.error('Admin Pricing GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/product-pricing
 * Create or update product pricing override
 */
export async function POST(request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      printfulProductId,  // Number or 'global'
      percentMarkup,      // e.g., 20 for 20%
      flatMarkup,         // e.g., 2.00 for $2
      customCategories,   // Admin-defined categories
      isActive
    } = body;

    if (printfulProductId === undefined) {
      return NextResponse.json(
        { error: 'printfulProductId is required (use "global" for default)' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date();

    // Check if rule exists for this product
    const existingRule = await db.collection('admin_product_pricing').findOne({
      printfulProductId: printfulProductId === 'global' ? 'global' : parseInt(printfulProductId)
    });

    const ruleData = {
      printfulProductId: printfulProductId === 'global' ? 'global' : parseInt(printfulProductId),
      percentMarkup: parseFloat(percentMarkup) || 0,
      flatMarkup: parseFloat(flatMarkup) || 0,
      customCategories: Array.isArray(customCategories) ? customCategories : [],
      isActive: isActive !== false,
      updatedAt: now,
      updatedBy: admin.id
    };

    if (existingRule) {
      // Update existing
      await db.collection('admin_product_pricing').updateOne(
        { printfulProductId: ruleData.printfulProductId },
        { $set: ruleData }
      );
    } else {
      // Create new
      ruleData.id = uuidv4();
      ruleData.createdAt = now;
      await db.collection('admin_product_pricing').insertOne(ruleData);
    }

    return NextResponse.json({
      success: true,
      rule: ruleData,
      updated: !!existingRule
    });

  } catch (error) {
    console.error('Admin Pricing POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/product-pricing
 * Delete a pricing override
 */
export async function DELETE(request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    await db.collection('admin_product_pricing').deleteOne({
      printfulProductId: productId === 'global' ? 'global' : parseInt(productId)
    });

    return NextResponse.json({ success: true, deleted: true });

  } catch (error) {
    console.error('Admin Pricing DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
