import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const { token, email, newPassword } = await request.json();

    if (!token || !email || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Hash the incoming token to compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await db.collection('users').findOne({
      email: email.toLowerCase().trim(),
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: new Date() }, // must not be expired
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Save new password and clear the reset token in one shot
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set:   { password: hashedPassword, updatedAt: new Date() },
        $unset: { resetToken: '', resetTokenExpiry: '' },
      }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('reset-password error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}