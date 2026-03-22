import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.substring(7) ||
      request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { externalProductId, catalogProductId } = body;

    if (!externalProductId || !catalogProductId) {
      return NextResponse.json(
        { error: 'externalProductId and catalogProductId are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const products = db.collection('products');

    const product = await products.findOne({
      userId: decoded.userId,
      externalProductId,
      status: { $ne: 'deleted' },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Call Printful v2 create-task (catalog mockup)
    const pfRes = await fetch(
      `https://api.printful.com/v2/mockup-tasks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // v2 catalog mockup task payload
          // You may need to adjust these fields for your exact use case
          catalog_product_id: catalogProductId,
          // Link this task to your external product/template
          external_id: externalProductId,
        }),
      }
    );

    const pfData = await pfRes.json();

    if (!pfRes.ok) {
      return NextResponse.json(
        { error: pfData.error?.message || 'Printful mockup task creation failed' },
        { status: 500 }
      );
    }

    const taskId = pfData.result?.task_id || pfData.data?.[0]?.id;

    if (!taskId) {
      return NextResponse.json(
        { error: 'No task id returned from Printful' },
        { status: 500 }
      );
    }

    // Optionally store the task id on the product for debugging/auditing
    await products.updateOne(
      { _id: product._id },
      {
        $set: {
          mockupTaskId: taskId,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json(
      { success: true, taskId },
      { status: 200 }
    );
  } catch (err) {
    console.error('❌ create-mockup-task error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create mockup task' },
      { status: 500 }
    );
  }
}
