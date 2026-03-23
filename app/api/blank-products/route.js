import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import countries from '@/data/countries.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 2. Use the helper instead of manually creating a client
    const db = await getDatabase();
    const collection = db.collection('blank_products');

    const rawProducts = await collection.find({ isActive: true }).toArray();

    const getCountryCodes = (originStr) => {
      if (!originStr) return [];
      const parts = originStr.toLowerCase().split(/and|,|&/).map(s => s.trim());
      return parts.map(part => {
        const match = countries.find(c => 
          c.name.toLowerCase().trim() === part || 
          c.code.toLowerCase().trim() === part
        );
        return match ? match.code.toLowerCase() : null;
      }).filter(Boolean);
    };

    const products = rawProducts.map((p) => {
      const variants = p.variants || [];
      const description = p.description || '';
      
      // 1. TRY PRIMARY FIELD, FALLBACK TO DESCRIPTION MINING
      let rawOrigin = p.producedIn;
      
      if (!rawOrigin || rawOrigin === "Multiple Locations") {
        if (description.includes("Haiti and Mexico")) {
          rawOrigin = "Haiti and Mexico";
        } else if (description.includes("sourced from")) {
           // Basic extraction: grab text after "sourced from"
           const match = description.match(/sourced from ([\w\s,]+)/i);
           if (match) rawOrigin = match[1].split('.')[0].trim();
        }
      }

      // 2. Resolve final Origin string and Flags
      const finalOriginStr = (rawOrigin && rawOrigin.trim() !== "") ? rawOrigin : "Multiple Locations";
      const flags = getCountryCodes(finalOriginStr);

const processedVariants = variants.map(v => {
  if (p.catalogProductId === 679 && v.variantId === 17008) {
    console.log("--- 🕵️ DEBUGGING VARIANT 17008 ---");
    console.log("Raw Variant keys:", Object.keys(v));
    
    // Check for sneaky hidden characters or similar names
    Object.keys(v).forEach(key => {
      console.log(`Key: "${key}" | Value:`, v[key]);
    });
  }

  // Attempt to find the color code by looking for any string starting with '#'
  const foundHex = Object.values(v).find(val => 
    typeof val === 'string' && val.startsWith('#')
  );

  return {
    variantId: v.variantId,
    sku: v.sku || '',
    name: v.name || '',
    size: v.size || '',
    color: v.color || '',
    // Use the found hex as a fail-safe
    colorCode: v.colorCode || v['colorCode'] || foundHex || null,
    price: v.price || 0,
    inStock: v.inStock ?? true,
    files: v.files || []
  };
});

      // 2. Use the NEW processedVariants for img and colors
      const img = p.printfulImage || p.printfulThumbnail || processedVariants[0]?.files?.[0]?.preview_url || '';
      const colors = p.availableColors?.length ? p.availableColors : [...new Set(processedVariants.map(v => v.color).filter(Boolean))];
      
      return {
        ...p,
        variants: processedVariants, // CRITICAL: This overwrites the old variants with the ones containing colorCode
        printfulImage: img,
        thumbnailUrl: p.thumbnailUrl || img,
        description: description,
        availableColors: colors,
        producedIn: finalOriginStr,
        originFlags: flags
      };
    });

    return NextResponse.json(
      { success: true, products },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error("Blank Products API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}