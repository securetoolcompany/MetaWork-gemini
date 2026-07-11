import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const res = await fetch('https://api.pinata.cloud/v3/pinata/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: JSON.stringify({
        keyName: `upload-${Date.now()}`,
        permissions: { endpoints: { pinning: { pinFileToIPFS: true } } },
        maxUses: 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.details || 'Key generation failed');
    return NextResponse.json({ JWT: data.JWT });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}