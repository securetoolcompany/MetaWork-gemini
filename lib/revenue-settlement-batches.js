// lib/revenue-settlement-batches.js

import { createHash, randomUUID } from 'node:crypto';

export const REVENUE_SETTLEMENT_BATCH_STATUSES = Object.freeze([
  'created',
  'deposit_submitted',
  'deposited',
  'round_created',
  'settled',
  'failed',
]);

const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ROWS_PER_BATCH = 100;

function assertSafeInteger(value, fieldName, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(
      `${fieldName} must be a safe integer greater than or equal to ${minimum}`
    );
  }

  return value;
}

function assertValidDate(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${fieldName} must be a valid date value`);
  }

  return date;
}

function normalizeOptionalOrderId(orderId) {
  if (orderId === null || orderId === undefined) {
    return null;
  }

  const normalizedOrderId = String(orderId).trim();

  if (!normalizedOrderId) {
    throw new TypeError('orderId must be a non-empty string when provided');
  }

  return normalizedOrderId;
}

function getReturnedDocument(result) {
  if (!result) {
    return null;
  }

  return result.value ?? result;
}

function getPoolTarget(row) {
  return {
    revenuePoolAppId: assertSafeInteger(
      row.revenuePoolAppId,
      'row.revenuePoolAppId',
      { minimum: 1 }
    ),
    poolKey: String(row.ipAssetId || '').trim(),
    revenueTokenAssetId: assertSafeInteger(
      row.revenueTokenAssetId,
      'row.revenueTokenAssetId',
      { minimum: 1 }
    ),
  };
}

function assertPoolTarget(target) {
  if (!target.poolKey) {
    throw new TypeError('row.ipAssetId must be a non-empty V7 pool key');
  }

  return target;
}

function createBatchKey({ target, idempotencyKeys }) {
  const sortedKeys = [...idempotencyKeys].sort();
  const hash = createHash('sha256')
    .update(sortedKeys.join('\n'))
    .digest('hex');

  return [
    `app:${target.revenuePoolAppId}`,
    `pool:${target.poolKey}`,
    `token:${target.revenueTokenAssetId}`,
    hash,
  ].join(':');
}

function createClaimFilter({ now, target = null, orderId = null }) {
  const filter = {
    status: 'release_eligible',
    settlementBatchId: null,
    $or: [
      { settlementLeaseId: null },
      { settlementLeaseId: { $exists: false } },
      { settlementLeaseExpiresAt: { $lte: now } },
    ],
  };

  if (orderId) {
    filter.orderId = orderId;
  }

  if (!target) {
    return filter;
  }

  return {
    ...filter,
    revenuePoolAppId: target.revenuePoolAppId,
    ipAssetId: target.poolKey,
    revenueTokenAssetId: target.revenueTokenAssetId,
  };
}

export async function createSettlementBatchFromEligibleRows({
  db,
  orderId = null,
  now = new Date(),
  leaseMs = DEFAULT_LEASE_MS,
  maxRows = DEFAULT_MAX_ROWS_PER_BATCH,
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  const batchNow = assertValidDate(now, 'now');
  const normalizedOrderId = normalizeOptionalOrderId(orderId);
  const normalizedLeaseMs = assertSafeInteger(leaseMs, 'leaseMs', {
    minimum: 1000,
  });
  const normalizedMaxRows = assertSafeInteger(
    maxRows,
    'maxRows',
    { minimum: 1 }
  );

  const revenueLedger = db.collection('revenue_ledger');
  const settlementBatches = db.collection('revenue_settlement_batches');

  const leaseId = randomUUID();
  const leaseExpiresAt = new Date(
    batchNow.getTime() + normalizedLeaseMs
  );

  const firstClaimResult = await revenueLedger.findOneAndUpdate(
    createClaimFilter({
      now: batchNow,
      orderId: normalizedOrderId,
    }),
    {
      $set: {
        settlementLeaseId: leaseId,
        settlementLeaseExpiresAt: leaseExpiresAt,
        updatedAt: batchNow,
      },
    },
    {
      sort: { createdAt: 1, _id: 1 },
      returnDocument: 'after',
    }
  );

  const firstRow = getReturnedDocument(firstClaimResult);

  if (!firstRow) {
    return null;
  }

  const target = assertPoolTarget(getPoolTarget(firstRow));
  const claimedRows = [firstRow];

  while (claimedRows.length < normalizedMaxRows) {
    const claimResult = await revenueLedger.findOneAndUpdate(
      createClaimFilter({
        now: batchNow,
        target,
        orderId: normalizedOrderId,
      }),
      {
        $set: {
          settlementLeaseId: leaseId,
          settlementLeaseExpiresAt: leaseExpiresAt,
          updatedAt: batchNow,
        },
      },
      {
        sort: { createdAt: 1, _id: 1 },
        returnDocument: 'after',
      }
    );

    const claimedRow = getReturnedDocument(claimResult);

    if (!claimedRow) {
      break;
    }

    claimedRows.push(claimedRow);
  }

  const totalAllocationCents = claimedRows.reduce(
    (total, row) => total + assertSafeInteger(
      row.allocationCents,
      'row.allocationCents'
    ),
    0
  );

  const totalUsdcAtomicUnits = claimedRows.reduce(
    (total, row) => total + assertSafeInteger(
      row.usdcAtomicUnits,
      'row.usdcAtomicUnits'
    ),
    0
  );

  if (totalUsdcAtomicUnits !== totalAllocationCents * 10000) {
    throw new Error(
      '[revenue-settlement-batches] Batch USDC total does not reconcile to cents'
    );
  }

  const idempotencyKeys = claimedRows.map((row) => String(row.idempotencyKey));
  const batchKey = createBatchKey({ target, idempotencyKeys });

  const batchDocument = {
    batchKey,
    status: 'created',

    revenuePoolAppId: target.revenuePoolAppId,
    poolKey: target.poolKey,
    revenueTokenAssetId: target.revenueTokenAssetId,

    ledgerRowIds: claimedRows.map((row) => row._id),
    ledgerIdempotencyKeys: [...idempotencyKeys].sort(),

    totalAllocationCents,
    totalUsdcAtomicUnits,

    usdcDepositTxId: null,
    usdcDepositConfirmedAt: null,
    revenueRoundId: null,
    revenueRoundTxId: null,
    revenueRoundCreatedAt: null,

    createdAt: batchNow,
    updatedAt: batchNow,
  };

  const batchResult = await settlementBatches.findOneAndUpdate(
    { batchKey },
    {
      $setOnInsert: batchDocument,
    },
    {
      upsert: true,
      returnDocument: 'after',
    }
  );

  const batch = getReturnedDocument(batchResult);

  if (!batch) {
    throw new Error(
      '[revenue-settlement-batches] Batch upsert did not return a batch document'
    );
  }

  const rowIds = claimedRows.map((row) => row._id);

  const attachResult = await revenueLedger.updateMany(
    {
      _id: { $in: rowIds },
      settlementLeaseId: leaseId,
      status: 'release_eligible',
      settlementBatchId: null,
    },
    {
      $set: {
        status: 'batched',
        settlementBatchId: batch._id,
        settlementLeaseId: null,
        settlementLeaseExpiresAt: null,
        updatedAt: batchNow,
      },
      $push: {
        stateTransitions: {
          fromStatus: 'release_eligible',
          toStatus: 'batched',
          actor: 'settlement_batch_service',
          reason: 'eligible_rows_batched',
          occurredAt: batchNow,
          settlementBatchId: batch._id,
        },
      },
    }
  );

  if (attachResult.modifiedCount !== claimedRows.length) {
    throw new Error(
      '[revenue-settlement-batches] Could not atomically attach every claimed row to the batch'
    );
  }

  return {
    batchId: batch._id,
    batchKey: batch.batchKey,
    status: batch.status,
    revenuePoolAppId: target.revenuePoolAppId,
    poolKey: target.poolKey,
    revenueTokenAssetId: target.revenueTokenAssetId,
    rowCount: claimedRows.length,
    totalAllocationCents,
    totalUsdcAtomicUnits,
  };
}