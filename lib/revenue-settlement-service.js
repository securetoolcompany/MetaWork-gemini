import algosdk from 'algosdk';
import { createHash } from 'node:crypto';
import {
  snapshotV10RevenueTokenHolders,
} from './revenue-pool-v10-holder-snapshot.js';
import {
  preflightLiveV10Deposit,
} from './revenue-pool-v10-deposit-preflight-live.js';
import {
  rebuildV10DepositGroupFromUnsignedTransactions,
  rebuildV10DepositHeldGroupFromUnsignedTransactions,
} from './revenue-pool-v10-deposit.js';
import {
  buildUnsignedV10CreatePayoutRoundGroup,
} from './revenue-pool-v10-payout.js';

export const V10_RECIPIENT_SNAPSHOT_VERSION = 'v1';
export const V10_RECIPIENT_ROUNDING_POLICY =
  'floor_pro_rata_residual_to_largest_holder_v1';

const USDC_ATOMIC_UNITS_PER_CENT = 10_000;
const TOTAL_REV_UNITS = 10_000n;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export class RevenueSettlementRecipientSnapshotError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'RevenueSettlementRecipientSnapshotError';
    this.code = code || 'RECIPIENT_SNAPSHOT_ERROR';
  }
}

export class RevenueSettlementRecipientSnapshotValidationError extends RevenueSettlementRecipientSnapshotError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'RECIPIENT_SNAPSHOT_VALIDATION_ERROR',
    });
    this.name = 'RevenueSettlementRecipientSnapshotValidationError';
  }
}

function assertSafeInteger(value, fieldName, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `${fieldName} must be a safe integer greater than or equal to ${minimum}`,
      { code: 'INVALID_INTEGER' },
    );
  }

  return value;
}

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `${fieldName} must be a non-empty string`,
      { code: 'INVALID_STRING' },
    );
  }

  return value.trim();
}

function assertValidDate(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `${fieldName} must be a valid date`,
      { code: 'INVALID_DATE' },
    );
  }

  return date;
}

function assertExpectedBatchStatus(batch) {
  if (batch.status !== 'created') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `batch.status must be "created"; received "${String(batch.status)}"`,
      { code: 'INVALID_BATCH_STATUS' },
    );
  }
}

function assertUnpreparedRecipientFields(batch) {
  const preparedFields = [
    'holderSnapshot',
    'roundPayees',
    'roundPayeesHash',
    'roundPayeesFrozenAt',
  ];

  for (const fieldName of preparedFields) {
    if (
      batch[fieldName] !== null &&
      batch[fieldName] !== undefined
    ) {
      throw new RevenueSettlementRecipientSnapshotValidationError(
        `batch.${fieldName} must be absent before recipient snapshot preparation`,
        { code: 'RECIPIENT_SNAPSHOT_ALREADY_PRESENT' },
      );
    }
  }
}

function assertBatchTotals(batch) {
  const totalAllocationCents = assertSafeInteger(
    batch.totalAllocationCents,
    'batch.totalAllocationCents',
    { minimum: 1 },
  );
  const totalUsdcAtomicUnits = assertSafeInteger(
    batch.totalUsdcAtomicUnits,
    'batch.totalUsdcAtomicUnits',
    { minimum: 1 },
  );

  if (
    totalUsdcAtomicUnits !==
    totalAllocationCents * USDC_ATOMIC_UNITS_PER_CENT
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'batch.totalUsdcAtomicUnits must equal batch.totalAllocationCents × 10,000',
      { code: 'BATCH_TOTAL_MISMATCH' },
    );
  }

  return {
    totalAllocationCents,
    totalUsdcAtomicUnits,
  };
}

function toPositiveBigInt(value, fieldName) {
  let integerValue;

  if (typeof value === 'bigint') {
    integerValue = value;
  } else if (typeof value === 'number' && Number.isSafeInteger(value)) {
    integerValue = BigInt(value);
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    integerValue = BigInt(value);
  } else {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `${fieldName} must be a positive integer`,
      { code: 'INVALID_REV_UNITS' },
    );
  }

  if (integerValue < 1n) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `${fieldName} must be greater than zero`,
      { code: 'INVALID_REV_UNITS' },
    );
  }

  return integerValue;
}

function toSafeInteger(bigintValue, fieldName) {
  if (bigintValue < 0n || bigintValue > MAX_SAFE_BIGINT) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `${fieldName} cannot be represented as a safe integer`,
      { code: 'UNSAFE_USDC_AMOUNT' },
    );
  }

  return Number(bigintValue);
}

function getAddressBytes(address, fieldName) {
  const normalizedAddress = assertNonEmptyString(address, fieldName);

  if (!algosdk.isValidAddress(normalizedAddress)) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `${fieldName} must be a valid Algorand address`,
      { code: 'INVALID_ADDRESS' },
    );
  }

  return {
    address: normalizedAddress,
    addressBytes: Buffer.from(
      algosdk.decodeAddress(normalizedAddress).publicKey,
    ),
  };
}

function compareAddressBytes(left, right) {
  return Buffer.compare(left.addressBytes, right.addressBytes);
}

function compareResidualRecipient(left, right) {
  if (left.revUnits !== right.revUnits) {
    return left.revUnits > right.revUnits ? -1 : 1;
  }

  return compareAddressBytes(left, right);
}

function normalizeHolderSnapshot(holderSnapshot) {
  if (!holderSnapshot || typeof holderSnapshot !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'holderSnapshot must be an object',
      { code: 'INVALID_HOLDER_SNAPSHOT' },
    );
  }

  if (!Array.isArray(holderSnapshot.entries) || !holderSnapshot.entries.length) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'holderSnapshot.entries must contain at least one holder',
      { code: 'INVALID_HOLDER_SNAPSHOT' },
    );
  }

  const seenAddresses = new Set();
  const entries = holderSnapshot.entries.map((entry, index) => {
    const { address, addressBytes } = getAddressBytes(
      entry?.address,
      `holderSnapshot.entries[${index}].address`,
    );
    const revUnits = toPositiveBigInt(
      entry?.revUnits,
      `holderSnapshot.entries[${index}].revUnits`,
    );

    if (seenAddresses.has(address)) {
      throw new RevenueSettlementRecipientSnapshotValidationError(
        `holderSnapshot.entries contains duplicate address ${address}`,
        { code: 'DUPLICATE_HOLDER' },
      );
    }

    seenAddresses.add(address);

    return {
      address,
      addressBytes,
      revUnits,
    };
  });

  entries.sort(compareAddressBytes);

  const totalRevUnits = entries.reduce(
    (total, entry) => total + entry.revUnits,
    0n,
  );

  if (totalRevUnits !== TOTAL_REV_UNITS) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `holderSnapshot REV total must equal ${TOTAL_REV_UNITS}; received ${totalRevUnits}`,
      { code: 'REV_SUPPLY_MISMATCH' },
    );
  }

  if (
    holderSnapshot.totalRevUnits !== undefined &&
    holderSnapshot.totalRevUnits !== null &&
    toPositiveBigInt(
      holderSnapshot.totalRevUnits,
      'holderSnapshot.totalRevUnits',
    ) !== totalRevUnits
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'holderSnapshot.totalRevUnits does not match its entries',
      { code: 'HOLDER_SNAPSHOT_TOTAL_MISMATCH' },
    );
  }

  return {
    entries,
    totalRevUnits,
  };
}

function createCanonicalPackedPayees(roundPayees) {
  return Buffer.concat(
    roundPayees.map((payee) => {
      const addressBytes = Buffer.from(
        algosdk.decodeAddress(payee.address).publicKey,
      );
      const amountBytes = Buffer.alloc(8);

      amountBytes.writeBigUInt64BE(
        BigInt(payee.amountUsdcAtomicUnits),
      );

      return Buffer.concat([addressBytes, amountBytes]);
    }),
  );
}

function hashPayload(payload) {
  return `sha256:${createHash('sha256')
    .update(payload)
    .digest('hex')}`;
}

function createHolderSnapshotHash(entries) {
  return hashPayload(
    Buffer.concat(
      entries.map((entry) => {
        const amountBytes = Buffer.alloc(8);

        amountBytes.writeBigUInt64BE(entry.revUnits);

        return Buffer.concat([entry.addressBytes, amountBytes]);
      }),
    ),
  );
}

function deriveRoundPayees({
  totalUsdcAtomicUnits,
  holderEntries,
}) {
  const totalUsdc = BigInt(totalUsdcAtomicUnits);
  const residualRecipient = [...holderEntries].sort(
    compareResidualRecipient,
  )[0];

  let allocatedUsdc = 0n;

  const calculated = holderEntries.map((holder) => {
    if (holder.address === residualRecipient.address) {
      return {
        ...holder,
        amountUsdcAtomicUnits: null,
      };
    }

    const amountUsdcAtomicUnits =
      (totalUsdc * holder.revUnits) / TOTAL_REV_UNITS;

    allocatedUsdc += amountUsdcAtomicUnits;

    return {
      ...holder,
      amountUsdcAtomicUnits,
    };
  });

  const residualAmount = totalUsdc - allocatedUsdc;

  if (residualAmount < 1n) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Residual recipient allocation must be greater than zero',
      { code: 'INVALID_RESIDUAL_ALLOCATION' },
    );
  }

  const roundPayees = calculated
    .map((entry) => {
      const amountUsdcAtomicUnits =
        entry.address === residualRecipient.address
          ? residualAmount
          : entry.amountUsdcAtomicUnits;

      return {
        address: entry.address,
        revUnits: entry.revUnits.toString(),
        amountUsdcAtomicUnits: toSafeInteger(
          amountUsdcAtomicUnits,
          `roundPayee ${entry.address} amountUsdcAtomicUnits`,
        ),
      };
    })
    .sort((left, right) => {
      const leftBytes = Buffer.from(
        algosdk.decodeAddress(left.address).publicKey,
      );
      const rightBytes = Buffer.from(
        algosdk.decodeAddress(right.address).publicKey,
      );

      return Buffer.compare(leftBytes, rightBytes);
    });

  const totalRoundPayees = roundPayees.reduce(
    (total, payee) => total + payee.amountUsdcAtomicUnits,
    0,
  );

  if (totalRoundPayees !== totalUsdcAtomicUnits) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Derived V10 round payees do not reconcile to the frozen batch USDC total',
      { code: 'ROUND_PAYEE_TOTAL_MISMATCH' },
    );
  }

  return {
    residualRecipientAddress: residualRecipient.address,
    roundPayees,
  };
}

/**
 * Produces immutable V10 round recipient data from:
 * - a durable settlement batch's already-frozen USDC amount; and
 * - a one-time current REV-holder snapshot.
 *
 * This function does not read the blockchain, write MongoDB, sign, or submit
 * transactions. The persistence unit must call it only after it has captured
 * the holder snapshot and before it broadcasts a USDC deposit.
 */
export function prepareV10RecipientSnapshot({
  batch,
  holderSnapshot,
  now = new Date(),
}) {
  if (!batch || typeof batch !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'batch must be an object',
      { code: 'INVALID_BATCH' },
    );
  }

  assertExpectedBatchStatus(batch);
  assertUnpreparedRecipientFields(batch);

  const batchId = assertNonEmptyString(batch._id, 'batch._id');
  const batchKey = assertNonEmptyString(batch.batchKey, 'batch.batchKey');
  const revenuePoolAppId = assertSafeInteger(
    batch.revenuePoolAppId,
    'batch.revenuePoolAppId',
    { minimum: 1 },
  );
  const poolKey = assertNonEmptyString(batch.poolKey, 'batch.poolKey');
  const revenueTokenAssetId = assertSafeInteger(
    batch.revenueTokenAssetId,
    'batch.revenueTokenAssetId',
    { minimum: 1 },
  );
  const preparedAt = assertValidDate(now, 'now');
  const { totalAllocationCents, totalUsdcAtomicUnits } =
    assertBatchTotals(batch);
  const normalizedSnapshot = normalizeHolderSnapshot(holderSnapshot);
  const { residualRecipientAddress, roundPayees } = deriveRoundPayees({
    totalUsdcAtomicUnits,
    holderEntries: normalizedSnapshot.entries,
  });

  const canonicalPackedPayees = createCanonicalPackedPayees(roundPayees);

  const storedHolderSnapshot = {
    source: 'algorand_indexer',
    snapshotVersion: V10_RECIPIENT_SNAPSHOT_VERSION,
    assetId: revenueTokenAssetId,
    totalRevUnits: normalizedSnapshot.totalRevUnits.toString(),
    entries: normalizedSnapshot.entries.map((entry) => ({
      address: entry.address,
      revUnits: entry.revUnits.toString(),
    })),
    canonicalHash: createHolderSnapshotHash(normalizedSnapshot.entries),
    capturedAt:
      holderSnapshot.capturedAt !== undefined
        ? assertValidDate(
            holderSnapshot.capturedAt,
            'holderSnapshot.capturedAt',
          )
        : preparedAt,
    indexerRound:
      holderSnapshot.indexerRound === undefined ||
      holderSnapshot.indexerRound === null
        ? null
        : assertSafeInteger(
            holderSnapshot.indexerRound,
            'holderSnapshot.indexerRound',
            { minimum: 1 },
          ),
    algodStatusRound:
      holderSnapshot.algodStatusRound === undefined ||
      holderSnapshot.algodStatusRound === null
        ? null
        : assertSafeInteger(
            holderSnapshot.algodStatusRound,
            'holderSnapshot.algodStatusRound',
            { minimum: 1 },
          ),
    indexerLagRounds:
      holderSnapshot.indexerLagRounds === undefined ||
      holderSnapshot.indexerLagRounds === null
        ? null
        : assertSafeInteger(
            holderSnapshot.indexerLagRounds,
            'holderSnapshot.indexerLagRounds',
            { minimum: 0 },
          ),
  };

  if (
    storedHolderSnapshot.indexerRound !== null &&
    storedHolderSnapshot.algodStatusRound !== null &&
    storedHolderSnapshot.indexerLagRounds !== null &&
    storedHolderSnapshot.algodStatusRound -
      storedHolderSnapshot.indexerRound !==
      storedHolderSnapshot.indexerLagRounds
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'holderSnapshot round metadata is internally inconsistent',
      { code: 'HOLDER_SNAPSHOT_ROUND_MISMATCH' },
    );
  }

  const result = {
    batchId,
    batchKey,
    fromStatus: 'created',
    toStatus: 'recipient_snapshot_prepared',

    revenuePoolAppId,
    poolKey,
    revenueTokenAssetId,

    totalAllocationCents,
    totalUsdcAtomicUnits,

    holderSnapshot: storedHolderSnapshot,

    roundPayeesVersion: V10_RECIPIENT_SNAPSHOT_VERSION,
    holderRoundingPolicy: V10_RECIPIENT_ROUNDING_POLICY,
    residualRecipientAddress,
    roundPayees,
    roundPayeesHash: hashPayload(canonicalPackedPayees),
    roundPayeesFrozenAt: preparedAt,
  };

  return Object.freeze({
    ...result,
    holderSnapshot: Object.freeze({
      ...result.holderSnapshot,
      entries: Object.freeze(
        result.holderSnapshot.entries.map((entry) =>
          Object.freeze({ ...entry }),
        ),
      ),
    }),
    roundPayees: Object.freeze(
      result.roundPayees.map((payee) => Object.freeze({ ...payee })),
    ),
  });
}

function getReturnedDocument(result) {
  if (!result) {
    return null;
  }

  return result.value ?? result;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertPersistedRecipientSnapshot(batch) {
  if (!batch || typeof batch !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Persisted batch must be an object',
      { code: 'INVALID_PERSISTED_BATCH' },
    );
  }

  if (batch.status !== 'recipient_snapshot_prepared') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Persisted batch status must be "recipient_snapshot_prepared"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_PERSISTED_BATCH_STATUS' },
    );
  }

  const requiredFields = [
    'holderSnapshot',
    'roundPayeesVersion',
    'holderRoundingPolicy',
    'residualRecipientAddress',
    'roundPayees',
    'roundPayeesHash',
    'roundPayeesFrozenAt',
  ];

  for (const fieldName of requiredFields) {
    if (
      batch[fieldName] === null ||
      batch[fieldName] === undefined
    ) {
      throw new RevenueSettlementRecipientSnapshotValidationError(
        `Persisted batch is missing ${fieldName}`,
        { code: 'MISSING_PERSISTED_RECIPIENT_SNAPSHOT' },
      );
    }
  }

  const recalculated = prepareV10RecipientSnapshot({
    batch: {
      ...batch,
      _id: String(batch._id),
      status: 'created',
      holderSnapshot: null,
      roundPayees: null,
      roundPayeesHash: null,
      roundPayeesFrozenAt: null,
    },
    holderSnapshot: batch.holderSnapshot,
    now: batch.roundPayeesFrozenAt,
  });

  const persistedProjection = {
    holderSnapshot: batch.holderSnapshot,
    roundPayeesVersion: batch.roundPayeesVersion,
    holderRoundingPolicy: batch.holderRoundingPolicy,
    residualRecipientAddress: batch.residualRecipientAddress,
    roundPayees: batch.roundPayees,
    roundPayeesHash: batch.roundPayeesHash,
  };

  const recalculatedProjection = {
    holderSnapshot: recalculated.holderSnapshot,
    roundPayeesVersion: recalculated.roundPayeesVersion,
    holderRoundingPolicy: recalculated.holderRoundingPolicy,
    residualRecipientAddress: recalculated.residualRecipientAddress,
    roundPayees: recalculated.roundPayees,
    roundPayeesHash: recalculated.roundPayeesHash,
  };

  if (!sameJson(persistedProjection, recalculatedProjection)) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Persisted recipient snapshot does not match its immutable holder and payee data',
      { code: 'PERSISTED_RECIPIENT_SNAPSHOT_MISMATCH' },
    );
  }

  return Object.freeze({
    batchId: String(batch._id),
    batchKey: batch.batchKey,
    status: batch.status,
    revenuePoolAppId: batch.revenuePoolAppId,
    poolKey: batch.poolKey,
    revenueTokenAssetId: batch.revenueTokenAssetId,
    totalAllocationCents: batch.totalAllocationCents,
    totalUsdcAtomicUnits: batch.totalUsdcAtomicUnits,
    holderSnapshot: recalculated.holderSnapshot,
    roundPayeesVersion: recalculated.roundPayeesVersion,
    holderRoundingPolicy: recalculated.holderRoundingPolicy,
    residualRecipientAddress: recalculated.residualRecipientAddress,
    roundPayees: recalculated.roundPayees,
    roundPayeesHash: recalculated.roundPayeesHash,
    roundPayeesFrozenAt: new Date(batch.roundPayeesFrozenAt),
  });
}

function createRecipientSnapshotUpdateFilter(batch) {
  return {
    _id: batch._id,
    status: 'created',
    holderSnapshot: null,
    roundPayees: null,
    roundPayeesHash: null,
    roundPayeesFrozenAt: null,
  };
}

function createRecipientSnapshotSet(prepared, now) {
  return {
    status: 'recipient_snapshot_prepared',
    holderSnapshot: prepared.holderSnapshot,
    roundPayeesVersion: prepared.roundPayeesVersion,
    holderRoundingPolicy: prepared.holderRoundingPolicy,
    residualRecipientAddress: prepared.residualRecipientAddress,
    roundPayees: prepared.roundPayees,
    roundPayeesHash: prepared.roundPayeesHash,
    roundPayeesFrozenAt: prepared.roundPayeesFrozenAt,
    updatedAt: now,
  };
}

/**
 * Captures and durably freezes current V10 REV-token holders as the
 * recipient/payee snapshot for exactly one settlement batch.
 *
 * It does not sign, broadcast, deposit USDC, create a payout round, or
 * change any revenue-ledger rows.
 */
export async function prepareAndPersistV10RecipientSnapshot({
  db,
  batchId,
  indexerClient,
  algodClient,
  now = new Date(),
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  if (batchId === null || batchId === undefined || batchId === '') {
    throw new TypeError('batchId is required');
  }

  const persistedAt = assertValidDate(now, 'now');
  const settlementBatches = db.collection('revenue_settlement_batches');

  if (
    !settlementBatches ||
    typeof settlementBatches.findOne !== 'function' ||
    typeof settlementBatches.findOneAndUpdate !== 'function'
  ) {
    throw new TypeError(
      'revenue_settlement_batches must provide findOne and findOneAndUpdate',
    );
  }

  const batch = await settlementBatches.findOne({ _id: batchId });

  if (!batch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(batchId)} was not found`,
      { code: 'BATCH_NOT_FOUND' },
    );
  }

  if (batch.status === 'recipient_snapshot_prepared') {
    return assertPersistedRecipientSnapshot(batch);
  }

  if (batch.status !== 'created') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} must have status "created"; received "${String(batch.status)}"`,
      { code: 'INVALID_BATCH_STATUS' },
    );
  }

  if (
    batch.holderSnapshot !== null ||
    batch.roundPayees !== null ||
    batch.roundPayeesHash !== null ||
    batch.roundPayeesFrozenAt !== null
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Created settlement batch already contains recipient snapshot fields',
      { code: 'RECIPIENT_SNAPSHOT_ALREADY_PRESENT' },
    );
  }

  const holderSnapshot = await snapshotV10RevenueTokenHolders({
    indexerClient,
    algodClient,
    revenueTokenAssetId: batch.revenueTokenAssetId,
  });

  const prepared = prepareV10RecipientSnapshot({
    batch: {
      ...batch,
      _id: String(batch._id),
    },
    holderSnapshot,
    now: persistedAt,
  });

  const updateResult = await settlementBatches.findOneAndUpdate(
    createRecipientSnapshotUpdateFilter(batch),
    {
      $set: createRecipientSnapshotSet(prepared, persistedAt),
    },
    {
      returnDocument: 'after',
    },
  );

  const updatedBatch = getReturnedDocument(updateResult);

  if (updatedBatch) {
    return assertPersistedRecipientSnapshot(updatedBatch);
  }

  const racedBatch = await settlementBatches.findOne({ _id: batch._id });

  if (!racedBatch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} disappeared during recipient snapshot preparation`,
      { code: 'BATCH_DISAPPEARED_DURING_UPDATE' },
    );
  }

  if (racedBatch.status === 'recipient_snapshot_prepared') {
    return assertPersistedRecipientSnapshot(racedBatch);
  }

  throw new RevenueSettlementRecipientSnapshotValidationError(
    `Recipient snapshot conditional update lost for batch ${String(
      batch._id,
    )} and no valid persisted snapshot is available`,
    { code: 'RECIPIENT_SNAPSHOT_CONDITIONAL_UPDATE_LOST' },
  );
}

const V10_DEPOSIT_ATTEMPT_VERSION = 'v1';
const V10_DEPOSIT_OPERATION = 'v10_usdc_deposit';
const V10_DEPOSIT_USDC_ASSET_ID = 10458941;

function assertPersistedRecipientSnapshotForDeposit(batch) {
  if (!batch || typeof batch !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Settlement batch must be an object',
      { code: 'INVALID_PERSISTED_BATCH' },
    );
  }

  const recipientBatch = {
    ...batch,
    status: 'recipient_snapshot_prepared',
  };

  return assertPersistedRecipientSnapshot(recipientBatch);
}

function assertDepositAttemptDate(value, fieldName) {
  if (value === null || value === undefined) {
    return null;
  }

  return assertValidDate(value, fieldName);
}

function assertDepositAttemptTarget({
  batch,
  target,
  expectedUsdcAssetId,
}) {
  if (!target || typeof target !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt.target must be an object',
      { code: 'INVALID_DEPOSIT_ATTEMPT_TARGET' },
    );
  }

  if (
    target.revenuePoolAppId !== batch.revenuePoolAppId ||
    target.poolKey !== batch.poolKey ||
    target.revenueTokenAssetId !== batch.revenueTokenAssetId ||
    target.usdcAssetId !== expectedUsdcAssetId
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt target does not match the immutable settlement batch target',
      { code: 'DEPOSIT_ATTEMPT_TARGET_MISMATCH' },
    );
  }

  return Object.freeze({
    revenuePoolAppId: target.revenuePoolAppId,
    poolKey: target.poolKey,
    revenueTokenAssetId: target.revenueTokenAssetId,
    usdcAssetId: target.usdcAssetId,
  });
}

function assertDepositAttemptTransactionIds(transactionIds) {
  if (!transactionIds || typeof transactionIds !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt.transactionIds must be an object',
      { code: 'INVALID_DEPOSIT_ATTEMPT_TRANSACTION_IDS' },
    );
  }

  const usdcTransfer = assertNonEmptyString(
    transactionIds.usdcTransfer,
    'depositAttempt.transactionIds.usdcTransfer',
  );
  const appCall = assertNonEmptyString(
    transactionIds.appCall,
    'depositAttempt.transactionIds.appCall',
  );

  return Object.freeze({
    usdcTransfer,
    appCall,
  });
}

function assertUnsignedTransactionsBase64(value) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt.unsignedTransactionsBase64 must contain exactly two transactions',
      { code: 'INVALID_DEPOSIT_ATTEMPT_UNSIGNED_TRANSACTIONS' },
    );
  }

  return Object.freeze(
    value.map((encodedTransaction, index) => {
      if (
        typeof encodedTransaction !== 'string' ||
        !encodedTransaction
      ) {
        throw new RevenueSettlementRecipientSnapshotValidationError(
          `depositAttempt.unsignedTransactionsBase64[${index}] must be a non-empty base64 string`,
          { code: 'INVALID_DEPOSIT_ATTEMPT_UNSIGNED_TRANSACTIONS' },
        );
      }

      return encodedTransaction;
    }),
  );
}

function assertAttemptAmount(value, fieldName) {
  if (typeof value === 'number') {
    return assertSafeInteger(value, fieldName, { minimum: 1 });
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const numericValue = Number(value);

    return assertSafeInteger(numericValue, fieldName, {
      minimum: 1,
    });
  }

  throw new RevenueSettlementRecipientSnapshotValidationError(
    `${fieldName} must be a positive safe integer or decimal string`,
    { code: 'INVALID_DEPOSIT_ATTEMPT_AMOUNT' },
  );
}

function assertPreparedDepositAttempt(batch) {
  if (!batch || typeof batch !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Persisted deposit batch must be an object',
      { code: 'INVALID_PERSISTED_BATCH' },
    );
  }

  if (batch.status !== 'deposit_prepared') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Persisted batch status must be "deposit_prepared"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_PERSISTED_DEPOSIT_STATUS' },
    );
  }

  assertPersistedRecipientSnapshotForDeposit(batch);

  const attempt = batch.depositAttempt;

  if (!attempt || typeof attempt !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Persisted deposit-prepared batch is missing depositAttempt',
      { code: 'MISSING_DEPOSIT_ATTEMPT' },
    );
  }

  if (
    attempt.attemptKey !==
    `${String(batch._id)}:deposit:${V10_DEPOSIT_ATTEMPT_VERSION}`
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt.attemptKey does not match the settlement batch',
      { code: 'INVALID_DEPOSIT_ATTEMPT_KEY' },
    );
  }

  if (attempt.operation !== V10_DEPOSIT_OPERATION) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `depositAttempt.operation must be "${V10_DEPOSIT_OPERATION}"`,
      { code: 'INVALID_DEPOSIT_ATTEMPT_OPERATION' },
    );
  }

  if (attempt.status !== 'prepared') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt.status must be "prepared"',
      { code: 'INVALID_DEPOSIT_ATTEMPT_STATUS' },
    );
  }

  const groupId = assertNonEmptyString(
    attempt.groupId,
    'depositAttempt.groupId',
  );
  const unsignedTransactionHash = assertNonEmptyString(
    attempt.unsignedTransactionHash,
    'depositAttempt.unsignedTransactionHash',
  );
  const unsignedTransactionsBase64 = assertUnsignedTransactionsBase64(
    attempt.unsignedTransactionsBase64,
  );
  const transactionIds = assertDepositAttemptTransactionIds(
    attempt.transactionIds,
  );
  const target = assertDepositAttemptTarget({
    batch,
    target: attempt.target,
    expectedUsdcAssetId: V10_DEPOSIT_USDC_ASSET_ID,
  });

  if (
    attempt.usdcTransferTransactionIndex !== 0 ||
    attempt.appCallTransactionIndex !== 1
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt transaction ordering must be USDC transfer index 0 and app call index 1',
      { code: 'INVALID_DEPOSIT_ATTEMPT_ORDERING' },
    );
  }

  const amountUsdcAtomicUnits = assertAttemptAmount(
    attempt.amountUsdcAtomicUnits,
    'depositAttempt.amountUsdcAtomicUnits',
  );

  if (amountUsdcAtomicUnits !== batch.totalUsdcAtomicUnits) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt amount does not match the immutable settlement batch USDC total',
      { code: 'DEPOSIT_ATTEMPT_AMOUNT_MISMATCH' },
    );
  }

  const preparedAt = assertValidDate(
    attempt.preparedAt,
    'depositAttempt.preparedAt',
  );
  const submittedAt = assertDepositAttemptDate(
    attempt.submittedAt,
    'depositAttempt.submittedAt',
  );
  const confirmedAt = assertDepositAttemptDate(
    attempt.confirmedAt,
    'depositAttempt.confirmedAt',
  );

  if (
    attempt.failureCode !== null &&
    attempt.failureCode !== undefined
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Prepared depositAttempt.failureCode must be null',
      { code: 'INVALID_DEPOSIT_ATTEMPT_FAILURE_STATE' },
    );
  }

  if (
    attempt.failureMessage !== null &&
    attempt.failureMessage !== undefined
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Prepared depositAttempt.failureMessage must be null',
      { code: 'INVALID_DEPOSIT_ATTEMPT_FAILURE_STATE' },
    );
  }

  let rebuilt;

  try {
    rebuilt = rebuildV10DepositHeldGroupFromUnsignedTransactions({
      unsignedTransactionsBase64,
      target,
      usdcAtomicUnits: amountUsdcAtomicUnits,
    });
  } catch (cause) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt unsigned transactions cannot be rebuilt as the exact V10 deposit group',
      {
        code: 'INVALID_DEPOSIT_ATTEMPT_UNSIGNED_GROUP',
        cause,
      },
    );
  }

  if (
    rebuilt.groupId !== groupId ||
    rebuilt.unsignedTransactionHash !== unsignedTransactionHash ||
    rebuilt.transactionIds.usdcTransfer !==
      transactionIds.usdcTransfer ||
    rebuilt.transactionIds.appCall !== transactionIds.appCall
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'depositAttempt metadata does not match its persisted unsigned V10 deposit group',
      { code: 'DEPOSIT_ATTEMPT_GROUP_MISMATCH' },
    );
  }

  return Object.freeze({
    batchId: String(batch._id),
    batchKey: batch.batchKey,
    status: batch.status,
    revenuePoolAppId: batch.revenuePoolAppId,
    poolKey: batch.poolKey,
    revenueTokenAssetId: batch.revenueTokenAssetId,
    totalAllocationCents: batch.totalAllocationCents,
    totalUsdcAtomicUnits: batch.totalUsdcAtomicUnits,
    holderSnapshot: batch.holderSnapshot,
    roundPayeesVersion: batch.roundPayeesVersion,
    holderRoundingPolicy: batch.holderRoundingPolicy,
    residualRecipientAddress: batch.residualRecipientAddress,
    roundPayees: batch.roundPayees,
    roundPayeesHash: batch.roundPayeesHash,
    roundPayeesFrozenAt: new Date(batch.roundPayeesFrozenAt),
    depositAttempt: Object.freeze({
      attemptKey: attempt.attemptKey,
      operation: attempt.operation,
      status: attempt.status,
      groupId,
      unsignedTransactionHash,
      unsignedTransactionsBase64,
      transactionIds,
      usdcTransferTransactionIndex:
        attempt.usdcTransferTransactionIndex,
      appCallTransactionIndex:
        attempt.appCallTransactionIndex,
      target,
      amountUsdcAtomicUnits: String(amountUsdcAtomicUnits),
      preparedAt,
      submittedAt,
      confirmedAt,
      failureCode: null,
      failureMessage: null,
    }),
  });
}

function createDepositAttemptUpdateFilter(batch) {
  return {
    _id: batch._id,
    status: 'recipient_snapshot_prepared',
    depositAttempt: null,
    holderSnapshot: { $ne: null },
    roundPayees: { $ne: null },
    roundPayeesHash: { $ne: null },
    roundPayeesFrozenAt: { $ne: null },
  };
}

function createPreparedDepositAttempt({
  batch,
  livePreflight,
  preparedAt,
}) {
  if (
    !livePreflight ||
    livePreflight.ok !== true ||
    !livePreflight.unsignedGroup ||
    !livePreflight.proposedGroup
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'A successful V10 live deposit preflight with an unsigned group is required',
      { code: 'INVALID_LIVE_DEPOSIT_PREFLIGHT' },
    );
  }

  const unsignedGroup = livePreflight.unsignedGroup;
  const proposedGroup = livePreflight.proposedGroup;

  if (
    proposedGroup.action !== 'deposit_held' ||
    proposedGroup.transactionCount !== 2 ||
    proposedGroup.usdcTransferTransactionIndex !== 0 ||
    proposedGroup.appCallTransactionIndex !== 1
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Live V10 deposit preflight proposed an invalid transaction shape',
      { code: 'INVALID_LIVE_DEPOSIT_GROUP' },
    );
  }

  if (
    unsignedGroup.target.revenuePoolAppId !==
      batch.revenuePoolAppId ||
    unsignedGroup.target.poolKey !== batch.poolKey ||
    unsignedGroup.target.usdcAssetId !==
      V10_DEPOSIT_USDC_ASSET_ID ||
    unsignedGroup.amountUsdcAtomicUnits !==
      batch.totalUsdcAtomicUnits
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Live V10 deposit group does not match immutable batch target or amount',
      { code: 'LIVE_DEPOSIT_GROUP_BATCH_MISMATCH' },
    );
  }

  if (
    proposedGroup.groupId !== unsignedGroup.groupId ||
    proposedGroup.unsignedTransactionHash !==
      unsignedGroup.unsignedTransactionHash ||
    proposedGroup.transactionIds.usdcTransfer !==
      unsignedGroup.transactionIds.usdcTransfer ||
    proposedGroup.transactionIds.appCall !==
      unsignedGroup.transactionIds.appCall
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Live V10 deposit preflight metadata does not match its unsigned group',
      { code: 'LIVE_DEPOSIT_GROUP_METADATA_MISMATCH' },
    );
  }

  const attempt = {
    attemptKey:
      `${String(batch._id)}:deposit:${V10_DEPOSIT_ATTEMPT_VERSION}`,
    operation: V10_DEPOSIT_OPERATION,
    status: 'prepared',
    groupId: unsignedGroup.groupId,
    unsignedTransactionHash: unsignedGroup.unsignedTransactionHash,
    unsignedTransactionsBase64:
      unsignedGroup.unsignedTransactionsBase64,
    transactionIds: {
      usdcTransfer:
        unsignedGroup.transactionIds.usdcTransfer,
      appCall: unsignedGroup.transactionIds.appCall,
    },
    usdcTransferTransactionIndex: 0,
    appCallTransactionIndex: 1,
    target: {
      revenuePoolAppId: batch.revenuePoolAppId,
      poolKey: batch.poolKey,
      revenueTokenAssetId: batch.revenueTokenAssetId,
      usdcAssetId: V10_DEPOSIT_USDC_ASSET_ID,
    },
    amountUsdcAtomicUnits: String(
      batch.totalUsdcAtomicUnits,
    ),
    preparedAt,
    submittedAt: null,
    confirmedAt: null,
    failureCode: null,
    failureMessage: null,
  };

  return attempt;
}

/**
 * Creates exactly one durable, unsigned V10 USDC-deposit attempt.
 *
 * This function:
 * - validates the already-frozen holder/payee snapshot;
 * - runs read-only live V10 preflight;
 * - persists a deterministic unsigned group via Mongo compare-and-set;
 * - does not sign, submit, confirm, or modify ledger rows.
 */
export async function prepareAndPersistV10DepositAttempt({
  db,
  batchId,
  now = new Date(),
  preflightLive = preflightLiveV10Deposit,
  preflightOptions = {},
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  if (batchId === null || batchId === undefined || batchId === '') {
    throw new TypeError('batchId is required');
  }

  if (typeof preflightLive !== 'function') {
    throw new TypeError('preflightLive must be a function');
  }

  if (!preflightOptions || typeof preflightOptions !== 'object') {
    throw new TypeError('preflightOptions must be an object');
  }

  const preparedAt = assertValidDate(now, 'now');
  const settlementBatches = db.collection(
    'revenue_settlement_batches',
  );

  if (
    !settlementBatches ||
    typeof settlementBatches.findOne !== 'function' ||
    typeof settlementBatches.findOneAndUpdate !== 'function'
  ) {
    throw new TypeError(
      'revenue_settlement_batches must provide findOne and findOneAndUpdate',
    );
  }

  const batch = await settlementBatches.findOne({ _id: batchId });

  if (!batch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(batchId)} was not found`,
      { code: 'BATCH_NOT_FOUND' },
    );
  }

  if (batch.status === 'deposit_prepared') {
    return assertPreparedDepositAttempt(batch);
  }

  if (batch.status !== 'recipient_snapshot_prepared') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} must have status "recipient_snapshot_prepared"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_DEPOSIT_PREPARATION_BATCH_STATUS' },
    );
  }

  assertPersistedRecipientSnapshot(batch);

  if (
    batch.depositAttempt !== null &&
    batch.depositAttempt !== undefined
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Recipient-snapshot-prepared batch already contains depositAttempt data',
      { code: 'DEPOSIT_ATTEMPT_ALREADY_PRESENT' },
    );
  }

  const livePreflight = await preflightLive({
    batch,
    ...preflightOptions,
  });

  if (!livePreflight || livePreflight.ok !== true) {
    const diagnostic = JSON.stringify(
      livePreflight,
      (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
    );

    throw new RevenueSettlementRecipientSnapshotValidationError(
      diagnostic || 'V10 live deposit preflight did not approve a deposit attempt',
      {
        code: 'LIVE_DEPOSIT_PREFLIGHT_REJECTED',
      },
    );
  }

    const depositAttempt = createPreparedDepositAttempt({
      batch,
      livePreflight,
      preparedAt,
    });

  const updateResult = await settlementBatches.findOneAndUpdate(
    createDepositAttemptUpdateFilter(batch),
    {
      $set: {
        status: 'deposit_prepared',
        depositAttempt,
        updatedAt: preparedAt,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  const updatedBatch = getReturnedDocument(updateResult);

  if (updatedBatch) {
    return assertPreparedDepositAttempt(updatedBatch);
  }

  const racedBatch = await settlementBatches.findOne({
    _id: batch._id,
  });

  if (!racedBatch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} disappeared during V10 deposit attempt preparation`,
      { code: 'BATCH_DISAPPEARED_DURING_DEPOSIT_PREPARATION' },
    );
  }

  if (racedBatch.status === 'deposit_prepared') {
    return assertPreparedDepositAttempt(racedBatch);
  }

  throw new RevenueSettlementRecipientSnapshotValidationError(
    `V10 deposit attempt conditional update lost for batch ${String(
      batch._id,
    )} and no valid prepared attempt is available`,
    { code: 'DEPOSIT_ATTEMPT_CONDITIONAL_UPDATE_LOST' },
  );
}

function assertConfirmedDepositRecovery(recovery) {
  if (!recovery || typeof recovery !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'confirmed deposit recovery result is required',
      { code: 'INVALID_DEPOSIT_RECOVERY' },
    );
  }

  if (recovery.outcome !== 'confirmed') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Deposit recovery outcome must be "confirmed"; received "${String(
        recovery.outcome,
      )}"`,
      { code: 'DEPOSIT_NOT_CONFIRMED' },
    );
  }

  const appCallTransactionId = assertNonEmptyString(
    recovery.appCallTransactionId,
    'recovery.appCallTransactionId',
  );

  const confirmedRound = String(
    recovery.confirmedRound ?? '',
  ).trim();

  if (!/^\d+$/.test(confirmedRound) || BigInt(confirmedRound) < 1n) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'recovery.confirmedRound must be a positive integer',
      { code: 'INVALID_CONFIRMED_ROUND' },
    );
  }

  return Object.freeze({
    appCallTransactionId,
    confirmedRound,
  });
}

function assertConfirmedDepositBatch(batch, recovery) {
  if (!batch || typeof batch !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Confirmed deposit batch must be an object',
      { code: 'INVALID_PERSISTED_BATCH' },
    );
  }

  if (
    batch.status !== 'deposit_confirmed_pending_ledger' &&
    batch.status !== 'deposited'
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Confirmed deposit batch has invalid status "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_CONFIRMED_DEPOSIT_STATUS' },
    );
  }

  if (!batch.depositAttempt || typeof batch.depositAttempt !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Confirmed deposit batch is missing depositAttempt',
      { code: 'MISSING_DEPOSIT_ATTEMPT' },
    );
  }

  if (batch.depositAttempt.operation !== V10_DEPOSIT_OPERATION) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Confirmed deposit batch has an invalid depositAttempt operation',
      { code: 'INVALID_DEPOSIT_ATTEMPT_OPERATION' },
    );
  }

  if (
    batch.depositAttempt.transactionIds?.appCall !==
    recovery.appCallTransactionId
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Confirmed recovery transaction ID does not match the stored V10 app-call transaction ID',
      { code: 'CONFIRMED_DEPOSIT_TRANSACTION_MISMATCH' },
    );
  }

  if (
    batch.usdcDepositTxId !== recovery.appCallTransactionId
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Confirmed batch USDC deposit transaction ID does not match recovery result',
      { code: 'CONFIRMED_BATCH_TRANSACTION_MISMATCH' },
    );
  }

  const confirmedAt = assertValidDate(
    batch.usdcDepositConfirmedAt,
    'batch.usdcDepositConfirmedAt',
  );

  if (batch.depositAttempt.status !== 'confirmed') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Confirmed batch depositAttempt.status must be "confirmed"',
      { code: 'INVALID_CONFIRMED_DEPOSIT_ATTEMPT_STATUS' },
    );
  }

  const attemptConfirmedAt = assertValidDate(
    batch.depositAttempt.confirmedAt,
    'batch.depositAttempt.confirmedAt',
  );

  if (attemptConfirmedAt.getTime() !== confirmedAt.getTime()) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'batch and depositAttempt confirmation timestamps must match',
      { code: 'CONFIRMED_DEPOSIT_TIMESTAMP_MISMATCH' },
    );
  }

  if (
    batch.depositAttempt.failureCode !== null &&
    batch.depositAttempt.failureCode !== undefined
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Confirmed depositAttempt.failureCode must be null',
      { code: 'INVALID_CONFIRMED_DEPOSIT_FAILURE_STATE' },
    );
  }

  if (
    batch.depositAttempt.failureMessage !== null &&
    batch.depositAttempt.failureMessage !== undefined
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Confirmed depositAttempt.failureMessage must be null',
      { code: 'INVALID_CONFIRMED_DEPOSIT_FAILURE_STATE' },
    );
  }

  return Object.freeze({
    batchId: String(batch._id),
    batchKey: batch.batchKey,
    status: batch.status,
    revenuePoolAppId: batch.revenuePoolAppId,
    poolKey: batch.poolKey,
    revenueTokenAssetId: batch.revenueTokenAssetId,
    totalAllocationCents: batch.totalAllocationCents,
    totalUsdcAtomicUnits: batch.totalUsdcAtomicUnits,
    usdcDepositTxId: batch.usdcDepositTxId,
    usdcDepositConfirmedAt: confirmedAt,
    confirmedRound: recovery.confirmedRound,
    depositAttempt: Object.freeze({
      ...batch.depositAttempt,
      confirmedAt: attemptConfirmedAt,
    }),
  });
}

function createSubmittedDepositAttemptFilter(prepared) {
  return {
    _id: prepared.batchId,
    status: 'deposit_prepared',
    usdcDepositTxId: null,
    usdcDepositConfirmedAt: null,
    'depositAttempt.operation': V10_DEPOSIT_OPERATION,
    'depositAttempt.status': 'prepared',
    'depositAttempt.groupId': prepared.depositAttempt.groupId,
    'depositAttempt.unsignedTransactionHash':
      prepared.depositAttempt.unsignedTransactionHash,
    'depositAttempt.transactionIds.usdcTransfer':
      prepared.depositAttempt.transactionIds.usdcTransfer,
    'depositAttempt.transactionIds.appCall':
      prepared.depositAttempt.transactionIds.appCall,
  };
}

function assertSubmittedDepositAttempt(batch) {
  if (!batch || typeof batch !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Persisted submitted deposit batch must be an object',
      { code: 'INVALID_PERSISTED_BATCH' },
    );
  }

  if (batch.status !== 'deposit_submitted') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Persisted batch status must be "deposit_submitted"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_PERSISTED_DEPOSIT_STATUS' },
    );
  }

  const prepared = assertPreparedDepositAttempt({
    ...batch,
    status: 'deposit_prepared',
    depositAttempt: {
      ...batch.depositAttempt,
      status: 'prepared',
    },
  });

  const submittedAt = assertValidDate(
    batch.depositAttempt?.submittedAt,
    'depositAttempt.submittedAt',
  );

  if (
    batch.depositAttempt?.confirmedAt !== null &&
    batch.depositAttempt?.confirmedAt !== undefined
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Submitted depositAttempt.confirmedAt must be null',
      { code: 'INVALID_SUBMITTED_DEPOSIT_ATTEMPT_CONFIRMATION_STATE' },
    );
  }

  return Object.freeze({
    ...prepared,
    status: 'deposit_submitted',
    depositAttempt: Object.freeze({
      ...prepared.depositAttempt,
      status: 'submitted',
      submittedAt,
      confirmedAt: null,
    }),
  });
}

function createConfirmedDepositBatchFilter(batch, recovery) {
  return {
    _id: batch._id,
    status: {
      $in: ['deposit_prepared', 'deposit_submitted'],
    },
    usdcDepositTxId: null,
    usdcDepositConfirmedAt: null,
    'depositAttempt.operation': V10_DEPOSIT_OPERATION,
    'depositAttempt.transactionIds.appCall':
      recovery.appCallTransactionId,
  };
}

/**
 * Persists that the wallet submitted the exact durable, prepared V10
 * held-USDC deposit group. It never rebuilds, replaces, signs, broadcasts,
 * confirms, materializes, or creates a payout round.
 */
export async function persistSubmittedV10DepositAttempt({
  db,
  batchId,
  submittedAt = new Date(),
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  if (batchId === null || batchId === undefined || batchId === '') {
    throw new TypeError('batchId is required');
  }

  const normalizedSubmittedAt = assertValidDate(
    submittedAt,
    'submittedAt',
  );

  const settlementBatches = db.collection(
    'revenue_settlement_batches',
  );

  if (
    !settlementBatches ||
    typeof settlementBatches.findOne !== 'function' ||
    typeof settlementBatches.findOneAndUpdate !== 'function'
  ) {
    throw new TypeError(
      'revenue_settlement_batches must provide findOne and findOneAndUpdate',
    );
  }

  const batch = await settlementBatches.findOne({ _id: batchId });

  if (!batch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(batchId)} was not found`,
      { code: 'BATCH_NOT_FOUND' },
    );
  }

  if (batch.status === 'deposit_submitted') {
    return assertSubmittedDepositAttempt(batch);
  }

  if (batch.status !== 'deposit_prepared') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} must have status "deposit_prepared"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_SUBMIT_DEPOSIT_BATCH_STATUS' },
    );
  }

  const prepared = assertPreparedDepositAttempt(batch);

  const updateResult = await settlementBatches.findOneAndUpdate(
    createSubmittedDepositAttemptFilter(prepared),
    {
      $set: {
        status: 'deposit_submitted',
        'depositAttempt.status': 'submitted',
        'depositAttempt.submittedAt': normalizedSubmittedAt,
        updatedAt: normalizedSubmittedAt,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  const updatedBatch = getReturnedDocument(updateResult);

  if (updatedBatch) {
    return assertSubmittedDepositAttempt(updatedBatch);
  }

  const racedBatch = await settlementBatches.findOne({
    _id: batch._id,
  });

  if (!racedBatch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} disappeared during deposit submission persistence`,
      { code: 'BATCH_DISAPPEARED_DURING_SUBMISSION' },
    );
  }

  if (racedBatch.status === 'deposit_submitted') {
    return assertSubmittedDepositAttempt(racedBatch);
  }

  throw new RevenueSettlementRecipientSnapshotValidationError(
    `V10 deposit submission conditional update lost for batch ${String(
      batch._id,
    )} and no valid submitted attempt is available`,
    { code: 'DEPOSIT_SUBMISSION_CONDITIONAL_UPDATE_LOST' },
  );
}

/**
 * Persists the fact that Algod already confirmed the exact durable V10
 * deposit app-call transaction. This is batch-only: it does not touch
 * revenue_ledger rows, sign, submit, or create a payout round.
 */
export async function persistConfirmedV10DepositBatch({
  db,
  batchId,
  recovery,
  confirmedAt = new Date(),
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  if (batchId === null || batchId === undefined || batchId === '') {
    throw new TypeError('batchId is required');
  }

  const confirmedRecovery = assertConfirmedDepositRecovery(recovery);
  const normalizedConfirmedAt = assertValidDate(
    confirmedAt,
    'confirmedAt',
  );

  const settlementBatches = db.collection(
    'revenue_settlement_batches',
  );

  if (
    !settlementBatches ||
    typeof settlementBatches.findOne !== 'function' ||
    typeof settlementBatches.findOneAndUpdate !== 'function'
  ) {
    throw new TypeError(
      'revenue_settlement_batches must provide findOne and findOneAndUpdate',
    );
  }

  const batch = await settlementBatches.findOne({ _id: batchId });

  if (!batch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(batchId)} was not found`,
      { code: 'BATCH_NOT_FOUND' },
    );
  }

  if (
    batch.status === 'deposit_confirmed_pending_ledger' ||
    batch.status === 'deposited'
  ) {
    return assertConfirmedDepositBatch(batch, confirmedRecovery);
  }

  if (
    batch.status !== 'deposit_prepared' &&
    batch.status !== 'deposit_submitted'
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} must have status "deposit_prepared" or "deposit_submitted"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_CONFIRM_DEPOSIT_BATCH_STATUS' },
    );
  }

  const preparedAttempt = assertPreparedDepositAttempt({
    ...batch,
    status: 'deposit_prepared',
    depositAttempt: {
      ...batch.depositAttempt,
      status: 'prepared',
    },
  });

  if (
    preparedAttempt.depositAttempt.transactionIds.appCall !==
    confirmedRecovery.appCallTransactionId
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Recovery app-call transaction ID does not match the stored deposit attempt',
      { code: 'CONFIRMED_DEPOSIT_TRANSACTION_MISMATCH' },
    );
  }

  const updateResult = await settlementBatches.findOneAndUpdate(
    createConfirmedDepositBatchFilter(batch, confirmedRecovery),
    {
      $set: {
        status: 'deposit_confirmed_pending_ledger',
        usdcDepositTxId:
          confirmedRecovery.appCallTransactionId,
        usdcDepositConfirmedAt: normalizedConfirmedAt,
        'depositAttempt.status': 'confirmed',
        'depositAttempt.confirmedAt': normalizedConfirmedAt,
        'depositAttempt.failureCode': null,
        'depositAttempt.failureMessage': null,
        updatedAt: normalizedConfirmedAt,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  const updatedBatch = getReturnedDocument(updateResult);

  if (updatedBatch) {
    return assertConfirmedDepositBatch(
      updatedBatch,
      confirmedRecovery,
    );
  }

  const racedBatch = await settlementBatches.findOne({
    _id: batch._id,
  });

  if (!racedBatch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} disappeared during confirmed deposit persistence`,
      { code: 'BATCH_DISAPPEARED_DURING_CONFIRMATION' },
    );
  }

  if (
    racedBatch.status === 'deposit_confirmed_pending_ledger' ||
    racedBatch.status === 'deposited'
  ) {
    return assertConfirmedDepositBatch(
      racedBatch,
      confirmedRecovery,
    );
  }

  throw new RevenueSettlementRecipientSnapshotValidationError(
    `Confirmed V10 deposit conditional update lost for batch ${String(
      batch._id,
    )} and no valid confirmed batch state is available`,
    { code: 'CONFIRMED_DEPOSIT_CONDITIONAL_UPDATE_LOST' },
  );
}

function assertConfirmedDepositMaterializationBatch(batch) {
  if (!batch || typeof batch !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Confirmed deposit batch must be an object',
      { code: 'INVALID_PERSISTED_BATCH' },
    );
  }

  if (batch.status !== 'deposit_confirmed_pending_ledger') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch must have status "deposit_confirmed_pending_ledger"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_DEPOSIT_LEDGER_MATERIALIZATION_BATCH_STATUS' },
    );
  }

  const recovery = {
    appCallTransactionId: batch.usdcDepositTxId,
    confirmedRound: batch.confirmedRound,
  };

  const confirmed = assertConfirmedDepositBatch(batch, recovery);
  const snapshot = assertPersistedRecipientSnapshot({
    ...batch,
    status: 'recipient_snapshot_prepared',
  });

  if (
    snapshot.totalAllocationCents !== confirmed.totalAllocationCents ||
    snapshot.totalUsdcAtomicUnits !== confirmed.totalUsdcAtomicUnits
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Frozen recipient snapshot totals do not match confirmed deposit totals',
      { code: 'DEPOSIT_LEDGER_MATERIALIZATION_TOTAL_MISMATCH' },
    );
  }

  return Object.freeze({
    batchId: confirmed.batchId,
    batchKey: confirmed.batchKey,
    revenuePoolAppId: confirmed.revenuePoolAppId,
    poolKey: confirmed.poolKey,
    revenueTokenAssetId: confirmed.revenueTokenAssetId,
    totalAllocationCents: confirmed.totalAllocationCents,
    totalUsdcAtomicUnits: confirmed.totalUsdcAtomicUnits,
    usdcDepositTxId: confirmed.usdcDepositTxId,
    usdcDepositConfirmedAt: confirmed.usdcDepositConfirmedAt,
    confirmedRound: confirmed.confirmedRound,
    holderSnapshot: snapshot.holderSnapshot,
    roundPayeesVersion: snapshot.roundPayeesVersion,
    holderRoundingPolicy: snapshot.holderRoundingPolicy,
    residualRecipientAddress: snapshot.residualRecipientAddress,
    roundPayees: snapshot.roundPayees,
    roundPayeesHash: snapshot.roundPayeesHash,
    roundPayeesFrozenAt: snapshot.roundPayeesFrozenAt,
  });
}

function createDepositLedgerMaterializationKey(batch) {
  return `${String(batch._id)}:confirmed-deposit-ledger:v1`;
}

function createDepositLedgerMaterializationDocument({
  confirmedBatch,
  materializationKey,
  materializedAt,
}) {
  return {
    materializationKey,
    batchId: confirmedBatch.batchId,
    batchKey: confirmedBatch.batchKey,
    status: 'materialized',
    sourceStatus: 'deposit_confirmed_pending_ledger',

    revenuePoolAppId: confirmedBatch.revenuePoolAppId,
    poolKey: confirmedBatch.poolKey,
    revenueTokenAssetId: confirmedBatch.revenueTokenAssetId,

    totalAllocationCents: confirmedBatch.totalAllocationCents,
    totalUsdcAtomicUnits: confirmedBatch.totalUsdcAtomicUnits,

    usdcDepositTxId: confirmedBatch.usdcDepositTxId,
    usdcDepositConfirmedAt: confirmedBatch.usdcDepositConfirmedAt,
    confirmedRound: confirmedBatch.confirmedRound,

    holderSnapshot: confirmedBatch.holderSnapshot,
    roundPayeesVersion: confirmedBatch.roundPayeesVersion,
    holderRoundingPolicy: confirmedBatch.holderRoundingPolicy,
    residualRecipientAddress: confirmedBatch.residualRecipientAddress,
    roundPayees: confirmedBatch.roundPayees,
    roundPayeesHash: confirmedBatch.roundPayeesHash,
    roundPayeesFrozenAt: confirmedBatch.roundPayeesFrozenAt,

    createdAt: materializedAt,
    updatedAt: materializedAt,
  };
}

function assertMatchingDepositLedgerMaterialization(
  materialization,
  expected,
) {
  if (!materialization || typeof materialization !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Deposit ledger materialization must be an object',
      { code: 'INVALID_DEPOSIT_LEDGER_MATERIALIZATION' },
    );
  }

  const immutableFields = [
    'materializationKey',
    'batchId',
    'batchKey',
    'status',
    'sourceStatus',
    'revenuePoolAppId',
    'poolKey',
    'revenueTokenAssetId',
    'totalAllocationCents',
    'totalUsdcAtomicUnits',
    'usdcDepositTxId',
    'confirmedRound',
    'roundPayeesVersion',
    'holderRoundingPolicy',
    'residualRecipientAddress',
    'roundPayeesHash',
  ];

  for (const fieldName of immutableFields) {
    if (materialization[fieldName] !== expected[fieldName]) {
      throw new RevenueSettlementRecipientSnapshotValidationError(
        `Deposit ledger materialization immutable field mismatch: ${fieldName}`,
        { code: 'DEPOSIT_LEDGER_MATERIALIZATION_CONFLICT' },
      );
    }
  }

  const jsonFields = [
    'holderSnapshot',
    'roundPayees',
  ];

  for (const fieldName of jsonFields) {
    if (!sameJson(materialization[fieldName], expected[fieldName])) {
      throw new RevenueSettlementRecipientSnapshotValidationError(
        `Deposit ledger materialization immutable field mismatch: ${fieldName}`,
        { code: 'DEPOSIT_LEDGER_MATERIALIZATION_CONFLICT' },
      );
    }
  }

  const materializationConfirmedAt = assertValidDate(
    materialization.usdcDepositConfirmedAt,
    'materialization.usdcDepositConfirmedAt',
  );
  const expectedConfirmedAt = assertValidDate(
    expected.usdcDepositConfirmedAt,
    'expected.usdcDepositConfirmedAt',
  );

  if (
    materializationConfirmedAt.getTime() !==
    expectedConfirmedAt.getTime()
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Deposit ledger materialization immutable field mismatch: usdcDepositConfirmedAt',
      { code: 'DEPOSIT_LEDGER_MATERIALIZATION_CONFLICT' },
    );
  }

  return Object.freeze({
    ...materialization,
    usdcDepositConfirmedAt: materializationConfirmedAt,
    roundPayeesFrozenAt: assertValidDate(
      materialization.roundPayeesFrozenAt,
      'materialization.roundPayeesFrozenAt',
    ),
    createdAt: assertValidDate(
      materialization.createdAt,
      'materialization.createdAt',
    ),
    updatedAt: assertValidDate(
      materialization.updatedAt,
      'materialization.updatedAt',
    ),
  });
}

/**
 * Materializes the immutable, confirmed V10 deposit into one durable
 * ledger-facing record and transitions exactly once to `deposited`.
 *
 * Does not snapshot holders, rebuild or submit a deposit, create a payout
 * round, sign/broadcast transactions, or mutate revenue-ledger rows.
 */
export async function materializeConfirmedDepositIntoLedger({
  db,
  batchId,
  now = new Date(),
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  if (batchId === null || batchId === undefined || batchId === '') {
    throw new TypeError('batchId is required');
  }

  const materializedAt = assertValidDate(now, 'now');
  const settlementBatches = db.collection('revenue_settlement_batches');
  const materializations = db.collection(
    'revenue_settlement_deposit_ledger_materializations',
  );

  if (
    !settlementBatches ||
    typeof settlementBatches.findOne !== 'function' ||
    typeof settlementBatches.findOneAndUpdate !== 'function'
  ) {
    throw new TypeError(
      'revenue_settlement_batches must provide findOne and findOneAndUpdate',
    );
  }

  if (
    !materializations ||
    typeof materializations.findOne !== 'function' ||
    typeof materializations.insertOne !== 'function'
  ) {
    throw new TypeError(
      'revenue_settlement_deposit_ledger_materializations must provide findOne and insertOne',
    );
  }

  const batch = await settlementBatches.findOne({ _id: batchId });

  if (!batch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(batchId)} was not found`,
      { code: 'BATCH_NOT_FOUND' },
    );
  }

  const materializationKey = createDepositLedgerMaterializationKey(batch);

  if (batch.status === 'deposited') {
    const existing = await materializations.findOne({
      materializationKey,
    });

    if (!existing) {
      throw new RevenueSettlementRecipientSnapshotValidationError(
        'Deposited settlement batch has no durable deposit ledger materialization',
        { code: 'MISSING_DEPOSIT_LEDGER_MATERIALIZATION' },
      );
    }

    const confirmedBatch = assertConfirmedDepositMaterializationBatch({
      ...batch,
      status: 'deposit_confirmed_pending_ledger',
    });

    const expected = createDepositLedgerMaterializationDocument({
      confirmedBatch,
      materializationKey,
      materializedAt: existing.createdAt,
    });

    return assertMatchingDepositLedgerMaterialization(existing, expected);
  }

  const confirmedBatch = assertConfirmedDepositMaterializationBatch(batch);

  const expected = createDepositLedgerMaterializationDocument({
    confirmedBatch,
    materializationKey,
    materializedAt,
  });

  const existing = await materializations.findOne({
    materializationKey,
  });

  if (existing) {
    assertMatchingDepositLedgerMaterialization(existing, expected);
  } else {
    try {
      await materializations.insertOne(expected);
    } catch (cause) {
      const concurrent = await materializations.findOne({
        materializationKey,
      });

      if (!concurrent) {
        throw cause;
      }

      assertMatchingDepositLedgerMaterialization(concurrent, expected);
    }
  }

  const updateResult = await settlementBatches.findOneAndUpdate(
    {
      _id: batch._id,
      status: 'deposit_confirmed_pending_ledger',
      usdcDepositTxId: confirmedBatch.usdcDepositTxId,
      usdcDepositConfirmedAt: confirmedBatch.usdcDepositConfirmedAt,
      roundPayeesHash: confirmedBatch.roundPayeesHash,
    },
    {
      $set: {
        status: 'deposited',
        depositLedgerMaterializationKey: materializationKey,
        depositLedgerMaterializedAt: materializedAt,
        updatedAt: materializedAt,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  const updatedBatch = getReturnedDocument(updateResult);

  if (updatedBatch) {
    return assertMatchingDepositLedgerMaterialization(
      await materializations.findOne({ materializationKey }),
      expected,
    );
  }

  const racedBatch = await settlementBatches.findOne({
    _id: batch._id,
  });

  if (!racedBatch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} disappeared during deposit ledger materialization`,
      { code: 'BATCH_DISAPPEARED_DURING_DEPOSIT_LEDGER_MATERIALIZATION' },
    );
  }

  if (
    racedBatch.status === 'deposited' &&
    racedBatch.depositLedgerMaterializationKey === materializationKey
  ) {
    return assertMatchingDepositLedgerMaterialization(
      await materializations.findOne({ materializationKey }),
      expected,
    );
  }

  throw new RevenueSettlementRecipientSnapshotValidationError(
    `Deposit ledger materialization conditional update lost for batch ${String(
      batch._id,
    )}`,
    { code: 'DEPOSIT_LEDGER_MATERIALIZATION_CONDITIONAL_UPDATE_LOST' },
  );
}

function createPayoutRoundKey(batch) {
  return `${String(batch._id)}:payout-round:v1`;
}

function createPayoutRoundDocument({
  batch,
  materialization,
  payoutRoundKey,
  createdAt,
}) {
  return {
    payoutRoundKey,
    batchId: String(batch._id),
    batchKey: batch.batchKey,
    status: 'created',

    revenuePoolAppId: batch.revenuePoolAppId,
    poolKey: batch.poolKey,
    revenueTokenAssetId: batch.revenueTokenAssetId,

    totalAllocationCents: batch.totalAllocationCents,
    totalUsdcAtomicUnits: batch.totalUsdcAtomicUnits,

    depositLedgerMaterializationKey:
      materialization.materializationKey,
    usdcDepositTxId: materialization.usdcDepositTxId,
    usdcDepositConfirmedAt:
      materialization.usdcDepositConfirmedAt,
    confirmedRound: materialization.confirmedRound,

    holderSnapshot: materialization.holderSnapshot,
    roundPayeesVersion: materialization.roundPayeesVersion,
    holderRoundingPolicy: materialization.holderRoundingPolicy,
    residualRecipientAddress:
      materialization.residualRecipientAddress,
    roundPayees: materialization.roundPayees,
    roundPayeesHash: materialization.roundPayeesHash,
    roundPayeesFrozenAt:
      materialization.roundPayeesFrozenAt,

    createdAt,
    updatedAt: createdAt,
  };
}

function assertMatchingPayoutRound(round, expected) {
  if (!round || typeof round !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout round must be an object',
      { code: 'INVALID_PAYOUT_ROUND' },
    );
  }

  const immutableFields = [
    'payoutRoundKey',
    'batchId',
    'batchKey',
    'status',
    'revenuePoolAppId',
    'poolKey',
    'revenueTokenAssetId',
    'totalAllocationCents',
    'totalUsdcAtomicUnits',
    'depositLedgerMaterializationKey',
    'usdcDepositTxId',
    'confirmedRound',
    'roundPayeesVersion',
    'holderRoundingPolicy',
    'residualRecipientAddress',
    'roundPayeesHash',
  ];

  for (const fieldName of immutableFields) {
    if (round[fieldName] !== expected[fieldName]) {
      throw new RevenueSettlementRecipientSnapshotValidationError(
        `Payout round immutable field mismatch: ${fieldName}`,
        { code: 'PAYOUT_ROUND_CONFLICT' },
      );
    }
  }

  for (const fieldName of ['holderSnapshot', 'roundPayees']) {
    if (!sameJson(round[fieldName], expected[fieldName])) {
      throw new RevenueSettlementRecipientSnapshotValidationError(
        `Payout round immutable field mismatch: ${fieldName}`,
        { code: 'PAYOUT_ROUND_CONFLICT' },
      );
    }
  }

  const roundConfirmedAt = assertValidDate(
    round.usdcDepositConfirmedAt,
    'round.usdcDepositConfirmedAt',
  );
  const expectedConfirmedAt = assertValidDate(
    expected.usdcDepositConfirmedAt,
    'expected.usdcDepositConfirmedAt',
  );

  if (roundConfirmedAt.getTime() !== expectedConfirmedAt.getTime()) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout round immutable field mismatch: usdcDepositConfirmedAt',
      { code: 'PAYOUT_ROUND_CONFLICT' },
    );
  }

  return Object.freeze({
    ...round,
    usdcDepositConfirmedAt: roundConfirmedAt,
    roundPayeesFrozenAt: assertValidDate(
      round.roundPayeesFrozenAt,
      'round.roundPayeesFrozenAt',
    ),
    createdAt: assertValidDate(round.createdAt, 'round.createdAt'),
    updatedAt: assertValidDate(round.updatedAt, 'round.updatedAt'),
  });
}

export async function createPayoutRoundFromMaterializedDeposit({
  db,
  batchId,
  now = new Date(),
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  if (batchId === null || batchId === undefined || batchId === '') {
    throw new TypeError('batchId is required');
  }

  const createdAt = assertValidDate(now, 'now');
  const settlementBatches = db.collection('revenue_settlement_batches');
  const materializations = db.collection(
    'revenue_settlement_deposit_ledger_materializations',
  );
  const payoutRounds = db.collection('revenue_payout_rounds');

  const batch = await settlementBatches.findOne({ _id: batchId });

  if (!batch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(batchId)} was not found`,
      { code: 'BATCH_NOT_FOUND' },
    );
  }

  const payoutRoundKey = createPayoutRoundKey(batch);

  if (batch.status !== 'deposited' && batch.status !== 'round_created') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch must have status "deposited"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_PAYOUT_ROUND_BATCH_STATUS' },
    );
  }

  const materializationKey = assertNonEmptyString(
    batch.depositLedgerMaterializationKey,
    'batch.depositLedgerMaterializationKey',
  );

  const materialization = await materializations.findOne({
    materializationKey,
  });

  if (!materialization) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Deposited settlement batch has no durable deposit ledger materialization',
      { code: 'MISSING_DEPOSIT_LEDGER_MATERIALIZATION' },
    );
  }

  if (
    materialization.batchId !== String(batch._id) ||
    materialization.batchKey !== batch.batchKey ||
    materialization.totalAllocationCents !==
      batch.totalAllocationCents ||
    materialization.totalUsdcAtomicUnits !==
      batch.totalUsdcAtomicUnits ||
    materialization.roundPayeesHash !== batch.roundPayeesHash
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Deposit ledger materialization does not match immutable settlement batch facts',
      { code: 'PAYOUT_ROUND_MATERIALIZATION_MISMATCH' },
    );
  }

  const expected = createPayoutRoundDocument({
    batch,
    materialization,
    payoutRoundKey,
    createdAt,
  });

  const existingRound = await payoutRounds.findOne({
    payoutRoundKey,
  });

  if (existingRound) {
    const validated = assertMatchingPayoutRound(
      existingRound,
      expected,
    );

    if (batch.status === 'round_created') {
      return validated;
    }
  } else {
    try {
      await payoutRounds.insertOne(expected);
    } catch (cause) {
      const concurrentRound = await payoutRounds.findOne({
        payoutRoundKey,
      });

      if (!concurrentRound) {
        throw cause;
      }

      assertMatchingPayoutRound(concurrentRound, expected);
    }
  }

  if (batch.status === 'round_created') {
    return assertMatchingPayoutRound(
      await payoutRounds.findOne({ payoutRoundKey }),
      expected,
    );
  }

  const updateResult = await settlementBatches.findOneAndUpdate(
    {
      _id: batch._id,
      status: 'deposited',
      depositLedgerMaterializationKey: materializationKey,
      roundPayeesHash: batch.roundPayeesHash,
      revenueRoundId: null,
      revenueRoundTxId: null,
      revenueRoundCreatedAt: null,
    },
    {
      $set: {
        status: 'round_created',
        revenueRoundId: payoutRoundKey,
        revenueRoundCreatedAt: createdAt,
        updatedAt: createdAt,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  const updatedBatch = getReturnedDocument(updateResult);

  if (updatedBatch) {
    return assertMatchingPayoutRound(
      await payoutRounds.findOne({ payoutRoundKey }),
      expected,
    );
  }

  const racedBatch = await settlementBatches.findOne({
    _id: batch._id,
  });

  if (
    racedBatch?.status === 'round_created' &&
    racedBatch.revenueRoundId === payoutRoundKey
  ) {
    return assertMatchingPayoutRound(
      await payoutRounds.findOne({ payoutRoundKey }),
      expected,
    );
  }

  throw new RevenueSettlementRecipientSnapshotValidationError(
    `Payout-round conditional update lost for batch ${String(batch._id)}`,
    { code: 'PAYOUT_ROUND_CONDITIONAL_UPDATE_LOST' },
  );
}

function assertRoundCreatedBatch(batch) {
  if (!batch || typeof batch !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout-round batch must be an object',
      { code: 'INVALID_PAYOUT_ROUND_BATCH' },
    );
  }

  if (batch.status !== 'round_created') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch must have status "round_created"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_PAYOUT_DISTRIBUTION_BATCH_STATUS' },
    );
  }

  const revenueRoundId = assertNonEmptyString(
    batch.revenueRoundId,
    'batch.revenueRoundId',
  );

  if (batch.revenueRoundTxId !== null && batch.revenueRoundTxId !== undefined) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'round_created batch must not contain revenueRoundTxId',
      { code: 'PAYOUT_DISTRIBUTION_ALREADY_SUBMITTED' },
    );
  }

  return Object.freeze({
    batchId: assertNonEmptyString(String(batch._id), 'batch._id'),
    batchKey: assertNonEmptyString(batch.batchKey, 'batch.batchKey'),
    revenueRoundId,
    revenuePoolAppId: assertSafeInteger(
      batch.revenuePoolAppId,
      'batch.revenuePoolAppId',
      { minimum: 1 },
    ),
    poolKey: assertNonEmptyString(batch.poolKey, 'batch.poolKey'),
    revenueTokenAssetId: assertSafeInteger(
      batch.revenueTokenAssetId,
      'batch.revenueTokenAssetId',
      { minimum: 1 },
    ),
    totalAllocationCents: assertSafeInteger(
      batch.totalAllocationCents,
      'batch.totalAllocationCents',
      { minimum: 1 },
    ),
    totalUsdcAtomicUnits: assertSafeInteger(
      batch.totalUsdcAtomicUnits,
      'batch.totalUsdcAtomicUnits',
      { minimum: 1 },
    ),
    depositLedgerMaterializationKey: assertNonEmptyString(
      batch.depositLedgerMaterializationKey,
      'batch.depositLedgerMaterializationKey',
    ),
    roundPayeesHash: assertNonEmptyString(
      batch.roundPayeesHash,
      'batch.roundPayeesHash',
    ),
  });
}

function normalizeFrozenRoundPayees(roundPayees, totalUsdcAtomicUnits) {
  if (!Array.isArray(roundPayees) || roundPayees.length === 0) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'round.roundPayees must contain at least one recipient',
      { code: 'INVALID_PAYOUT_DISTRIBUTION_PAYEES' },
    );
  }

  const seenAddresses = new Set();

  const normalized = roundPayees.map((payee, index) => {
    const { address, addressBytes } = getAddressBytes(
      payee?.address,
      `round.roundPayees[${index}].address`,
    );

    if (seenAddresses.has(address)) {
      throw new RevenueSettlementRecipientSnapshotValidationError(
        `round.roundPayees contains duplicate address ${address}`,
        { code: 'DUPLICATE_PAYOUT_DISTRIBUTION_PAYEE' },
      );
    }

    seenAddresses.add(address);

    const revUnits = toPositiveBigInt(
      payee?.revUnits,
      `round.roundPayees[${index}].revUnits`,
    );

    const amountUsdcAtomicUnits = assertSafeInteger(
      payee?.amountUsdcAtomicUnits,
      `round.roundPayees[${index}].amountUsdcAtomicUnits`,
      { minimum: 1 },
    );

    return {
      address,
      addressBytes,
      revUnits: revUnits.toString(),
      amountUsdcAtomicUnits,
    };
  });

  normalized.sort(compareAddressBytes);

  const total = normalized.reduce(
    (sum, payee) => sum + payee.amountUsdcAtomicUnits,
    0,
  );

  if (total !== totalUsdcAtomicUnits) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Frozen payout recipients do not reconcile to the payout-round USDC total',
      { code: 'PAYOUT_DISTRIBUTION_TOTAL_MISMATCH' },
    );
  }

  return Object.freeze(
    normalized.map(({ addressBytes, ...payee }) => Object.freeze(payee)),
  );
}

function assertPayoutRoundForDistribution({
  batch,
  round,
}) {
  if (!round || typeof round !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout round must be an object',
      { code: 'INVALID_PAYOUT_ROUND' },
    );
  }

  const batchFacts = assertRoundCreatedBatch(batch);

  if (
    round.payoutRoundKey !== batchFacts.revenueRoundId ||
    round.batchId !== batchFacts.batchId ||
    round.batchKey !== batchFacts.batchKey ||
    round.status !== 'created' ||
    round.revenuePoolAppId !== batchFacts.revenuePoolAppId ||
    round.poolKey !== batchFacts.poolKey ||
    round.revenueTokenAssetId !== batchFacts.revenueTokenAssetId ||
    round.totalAllocationCents !== batchFacts.totalAllocationCents ||
    round.totalUsdcAtomicUnits !== batchFacts.totalUsdcAtomicUnits ||
    round.depositLedgerMaterializationKey !==
      batchFacts.depositLedgerMaterializationKey ||
    round.roundPayeesHash !== batchFacts.roundPayeesHash
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout round does not match immutable settlement batch facts',
      { code: 'PAYOUT_DISTRIBUTION_ROUND_MISMATCH' },
    );
  }

  const payees = normalizeFrozenRoundPayees(
    round.roundPayees,
    batchFacts.totalUsdcAtomicUnits,
  );

  const packedPayees = createCanonicalPackedPayees(payees);

  if (hashPayload(packedPayees) !== round.roundPayeesHash) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout round recipient hash does not match frozen recipients',
      { code: 'PAYOUT_DISTRIBUTION_PAYEE_HASH_MISMATCH' },
    );
  }

  return Object.freeze({
    ...batchFacts,
    usdcDepositTxId: assertNonEmptyString(
      round.usdcDepositTxId,
      'round.usdcDepositTxId',
    ),
    usdcDepositConfirmedAt: assertValidDate(
      round.usdcDepositConfirmedAt,
      'round.usdcDepositConfirmedAt',
    ),
    confirmedRound: assertNonEmptyString(
      String(round.confirmedRound),
      'round.confirmedRound',
    ),
    roundPayeesVersion: assertNonEmptyString(
      round.roundPayeesVersion,
      'round.roundPayeesVersion',
    ),
    holderRoundingPolicy: assertNonEmptyString(
      round.holderRoundingPolicy,
      'round.holderRoundingPolicy',
    ),
    residualRecipientAddress: assertNonEmptyString(
      round.residualRecipientAddress,
      'round.residualRecipientAddress',
    ),
    roundPayeesHash: round.roundPayeesHash,
    roundPayeesFrozenAt: assertValidDate(
      round.roundPayeesFrozenAt,
      'round.roundPayeesFrozenAt',
    ),
    roundPayees: payees,
  });
}

/**
 * Read-only validation and deterministic payout-instruction selection.
 *
 * Does not persist, sign, submit, broadcast, create a payout round,
 * mutate revenue-ledger rows, or re-query live V10 holder balances.
 */
export async function preparePayoutRoundDistribution({
  db,
  batchId,
  now = new Date(),
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  if (batchId === null || batchId === undefined || batchId === '') {
    throw new TypeError('batchId is required');
  }

  const preparedAt = assertValidDate(now, 'now');
  const settlementBatches = db.collection('revenue_settlement_batches');
  const payoutRounds = db.collection('revenue_payout_rounds');

  if (
    !settlementBatches ||
    typeof settlementBatches.findOne !== 'function'
  ) {
    throw new TypeError(
      'revenue_settlement_batches must provide findOne',
    );
  }

  if (!payoutRounds || typeof payoutRounds.findOne !== 'function') {
    throw new TypeError('revenue_payout_rounds must provide findOne');
  }

  const batch = await settlementBatches.findOne({ _id: batchId });

  if (!batch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(batchId)} was not found`,
      { code: 'BATCH_NOT_FOUND' },
    );
  }

  const batchFacts = assertRoundCreatedBatch(batch);

  const round = await payoutRounds.findOne({
    payoutRoundKey: batchFacts.revenueRoundId,
  });

  if (!round) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Payout round ${batchFacts.revenueRoundId} was not found`,
      { code: 'PAYOUT_ROUND_NOT_FOUND' },
    );
  }

  const validated = assertPayoutRoundForDistribution({
    batch,
    round,
  });

  const payoutInstructions = Object.freeze(
    validated.roundPayees.map((payee, index) =>
      Object.freeze({
        instructionIndex: index,
        recipientAddress: payee.address,
        amountUsdcAtomicUnits: payee.amountUsdcAtomicUnits,
      }),
    ),
  );

  const totalInstructionAmount = payoutInstructions.reduce(
    (total, instruction) =>
      total + instruction.amountUsdcAtomicUnits,
    0,
  );

  if (totalInstructionAmount !== validated.totalUsdcAtomicUnits) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout instructions do not reconcile to the frozen payout-round USDC total',
      { code: 'PAYOUT_INSTRUCTION_TOTAL_MISMATCH' },
    );
  }

  return Object.freeze({
    batchId: validated.batchId,
    batchKey: validated.batchKey,
    payoutRoundKey: validated.revenueRoundId,
    status: 'ready_for_distribution',
    preparedAt,

    revenuePoolAppId: validated.revenuePoolAppId,
    poolKey: validated.poolKey,
    revenueTokenAssetId: validated.revenueTokenAssetId,

    totalAllocationCents: validated.totalAllocationCents,
    totalUsdcAtomicUnits: validated.totalUsdcAtomicUnits,

    depositLedgerMaterializationKey:
      validated.depositLedgerMaterializationKey,
    usdcDepositTxId: validated.usdcDepositTxId,
    usdcDepositConfirmedAt:
      validated.usdcDepositConfirmedAt,
    confirmedRound: validated.confirmedRound,

    roundPayeesHash: validated.roundPayeesHash,
    roundPayeesFrozenAt: validated.roundPayeesFrozenAt,
    payoutInstructions,
  });
}

const V10_CREATE_PAYOUT_ROUND_ATTEMPT_VERSION = 'v1';
const V10_CREATE_PAYOUT_ROUND_OPERATION =
  'v10_create_payout_round';

function createPayoutRoundSubmissionAttemptKey(batchId) {
  return `${String(
    batchId,
  )}:create-payout-round:${V10_CREATE_PAYOUT_ROUND_ATTEMPT_VERSION}`;
}

function assertPreparedCreatePayoutRoundAttempt({
  batch,
  attempt,
}) {
  if (!attempt || typeof attempt !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout submission attempt must be an object',
      { code: 'INVALID_PAYOUT_SUBMISSION_ATTEMPT' },
    );
  }

  const expectedAttemptKey =
    createPayoutRoundSubmissionAttemptKey(batch._id);

  if (attempt.attemptKey !== expectedAttemptKey) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout submission attempt key does not match the batch',
      { code: 'INVALID_PAYOUT_SUBMISSION_ATTEMPT_KEY' },
    );
  }

  if (attempt.operation !== V10_CREATE_PAYOUT_ROUND_OPERATION) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout submission attempt operation is invalid',
      { code: 'INVALID_PAYOUT_SUBMISSION_ATTEMPT_OPERATION' },
    );
  }

  if (attempt.status !== 'prepared') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout submission attempt status must be "prepared"',
      { code: 'INVALID_PAYOUT_SUBMISSION_ATTEMPT_STATUS' },
    );
  }

  if (attempt.payoutRoundKey !== batch.revenueRoundId) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout submission attempt payout-round key does not match batch',
      { code: 'PAYOUT_SUBMISSION_ROUND_MISMATCH' },
    );
  }

  if (
    attempt.totalUsdcAtomicUnits !==
    batch.totalUsdcAtomicUnits
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout submission attempt amount does not match batch',
      { code: 'PAYOUT_SUBMISSION_AMOUNT_MISMATCH' },
    );
  }

  if (attempt.roundPayeesHash !== batch.roundPayeesHash) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout submission attempt payee hash does not match batch',
      { code: 'PAYOUT_SUBMISSION_PAYEE_HASH_MISMATCH' },
    );
  }

  if (
    !Array.isArray(attempt.unsignedTransactionsBase64) ||
    attempt.unsignedTransactionsBase64.length !== 2
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout submission attempt must contain two unsigned transactions',
      { code: 'INVALID_PAYOUT_SUBMISSION_UNSIGNED_TRANSACTIONS' },
    );
  }

  for (
    let index = 0;
    index < attempt.unsignedTransactionsBase64.length;
    index += 1
  ) {
    assertNonEmptyString(
      attempt.unsignedTransactionsBase64[index],
      `attempt.unsignedTransactionsBase64[${index}]`,
    );
  }

  if (
    !attempt.transactionIds ||
    typeof attempt.transactionIds !== 'object'
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Payout submission attempt transaction IDs are required',
      { code: 'INVALID_PAYOUT_SUBMISSION_TRANSACTION_IDS' },
    );
  }

  const appCallTransactionId = assertNonEmptyString(
    attempt.transactionIds.appCall,
    'attempt.transactionIds.appCall',
  );
  const companionPaymentTransactionId = assertNonEmptyString(
    attempt.transactionIds.companionPayment,
    'attempt.transactionIds.companionPayment',
  );

  return Object.freeze({
    attemptKey: expectedAttemptKey,
    operation: V10_CREATE_PAYOUT_ROUND_OPERATION,
    status: 'prepared',
    payoutRoundKey: attempt.payoutRoundKey,
    totalUsdcAtomicUnits: attempt.totalUsdcAtomicUnits,
    roundPayeesHash: attempt.roundPayeesHash,
    sender: assertNonEmptyString(attempt.sender, 'attempt.sender'),
    groupId: assertNonEmptyString(attempt.groupId, 'attempt.groupId'),
    unsignedTransactionHash: assertNonEmptyString(
      attempt.unsignedTransactionHash,
      'attempt.unsignedTransactionHash',
    ),
    unsignedTransactionsBase64: Object.freeze([
      ...attempt.unsignedTransactionsBase64,
    ]),
    transactionIds: Object.freeze({
      appCall: appCallTransactionId,
      companionPayment: companionPaymentTransactionId,
    }),
    roundBoxMbrMicroalgos: assertSafeInteger(
      attempt.roundBoxMbrMicroalgos,
      'attempt.roundBoxMbrMicroalgos',
      { minimum: 1 },
    ),
    preparedAt: assertValidDate(
      attempt.preparedAt,
      'attempt.preparedAt',
    ),
    submittedAt:
      attempt.submittedAt === null ||
      attempt.submittedAt === undefined
        ? null
        : assertValidDate(
            attempt.submittedAt,
            'attempt.submittedAt',
          ),
    confirmedAt:
      attempt.confirmedAt === null ||
      attempt.confirmedAt === undefined
        ? null
        : assertValidDate(
            attempt.confirmedAt,
            'attempt.confirmedAt',
          ),
    failureCode:
      attempt.failureCode === null ||
      attempt.failureCode === undefined
        ? null
        : assertNonEmptyString(
            attempt.failureCode,
            'attempt.failureCode',
          ),
    failureMessage:
      attempt.failureMessage === null ||
      attempt.failureMessage === undefined
        ? null
        : assertNonEmptyString(
            attempt.failureMessage,
            'attempt.failureMessage',
          ),
  });
}

function createPreparedCreatePayoutRoundAttempt({
  distribution,
  sender,
  unsignedGroup,
  preparedAt,
}) {
  if (!unsignedGroup || typeof unsignedGroup !== 'object') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Unsigned payout-round group is required',
      { code: 'INVALID_PAYOUT_SUBMISSION_GROUP' },
    );
  }

  if (
    unsignedGroup.action !== 'create_payout_round' ||
    unsignedGroup.appId !== distribution.revenuePoolAppId ||
    unsignedGroup.poolKey !== distribution.poolKey ||
    unsignedGroup.totalUsdcAtomicUnits !==
      distribution.totalUsdcAtomicUnits ||
    unsignedGroup.roundPayeesHash !== undefined &&
      unsignedGroup.roundPayeesHash !== distribution.roundPayeesHash
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Unsigned payout-round group does not match frozen distribution',
      { code: 'PAYOUT_SUBMISSION_GROUP_MISMATCH' },
    );
  }

  if (
    !Array.isArray(unsignedGroup.unsignedTransactionsBase64) ||
    unsignedGroup.unsignedTransactionsBase64.length !== 2
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Unsigned payout-round group must contain exactly two transactions',
      { code: 'INVALID_PAYOUT_SUBMISSION_GROUP' },
    );
  }

  if (
    !unsignedGroup.transactionIds ||
    typeof unsignedGroup.transactionIds !== 'object'
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'Unsigned payout-round group must include transaction IDs',
      { code: 'INVALID_PAYOUT_SUBMISSION_GROUP' },
    );
  }

  return {
    attemptKey: createPayoutRoundSubmissionAttemptKey(
      distribution.batchId,
    ),
    operation: V10_CREATE_PAYOUT_ROUND_OPERATION,
    status: 'prepared',

    payoutRoundKey: distribution.payoutRoundKey,
    totalUsdcAtomicUnits:
      distribution.totalUsdcAtomicUnits,
    roundPayeesHash: distribution.roundPayeesHash,

    sender: assertNonEmptyString(sender, 'sender'),

    groupId: assertNonEmptyString(
      unsignedGroup.groupId,
      'unsignedGroup.groupId',
    ),
    unsignedTransactionHash: assertNonEmptyString(
      unsignedGroup.unsignedTransactionHash,
      'unsignedGroup.unsignedTransactionHash',
    ),
    unsignedTransactionsBase64: [
      ...unsignedGroup.unsignedTransactionsBase64,
    ],
    transactionIds: {
      appCall: assertNonEmptyString(
        unsignedGroup.transactionIds.appCall,
        'unsignedGroup.transactionIds.appCall',
      ),
      companionPayment: assertNonEmptyString(
        unsignedGroup.transactionIds.companionPayment,
        'unsignedGroup.transactionIds.companionPayment',
      ),
    },
    roundBoxMbrMicroalgos: assertSafeInteger(
      unsignedGroup.roundBoxMbrMicroalgos,
      'unsignedGroup.roundBoxMbrMicroalgos',
      { minimum: 1 },
    ),

    preparedAt,
    submittedAt: null,
    confirmedAt: null,
    failureCode: null,
    failureMessage: null,
  };
}

/**
 * Builds and durably persists one unsigned V10 create_payout_round group.
 *
 * This operation does not sign, submit, broadcast, confirm an app call,
 * mark a recipient claimed, or mutate revenue-ledger rows.
 */
export async function prepareCreatePayoutRoundSubmission({
  db,
  batchId,
  sender,
  suggestedParams,
  now = new Date(),
  buildUnsignedGroup =
    buildUnsignedV10CreatePayoutRoundGroup,
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  if (batchId === null || batchId === undefined || batchId === '') {
    throw new TypeError('batchId is required');
  }

  if (typeof buildUnsignedGroup !== 'function') {
    throw new TypeError('buildUnsignedGroup must be a function');
  }

  const preparedAt = assertValidDate(now, 'now');
  const settlementBatches = db.collection(
    'revenue_settlement_batches',
  );

  if (
    !settlementBatches ||
    typeof settlementBatches.findOne !== 'function' ||
    typeof settlementBatches.findOneAndUpdate !== 'function'
  ) {
    throw new TypeError(
      'revenue_settlement_batches must provide findOne and findOneAndUpdate',
    );
  }

  const batch = await settlementBatches.findOne({ _id: batchId });

  if (!batch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(batchId)} was not found`,
      { code: 'BATCH_NOT_FOUND' },
    );
  }

  if (batch.status === 'payout_prepared') {
    return assertPreparedCreatePayoutRoundAttempt({
      batch,
      attempt: batch.payoutSubmissionAttempt,
    });
  }

  if (batch.status !== 'round_created') {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch must have status "round_created"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_PAYOUT_SUBMISSION_BATCH_STATUS' },
    );
  }

  if (
    batch.payoutSubmissionAttempt !== null &&
    batch.payoutSubmissionAttempt !== undefined
  ) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      'round_created batch already contains payoutSubmissionAttempt data',
      { code: 'PAYOUT_SUBMISSION_ATTEMPT_ALREADY_PRESENT' },
    );
  }

  const distribution = await preparePayoutRoundDistribution({
    db,
    batchId,
    now: preparedAt,
  });

  const unsignedGroup = await buildUnsignedGroup({
    appId: distribution.revenuePoolAppId,
    poolKey: distribution.poolKey,
    sender,
    roundPayees: distribution.payoutInstructions.map(
      (instruction) => ({
        address: instruction.recipientAddress,
        amountUsdcAtomicUnits:
          instruction.amountUsdcAtomicUnits,
      }),
    ),
    totalUsdcAtomicUnits:
      distribution.totalUsdcAtomicUnits,
    suggestedParams,
  });

  const payoutSubmissionAttempt =
    createPreparedCreatePayoutRoundAttempt({
      distribution,
      sender,
      unsignedGroup,
      preparedAt,
    });

  const updateResult = await settlementBatches.findOneAndUpdate(
    {
      _id: batch._id,
      status: 'round_created',
      payoutSubmissionAttempt: null,
      revenueRoundId: distribution.payoutRoundKey,
      roundPayeesHash: distribution.roundPayeesHash,
    },
    {
      $set: {
        status: 'payout_prepared',
        payoutSubmissionAttempt,
        updatedAt: preparedAt,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  const updatedBatch = getReturnedDocument(updateResult);

  if (updatedBatch) {
    return assertPreparedCreatePayoutRoundAttempt({
      batch: updatedBatch,
      attempt: updatedBatch.payoutSubmissionAttempt,
    });
  }

  const racedBatch = await settlementBatches.findOne({
    _id: batch._id,
  });

  if (!racedBatch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(
        batch._id,
      )} disappeared during payout submission preparation`,
      { code: 'BATCH_DISAPPEARED_DURING_PAYOUT_SUBMISSION_PREPARATION' },
    );
  }

  if (racedBatch.status === 'payout_prepared') {
    return assertPreparedCreatePayoutRoundAttempt({
      batch: racedBatch,
      attempt: racedBatch.payoutSubmissionAttempt,
    });
  }

  throw new RevenueSettlementRecipientSnapshotValidationError(
    `Payout submission conditional update lost for batch ${String(
      batch._id,
    )}`,
    { code: 'PAYOUT_SUBMISSION_CONDITIONAL_UPDATE_LOST' },
  );
}