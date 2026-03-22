import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ensurePrintfulSyncProduct } from '@/lib/printful-sync-product';

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
    const { externalProductId } = body;

    if (!externalProductId) {
      return NextResponse.json(
        { error: 'externalProductId is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const products = db.collection('products');

    const productDoc = await products.findOne({
      userId: decoded.userId,
      externalProductId,
    });

    if (!productDoc) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    console.log('🔍 Sync debug:', { 
      externalProductId, 
      templateId: productDoc.printfulTemplateId,
      catalogId: productDoc.baseProduct?.printfulId 
    });
    const syncResult = await ensurePrintfulSyncProduct(productDoc);
    console.log('🔍 Sync result:', syncResult);

    const printfulSyncProductId = syncResult?.printfulSyncProductId;
    const mockupUrl = productDoc.mockupUrl || syncResult?.mockupUrl || null;

    if (printfulSyncProductId || mockupUrl) {
      await products.updateOne(
        { _id: productDoc._id },
        {
          $set: {
            printfulSyncProductId: printfulSyncProductId || null,
            mockupUrl: mockupUrl || null,
            updatedAt: new Date(),
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        printfulSyncProductId: printfulSyncProductId || null,
        mockupUrl: mockupUrl || null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('❌ ensure-sync error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to ensure sync product' },
      { status: 500 }
    );
  }
}
