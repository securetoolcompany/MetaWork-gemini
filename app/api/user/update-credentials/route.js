import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    // --- Auth ---
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    const body = await request.json();
    const { email, currentPassword, newPassword, defaultWallet, notifications } = body;

    const { db } = await connectToDatabase();

    let queryId;
    try {
      queryId = new ObjectId(decoded.userId);
    } catch {
      queryId = decoded.userId;
    }

    const userQuery = { $or: [{ _id: queryId }, { id: decoded.userId }] };

    // --- Password update: verify current password first ---
    if (currentPassword !== undefined && newPassword !== undefined) {
      const user = await db.collection('users').findOne(userQuery);
      if (!user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }
      if (!user.password) {
        return NextResponse.json(
          { success: false, error: 'This account uses wallet authentication and has no password.' },
          { status: 400 }
        );
      }
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return NextResponse.json({ success: false, error: 'Incorrect current password' }, { status: 400 });
      }
      const hashed = await bcrypt.hash(newPassword, 12);
      await db.collection('users').updateOne(userQuery, {
        $set: { password: hashed, updatedAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    // --- All other updates (email, defaultWallet, notifications) ---
    const updateFields = { updatedAt: new Date() };

    if (email !== undefined)             updateFields.email         = email;
    if (defaultWallet !== undefined)     updateFields.defaultWallet = defaultWallet;
    if (notifications !== undefined)     updateFields.notifications = notifications;

    if (Object.keys(updateFields).length === 1) {
      // Only updatedAt — nothing useful was sent
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const result = await db.collection('users').updateOne(userQuery, { $set: updateFields });

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('update-credentials error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}