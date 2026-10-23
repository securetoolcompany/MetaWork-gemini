// lib/tokenized-funds/nillion/read-price.js

import { NILLION_CONTRACTS } from './config.js';

const API_BASE = 'https://api.coingecko.com/api/v3';

const CACHE_DURATION_MS = 60_000;
const MAX_QUOTE_AGE_SECONDS = 15 * 60;
const MAX_FUTURE_SECONDS = 60;

let cachedQuote = null;
let cachedAt = 0;
let pendingRequest = null;

function validateQuoteTimestamp(timestamp) {
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error('NIL price response has no valid quote timestamp.');
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - timestamp;

  if (ageSeconds > MAX_QUOTE_AGE_SECONDS) {
    throw new Error('The NIL price quote is stale.');
  }

  if (ageSeconds < -MAX_FUTURE_SECONDS) {
    throw new Error('The NIL price quote timestamp is in the future.');
  }
}

async function fetchCurrentPrice() {
  const tokenAddress = NILLION_CONTRACTS.nilToken.toLowerCase();

  const url = new URL(`${API_BASE}/simple/token_price/ethereum`);

  url.searchParams.set('contract_addresses', tokenAddress);
  url.searchParams.set('vs_currencies', 'usd');
  url.searchParams.set('include_last_updated_at', 'true');
  url.searchParams.set('precision', 'full');

  const headers = {
    Accept: 'application/json',
  };

  const apiKey = process.env.COINGECKO_DEMO_API_KEY?.trim();

  if (apiKey) {
    headers['x-cg-demo-api-key'] = apiKey;
  }

  const response = await fetch(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `NIL price lookup failed: HTTP ${response.status}`,
    );
  }

  const body = await response.json();
  const price = body[tokenAddress];

  if (
    !price ||
    typeof price.usd !== 'number' ||
    !Number.isFinite(price.usd) ||
    price.usd <= 0
  ) {
    throw new Error('No valid NIL/USD price was returned.');
  }

  validateQuoteTimestamp(price.last_updated_at);

  return Object.freeze({
    source: 'coingecko',
    currency: 'usd',
    tokenContract: NILLION_CONTRACTS.nilToken,
    priceUsd: String(price.usd),
    quoteTimestamp: String(price.last_updated_at),
    quoteTimeUtc: new Date(
      price.last_updated_at * 1000,
    ).toISOString(),
    fetchedAt: new Date().toISOString(),
  });
}

export async function readNillionPrice() {
  if (
    cachedQuote &&
    Date.now() - cachedAt < CACHE_DURATION_MS
  ) {
    validateQuoteTimestamp(Number(cachedQuote.quoteTimestamp));
    return cachedQuote;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = fetchCurrentPrice()
    .then((quote) => {
      cachedQuote = quote;
      cachedAt = Date.now();
      return quote;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}