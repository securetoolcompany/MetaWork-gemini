import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ensurePrintfulSyncProduct } from '@/lib/printful-sync-product';

function mergeVariantMappings(existingVariants = [], variantMappings = []) {
  const mappingByVariantId = new Map(
    (variantMappings || []).map((m) => [String(m.variant_id), m])
  );

  return (existingVariants || []).map((variant) => {
    const key = String(variant?.printful_id || variant?.variantId || variant?.id || '');
    const match = mappingByVariantId.get(key);

    if (!match) return variant;

    return {
      ...variant,
      sync_variant_id: match.sync_variant_id,
      printfulVariantId: match.sync_variant_id,
      external_id: match.external_id || variant.external_id || null,
    };
  });
}

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
      catalogId:
        productDoc.catalogProductId ||
        productDoc.baseProduct?.catalogProductId ||
        productDoc.baseProduct?.printfulId ||
        null,
    });
    const syncResult = await ensurePrintfulSyncProduct(productDoc);
    console.log('🔍 Sync result:', syncResult);

    const printfulSyncProductId = syncResult?.printfulSyncProductId;
    const mockupUrl = productDoc.mockupUrl || syncResult?.mockupUrl || null;
    const variantMappings = syncResult?.variantMappings || [];

    const mergedTopLevelVariants = mergeVariantMappings(
      productDoc.variants || [],
      variantMappings
    );

    const mergedBaseProductVariants = mergeVariantMappings(
      productDoc.baseProduct?.variants || [],
      variantMappings
    );

    if (printfulSyncProductId || mockupUrl || variantMappings.length > 0) {
      await products.updateOne(
        { _id: productDoc._id },
        {
          $set: {
            printfulSyncProductId: printfulSyncProductId || null,
            mockupUrl: mockupUrl || null,
            variants: mergedTopLevelVariants,
            'baseProduct.variants': mergedBaseProductVariants,
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
        syncedVariantCount: variantMappings.length,
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
