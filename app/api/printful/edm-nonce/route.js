import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { externalProductId, externalCustomerId } = await req.json();
    let origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL;
    origin = origin.trim().replace(/\/$/, ""); 

    console.log('🔐 Nonce Request:', {
      externalProductId,
      externalCustomerId,
      origin,
      hasApiKey: !!process.env.PRINTFUL_API_KEY
    });

      console.log('PRINTFUL_API_KEY exists?', !!process.env.PRINTFUL_API_KEY);
          console.log('Full request body:', {
            external_product_id: String(externalProductId),
            external_customer_id: String(externalCustomerId || 'guest'),
            origin
          });

    const response = await fetch('https://api.printful.com/embedded-designer/nonces', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        external_product_id: String(externalProductId),
        external_customer_id: String(externalCustomerId || 'guest'),
        origin: origin,
      }),
    });

    const data = await response.json();
    
console.log('📦 Printful full response:', JSON.stringify(data, null, 2));
    console.log('Response status:', response.status, 'ok:', response.ok);
    
    if (!response.ok) {
      console.error('❌ Printful API failed:', data);
      return NextResponse.json({ error: data.error?.message || 'Printful API failed' }, { status: 400 });
    }

    const token = data.result?.nonce?.nonce;
    if (!token) {
      console.error('❌ No token in response. Full data:', JSON.stringify(data, null, 2));
      return NextResponse.json({ error: 'Invalid Printful response format' }, { status: 500 });
    }

    console.log('✅ Nonce OK:', token.substring(0, 10) + '...');
    return NextResponse.json({ nonce: token, origin });
    
  } catch (error) {
    console.error('❌ Nonce API CRASH:', error);  // ← This is your 500!
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
