import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ensurePrintfulSyncProduct } from '@/lib/printful-sync-product';

function mergeVariantMappings(existingVariants = [], variantMappings = []) {
  const mappingByVariantId = new Map(
    (variantMappings || []).map((m) => [String(m.variant_id), m])
  );

  return (existingVariants || []).map((variant) => {
    const key = String(
      variant?.catalogVariantId ??
      variant?.printful_id ??
      variant?.variantId ??
      variant?.variant_id ??
      variant?.id ??
      ''
    );
    const match = mappingByVariantId.get(key);

    if (!match) return variant;

    const color = variant.color ?? variant.colour ?? null;

    return {
      ...variant,
      color,
      colorKey:
        variant.colorKey ??
        (color ? String(color).trim().toLowerCase() : null),
      sync_variant_id: match.sync_variant_id,
      printfulVariantId: match.sync_variant_id,
      external_id: match.external_id || variant.external_id || null,
    };
  });
}

export const dynamic = 'force-dynamic';
const SYNC_LEASE_MS = 10 * 60 * 1000;

export async function POST(request) {
  let products = null;
  let leaseProductId = null;
  let leaseId = null;

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

    const { externalProductId } = await request.json();

    if (!externalProductId) {
      return NextResponse.json(
        { error: 'externalProductId is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    products = db.collection('products');

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

    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + SYNC_LEASE_MS);
    leaseId = crypto.randomUUID();

    /*
     * Atomically claim this product's Printful-sync lease. Only a missing
     * or expired lease may be replaced.
     */
    const leaseResult = await products.findOneAndUpdate(
      {
        _id: productDoc._id,
        $or: [
          { syncLeaseExpiresAt: { $exists: false } },
          { syncLeaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          syncLeaseId: leaseId,
          syncLeaseExpiresAt: leaseExpiresAt,
          syncStartedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    /*
     * MongoDB driver versions differ: some return the document directly,
     * while others return { value: document }.
     */
    const leasedProductDoc = leaseResult?.value ?? leaseResult ?? null;

    if (!leasedProductDoc?._id) {
      return NextResponse.json(
        {
          success: true,
          syncing: true,
          message: 'A Printful sync is already in progress for this product.',
        },
        { status: 202 }
      );
    }

    leaseProductId = leasedProductDoc._id;

    console.log('🔍 Sync debug:', {
      externalProductId,
      templateId: leasedProductDoc.printfulTemplateId,
      catalogId:
        leasedProductDoc.baseProduct?.product_id ??
        leasedProductDoc.baseProduct?.printfulProductId ??
        leasedProductDoc.catalogProductId ??
        leasedProductDoc.baseProduct?.catalogProductId ??
        null,
    });

    const syncResult = await ensurePrintfulSyncProduct(leasedProductDoc);

    console.log('🔍 Sync result:', syncResult);

    const printfulSyncProductId =
      syncResult?.printfulSyncProductId ||
      leasedProductDoc.printfulSyncProductId ||
      null;

    const mockupUrl =
      leasedProductDoc.mockupUrl ||
      syncResult?.mockupUrl ||
      null;

    const variantMappings = syncResult?.variantMappings || [];

    const allowedCatalogVariantIds = new Set(
      variantMappings.map((mapping) => String(mapping.variant_id))
    );

    const existingVariantByCatalogId = new Map(
      (leasedProductDoc.variants || []).map((variant) => {
        const catalogVariantId =
          variant?.catalogVariantId ??
          variant?.printful_id ??
          variant?.variantId ??
          variant?.variant_id ??
          variant?.id;
        return [String(catalogVariantId), variant];
      })
    );

    const allowedBaseProductVariants = (
      leasedProductDoc.baseProduct?.variants || []
    ).filter((variant) => {
      const catalogVariantId =
        variant?.variantId ??
        variant?.variant_id ??
        variant?.printful_id ??
        variant?.id;

      return allowedCatalogVariantIds.has(String(catalogVariantId));
      });

      const mergedTopLevelVariants = mergeVariantMappings(
        allowedBaseProductVariants.map((source) => {
          const catalogVariantId = Number(
            source?.catalogVariantId ??
              source?.variantId ??
              source?.variant_id ??
              source?.printful_id ??
              source?.id
          );

          if (!Number.isInteger(catalogVariantId) || catalogVariantId <= 0) {
            throw new Error(
              `Invalid catalog variant ID while syncing product ${String(
                leasedProductDoc._id
              )}`
            );
          }

          const existingVariant = existingVariantByCatalogId.get(
            String(catalogVariantId)
          );

          const size =
            source?.attributes?.pa_size ??
            source?.attributes?.size ??
            source?.size ??
            null;

          const color =
            source?.attributes?.pa_color ??
            source?.attributes?.color ??
            source?.color ??
            source?.colour ??
            null;

          return {
            id: String(catalogVariantId),
            variantId: catalogVariantId,
            variant_id: catalogVariantId,
            catalogVariantId,
            printful_id: catalogVariantId,

            sku: source?.sku ?? existingVariant?.sku ?? '',
            name: source?.name ?? existingVariant?.name ?? '',

            size,
            color,
            colorCode:
              source?.colorCode ??
              source?.colourCode ??
              existingVariant?.colorCode ??
              null,
            colorKey:
              source?.colorKey ??
              existingVariant?.colorKey ??
              (color ? String(color).trim().toLowerCase() : null),

            attributes: {
              ...(existingVariant?.attributes || {}),
              ...(source?.attributes || {}),
              pa_size: size,
              pa_color: color,
            },

            cost:
              source?.price ??
              source?.cost ??
              existingVariant?.cost ??
              null,
            retail_price:
              existingVariant?.retail_price ??
              existingVariant?.retailPrice ??
              source?.retail_price ??
              source?.retailPrice ??
              source?.price ??
              null,
          };
        }),
        variantMappings
      );

    const mergedBaseProductVariants = mergeVariantMappings(
      (leasedProductDoc.baseProduct?.variants || []).map((variant) => {
        const color = variant?.color ?? variant?.colour ?? null;

        return {
          ...variant,
          color,
          colorKey:
            variant?.colorKey ??
            (color ? String(color).trim().toLowerCase() : null),
        };
      }),
      variantMappings
    );

    /*
     * Include syncLeaseId in the filter. A stale worker whose lease has
     * expired cannot overwrite a newer worker's result.
     */
    const persistResult = await products.updateOne(
      {
        _id: leasedProductDoc._id,
        syncLeaseId: leaseId,
      },
      {
        $set: {
          printfulSyncProductId,
          mockupUrl,
          variants: mergedTopLevelVariants,
          'baseProduct.variants': mergedBaseProductVariants,
          updatedAt: new Date(),
        },
      }
    );

    if (persistResult.matchedCount !== 1) {
      throw new Error(
        'Printful sync lease expired before the sync result could be saved.'
      );
    }

    return NextResponse.json(
      {
        success: true,
        printfulSyncProductId,
        mockupUrl,
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
  } finally {
    /*
     * Only the worker that acquired the lease may release it.
     * If the process crashes, the ten-minute expiry makes it recoverable.
     */
    if (products && leaseProductId && leaseId) {
      try {
        await products.updateOne(
          {
            _id: leaseProductId,
            syncLeaseId: leaseId,
          },
          {
            $unset: {
              syncLeaseId: '',
              syncLeaseExpiresAt: '',
              syncStartedAt: '',
            },
          }
        );
      } catch (releaseError) {
        console.error(
          '[ensure-sync] Failed to release sync lease:',
          releaseError.message
        );
      }
    }
  }
}