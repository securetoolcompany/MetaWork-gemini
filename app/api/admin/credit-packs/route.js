/**
 * /api/admin/credit-packs
 * Admin CRUD for mint credit packs — GET, POST, PATCH
 */

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

function isAdmin(decoded) {
  return decoded?.role === 'admin' || decoded?.isAdmin === true;
}

async function authenticate(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const decoded = verifyToken(authHeader.substring(7));
  if (!decoded?.userId) return null;
  return decoded;
}

export async function GET(request) {
  try {
    const decoded = await authenticate(request);
    if (!decoded || !isAdmin(decoded)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    const { db } = await connectToDatabase();
    const packs = await db.collection('creditPacks').find({}).sort({ sortOrder: 1 }).toArray();
    return NextResponse.json({ success: true, packs });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch packs' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const decoded = await authenticate(request);
    if (!decoded || !isAdmin(decoded)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    const body = await request.json();
    const { name, credits, priceUSDC, type = 'one-time', active = true, sortOrder = 99 } = body;
    if (!name || !credits || !priceUSDC) {
      return NextResponse.json({ error: 'name, credits, and priceUSDC are required' }, { status: 400 });
    }
    const { db } = await connectToDatabase();
    const result = await db.collection('creditPacks').insertOne({
      name,
      credits: Number(credits),
      priceUSDC: Number(priceUSDC),
      type,
      active,
      sortOrder: Number(sortOrder),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return NextResponse.json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create pack' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const decoded = await authenticate(request);
    if (!decoded || !isAdmin(decoded)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    const body = await request.json();
    const { _id, ...fields } = body;
    if (!_id) {
      return NextResponse.json({ error: '_id is required' }, { status: 400 });
    }
    const allowed = ['name', 'credits', 'priceUSDC', 'type', 'active', 'sortOrder'];
    const update = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) update[key] = fields[key];
    }
    update.updatedAt = new Date();
    const { db } = await connectToDatabase();
    await db.collection('creditPacks').updateOne({ _id: new ObjectId(_id) }, { $set: update });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update pack' }, { status: 500 });
  }
}