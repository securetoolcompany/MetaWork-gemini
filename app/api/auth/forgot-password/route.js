import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne({ email });

  // Always return success to prevent email enumeration
  if (!user) {
    return NextResponse.json({ message: 'If that email exists, a reset link was sent.' });
  }

  const token = jwt.sign({ userId: user._id }, process.env.NEXTAUTH_SECRET, { expiresIn: '1h' });

  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { passwordResetToken: token, passwordResetExpires: new Date(Date.now() + 3600000) } }
  );

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: 'MetaWork <accountRecovery@metawork.tools>',
    to: email,
    subject: 'Reset your MetaWork password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Reset your password</h2>
        <p>Click the button below to reset your MetaWork password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#01696f;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a>
        <p style="margin-top:24px;color:#888;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  });

  return NextResponse.json({ message: 'If that email exists, a reset link was sent.' });
}