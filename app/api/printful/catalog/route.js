import { NextResponse } from 'next/server';

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_BASE_URL = 'https://api.printful.com';

// Curated list of product categories to show
const CURATED_PRODUCT_IDS = [
  71, 145, 380, // T-Shirts
  146, 320,     // Hoodies
  312, 506,     // Hats
  19, 281,      // Mugs
  1, 171,       // Posters
  56, 233,      // Phone Cases
  83,           // Bags
  358,          // Stickers
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id'); // NEW: Check for specific ID
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const fetchAll = searchParams.get('all') === 'true';

    // --- CASE 1: FETCH SINGLE PRODUCT DETAILS (Deep Data) ---
    if (id) {
      const response = await fetch(`${PRINTFUL_BASE_URL}/products/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Printful API Error: ${response.status}`);
      }

      const data = await response.json();
      // Returns { product: {...}, variants: [...] }
      return NextResponse.json(data.result);
    }

    // --- CASE 2: FETCH CATALOG LIST (Summary Data) ---
    const response = await fetch(`${PRINTFUL_BASE_URL}/products`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch Printful catalog', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    let products = data.result || [];

    if (!fetchAll) {
      products = products.filter(p => CURATED_PRODUCT_IDS.includes(p.id));
    }

    if (category) {
      products = products.filter(p => 
        p.type_name?.toLowerCase().includes(category.toLowerCase()) ||
        p.main_category_id?.toString() === category
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(p =>
        p.title?.toLowerCase().includes(searchLower) ||
        p.type_name?.toLowerCase().includes(searchLower)
      );
    }

    const catalogProducts = products.map(product => ({
      catalogProductId: product.id,
      name: product.title || product.type_name,
      thumbnailUrl: product.image || product.thumbnail_url,
      mainCategory: product.type_name,
      type: product.type_name,
      variantCount: product.variant_count || 0,
      isAccessory: product.is_accessory || false,
      avgPrice: product.avg_price || null,
      description: product.description || ''
    }));

    const categories = [...new Set(products.map(p => p.type_name).filter(Boolean))];

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
