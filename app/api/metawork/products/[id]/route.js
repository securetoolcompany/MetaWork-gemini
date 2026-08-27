import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

async function generatePrintfulMockup(productId, templateId) {
  const res = await fetch('https://api.printful.com/mockup-generator', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product_id: productId.split('-')[0],  // Extract Printful catalog ID
      template: templateId,
      format: 'jpg'
    })
  });
  
  if (!res.ok) {
    throw new Error(`Printful failed: ${res.status}`);
  }
  
  const data = await res.json();
  return data.result?.url;
}

export const dynamic = 'force-dynamic';

function getAuthenticatedUserId(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : request.cookies.get('auth_token')?.value;

    if (!token) return null;

    const decoded = verifyToken(token);

    return decoded?.userId ? String(decoded.userId) : null;
  } catch {
    return null;
  }
}

function createOwnershipFilter(productFilter, userId) {
  return {
    $and: [
      productFilter,
      {
        $or: [
          { userId },
          { ownerId: userId },
        ],
      },
    ],
  };
}

const toCents = (value) => Math.round(Number(value || 0) * 100);

const getLockedLicensingFeeCents = (product) =>
  (Array.isArray(product?.licensedRevenueTerms)
    ? product.licensedRevenueTerms
    : []
  ).reduce(
    (total, term) => total + Math.max(0, Number(term?.licensingFeeCents || 0)),
    0
  );

const getVariantCostCents = (variant) => {
  const value = variant?.cost ?? variant?.printfulCost ?? variant?.supplierCost;

  if (value === undefined || value === null || value === '') {
    return null;
  }

  const cents = toCents(value);

  if (!Number.isFinite(cents) || cents < 0) {
    return null;
  }

  return cents;
};

function getVariantKey(variant) {
  const value =
    variant?.variant_id ??
    variant?.variantId ??
    variant?.printful_id ??
    variant?.id;

  return value === undefined || value === null || value === ''
    ? null
    : String(value);
}

function getCanonicalProductVariants(product) {
  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    return product.variants;
  }

  if (
    Array.isArray(product?.baseProduct?.variants) &&
    product.baseProduct.variants.length > 0
  ) {
    return product.baseProduct.variants.map((variant) => {
      const catalogVariantId = Number(
        variant?.catalogVariantId ??
          variant?.printful_id ??
          variant?.variant_id ??
          variant?.variantId ??
          variant?.id
      );

      return {
        ...variant,
        id: String(catalogVariantId),
        variantId: catalogVariantId,
        variant_id: catalogVariantId,
        catalogVariantId,
        printful_id: catalogVariantId,
        cost: variant?.cost ?? variant?.price,
        retail_price: variant?.retail_price ?? product?.price,
      };
    });
  }

  return [];
}

function applyCanonicalVariantPricing(existingVariants, requestedVariants) {
  const canonicalVariants = Array.isArray(existingVariants)
    ? existingVariants
    : [];

  const existingByKey = new Map(
    canonicalVariants
      .map((variant) => [getVariantKey(variant), variant])
      .filter(([key]) => key)
  );

  const requestedByKey = new Map();

  for (const requestedVariant of requestedVariants) {
    const key = getVariantKey(requestedVariant);

    if (!key || !existingByKey.has(key)) {
      throw new Error(
        `Unknown product variant: ${key || 'missing variant ID'}`
      );
    }

    if (requestedByKey.has(key)) {
      throw new Error(`Duplicate product variant: ${key}`);
    }

    requestedByKey.set(key, requestedVariant);
  }

  /*
   * Preserve every canonical database variant. Only a matching incoming
   * variant may change its retail_price.
   */
  return requestedVariants.map((requestedVariant) => {
  const key = getVariantKey(requestedVariant);
  const canonicalVariant = existingByKey.get(key);

  const rawRetailPrice =
    requestedVariant.retail_price ?? canonicalVariant.retail_price;

  if (
    rawRetailPrice === undefined ||
    rawRetailPrice === null ||
    rawRetailPrice === ''
  ) {
    throw new Error(`Variant ${key} is missing a retail_price.`);
  }

  const retailPrice = Number(rawRetailPrice);

  if (!Number.isFinite(retailPrice) || retailPrice < 0) {
    throw new Error(`Variant ${key} has an invalid retail_price.`);
  }

  return {
    ...canonicalVariant,
    retail_price: Number(retailPrice.toFixed(2)),
  };
});
}

const assertProductCanBeSold = ({ product, variants }) => {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('Cannot publish a product without at least one sellable variant.');
  }
  const lockedLicensingFeeCents = getLockedLicensingFeeCents(product);

  for (const variant of variants) {
    const retailPriceCents = toCents(variant?.retail_price);
    const supplierCostCents = getVariantCostCents(variant);

    if (supplierCostCents === null) {
      throw new Error(
        `Cannot publish ${variant?.name || variant?.size || 'a variant'} without a supplier cost.`
      );
    }

    const minimumPriceCents = supplierCostCents + lockedLicensingFeeCents;

    if (retailPriceCents < minimumPriceCents) {
      throw new Error(
        `${variant?.name || variant?.size || 'A variant'} must be priced at ` +
          `$${(minimumPriceCents / 100).toFixed(2)} or more. ` +
          `Its supplier cost is $${(supplierCostCents / 100).toFixed(2)} and ` +
          `the product has $${(lockedLicensingFeeCents / 100).toFixed(2)} in locked IP licensing fees.`
      );
    }
  }
};

export async function GET(request, { params }) {
  console.log('[METAWORK DEBUG] Initializing handler');

  try {
    const { id } = await params;
    if (!id || id === 'undefined') {
      return NextResponse.json({ success: false, error: 'Invalid or missing ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const { ObjectId } = require('mongodb');

    const filter = {
      $or: [
        { id: id },
        { _id: /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id }
      ]
    };

    const localProduct = await db.collection('products').findOne(filter);

    if (!localProduct) {
      const pfRes = await fetch(`https://api.printful.com/products/${id}`, {
        headers: { Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`, 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      });

      if (!pfRes.ok) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });

      const pfData = await pfRes.json();
      return NextResponse.json({
        success: true,
        product: {
          ...pfData.result.product,
          variants: pfData.result.variants ?? pfData.result.sync_variants ?? [],
          lastUpdated: new Date().toISOString(),
        },
      });
    }

    let pfData = null;
    if (localProduct.catalogProductId) {
      const pfRes = await fetch(`https://api.printful.com/products/${localProduct.catalogProductId}`, {
        headers: { Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`, 'Content-Type': 'application/json' },
        next: { revalidate: 0 },
      });
      if (pfRes.ok) pfData = await pfRes.json();
    }

    const mergedProduct = {
      ...(pfData?.result?.product ?? {}), 
      ...localProduct,                    
      // FIX: Check local variants first, then fall back to Printful (Checking both variants and sync_variants)
      variants: getCanonicalProductVariants(localProduct),
      lastUpdated: new Date().toISOString(),
    };

    if (localProduct.price) {
        mergedProduct.price = parseFloat(localProduct.price);
    }

    return NextResponse.json({ success: true, product: mergedProduct });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const updates = await request.json();

    const { db } = await connectToDatabase();
    const { ObjectId } = require('mongodb');

    if (!id || id === 'undefined') {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const authenticatedUserId = getAuthenticatedUserId(request);

    if (!authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const filter = {
      $or: [
        { id },
        { _id: /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id },
      ],
    };

    const existingProduct = await db.collection('products').findOne(filter);

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const productOwnerId = String(
      existingProduct.userId ?? existingProduct.ownerId ?? ''
    );

    if (productOwnerId !== authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const ownershipFilter = createOwnershipFilter(
      filter,
      authenticatedUserId
    );

    /*
    * These values are locked/database-controlled.
    * Never accept changes to them from the browser.
    */
    delete updates.userId;
    delete updates.licensedRevenueTerms;
    delete updates.ownerId;
    delete updates.ownerWallet;
    delete updates.ownerName;
    delete updates.ownerUsername;
    delete updates.revenuePoolAddress;
    delete updates.revenuePoolAppId;
    delete updates.revenueTokenAssetId;

    console.log(`[METAWORK DEBUG] Updating product ${id} with:`, updates);

    // --- PRESERVE CANONICAL VARIANT COSTS; ACCEPT RETAIL PRICE ONLY ---
    if (Array.isArray(updates.variants) && updates.variants.length > 0) {
      updates.variants = applyCanonicalVariantPricing(
        getCanonicalProductVariants(existingProduct),
        updates.variants
      );

      updates.price = updates.variants.reduce(
        (lowest, variant) =>
          Number(variant.retail_price) < Number(lowest)
            ? Number(variant.retail_price)
            : lowest,
        Number(updates.variants[0].retail_price)
      );
    }

    const nextStatus = updates.status ?? existingProduct.status;
    const nextIsPublic = updates.isPublic ?? existingProduct.isPublic;
    const productWillBeSellable =
      nextStatus === 'live' ||
      nextStatus === 'active' ||
      nextIsPublic === true;

    if (productWillBeSellable) {
      assertProductCanBeSold({
        product: existingProduct,
        variants:
          updates.variants ??
          getCanonicalProductVariants(existingProduct),
      });
    }
    // -------------------------------------------------------------------

    // --- ENSURE PRINTFUL SYNC ONLY WHEN EXPLICITLY REQUESTED ---
    if (Array.isArray(updates.variants) && updates.variants.length > 0) {      try {
        const { ensurePrintfulSyncProduct } = require('@/lib/printful-sync-product');
        
        const filterForLookup = ownershipFilter;

        const existingProduct = await db.collection('products').findOne(filterForLookup);
        const canonicalStoredVariants =
         getCanonicalProductVariants(existingProduct);

        const hasRetailPriceChange = (updates.variants || []).some(
          (updatedVariant) => {
            const key = getVariantKey(updatedVariant);

            const storedVariant = canonicalStoredVariants.find(
              (variant) => getVariantKey(variant) === key
            );

            return (
              storedVariant &&
              toCents(updatedVariant.retail_price) !==
                toCents(storedVariant.retail_price)
            );
          }
        );

        const needsSync =
          !existingProduct?.printfulSyncProductId ||
          canonicalStoredVariants.some(
            (variant) => !variant.sync_variant_id
          ) ||
          hasRetailPriceChange;

        console.log(
          '[SYNC DEBUG] needsSync:',
          needsSync,
          'existing printfulSyncProductId:',
          existingProduct?.printfulSyncProductId
        );

        console.log(
          '[SYNC DEBUG] printfulTemplateId:',
          existingProduct?.printfulTemplateId ?? updates.printfulTemplateId
        );

        console.log(
          '[SYNC DEBUG] baseProduct.variants count:',
          (existingProduct?.baseProduct?.variants || []).length
        );

        if (needsSync) {
          const productForSync = { ...existingProduct, ...updates, _id: existingProduct?._id };
          console.log('[SYNC DEBUG] Calling ensurePrintfulSyncProduct...');

          const syncResult = await ensurePrintfulSyncProduct(productForSync, { skipMockup: true });
          console.log('[SYNC DEBUG] syncResult:', JSON.stringify(syncResult));

          if (syncResult?.printfulSyncProductId) {
            updates.printfulSyncProductId = syncResult.printfulSyncProductId;
          }

          if (Array.isArray(syncResult?.variantMappings) && syncResult.variantMappings.length > 0) {
            const syncMap = new Map(
              syncResult.variantMappings.map((m) => [String(m.variant_id), m.sync_variant_id])
            );

            updates.variants = updates.variants.map((v) => ({
              ...v,
              sync_variant_id: syncMap.get(String(v.printful_id)) ?? v.sync_variant_id ?? null,
            }));
          } else {
            console.warn('[SYNC DEBUG] No variantMappings returned — sync likely failed silently upstream');
          }
        } else {
          console.log('[SYNC DEBUG] Skipped — product already fully synced');
        }
      } catch (syncErr) {
        console.error('[METAWORK] Printful sync failed:', syncErr.message, syncErr.stack);
      }
    }
    // ----------------------------------

    const result = await db.collection('products').updateOne(
      ownershipFilter,
      {
        $set: {
          ...updates,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    if (updates.printfulTemplateId) {
      try {
        const mockupUrl = await generatePrintfulMockup(id, updates.printfulTemplateId);
        await db.collection('products').updateOne(ownershipFilter, {
          $set: { mockupUrl }
        });
        console.log('[METAWORK] Mockup generated:', mockupUrl);
      } catch (mockupErr) {
        console.warn('[METAWORK] Mockup failed:', mockupErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Product synced to database'
    });
  } catch (error) {
    console.error('[METAWORK DEBUG] PUT Error:', error.message);

    const isPricingValidationError =
      error.message.startsWith('Cannot publish') ||
      error.message.startsWith('Unknown product variant') ||
      error.message.startsWith('Duplicate product variant') ||
      error.message.startsWith('Variant ') ||
      error.message.includes('must be priced at');

    return NextResponse.json(
      { success: false, error: error.message },
      { status: isPricingValidationError ? 400 : 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!id || id === 'undefined') {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const authenticatedUserId = getAuthenticatedUserId(request);

    if (!authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const { ObjectId } = require('mongodb');

    const filter = {
      $or: [
        { id },
        {
          _id: /^[a-fA-F0-9]{24}$/.test(id)
            ? new ObjectId(id)
            : id,
        },
      ],
    };

    const existingProduct = await db
      .collection('products')
      .findOne(filter);

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const productOwnerId = String(
      existingProduct.userId ?? existingProduct.ownerId ?? ''
    );

    if (productOwnerId !== authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const ownershipFilter = createOwnershipFilter(
      filter,
      authenticatedUserId
    );

    const result = await db
      .collection('products')
      .deleteOne(ownershipFilter);

    if (result.deletedCount !== 1) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete product' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('[METAWORK DEBUG] DELETE Error:', error.message);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}