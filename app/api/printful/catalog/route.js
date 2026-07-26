// app/api/printful/catalog/route.js

import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const CURATED_PRODUCT_IDS = [
  71, 145, 380, // T-Shirts
  146, 320,     // Hoodies
  312, 506,     // Hats
  19, 281,      // Mugs
  1, 171,       // Posters
  56, 233,      // Phone Cases
  83,           // Bags
  358           // Stickers
];

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const fetchAll = searchParams.get('all') === 'true';

    const client = await clientPromise;
    const db = client.db('metawork_db');
    const blankProducts = db.collection('blank_products');

    // --- CASE 1: FETCH SINGLE PRODUCT DETAILS (Deep Data from Mongo) ---
    if (id) {
      const numericId = Number(id);
      const productDoc =
        (await blankProducts.findOne({ catalogProductId: numericId })) ||
        (await blankProducts.findOne({ printfulProductId: numericId }));

      if (!productDoc || productDoc.hasAvailableVariants === false) {
        return NextResponse.json(
          { error: 'Product unavailable' },
          { status: 404 }
        );
      }

      const filteredVariants = (productDoc.variants || []).filter(
        v => v.availability_status === 'active'
      );

      return NextResponse.json({
        product: {
          id: productDoc.printfulProductId,
          title: productDoc.title,
          type_name: productDoc.type_name,
          main_category_id: productDoc.main_category_id,
          image: productDoc.image,
          thumbnail_url: productDoc.thumbnail_url,
          description: productDoc.description
        },
        variants: filteredVariants
      });
    }

    // --- CASE 2: FETCH CATALOG LIST (Summary Data from Mongo) ---
    const query = {
      hasAvailableVariants: true
    };

    if (!fetchAll) {
      query.catalogProductId = { $in: CURATED_PRODUCT_IDS };
    }

    let products = await blankProducts.find(query).toArray();

    if (category) {
      const categoryLower = category.toLowerCase();
      products = products.filter(
        p =>
          p.type_name?.toLowerCase().includes(categoryLower) ||
          p.main_category_id?.toString() === category
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(
        p =>
          p.title?.toLowerCase().includes(searchLower) ||
          p.type_name?.toLowerCase().includes(searchLower)
      );
    }

    const catalogProducts = products.map(product => {
    // Choose the best available image in the same way your dialog/mockup logic does
    const variantPreview =
      product.variants?.[0]?.files?.[0]?.previewUrl ||
      product.variants?.[0]?.files?.[0]?.preview_url;

    const thumbnailUrl =
      product.image ||
      product.thumbnail_url ||
      variantPreview ||
      null;

    return {
      catalogProductId: product.catalogProductId || product.printfulProductId,
      name: product.title || product.type_name,
      thumbnailUrl,
      mainCategory: product.type_name,
      type: product.type_name,
      variantCount: (product.variants || []).length,
      isAccessory: product.is_accessory || false,
      avgPrice: product.avg_price || null,
      description: product.description || '',
      // expose raw fields too if the UI wants them
      rawImage: product.image,
      rawThumbnailUrl: product.thumbnail_url
    };
  });

    const categories = [
      ...new Set(
        products
          .map(p => p.type_name)
          .filter(Boolean)
      )
    ];

    return NextResponse.json({
      success: true,
      products: catalogProducts,
      categories,
      totalCount: catalogProducts.length
    });
  } catch (error) {
    console.error('Catalog API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}