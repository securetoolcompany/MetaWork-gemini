import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

export async function POST(req) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required.' },
        { status: 400 }
      );
    }

    const { userId } = jwt.verify(token, process.env.NEXTAUTH_SECRET);

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const userIdString = String(userId);

    const idQueries = [
      { _id: userIdString },
      { id: userIdString },
    ];

    if (ObjectId.isValid(userIdString)) {
      idQueries.unshift({ _id: new ObjectId(userIdString) });
    }

    const user = await db.collection('users').findOne({
      $and: [
        { $or: idQueries },
        { passwordResetToken: token },
        { passwordResetExpires: { $gt: new Date() } },
      ],
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
        $unset: {
          passwordResetToken: '',
          passwordResetExpires: '',
        },
      }
    );

    return NextResponse.json({
      message: 'Password reset successfully.',
    });
  } catch (error) {
    console.error('Password reset failed:', error?.message);

    return NextResponse.json(
      { error: 'Invalid or expired reset link.' },
      { status: 400 }
    );
  }
}