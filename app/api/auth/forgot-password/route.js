import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function POST(request) {
  
      console.log('SMTP DEBUG:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        passLength: process.env.SMTP_PASS?.length,
    });
  
    try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });

    // Always return success — never confirm whether an email exists (security best practice)
    if (!user) {
      return NextResponse.json({ success: true });
    }

    if (!user.password) {
      // Wallet-only account — no password to reset
      return NextResponse.json({ success: true });
    }

    // Generate a cryptographically secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

    // Store hashed token in DB (never store raw token)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { resetToken: hashedToken, resetTokenExpiry, updatedAt: new Date() } }
    );

    // Build reset link with raw token (so user has the unhashed version)
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email.toLowerCase().trim())}`;

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Reset your MetaWork password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="margin-bottom:8px">Reset your password</h2>
          <p style="color:#555">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}"
             style="display:inline-block;margin:24px 0;padding:12px 24px;background:#01696f;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
          <p style="color:#999;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#bbb;font-size:12px">MetaWork · This link expires in 1 hour</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('forgot-password error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}