import algosdk from 'algosdk';
import crypto from 'node:crypto';

export const V10_TOTAL_REV_UNITS = 10_000n;
export const DEFAULT_MAX_INDEXER_LAG_ROUNDS = 2;

export class V10HolderSnapshotError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'V10HolderSnapshotError';
    this.code = code || 'V10_HOLDER_SNAPSHOT_ERROR';
  }
}

export class V10HolderSnapshotValidationError extends V10HolderSnapshotError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'V10_HOLDER_SNAPSHOT_VALIDATION_ERROR',
    });
    this.name = 'V10HolderSnapshotValidationError';
  }
}

export class V10HolderSnapshotNetworkError extends V10HolderSnapshotError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'V10_HOLDER_SNAPSHOT_NETWORK_ERROR',
    });
    this.name = 'V10HolderSnapshotNetworkError';
  }
}

export class V10HolderSnapshotFreshnessError extends V10HolderSnapshotError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'V10_HOLDER_SNAPSHOT_STALE',
    });
    this.name = 'V10HolderSnapshotFreshnessError';
  }
}

function assertPositiveSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new V10HolderSnapshotValidationError(
      `${fieldName} must be a positive safe integer`,
      { code: 'INVALID_INPUT' },
    );
  }

  return value;
}

function assertNonNegativeSafeInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new V10HolderSnapshotValidationError(
      `${fieldName} must be a non-negative safe integer`,
      { code: 'INVALID_INPUT' },
    );
  }

  return value;
}

function assertIndexerClient(indexerClient) {
  if (
    !indexerClient ||
    typeof indexerClient.lookupAssetBalances !== 'function'
  ) {
    throw new V10HolderSnapshotValidationError(
      'indexerClient must provide lookupAssetBalances(assetId)',
      { code: 'INVALID_INDEXER_CLIENT' },
    );
  }
}

function assertAlgodClient(algodClient) {
  if (!algodClient || typeof algodClient.status !== 'function') {
    throw new V10HolderSnapshotValidationError(
      'algodClient must provide status()',
      { code: 'INVALID_ALGOD_CLIENT' },
    );
  }
}

function toBigIntAmount(value, fieldName) {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new V10HolderSnapshotValidationError(
        `${fieldName} must be a non-negative integer`,
        { code: 'INVALID_BALANCE' },
      );
    }

    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new V10HolderSnapshotValidationError(
        `${fieldName} must be a non-negative safe integer`,
        { code: 'INVALID_BALANCE' },
      );
    }

    return BigInt(value);
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value);
  }

  throw new V10HolderSnapshotValidationError(
    `${fieldName} must be a non-negative integer`,
    { code: 'INVALID_BALANCE' },
  );
}

function toSafeRound(value, fieldName) {
  const round = toBigIntAmount(value, fieldName);

  if (round > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new V10HolderSnapshotValidationError(
      `${fieldName} exceeds Number.MAX_SAFE_INTEGER`,
      { code: 'UNSAFE_ROUND' },
    );
  }

  return Number(round);
}

function getIndexerRound(response) {
  const round =
    response?.currentRound ??
    response?.['current-round'] ??
    response?.round ??
    response?.['round'];

  if (round === undefined || round === null) {
    return null;
  }

  return toSafeRound(round, 'indexer response round');
}

function getAlgodRound(response) {
  const round =
    response?.lastRound ??
    response?.['last-round'] ??
    response?.round ??
    response?.['round'];

  if (round === undefined || round === null) {
    throw new V10HolderSnapshotValidationError(
      'algod status response is missing last-round',
      { code: 'MISSING_ALGOD_ROUND' },
    );
  }

  return toSafeRound(round, 'algod status round');
}

function getNextToken(response) {
  const token =
    response?.nextToken ??
    response?.['next-token'] ??
    response?.next;

  if (token === undefined || token === null || token === '') {
    return null;
  }

  if (typeof token !== 'string') {
    throw new V10HolderSnapshotValidationError(
      'indexer next-token must be a string',
      { code: 'INVALID_PAGINATION_TOKEN' },
    );
  }

  return token;
}

function getBalances(response) {
  const balances = response?.balances;

  if (!Array.isArray(balances)) {
    throw new V10HolderSnapshotValidationError(
      'indexer asset balance response must contain a balances array',
      { code: 'INVALID_INDEXER_RESPONSE' },
    );
  }

  return balances;
}

function decodeAndNormalizeAddress(address, fieldName) {
  if (typeof address !== 'string' || !address.trim()) {
    throw new V10HolderSnapshotValidationError(
      `${fieldName} must be a non-empty Algorand address`,
      { code: 'INVALID_ADDRESS' },
    );
  }

  const normalized = address.trim();

  if (!algosdk.isValidAddress(normalized)) {
    throw new V10HolderSnapshotValidationError(
      `${fieldName} is not a valid Algorand address`,
      { code: 'INVALID_ADDRESS' },
    );
  }

  return {
    address: normalized,
    addressBytes: Buffer.from(algosdk.decodeAddress(normalized).publicKey),
  };
}

function compareAddressBytes(left, right) {
  return Buffer.compare(left.addressBytes, right.addressBytes);
}

function canonicalHolderPayload(entries) {
  return Buffer.concat(
    entries.map((entry) => {
      const amountBytes = Buffer.alloc(8);
      amountBytes.writeBigUInt64BE(BigInt(entry.revUnits));

      return Buffer.concat([entry.addressBytes, amountBytes]);
    }),
  );
}

function canonicalHash(entries) {
  return `sha256:${crypto
    .createHash('sha256')
    .update(canonicalHolderPayload(entries))
    .digest('hex')}`;
}

async function fetchAllAssetBalances({ indexerClient, revenueTokenAssetId }) {
  const entries = [];
  const seenAddresses = new Set();
  let nextToken = null;
  let indexerRound = null;

  do {
    let request;

    try {
      request = indexerClient.lookupAssetBalances(revenueTokenAssetId);
    } catch (cause) {
      throw new V10HolderSnapshotNetworkError(
        `Unable to create Indexer holder lookup for asset ${revenueTokenAssetId}`,
        { code: 'INDEXER_REQUEST_BUILD_FAILED', cause },
      );
    }

    if (!request || typeof request.do !== 'function') {
      throw new V10HolderSnapshotValidationError(
        'indexerClient.lookupAssetBalances(assetId) must return an object with do()',
        { code: 'INVALID_INDEXER_CLIENT' },
      );
    }

    if (nextToken !== null) {
      if (typeof request.nextToken !== 'function') {
        throw new V10HolderSnapshotValidationError(
          'indexer holder lookup request must provide nextToken(token) for pagination',
          { code: 'UNSUPPORTED_INDEXER_PAGINATION' },
        );
      }

      request = request.nextToken(nextToken);
    }

    let response;

    try {
      response = await request.do();
    } catch (cause) {
      throw new V10HolderSnapshotNetworkError(
        `Unable to read current holders for REV asset ${revenueTokenAssetId}`,
        { code: 'INDEXER_LOOKUP_FAILED', cause },
      );
    }

    const pageRound = getIndexerRound(response);

    if (pageRound !== null) {
      if (indexerRound !== null && pageRound !== indexerRound) {
        throw new V10HolderSnapshotFreshnessError(
          'Indexer pagination returned inconsistent response rounds; retry the holder snapshot',
          { code: 'INDEXER_PAGINATION_ROUND_CHANGED' },
        );
      }

      indexerRound = pageRound;
    }

    for (const [index, balance] of getBalances(response).entries()) {
      const { address, addressBytes } = decodeAndNormalizeAddress(
        balance?.address,
        `balances[${index}].address`,
      );
      const revUnits = toBigIntAmount(
        balance?.amount,
        `balances[${index}].amount`,
      );

      if (revUnits === 0n) {
        continue;
      }

      if (seenAddresses.has(address)) {
        throw new V10HolderSnapshotValidationError(
          `Indexer returned duplicate nonzero REV holder ${address}`,
          { code: 'DUPLICATE_HOLDER' },
        );
      }

      seenAddresses.add(address);
      entries.push({ address, addressBytes, revUnits });
    }

    nextToken = getNextToken(response);
  } while (nextToken !== null);

  if (indexerRound === null) {
    throw new V10HolderSnapshotFreshnessError(
      'Indexer holder response did not provide a current round',
      { code: 'MISSING_INDEXER_ROUND' },
    );
  }

  return { entries, indexerRound };
}

async function readAlgodStatusRound(algodClient) {
  let response;

  try {
    response = await algodClient.status().do();
  } catch (cause) {
    throw new V10HolderSnapshotNetworkError(
      'Unable to read Algod network status for holder snapshot freshness',
      { code: 'ALGOD_STATUS_FAILED', cause },
    );
  }

  return getAlgodRound(response);
}

function freezeEntry(entry) {
  return Object.freeze({
    address: entry.address,
    revUnits: entry.revUnits.toString(),
  });
}

/**
 * Captures the current nonzero holders of a V10 pool's REV ASA.
 *
 * This function does not determine the revenue amount. Callers must provide
 * an already-frozen batch amount separately when deriving V10 round payees.
 *
 * The returned snapshot is a one-time eligibility input: persist it before
 * broadcasting the matching USDC deposit, and never re-query holders for the
 * same settlement batch.
 */
export async function snapshotV10RevenueTokenHolders({
  indexerClient,
  algodClient,
  revenueTokenAssetId,
  expectedTotalRevUnits = V10_TOTAL_REV_UNITS,
  maxIndexerLagRounds = DEFAULT_MAX_INDEXER_LAG_ROUNDS,
}) {
  assertIndexerClient(indexerClient);
  assertAlgodClient(algodClient);

  const assetId = assertPositiveSafeInteger(
    revenueTokenAssetId,
    'revenueTokenAssetId',
  );
  const expectedTotal = toBigIntAmount(
    expectedTotalRevUnits,
    'expectedTotalRevUnits',
  );
  const maxLag = assertNonNegativeSafeInteger(
    maxIndexerLagRounds,
    'maxIndexerLagRounds',
  );

  if (expectedTotal < 1n) {
    throw new V10HolderSnapshotValidationError(
      'expectedTotalRevUnits must be greater than zero',
      { code: 'INVALID_EXPECTED_TOTAL' },
    );
  }

  const [{ entries, indexerRound }, algodStatusRound] = await Promise.all([
    fetchAllAssetBalances({
      indexerClient,
      revenueTokenAssetId: assetId,
    }),
    readAlgodStatusRound(algodClient),
  ]);

  const indexerLagRounds = algodStatusRound - indexerRound;

  if (indexerLagRounds < 0) {
    throw new V10HolderSnapshotFreshnessError(
      `Indexer round ${indexerRound} is ahead of Algod status round ${algodStatusRound}`,
      { code: 'INDEXER_AHEAD_OF_ALGOD' },
    );
  }

  if (indexerLagRounds > maxLag) {
    throw new V10HolderSnapshotFreshnessError(
      `Indexer is ${indexerLagRounds} rounds behind Algod; maximum allowed lag is ${maxLag}`,
      { code: 'INDEXER_TOO_STALE' },
    );
  }

  entries.sort(compareAddressBytes);

  const totalRevUnits = entries.reduce(
    (sum, entry) => sum + entry.revUnits,
    0n,
  );

  if (totalRevUnits !== expectedTotal) {
    throw new V10HolderSnapshotValidationError(
      `REV holder total ${totalRevUnits} does not equal expected total ${expectedTotal}`,
      { code: 'REV_SUPPLY_MISMATCH' },
    );
  }

  if (entries.length === 0) {
    throw new V10HolderSnapshotValidationError(
      'REV holder snapshot must contain at least one nonzero holder',
      { code: 'NO_NONZERO_HOLDERS' },
    );
  }

  const capturedAt = new Date().toISOString();
  const frozenEntries = Object.freeze(entries.map(freezeEntry));

  return Object.freeze({
    assetId,
    expectedTotalRevUnits: expectedTotal.toString(),
    totalRevUnits: totalRevUnits.toString(),
    capturedAt,
    indexerRound,
    algodStatusRound,
    indexerLagRounds,
    entries: frozenEntries,
    canonicalHash: canonicalHash(entries),
  });
}