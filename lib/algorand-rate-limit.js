/**
 * lib/algorand-rate-limit.js
 * Keep outbound Tatum/Algod HTTP calls under 3 req/s.
 */

const _cache = new Map();
const _inFlight = new Map();

const ACCOUNT_TTL_MS = 45_000;
const TX_PARAMS_TTL_MS = 20_000;
const POOL_BOX_TTL_MS = 45_000;

function cacheSet(key, value, ttlMs) {
  _cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }

  return entry.value;
}

async function getOrLoad(key, ttlMs, loader) {
  const cached = cacheGet(key);
  if (cached) return cached;

  const existingPromise = _inFlight.get(key);
  if (existingPromise) {
    return await existingPromise;
  }

  const promise = (async () => {
    try {
      const value = await loader();
      cacheSet(key, value, ttlMs);
      return value;
    } finally {
      _inFlight.delete(key);
    }
  })();

  _inFlight.set(key, promise);
  return await promise;
}

export function invalidateAccountCache(address) {
  const normalized = String(address || '').trim().toUpperCase();
  const key = `acct:${normalized}`;
  _cache.delete(key);
  _inFlight.delete(key);
}

export function invalidatePoolBoxCache(appId, cacheKeyPart) {
  const key = `poolbox:${appId}:${cacheKeyPart}`;
  _cache.delete(key);
  _inFlight.delete(key);
}

export function invalidateTxParamsCache() {
  _cache.delete('txparams');
  _inFlight.delete('txparams');
}

export async function getCachedAccountInfo(algodClient, address) {
  const normalized = String(address || '').trim().toUpperCase();
  const key = `acct:${normalized}`;

  return await getOrLoad(key, ACCOUNT_TTL_MS, async () => {
    return await algodClient.accountInformation(normalized).do();
  });
}

export async function getCachedTxParams(algodClient) {
  return await getOrLoad('txparams', TX_PARAMS_TTL_MS, async () => {
    return await algodClient.getTransactionParams().do();
  });
}

export async function getCachedPoolBox(algodClient, appId, boxName, cacheKeyPart) {
  const key = `poolbox:${appId}:${cacheKeyPart}`;

  return await getOrLoad(key, POOL_BOX_TTL_MS, async () => {
    return await algodClient.getApplicationBoxByName(appId, boxName).do();
  });
}

const _claimLocks = new Set();

export async function withUserClaimLock(address, fn) {
  const normalized = String(address || '').trim().toUpperCase();

  if (_claimLocks.has(normalized)) {
    throw Object.assign(
      new Error('A claim is already in progress for this wallet. Please wait a moment and retry.'),
      { statusCode: 429, retryable: true }
    );
  }

  _claimLocks.add(normalized);

  try {
    return await fn();
  } finally {
    _claimLocks.delete(normalized);
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}