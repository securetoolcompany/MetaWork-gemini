import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required.' }, { status: 400 });
  }

  try {
    const { userId } = jwt.verify(token, process.env.NEXTAUTH_SECRET);
    const { db } = await connectToDatabase();

    const objectId = new ObjectId(String(userId));

    const user = await db.collection('users').findOne({
      _id: objectId,
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.collection('users').updateOne(
      { _id: objectId },
      {
        $set: { password: hashedPassword, updatedAt: new Date() },
        $unset: { passwordResetToken: '', passwordResetExpires: '' }
      }
    );

    return NextResponse.json({ message: 'Password reset successfully.' });
  } catch {
    return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 });
  }
}