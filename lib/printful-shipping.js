import crypto from 'crypto';

const PRINTFUL_SHIPPING_RATES_URL = 'https://api.printful.com/shipping/rates';

function money(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Printful returned an invalid shipping amount.');
  }

  return Math.round(amount * 100) / 100;
}

export function makeFingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

export function normalizeShippingAddress(shippingInfo = {}) {
  return {
    name: String(shippingInfo.name ?? '').trim(),
    address1: String(shippingInfo.address1 ?? '').trim(),
    address2: String(shippingInfo.address2 ?? '').trim(),
    city: String(shippingInfo.city ?? '').trim(),
    state_code: String(shippingInfo.state_code ?? '').trim().toUpperCase(),
    country_code: String(shippingInfo.country_code ?? '').trim().toUpperCase(),
    zip: String(shippingInfo.zip ?? '').trim(),
    phone: String(shippingInfo.phone ?? '').trim(),
    email: String(shippingInfo.email ?? '').trim().toLowerCase(),
  };
}

export function makeAddressFingerprint(address) {
  return makeFingerprint({
    name: address.name,
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    state_code: address.state_code,
    country_code: address.country_code,
    zip: address.zip,
  });
}

function normalizePrintfulRate(rate) {
  return {
    id: String(rate.id ?? rate.shipping ?? rate.name ?? 'STANDARD'),
    name: String(rate.name ?? rate.shipping ?? 'Standard shipping'),
    amount: money(rate.rate ?? rate.price ?? rate.cost),
    currency: String(rate.currency ?? 'USD').toUpperCase(),
    minDeliveryDays: Number.isFinite(Number(rate.minDeliveryDays))
      ? Number(rate.minDeliveryDays)
      : null,
    maxDeliveryDays: Number.isFinite(Number(rate.maxDeliveryDays))
      ? Number(rate.maxDeliveryDays)
      : null,
  };
}

/**
 * Calls Printful only from server code.
 *
 * The established MetaWork Printful integration scopes requests with
 * X-PF-Store-Id. Keep the store ID out of browser code and use the same
 * connected-store context for shipping quotes.
 *
 * items must be:
 * [{ variant_id: Number, quantity: Number }]
 *
 * For this endpoint, variant_id must be the Printful catalog variant ID
 * associated with the synced store variant—not the sync_variant_id itself.
 */
export async function quotePrintfulShipping({ recipient, items }) {
  const apiKey = process.env.PRINTFUL_API_KEY;
  const storeId = process.env.PRINTFUL_STORE_ID;

  if (!apiKey) {
    const error = new Error('PRINTFUL_API_KEY is not configured.');
    error.code = 'PRINTFUL_NOT_CONFIGURED';
    throw error;
  }

  if (!storeId) {
    const error = new Error('PRINTFUL_STORE_ID is not configured.');
    error.code = 'PRINTFUL_STORE_NOT_CONFIGURED';
    throw error;
  }

  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Cannot quote shipping for an empty cart.');
    error.code = 'EMPTY_CART';
    throw error;
  }

  const numericStoreId = Number(storeId);

  if (!Number.isInteger(numericStoreId) || numericStoreId <= 0) {
    const error = new Error('PRINTFUL_STORE_ID must be a positive integer.');
    error.code = 'INVALID_PRINTFUL_STORE_ID';
    throw error;
  }

  const normalizedItems = items.map((item, index) => {
    const variantId = Number(item.variant_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(variantId) || variantId <= 0) {
      const error = new Error(
        `Shipping item ${index + 1} has an invalid Printful catalog variant ID.`
      );
      error.code = 'INVALID_PRINTFUL_VARIANT_ID';
      throw error;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error(
        `Shipping item ${index + 1} has an invalid quantity.`
      );
      error.code = 'INVALID_SHIPPING_QUANTITY';
      throw error;
    }

    return {
      variant_id: variantId,
      quantity,
    };
  });

  const response = await fetch(PRINTFUL_SHIPPING_RATES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',

      // Match lib/printful-sync-product.js exactly.
      'X-PF-Store-Id': String(numericStoreId),
    },
    body: JSON.stringify({
      recipient,
      items: normalizedItems,
    }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ||
        payload?.result ||
        'Printful could not calculate shipping for this destination.'
    );

    error.code = 'PRINTFUL_SHIPPING_RATE_ERROR';
    error.status = response.status;
    error.providerResponse = payload;

    console.error(
      '[printful/shipping-rates] provider response:',
      JSON.stringify(payload, null, 2)
    );

    throw error;
  }

  const providerRates = Array.isArray(payload?.result) ? payload.result : [];
  const rates = providerRates.map(normalizePrintfulRate);

  if (!rates.length) {
    const error = new Error(
      'No shipping methods are available for this cart and destination.'
    );
    error.code = 'NO_SHIPPING_RATES';
    throw error;
  }

  return rates;
}