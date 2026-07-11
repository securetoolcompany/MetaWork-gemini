import { NextResponse } from 'next/server';
import { PinataSDK } from "pinata-web3";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export async function POST(request) {
  try {
    const data = await request.formData();
    const file = data.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // This pins the raw image file to Pinata
    const upload = await pinata.upload.file(file);

    return NextResponse.json({ ipfsHash: upload.IpfsHash });
  } catch (error) {
    console.error("IPFS Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}