// lib/tokenized-funds/nillion/principal-performance.js

const PRICE_SCALE = 10n ** 18n;
const BPS = 10_000n;

// USD values are returned in millionths of a dollar.
const USD_DECIMALS = 6;

function readPrincipal(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(
      'Original principal must be a non-negative integer base-unit string.',
    );
  }

  return BigInt(value);
}

function readPrice(value, field) {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a positive price string.`);
  }

  const match = value.match(
    /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/,
  );

  if (!match) {
    throw new Error(`${field} must be a positive price string.`);
  }

  const whole = match[1];
  const fraction = match[2] ?? '';
  const exponent = Number(match[3] ?? '0');

  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) {
    throw new Error(`${field} has an unsupported exponent.`);
  }

  const coefficient = BigInt(`${whole}${fraction}`);
  const shift = 18 + exponent - fraction.length;

  // Prices are represented at 18 decimal places.
  // Any additional decimal places are truncated.
  const scaled =
    shift >= 0
      ? coefficient * 10n ** BigInt(shift)
      : coefficient / 10n ** BigInt(-shift);

  if (scaled <= 0n) {
    throw new Error(
      `${field} must be positive and representable at 18 decimal places.`,
    );
  }

  return scaled;
}

export function calculateNillionPrincipalPerformance({
  originalStakeBaseUnits,
  baselinePriceUsd,
  currentPriceUsd,
}) {
  const principal = readPrincipal(originalStakeBaseUnits);

  const baselinePrice = readPrice(
    baselinePriceUsd,
    'baselinePriceUsd',
  );

  const currentPrice = readPrice(
    currentPriceUsd,
    'currentPriceUsd',
  );

  // NIL principal uses 6 decimals, and USD output also uses
  // 6 decimals, so only the price scale remains in the divisor.
  const startingValueUsdAtomic =
    (principal * baselinePrice) / PRICE_SCALE;

  const currentValueUsdAtomic =
    (principal * currentPrice) / PRICE_SCALE;

  const appreciationUsdAtomic =
    currentValueUsdAtomic - startingValueUsdAtomic;

  // Signed basis points; truncated toward zero.
  const priceReturnBps =
    ((currentPrice - baselinePrice) * BPS) / baselinePrice;

  return {
    currency: 'usd',
    usdDecimals: USD_DECIMALS,

    originalStakeBaseUnits,
    baselinePriceUsd,
    currentPriceUsd,

    startingValueUsdAtomic: startingValueUsdAtomic.toString(),
    currentValueUsdAtomic: currentValueUsdAtomic.toString(),
    appreciationUsdAtomic: appreciationUsdAtomic.toString(),
    priceReturnBps: priceReturnBps.toString(),

    direction:
      currentPrice > baselinePrice
        ? 'gain'
        : currentPrice < baselinePrice
          ? 'loss'
          : 'unchanged',

    includesRewardTokens: false,
  };
}