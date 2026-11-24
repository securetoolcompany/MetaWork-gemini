import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ipPreparationError } from './tokenization-reservation.js';

const LIMIT = 256 * 1024;
const API = 'https://api.pinata.cloud';
const cidPattern = /^[a-zA-Z0-9]{20,200}$/;

function check(request) {
  if (
    !/^[a-f0-9]{64}$/.test(request?.correlation || '') ||
    createHash('sha256').update(JSON.stringify(request.metadata)).digest('base64') !== request.metadataHash
  ) throw ipPreparationError('IP_PREPARATION_METADATA_BINDING_INVALID');
}

async function jsonRequest(url, init, { fetchImpl = globalThis.fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let reader;
  try {
    const response = await fetchImpl(url, {
      ...init, signal: controller.signal, redirect: 'error', cache: 'no-store',
    });
    if (!response.ok || !response.body) throw new Error('Provider request failed');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > LIMIT)) {
      throw new Error('Provider response too large');
    }
    reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) throw new Error('Provider response too large');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw ipPreparationError('IP_PREPARATION_METADATA_RECOVERY_REQUIRED');
  } finally {
    controller.abort();
    clearTimeout(timeout);
    if (reader) { try { await reader.cancel(); } catch {} }
  }
}

function headers(dependencies) {
  const jwt = dependencies.jwt ?? process.env.PINATA_JWT;
  if (typeof jwt !== 'string' || !jwt.trim()) {
    throw ipPreparationError('IP_PREPARATION_METADATA_RECOVERY_REQUIRED');
  }
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

function keyvalues(request) {
  return { mw_preparation: request.correlation, mw_metadata_sha256: request.metadataHash };
}

export async function uploadIpPreparationMetadata(request, dependencies = {}) {
  check(request);
  const response = await jsonRequest(`${API}/pinning/pinJSONToIPFS`, {
    method: 'POST', headers: headers(dependencies),
    body: JSON.stringify({
      pinataContent: request.metadata,
      pinataMetadata: { name: request.correlation, keyvalues: keyvalues(request) },
      pinataOptions: { cidVersion: 1 },
    }),
  }, dependencies);
  if (!cidPattern.test(response?.IpfsHash || '')) {
    throw ipPreparationError('IP_PREPARATION_METADATA_RECOVERY_REQUIRED');
  }
  return { ipfsUrl: `ipfs://${response.IpfsHash}` };
}

export async function reconcileIpPreparationMetadata(request, dependencies = {}) {
  check(request);
  const url = new URL(`${API}/data/pinList`);
  url.searchParams.set('status', 'pinned');
  url.searchParams.set('pageLimit', '2');
  url.searchParams.set('pageOffset', '0');
  url.searchParams.set('includeCount', 'true');
  url.searchParams.set('metadata', JSON.stringify({ name: request.correlation }));
  const result = await jsonRequest(url.href, {
    method: 'GET', headers: headers(dependencies),
  }, dependencies);
  // Zero, multiple, truncated or unfamiliar results remain unresolved. No upload.
  if (result?.count !== 1 || !Array.isArray(result.rows) || result.rows.length !== 1) {
    throw ipPreparationError('IP_PREPARATION_METADATA_RECOVERY_REQUIRED');
  }
  const row = result.rows[0];
  if (
    row.metadata?.name !== request.correlation ||
    !isDeepStrictEqual(row.metadata?.keyvalues, keyvalues(request)) ||
    !cidPattern.test(row.ipfs_pin_hash || '') || row.date_unpinned
  ) throw ipPreparationError('IP_PREPARATION_METADATA_RECOVERY_REQUIRED');
  // The bearer token is deliberately never forwarded to a content gateway.
  const content = await jsonRequest(
    `https://gateway.pinata.cloud/ipfs/${row.ipfs_pin_hash}`,
    { method: 'GET' }, dependencies,
  );
  if (!isDeepStrictEqual(content, request.metadata)) {
    throw ipPreparationError('IP_PREPARATION_METADATA_RECOVERY_REQUIRED');
  }
  return { ipfsUrl: `ipfs://${row.ipfs_pin_hash}` };
}
