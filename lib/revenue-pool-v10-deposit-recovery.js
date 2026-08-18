export const V10_DEPOSIT_RECOVERY_OUTCOMES = Object.freeze([
  'unknown',
  'pending',
  'confirmed',
  'rejected',
  'network_error',
]);

export class V10DepositRecoveryValidationError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'V10DepositRecoveryValidationError';
    this.code = code || 'V10_DEPOSIT_RECOVERY_VALIDATION_ERROR';
  }
}

function assertAlgodClient(algodClient) {
  if (
    !algodClient ||
    typeof algodClient.pendingTransactionInformation !== 'function'
  ) {
    throw new V10DepositRecoveryValidationError(
      'algodClient must provide pendingTransactionInformation(transactionId)',
      { code: 'INVALID_ALGOD_CLIENT' },
    );
  }
}

function assertBatch(batch) {
  if (!batch || typeof batch !== 'object') {
    throw new V10DepositRecoveryValidationError(
      'batch must be an object',
      { code: 'INVALID_BATCH' },
    );
  }

  if (
    batch.status !== 'deposit_prepared' &&
    batch.status !== 'deposit_submitted'
  ) {
    throw new V10DepositRecoveryValidationError(
      `batch.status must be "deposit_prepared" or "deposit_submitted"; received "${String(
        batch.status,
      )}"`,
      { code: 'INVALID_BATCH_STATUS' },
    );
  }

  if (!batch.depositAttempt || typeof batch.depositAttempt !== 'object') {
    throw new V10DepositRecoveryValidationError(
      'batch.depositAttempt is required',
      { code: 'MISSING_DEPOSIT_ATTEMPT' },
    );
  }

  if (batch.depositAttempt.operation !== 'v10_usdc_deposit') {
    throw new V10DepositRecoveryValidationError(
      'batch.depositAttempt.operation must be "v10_usdc_deposit"',
      { code: 'INVALID_DEPOSIT_ATTEMPT_OPERATION' },
    );
  }

  if (
    batch.depositAttempt.status !== 'prepared' &&
    batch.depositAttempt.status !== 'submitted'
  ) {
    throw new V10DepositRecoveryValidationError(
      'batch.depositAttempt.status must be "prepared" or "submitted"',
      { code: 'INVALID_DEPOSIT_ATTEMPT_STATUS' },
    );
  }

  const appCallTransactionId =
    batch.depositAttempt?.transactionIds?.appCall;

  if (
    typeof appCallTransactionId !== 'string' ||
    !appCallTransactionId
  ) {
    throw new V10DepositRecoveryValidationError(
      'batch.depositAttempt.transactionIds.appCall is required',
      { code: 'MISSING_APP_CALL_TRANSACTION_ID' },
    );
  }

  const usdcTransferTransactionId =
    batch.depositAttempt?.transactionIds?.usdcTransfer;

  if (
    typeof usdcTransferTransactionId !== 'string' ||
    !usdcTransferTransactionId
  ) {
    throw new V10DepositRecoveryValidationError(
      'batch.depositAttempt.transactionIds.usdcTransfer is required',
      { code: 'MISSING_USDC_TRANSFER_TRANSACTION_ID' },
    );
  }

  return {
    batchId: String(batch._id),
    batchStatus: batch.status,
    depositAttemptStatus: batch.depositAttempt.status,
    appCallTransactionId,
    usdcTransferTransactionId,
  };
}

function toConfirmedRound(value) {
  if (typeof value === 'bigint') {
    return value > 0n ? value.toString() : null;
  }

  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value) > 0n ? value : null;
  }

  return null;
}

function getConfirmedRound(pendingTransaction) {
  return toConfirmedRound(
    pendingTransaction?.confirmedRound ??
      pendingTransaction?.['confirmed-round'] ??
      0,
  );
}

function getPoolError(pendingTransaction) {
  const value =
    pendingTransaction?.poolError ??
    pendingTransaction?.['pool-error'] ??
    '';

  return typeof value === 'string' ? value : String(value || '');
}

function getNotFoundStatus(error) {
  return (
    error?.status ??
    error?.statusCode ??
    error?.response?.status ??
    error?.response?.statusCode
  );
}

/**
 * Reads the current chain state of the exact stored V10 app-call transaction.
 *
 * `unknown` means Algod returned a not-found response. It is intentionally
 * distinct from `pending`: neither result authorizes a replacement payment.
 */
export async function readV10DepositRecoveryState({
  algodClient,
  batch,
}) {
  assertAlgodClient(algodClient);

  const {
    batchId,
    batchStatus,
    depositAttemptStatus,
    appCallTransactionId,
    usdcTransferTransactionId,
  } = assertBatch(batch);

  let pendingTransaction;

  try {
    pendingTransaction = await algodClient
      .pendingTransactionInformation(appCallTransactionId)
      .do();
  } catch (cause) {
    if (getNotFoundStatus(cause) === 404) {
      return Object.freeze({
        outcome: 'unknown',
        batchId,
        batchStatus,
        depositAttemptStatus,
        appCallTransactionId,
        usdcTransferTransactionId,
        confirmedRound: null,
        poolError: null,
        reason: 'Stored app-call transaction is not currently available from Algod.',
      });
    }

    return Object.freeze({
      outcome: 'network_error',
      batchId,
      batchStatus,
      depositAttemptStatus,
      appCallTransactionId,
      usdcTransferTransactionId,
      confirmedRound: null,
      poolError: null,
      reason: cause?.message || 'Unable to read stored V10 deposit transaction.',
    });
  }

  const poolError = getPoolError(pendingTransaction);

  if (poolError) {
    return Object.freeze({
      outcome: 'rejected',
      batchId,
      batchStatus,
      depositAttemptStatus,
      appCallTransactionId,
      usdcTransferTransactionId,
      confirmedRound: null,
      poolError,
      reason: poolError,
    });
  }

  const confirmedRound = getConfirmedRound(pendingTransaction);

  if (confirmedRound !== null) {
    return Object.freeze({
      outcome: 'confirmed',
      batchId,
      batchStatus,
      depositAttemptStatus,
      appCallTransactionId,
      usdcTransferTransactionId,
      confirmedRound,
      poolError: null,
      reason: null,
    });
  }

  return Object.freeze({
    outcome: 'pending',
    batchId,
    batchStatus,
    depositAttemptStatus,
    appCallTransactionId,
    usdcTransferTransactionId,
    confirmedRound: null,
    poolError: null,
    reason: null,
  });
}