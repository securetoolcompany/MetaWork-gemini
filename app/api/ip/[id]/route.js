import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { db } = await connectToDatabase();

    // Build match query supporting _id, id, and revenueTokenAssetId
    const matchQuery = {
      $or: [
        { id: id },
        { revenueTokenAssetId: parseInt(id) || -1 }
      ]
    };
    
    // Add _id match if id is a valid ObjectId string
    if (ObjectId.isValid(id)) {
      matchQuery.$or.push({ _id: new ObjectId(id) });
    }

    // 1. Join IP with Revenue Pool (Blockchain Data)
    const results = await db.collection('ip_assets').aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'revenue_pools',
          localField: 'id', 
          foreignField: 'ipAssetId', 
          as: 'revenuePool'
        }
      },
      { $unwind: { path: '$revenuePool', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    const ipAsset = results[0];

    if (!ipAsset) {
      return NextResponse.json({ error: 'IP asset not found' }, { status: 404 });
    }

    // 2. Auth Logic: Determine if the visitor is the owner
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.substring(7);
    let isOwner = false;

    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded?.userId === ipAsset.ownerId) {
          isOwner = true;
        }
      } catch (e) { /* Invalid token, proceed as guest */ }
    }

    // 3. Data Integrity: BigInt to String conversion for JSON safety
    if (ipAsset.revenueTokenAssetId) ipAsset.revenueTokenAssetId = String(ipAsset.revenueTokenAssetId);
    if (ipAsset.revenuePool?.appId) ipAsset.revenuePool.appId = String(ipAsset.revenuePool.appId);

    // Normalize tags
    if (typeof ipAsset.tags === 'string') {
      ipAsset.tags = ipAsset.tags.split(',').map(t => t.trim()).filter(Boolean);
    } else if (!Array.isArray(ipAsset.tags)) {
      ipAsset.tags = [];
    }

    // 4. Usage Stats: Fetch history, products, and owner info
    const [ownershipHistory, products, owner] = await Promise.all([
      db.collection('ip_ownership_history')
        .find({ ipAssetId: String(ipAsset.id) })
        .toArray(),
      db.collection('products')
        .find({ ipAssetId: String(ipAsset.id) })
        .toArray(),
      db.collection('users').findOne({ id: ipAsset.ownerId })
    ]);

// Add owner info to ipAsset (for creator button)
if (owner) {
  ipAsset.ownerName = owner.name || owner.username;
  ipAsset.ownerUsername = owner.username;
  ipAsset.ownerAvatar = owner.avatar || owner.profileImage;
}

// Calculate comprehensive stats
ipAsset.usageCount = products.length;
ipAsset.earnings = ipAsset.revenuePool?.accumulatedRevenue || 0;

// Calculate total revenue from products using this IP
const totalRevenue = products.reduce(
  (sum, product) => sum + (product.totalRevenue || 0),
  0
);
ipAsset.totalRevenue = totalRevenue;

// Calculate average product price
const avgPrice =
  products.length > 0
    ? products.reduce(
        (sum, product) => sum + (product.price || 0),
        0
      ) / products.length
    : 0;
ipAsset.avgProductPrice = avgPrice;

    return NextResponse.json({
      success: true,
      ipAsset,
      ownershipHistory,
      products,
      isOwner // Gatekeeper state for 'Claim' button visibility
    });

  } catch (error) {
    console.error("GET IP Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { db } = await connectToDatabase();

    const matchQuery = {
      $or: [{ id: id }, { revenueTokenAssetId: parseInt(id) || -1 }]
    };
    if (ObjectId.isValid(id)) {
      matchQuery.$or.push({ _id: new ObjectId(id) });
    }

    const result = await db.collection('ip_assets').updateOne(
      matchQuery,
      {
        $inc: { viewCount: 1 },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'IP asset not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST viewCount Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update IP asset
export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    
    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    
    const { id } = await params;
    const body = await request.json();
    
    const { db } = await connectToDatabase();
    
    // Build the match query - handle different ID formats
    const matchQuery = {
      $or: [
        { id: id },
        { revenueTokenAssetId: parseInt(id) || -1 }
      ],
      ownerId: decoded.userId
    };
    
    // Try ObjectId format if it's a valid ObjectId string
    if (ObjectId.isValid(id)) {
      matchQuery.$or.push({ _id: new ObjectId(id) });
    }
    
    const ipAsset = await db.collection('ip_assets').findOne(matchQuery);
    
    if (!ipAsset) {
      return NextResponse.json({ error: 'IP not found or unauthorized' }, { status: 404 });
    }
    
    // Update the IP asset using the internal _id
    await db.collection('ip_assets').updateOne(
      { _id: ipAsset._id },
      {
        $set: {
          name: body.name,
          description: body.description,
          category: body.category,
          tags: body.tags,
          licensingFee: body.licensingFee,
          isPublic: body.isPublic,
          updatedAt: new Date()
        }
      }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('IP update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove IP asset
export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const { db } = await connectToDatabase();

    // Same matching strategy as PUT, owner-guarded
    const matchQuery = {
      $or: [
        { id: id },
        { revenueTokenAssetId: parseInt(id) || -1 },
      ],
      ownerId: decoded.userId,
    };

    if (ObjectId.isValid(id)) {
      matchQuery.$or.push({ _id: new ObjectId(id) });
    }

    // Find the asset first (to get _id)
    const ipAsset = await db.collection('ip_assets').findOne(matchQuery);

    if (!ipAsset) {
      return NextResponse.json(
        { error: 'IP not found or unauthorized' },
        { status: 404 }
      );
    }

    await db.collection('ip_assets').deleteOne({ _id: ipAsset._id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('IP delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}