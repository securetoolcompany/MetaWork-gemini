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
    console.log('[METAWORK DEBUG] Resolved ID:', id);

    if (!id || id === 'undefined') {
      return NextResponse.json({ success: false, error: 'Invalid or missing ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 1) Always resolve local product first by MetaWork id
    const localProduct = await db.collection('products').findOne({ id });

    if (!localProduct) {
      // optional: still try treating id as a raw Printful product id
      const pfRes = await fetch(`https://api.printful.com/products/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 0 },
      });

      if (!pfRes.ok) {
        console.error('[METAWORK DEBUG] Local + Printful Not Found');
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      const pfData = await pfRes.json();
      return NextResponse.json({
        success: true,
        product: {
          ...pfData.result.product,
          variants: pfData.result.variants ?? [],
          lastUpdated: new Date().toISOString(),
        },
      });
    }

    // 2) We have a local product: optionally enrich with Printful using catalogProductId
    let pfData = null;
    if (localProduct.catalogProductId) {
      const pfRes = await fetch(
        `https://api.printful.com/products/${localProduct.catalogProductId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          next: { revalidate: 0 },
        }
      );

      if (pfRes.ok) {
        pfData = await pfRes.json();
      } else {
        console.warn('[METAWORK DEBUG] Printful Not Found for catalogProductId', localProduct.catalogProductId);
      }
    }

    const mergedProduct = {
      ...localProduct,
      ...(pfData?.result?.product ?? {}),
      variants: pfData?.result?.variants ?? [],
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, product: mergedProduct });
  } catch (e) {
    console.error('[METAWORK DEBUG] Route Error:', e.message);
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

    // Filter to find the product by custom 'id' or Mongo '_id'
    const filter = {
      $or: [
        { id: id },
        { _id: /^[a-fA-F0-9]{24}$/.test(id) ? new (require('mongodb').ObjectId)(id) : id }
      ]
    };

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