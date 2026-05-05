const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

/**
 * Upload a file to IPFS via Pinata
 * @param {Buffer|Blob} fileBuffer - The file data
 * @param {string} fileName - Name of the file
 * @param {object} metadata - Optional metadata for the pin
 * @returns {Promise<{ipfsHash: string, ipfsUrl: string}>}
 */
export async function uploadFileToPinata(fileBuffer, fileName, metadata = {}) {
  // 1. Debugging: Check what the server actually sees
  console.log("--- Pinata Debug Log ---");
  console.log("Buffer size:", fileBuffer.length);
  console.log("JWT present:", !!process.env.PINATA_JWT);
  console.log("Using Gateway:", process.env.PINATA_GATEWAY);

  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append('file', blob, fileName);
  
  formData.append('pinataMetadata', JSON.stringify({
    name: fileName,
    keyvalues: metadata
  }));
  
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
  
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      // Use JWT for more reliable authentication
      'Authorization': `Bearer ${process.env.PINATA_JWT}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Pinata API Detailed Error:", errorText);
    throw new Error(`Pinata upload failed: ${errorText}`);
  }
  
  const result = await response.json();
  console.log("Upload Success! CID:", result.IpfsHash);
  
  return {
    ipfsHash: result.IpfsHash,
    // Use the Gateway from your .env and ensure it handles the slash correctly
    ipfsUrl: `${process.env.PINATA_GATEWAY}/${result.IpfsHash}`
  };
}

/**
 * Upload JSON metadata to IPFS via Pinata
 * @param {object} jsonData - The JSON data to upload
 * @param {string} name - Name for the pin
 * @returns {Promise<{ipfsHash: string, ipfsUrl: string}>}
 */
export async function uploadJsonToPinata(jsonData, name) {
  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PINATA_JWT}` 
    },
    body: JSON.stringify({
      pinataContent: jsonData,
      pinataMetadata: { name: name },
      pinataOptions: { cidVersion: 1 }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinata JSON upload failed: ${error}`);
  }
  
  const result = await response.json();
  
  return {
    ipfsHash: result.IpfsHash,
    ipfsUrl: `${process.env.PINATA_GATEWAY}/${result.IpfsHash}`,
    publicIpfsUrl: `ipfs://${result.IpfsHash}`
  };
}

/**
 * Create ARC-3 compliant NFT metadata
 * @param {object} params - NFT parameters
 * @returns {object} ARC-3 metadata
 */
// lib/pinata.js

export function createARC3Metadata({ 
  name, 
  description, 
  imageUrl, 
  ipAssetId,
  category,
  creator,
  ...otherData
}) {
  const isProduct = otherData?.isProduct || !!otherData?.baseProduct;
  const path = isProduct ? 'showroom/product' : 'vault';
  const imageHttpUrl = imageUrl.startsWith('ipfs://')
    ? `https://gateway.pinata.cloud/ipfs/${imageUrl.replace('ipfs://', '')}`
    : imageUrl;

  return {
    name,
    description,
    image: imageHttpUrl,
    image_mimetype: 'image/png',
    external_url: `${process.env.NEXT_PUBLIC_BASE_URL}/${path}/${ipAssetId}`,
    properties: {
      category,
      creator,
      ...otherData, // Spreads them flat here
      created_at: new Date().toISOString()
    }
  };
}