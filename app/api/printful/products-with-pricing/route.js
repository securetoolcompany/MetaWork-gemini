import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_BASE_URL = 'https://api.printful.com';

export const dynamic = 'force-dynamic';

/**
 * GET /api/printful/products-with-pricing
 * Fetch Printful products with admin pricing markups applied
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Fetch products from Printful
    const response = await fetch(`${PRINTFUL_BASE_URL}/products`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Printful API Error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch Printful catalog' },
        { status: response.status }
      );
    }

    const data = await response.json();
    let products = data.result || [];

    // Get admin pricing rules
    const { db } = await connectToDatabase();
    const pricingRules = await db.collection('admin_product_pricing')
      .find({ isActive: true })
      .toArray();

    // Get admin categories
    const adminCategories = await db.collection('admin_categories')
      .find({ isActive: true })
      .toArray();

    // Find global default pricing
    const globalPricing = pricingRules.find(r => r.printfulProductId === 'global');

    // Apply pricing and categories to products
    const productsWithPricing = products.map(product => {
      // Find product-specific pricing or use global
      const productPricing = pricingRules.find(r => r.printfulProductId === product.id) || globalPricing;

      // Calculate effective price
      const basePrice = product.avg_price || 0;
      let percentMarkup = productPricing?.percentMarkup || 0;
      let flatMarkup = productPricing?.flatMarkup || 0;

      const markupAmount = basePrice * (percentMarkup / 100);
      const effectivePrice = basePrice + markupAmount + flatMarkup;

      // Get custom categories for this product
      const customCategories = productPricing?.customCategories || [];

      return {
        catalogProductId: product.id,
        name: product.title || product.type_name,
        thumbnailUrl: product.image || product.thumbnail_url,
        mainCategory: product.type_name,
        type: product.type_name,
        variantCount: product.variant_count || 0,
        description: product.description || '',
        
        // Pricing info
        basePrice,
        percentMarkup,
        flatMarkup,
        effectivePrice: Math.round(effectivePrice * 100) / 100,
        hasPricingOverride: !!productPricing && productPricing.printfulProductId !== 'global',
        
        // Categories - both Printful native and admin custom
        printfulCategory: product.type_name,
        customCategories,
        allCategories: [product.type_name, ...customCategories].filter(Boolean)
      };
    });

    // Apply filters
    let filteredProducts = productsWithPricing;

    if (category) {
      filteredProducts = filteredProducts.filter(p => 
        p.allCategories.some(c => c.toLowerCase().includes(category.toLowerCase()))
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p =>
        p.name?.toLowerCase().includes(searchLower) ||
        p.type?.toLowerCase().includes(searchLower)
      );
    }

    // Get unique categories for filter UI
    const allCategoryNames = [...new Set(
      productsWithPricing.flatMap(p => p.allCategories)
    )].filter(Boolean).sort();

    return NextResponse.json({
      success: true,
      products: filteredProducts,
      categories: allCategoryNames,
      adminCategories,
      totalCount: filteredProducts.length,
      pricing: {
        globalDefault: globalPricing ? {
          percentMarkup: globalPricing.percentMarkup,
          flatMarkup: globalPricing.flatMarkup
        } : null
      }
    });

  } catch (error) {
    console.error('Products with Pricing API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
