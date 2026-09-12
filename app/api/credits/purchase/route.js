import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const disabledResponse = {
  success: false,
  error:
    'Algorand USDC credit purchases are not available yet. Credits cannot currently be purchased with cryptocurrency.',
  code: 'CRYPTO_CREDIT_PURCHASES_DISABLED',
};

export async function POST() {
  return NextResponse.json(disabledResponse, { status: 503 });
}