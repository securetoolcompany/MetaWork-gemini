import { getDatabase } from './mongodb.js';

export const REVENUE_POOL_CLAIM_RECEIPTS_COLLECTION =
  'revenue_pool_claim_receipts';

export function normalizeRevenuePoolClaimReceipt({
  appId,
  poolKey,
  roundId,
  claimerAddress,
  amountUsdcAtomicUnits,
  roundCreated,
  claimTransactionId,
  claimedAt = new Date(),
}) {
  const normalizedAppId = Number(appId);
  const normalizedRoundId = Number(roundId);
  const normalizedAmount = Number(amountUsdcAtomicUnits);
  const normalizedPoolKey = String(poolKey || '').trim();
  const normalizedClaimerAddress = String(claimerAddress || '')
    .trim()
    .toUpperCase();
  const normalizedClaimTransactionId = String(
    claimTransactionId || '',
  ).trim();

  if (!Number.isSafeInteger(normalizedAppId) || normalizedAppId < 1) {
    throw new TypeError('appId must be a positive safe integer');
  }

  if (!normalizedPoolKey) {
    throw new TypeError('poolKey must be a non-empty string');
  }

  if (!Number.isSafeInteger(normalizedRoundId) || normalizedRoundId < 1) {
    throw new TypeError('roundId must be a positive safe integer');
  }

  if (
    !Number.isSafeInteger(normalizedAmount) ||
    normalizedAmount < 1
  ) {
    throw new TypeError(
      'amountUsdcAtomicUnits must be a positive safe integer',
    );
  }

  if (!normalizedClaimerAddress) {
    throw new TypeError('claimerAddress must be a non-empty string');
  }

  if (!normalizedClaimTransactionId) {
    throw new TypeError(
      'claimTransactionId must be a non-empty string',
    );
  }

  return {
    appId: normalizedAppId,
    poolKey: normalizedPoolKey,
    roundId: normalizedRoundId,
    claimerAddress: normalizedClaimerAddress,
    amountUsdcAtomicUnits: normalizedAmount,
    roundCreated:
        Number.isSafeInteger(Number(roundCreated)) &&
        Number(roundCreated) > 0
            ? Number(roundCreated)
            : null,
    claimTransactionId: normalizedClaimTransactionId,
    claimedAt: new Date(claimedAt),
  };
}

export async function upsertRevenuePoolClaimReceipt(receipt) {
  const normalized = normalizeRevenuePoolClaimReceipt(receipt);
  const db = await getDatabase();
  const collection = db.collection(
    REVENUE_POOL_CLAIM_RECEIPTS_COLLECTION,
  );
  const now = new Date();

  await collection.updateOne(
    {
      appId: normalized.appId,
      poolKey: normalized.poolKey,
      roundId: normalized.roundId,
      claimerAddress: normalized.claimerAddress,
    },
    {
      $set: {
        amountUsdcAtomicUnits: normalized.amountUsdcAtomicUnits,
        roundCreated: normalized.roundCreated,
        claimTransactionId: normalized.claimTransactionId,
        claimedAt: normalized.claimedAt,
        updatedAt: now,
      },
      $setOnInsert: {
        appId: normalized.appId,
        poolKey: normalized.poolKey,
        roundId: normalized.roundId,
        claimerAddress: normalized.claimerAddress,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return normalized;
}

export async function getRevenuePoolClaimHistory({
  appId,
  poolKey,
  claimerAddress,
}) {
  const db = await getDatabase();
  const collection = db.collection(
    REVENUE_POOL_CLAIM_RECEIPTS_COLLECTION,
  );

  return collection
    .find({
      appId: Number(appId),
      poolKey: String(poolKey || '').trim(),
      claimerAddress: String(claimerAddress || '').trim().toUpperCase(),
    })
    .sort({ roundId: -1, claimedAt: -1 })
    .project({
      _id: 0,
      roundId: 1,
      amountUsdcAtomicUnits: 1,
      roundCreated: 1,
      claimTransactionId: 1,
      claimedAt: 1,
    })
    .toArray();
}