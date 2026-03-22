import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // 1) Auth
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

    // 2) Input
    const body = await request.json();
    const { externalProductId } = body;

    if (!externalProductId) {
      return NextResponse.json(
        { error: 'externalProductId is required' },
        { status: 400 }
      );
    }

    // 3) DB + product check
    const { db } = await connectToDatabase();
    const products = db.collection('products');

    const product = await products.findOne({
      userId: decoded.userId,
      externalProductId,
      status: { $ne: 'deleted' },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    if (!product.printfulTemplateId) {
      return NextResponse.json(
        { error: 'printfulTemplateId is missing for this product' },
        { status: 400 }
      );
    }

    const templateId = product.printfulTemplateId;

    // 4) Call Printful to get mockups for this template
    // NOTE: Replace the URL/path below with the actual template- or product-based
    // mockup endpoint you decide to use from Printful's API docs. [web:3][web:9]
		const pfRes = await fetch(
			`https://api.printful.com/mockup-generator/templates/${encodeURIComponent(
				templateId
			)}?store_id=${encodeURIComponent(process.env.PRINTFUL_STORE_ID)}`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
				},
			}
		);

    const pfData = await pfRes.json();

    if (!pfRes.ok) {
      console.error('Printful mockup fetch error:', pfData);
      return NextResponse.json(
        { error: pfData.error?.message || 'Failed to fetch mockups from Printful' },
        { status: 502 }
      );
    }

    // 5) Pick a single default mockup URL
    // Adjust this selection logic to match the structure of pfData.result.
    // Typically you'll have an array of mockups or files; we choose the first
    // "front" / flat mockup if possible, otherwise just the first. [web:10][web:33]
    const result = pfData.result || pfData.data || pfData;
    let mockupUrl = null;

    if (Array.isArray(result.mockups) && result.mockups.length > 0) {
      // Example shape: [{ type: 'front', format: 'jpg', url: '...' }, ...]
      const front = result.mockups.find(
        (m) =>
          typeof m.type === 'string' &&
          m.type.toLowerCase().includes('front')
      );
      mockupUrl = front?.url || result.mockups[0]?.url || null;
    } else if (Array.isArray(result.files) && result.files.length > 0) {
      // Fallback if API returns files[] with preview URLs
      mockupUrl =
        result.files[0].preview_url ||
        result.files[0].url ||
        null;
    }

    if (!mockupUrl) {
      return NextResponse.json(
        { error: 'No mockup URL returned from Printful for this template' },
        { status: 500 }
      );
    }

    // 6) Save mockupUrl on the product
    await products.updateOne(
      { _id: product._id },
      {
        $set: {
          mockupUrl,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json(
      { success: true, mockupUrl },
      { status: 200 }
    );
  } catch (err) {
    console.error('❌ generate-and-save-mockup (template-based) error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate mockup' },
      { status: 500 }
    );
  }
}