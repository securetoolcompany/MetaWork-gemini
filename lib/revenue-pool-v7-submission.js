// lib/revenue-pool-v7-submission.js

function outcome({
  ok,
  outcome: status,
  reasons = [],
  groupId = null,
  transactionId = null,
  confirmedRound = null,
}) {
  return {
    ok,
    outcome: status,
    reasons,
    groupId,
    transactionId,
    confirmedRound,
  };
}

function assertAlgodClient(algodClient) {
  if (
    !algodClient ||
    typeof algodClient.sendRawTransaction !== 'function' ||
    typeof algodClient.pendingTransactionInformation !== 'function'
  ) {
    throw new TypeError(
      'algodClient must provide sendRawTransaction and pendingTransactionInformation'
    );
  }
}

function assertSignedResult(signedResult) {
  if (!signedResult || typeof signedResult !== 'object') {
    return 'Signed transaction result is required.';
  }

  if (
    typeof signedResult.groupId !== 'string' ||
    !signedResult.groupId
  ) {
    return 'Signed transaction result is missing a verified group ID.';
  }

  if (signedResult.transactionCount !== 2) {
    return 'Signed release-held group must contain exactly two transactions.';
  }

  if (
    !Array.isArray(signedResult.signedTransactions) ||
    signedResult.signedTransactions.length !== 2
  ) {
    return 'Signed release-held group must contain exactly two signed transaction blobs.';
  }

  if (
    !signedResult.signedTransactions.every(
      (transaction) => transaction instanceof Uint8Array
    )
  ) {
    return 'Signed release-held transactions must be Uint8Array blobs.';
  }

  return null;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function pollV7SettlementConfirmation({
  algodClient,
  transactionId,
  maxAttempts = 20,
  pollIntervalMilliseconds = 1000,
}) {
  assertAlgodClient(algodClient);

  if (typeof transactionId !== 'string' || !transactionId) {
    throw new TypeError('transactionId is required');
  }

  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError('maxAttempts must be a positive safe integer');
  }

  if (
    !Number.isSafeInteger(pollIntervalMilliseconds) ||
    pollIntervalMilliseconds < 0
  ) {
    throw new TypeError(
      'pollIntervalMilliseconds must be a non-negative safe integer'
    );
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const pendingTransaction = await algodClient
        .pendingTransactionInformation(transactionId)
        .do();

      const poolError =
        pendingTransaction?.poolError ??
        pendingTransaction?.['pool-error'] ??
        '';

      if (poolError) {
        return {
          outcome: 'rejected',
          transactionId,
          attempts: attempt,
          poolError,
          confirmedRound: null,
        };
      }

      const confirmedRound =
        pendingTransaction?.confirmedRound ??
        pendingTransaction?.['confirmed-round'] ??
        0;

      if (confirmedRound > 0) {
        return {
          outcome: 'confirmed',
          transactionId,
          attempts: attempt,
          poolError: null,
          confirmedRound,
        };
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        return {
          outcome: 'network_error',
          transactionId,
          attempts: attempt,
          error,
          confirmedRound: null,
        };
      }
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMilliseconds);
    }
  }

  return {
    outcome: 'pending',
    transactionId,
    attempts: maxAttempts,
    confirmedRound: null,
  };
}

export async function submitApprovedV7ReleaseHeldGroup({
  enabled,
  userConfirmedSubmission,
  signedResult,
  preflightResult,
  refreshPreflight,
  algodClient,
  maxConfirmationAttempts = 20,
  confirmationPollIntervalMilliseconds = 1000,
}) {
  if (enabled !== true) {
    return outcome({
      ok: false,
      outcome: 'disabled',
      reasons: [
        'V7 settlement submission is disabled by configuration.',
      ],
    });
  }

  if (userConfirmedSubmission !== true) {
    return outcome({
      ok: false,
      outcome: 'confirmation_required',
      reasons: [
        'Explicit user confirmation is required immediately before submission.',
      ],
    });
  }

  const signedResultError = assertSignedResult(signedResult);

  if (signedResultError) {
    return outcome({
      ok: false,
      outcome: 'rejected',
      reasons: [signedResultError],
    });
  }

  if (
    !preflightResult ||
    preflightResult.ok !== true ||
    typeof preflightResult.proposedGroup?.groupId !== 'string'
  ) {
    return outcome({
      ok: false,
      outcome: 'rejected',
      groupId: signedResult.groupId,
      reasons: [
        'A successful preflight result with an approved group ID is required.',
      ],
    });
  }

  if (preflightResult.proposedGroup.groupId !== signedResult.groupId) {
    return outcome({
      ok: false,
      outcome: 'stale_preflight',
      groupId: signedResult.groupId,
      reasons: [
        'Signed group ID does not match the preflight-approved group ID.',
      ],
    });
  }

  if (typeof refreshPreflight !== 'function') {
    return outcome({
      ok: false,
      outcome: 'rejected',
      groupId: signedResult.groupId,
      reasons: [
        'refreshPreflight must re-check live pool, round, balance, and suggested-parameter state.',
      ],
    });
  }

  let freshPreflight;

  try {
    freshPreflight = await refreshPreflight();
  } catch (error) {
    return outcome({
      ok: false,
      outcome: 'network_error',
      groupId: signedResult.groupId,
      reasons: [
        `Unable to refresh settlement preflight: ${error.message}`,
      ],
    });
  }

  if (!freshPreflight || freshPreflight.ok !== true) {
    return outcome({
      ok: false,
      outcome: 'stale_preflight',
      groupId: signedResult.groupId,
      reasons: [
        ...(freshPreflight?.reasons?.map(
          (entry) => entry.message ?? String(entry)
        ) ?? ['Live settlement preflight failed.']),
      ],
    });
  }

  if (
    freshPreflight.proposedGroup?.groupId !== signedResult.groupId
  ) {
    return outcome({
      ok: false,
      outcome: 'stale_preflight',
      groupId: signedResult.groupId,
      reasons: [
        'Live state changed after signing; obtain a new preflight and signature.',
      ],
    });
  }

  try {
    assertAlgodClient(algodClient);

    const submission = await algodClient
      .sendRawTransaction(signedResult.signedTransactions)
      .do();

    const transactionId =
      submission?.txId ??
      submission?.txid ??
      submission?.transactionId ??
      submission?.['txid'] ??
      null;

    if (!transactionId) {
      return outcome({
        ok: false,
        outcome: 'network_error',
        groupId: signedResult.groupId,
        reasons: [
          'Algod accepted the submission request but did not return a transaction ID.',
        ],
      });
    }

    const confirmation = await pollV7SettlementConfirmation({
      algodClient,
      transactionId,
      maxAttempts: maxConfirmationAttempts,
      pollIntervalMilliseconds: confirmationPollIntervalMilliseconds,
    });

    if (confirmation.outcome === 'confirmed') {
      return outcome({
        ok: true,
        outcome: 'confirmed',
        groupId: signedResult.groupId,
        transactionId,
        confirmedRound: confirmation.confirmedRound,
      });
    }

    if (confirmation.outcome === 'pending') {
      return outcome({
        ok: true,
        outcome: 'pending',
        groupId: signedResult.groupId,
        transactionId,
      });
    }

    return outcome({
      ok: false,
      outcome: confirmation.outcome,
      groupId: signedResult.groupId,
      transactionId,
      confirmedRound: confirmation.confirmedRound,
      reasons: [
        confirmation.poolError ??
          confirmation.error?.message ??
          'Settlement submission was not confirmed.',
      ],
    });
  } catch (error) {
    return outcome({
      ok: false,
      outcome: 'network_error',
      groupId: signedResult.groupId,
      reasons: [error.message],
    });
  }
}