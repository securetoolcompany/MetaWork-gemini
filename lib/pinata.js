const IP_UPLOAD_PURPOSES = new Set([
  'source',
  'display_thumbnail',
]);

function requireBindingString(value, name) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 128 ||
    value.trim() !== value
  ) {
    throw new TypeError(`${name} must be a nonempty bounded string`);
  }

  return value;
}

export function createIpUploadBinding({
  authorizationId,
  operationRevision,
  purpose,
  bindingNonce,
}) {
  if (!IP_UPLOAD_PURPOSES.has(purpose)) {
    throw new TypeError('Unsupported IP upload purpose');
  }

  if (
    typeof bindingNonce !== 'string' ||
    !/^[a-f0-9]{64}$/.test(bindingNonce)
  ) {
    throw new TypeError('bindingNonce must be 32 random bytes as hex');
  }

  return Object.freeze({
    mw_binding_version: '1',
    mw_authorization: requireBindingString(
      authorizationId,
      'authorizationId',
    ),
    mw_revision: requireBindingString(
      operationRevision,
      'operationRevision',
    ),
    mw_purpose: purpose,
    mw_binding: bindingNonce,
  });
}

export function assertIpUploadBinding(providerKeyvalues, authorization) {
  const expected = createIpUploadBinding(authorization);

  if (
    !providerKeyvalues ||
    typeof providerKeyvalues !== 'object' ||
    Array.isArray(providerKeyvalues)
  ) {
    throw new Error('IP upload binding verification failed');
  }

  for (const [key, value] of Object.entries(expected)) {
    if (
      !Object.prototype.hasOwnProperty.call(providerKeyvalues, key) ||
      providerKeyvalues[key] !== value
    ) {
      throw new Error('IP upload binding verification failed');
    }
  }

  return true;
}

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
const IP_PINATA_RESPONSE_LIMIT = 64 * 1024;
const IP_PINATA_TIMEOUT_MS = 10_000;

function requireIpPinataId(value, name) {
  if (
    typeof value !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(value)
  ) {
    throw new TypeError(`${name} is invalid`);
  }

  return value;
}

async function requestIpPinataJson(url, init, dependencies) {
  const fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  const jwt = dependencies.jwt ?? process.env.PINATA_JWT;

  if (typeof jwt !== 'string' || !jwt.trim()) {
    throw new Error('Pinata service is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    IP_PINATA_TIMEOUT_MS,
  );

  let reader;

  try {
    const response = await fetchImpl(url, {
      ...init,
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok || !response.body) {
      throw new Error('Provider request failed');
    }

    const declaredLength = response.headers.get('content-length');

    if (
      declaredLength !== null &&
      (
        !/^\d+$/.test(declaredLength) ||
        Number(declaredLength) > IP_PINATA_RESPONSE_LIMIT
      )
    ) {
      throw new Error('Provider response too large');
    }

    reader = response.body.getReader();
    const chunks = [];
    let length = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      length += value.byteLength;

      if (length > IP_PINATA_RESPONSE_LIMIT) {
        throw new Error('Provider response too large');
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(length);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    );
  } catch {
    // Never expose provider bodies, signed URLs, JWTs or binding values.
    throw new Error('Pinata provider request failed');
  } finally {
    clearTimeout(timeout);
    controller.abort();

    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // Cleanup must not replace the sanitized error.
      }
    }
  }
}

export async function createIpSignedUpload(
  authorization,
  dependencies = {},
) {
  const keyvalues = createIpUploadBinding(authorization);
  const { maxBytes, expiresSeconds, allowedMimeTypes } = authorization;

  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer');
  }

  if (
    !Number.isSafeInteger(expiresSeconds) ||
    expiresSeconds <= 0 ||
    expiresSeconds > 900
  ) {
    throw new TypeError('expiresSeconds must be between 1 and 900');
  }

  if (
    !Array.isArray(allowedMimeTypes) ||
    allowedMimeTypes.length === 0 ||
    allowedMimeTypes.length > 16 ||
    allowedMimeTypes.some(value =>
      typeof value !== 'string' ||
      value.length > 128 ||
      !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+*-]+$/i.test(value)
    )
  ) {
    throw new TypeError('allowedMimeTypes must be a bounded MIME list');
  }

  const now = dependencies.now || Date.now;
  const date = Math.floor(now() / 1000);

  if (!Number.isSafeInteger(date) || date < 0) {
    throw new TypeError('Signing date is invalid');
  }

  const payload = {
    date,
    expires: expiresSeconds,
    max_file_size: maxBytes,
    allow_mime_types: [...allowedMimeTypes],
    keyvalues,
    cid_version: 'v1',
  };

  if (authorization.groupId !== undefined) {
    payload.group_id = requireIpPinataId(
      authorization.groupId,
      'groupId',
    );
  }

  const response = await requestIpPinataJson(
    'https://uploads.pinata.cloud/v3/files/sign',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    dependencies,
  );

  let signedUrl;

  try {
    signedUrl = new URL(response.data);
  } catch {
    throw new Error('Pinata returned an invalid upload capability');
  }

  if (
    signedUrl.origin !== 'https://uploads.pinata.cloud' ||
    signedUrl.pathname !== '/v3/files' ||
    signedUrl.username ||
    signedUrl.password ||
    signedUrl.hash
  ) {
    throw new Error('Pinata returned an invalid upload capability');
  }

  return {
    uploadUrl: signedUrl.href,
    expiresAt: new Date((date + expiresSeconds) * 1000).toISOString(),
  };
}

export async function verifyIpUploadReceipt(
  { authorization, providerFileId, network },
  dependencies = {},
) {
  requireIpPinataId(providerFileId, 'providerFileId');

  if (!['public', 'private'].includes(network)) {
    throw new TypeError('An explicit storage network is required');
  }

  if (
    !Number.isSafeInteger(authorization.maxBytes) ||
    authorization.maxBytes <= 0
  ) {
    throw new TypeError('maxBytes must be a positive safe integer');
  }

  // Validate expected binding before any provider request.
  createIpUploadBinding(authorization);

  const response = await requestIpPinataJson(
    `https://api.pinata.cloud/v3/files/${network}/${providerFileId}`,
    { method: 'GET' },
    dependencies,
  );

  const file = response?.data;

  if (
    !file ||
    typeof file !== 'object' ||
    Array.isArray(file) ||
    file.id !== providerFileId ||
    typeof file.cid !== 'string' ||
    !/^[a-zA-Z0-9]{20,200}$/.test(file.cid) ||
    !Number.isSafeInteger(file.size) ||
    file.size <= 0 ||
    file.size > authorization.maxBytes ||
    file.number_of_files !== 1 ||
    typeof file.mime_type !== 'string' ||
    file.mime_type.length > 128 ||
    typeof file.created_at !== 'string' ||
    !Number.isFinite(Date.parse(file.created_at))
  ) {
    throw new Error('Pinata upload receipt verification failed');
  }

  if (
    authorization.groupId !== undefined &&
    file.group_id !== authorization.groupId
  ) {
    throw new Error('Pinata upload receipt verification failed');
  }

  assertIpUploadBinding(file.keyvalues, authorization);

  return Object.freeze({
    provider: 'pinata',
    providerFileId: file.id,
    network,
    cid: file.cid,
    providerSize: file.size,
    providerMimeType: file.mime_type,
    providerNumberOfFiles: file.number_of_files,
    providerGroupId:
      typeof file.group_id === 'string' ? file.group_id : null,
    providerCreatedAt: file.created_at,
    authorizationId: authorization.authorizationId,
    operationRevision: authorization.operationRevision,
    purpose: authorization.purpose,
    verificationMethod: 'pinata_authenticated_file_lookup',
  });
}
