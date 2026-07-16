import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

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

export async function GET(request, { params }) {
  console.log('[METAWORK DEBUG] Initializing handler');

  try {
    const { id } = await params;
    if (!id || id === 'undefined') {
      return NextResponse.json({ success: false, error: 'Invalid or missing ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const localProduct = await db.collection('products').findOne({ id });

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
      variants: localProduct.variants || localProduct.variations || pfData?.result?.variants || pfData?.result?.sync_variants || [],
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

    if (!id || id === 'undefined') {
      return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    }

    console.log(`[METAWORK DEBUG] Updating product ${id} with:`, updates);

    // --- ENFORCE PRICING LOGIC HERE ---
    // Recalculate variants before it hits the database
    if (updates.variants && updates.variants.length > 0) {
      // Find the variant with the lowest cost to act as the baseline anchor
      const baseVariant = updates.variants.reduce((min, v) => 
        ((v.cost || 0) < (min.cost || 0)) ? v : min, updates.variants[0]
      );
      
      // Calculate the intended flat markup
      const markup = (baseVariant.retail_price || 0) - (baseVariant.cost || 0);

      // Override all variant prices to guarantee cost differences are mathematically maintained
      updates.variants = updates.variants.map(variant => ({
        ...variant,
        retail_price: parseFloat(((variant.cost || 0) + markup).toFixed(2))
      }));

      // Ensure the top-level product price matches the baseline
      updates.price = baseVariant.retail_price;
    }
    // ----------------------------------

        // --- ENSURE PRINTFUL SYNC ---
    if (updates.variants && updates.variants.length > 0) {
      try {
        const { ensurePrintfulSyncProduct } = require('@/lib/printful-sync-product');
        const filterForLookup = {
          $or: [
            { id: id },
            { _id: /^[a-fA-F0-9]{24}$/.test(id) ? new (require('mongodb').ObjectId)(id) : id }
          ]
        };
        const existingProduct = await db.collection('products').findOne(filterForLookup);

        const needsSync =
          !existingProduct?.printfulSyncProductId ||
          (existingProduct?.variants || []).some(v => !v.sync_variant_id);

        console.log('[SYNC DEBUG] needsSync:', needsSync, 'existing printfulSyncProductId:', existingProduct?.printfulSyncProductId);
        console.log('[SYNC DEBUG] printfulTemplateId:', existingProduct?.printfulTemplateId ?? updates.printfulTemplateId);
        console.log('[SYNC DEBUG] baseProduct.variants count:', (existingProduct?.baseProduct?.variants || []).length);

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
              syncResult.variantMappings.map(m => [String(m.variant_id), m.sync_variant_id])
            );
            updates.variants = updates.variants.map(v => ({
              ...v,
              sync_variant_id: syncMap.get(String(v.printful_id)) ?? v.sync_variant_id ?? null
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

    // Filter to find the product by custom 'id' or Mongo '_id'
    const filter = {
      $or: [
        { id: id },
        { _id: /^[a-fA-F0-9]{24}$/.test(id) ? new (require('mongodb').ObjectId)(id) : id }
      ]
    };

    // Because we modified `updates` above, the corrected prices are injected here
    const result = await db.collection('products').updateOne(
      filter,
      { 
        $set: { 
          ...updates, 
          updatedAt: new Date().toISOString() 
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    if (updates.printfulTemplateId) {
      try {
        const mockupUrl = await generatePrintfulMockup(id, updates.printfulTemplateId);
        await db.collection('products').updateOne(filter, {
          $set: { mockupUrl }
        });
        console.log('[METAWORK] Mockup generated:', mockupUrl);
      } catch (mockupErr) {
        console.warn('[METAWORK] Mockup failed:', mockupErr.message);
        // Don't fail save—mockup optional
      }
    }

    // THIS IS THE CRITICAL JSON RETURN
    return NextResponse.json({ 
      success: true, 
      message: 'Product synced to database' 
    });

  } catch (error) {
    console.error('[METAWORK DEBUG] PUT Error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message }, 
      { status: 500 }
    );
  }
}