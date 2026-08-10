// lib/revenue-ledger-eligibility.js

export const MANUAL_TEST_RELEASE_REASON = 'manual_test_release';

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function assertValidDate(value, fieldName) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${fieldName} must be a valid date value`);
  }

  return date;
}

function normalizeLedgerIds(ledgerIds) {
  if (!Array.isArray(ledgerIds) || ledgerIds.length === 0) {
    return null;
  }

  const uniqueIds = [];
  const seenIds = new Set();

  for (const ledgerId of ledgerIds) {
    if (ledgerId === null || ledgerId === undefined || ledgerId === '') {
      throw new TypeError('ledgerIds must not contain empty values');
    }

    const idKey = String(ledgerId);

    if (seenIds.has(idKey)) {
      continue;
    }

    seenIds.add(idKey);
    uniqueIds.push(ledgerId);
  }

  return uniqueIds;
}

function assertManualReleaseScope({ ledgerIds, orderId }) {
  const hasLedgerIds = Array.isArray(ledgerIds) && ledgerIds.length > 0;
  const hasOrderId =
    orderId !== null &&
    orderId !== undefined &&
    String(orderId).trim() !== '';

  if (hasLedgerIds && hasOrderId) {
    throw new TypeError(
      'Provide explicit ledgerIds or one tightly scoped orderId, not both'
    );
  }

  if (hasLedgerIds) {
    return {
      _id: { $in: ledgerIds },
    };
  }

  if (hasOrderId) {
    return {
      orderId: assertNonEmptyString(String(orderId), 'orderId'),
    };
  }

  throw new TypeError(
    'Provide explicit ledgerIds or one tightly scoped orderId'
  );
}

export async function transitionHeldLedgerRowsToReleaseEligible({
  db,
  ledgerIds = null,
  orderId = null,
  actor,
  reason = MANUAL_TEST_RELEASE_REASON,
  now = new Date(),
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  const normalizedLedgerIds = normalizeLedgerIds(ledgerIds);
  const filter = assertManualReleaseScope({
    ledgerIds: normalizedLedgerIds,
    orderId,
  });

  const normalizedActor = assertNonEmptyString(actor, 'actor');
  const normalizedReason = assertNonEmptyString(reason, 'reason');

  if (normalizedReason !== MANUAL_TEST_RELEASE_REASON) {
    throw new TypeError(
      `reason must be ${MANUAL_TEST_RELEASE_REASON} for this manual test service`
    );
  }

  const transitionAt = assertValidDate(now, 'now');
  const revenueLedger = db.collection('revenue_ledger');
  const selectedRows = await revenueLedger.find(filter).toArray();

  if (selectedRows.length === 0) {
    throw new Error(
      '[revenue-ledger-eligibility] No ledger rows matched the explicit release scope'
    );
  }

  if (normalizedLedgerIds && selectedRows.length !== normalizedLedgerIds.length) {
    throw new Error(
      '[revenue-ledger-eligibility] One or more explicit ledger IDs were not found'
    );
  }

  const invalidRow = selectedRows.find(
    (row) =>
      row.status !== 'held' &&
      row.status !== 'release_eligible'
  );

  if (invalidRow) {
    throw new Error(
      `[revenue-ledger-eligibility] Ledger row ${String(
        invalidRow._id
      )} cannot transition from ${invalidRow.status}`
    );
  }

  const results = [];

  for (const row of selectedRows) {
    if (row.status === 'release_eligible') {
      results.push({
        ledgerId: row._id,
        idempotencyKey: row.idempotencyKey,
        transitioned: false,
        status: 'release_eligible',
      });
      continue;
    }

    const updateResult = await revenueLedger.updateOne(
      {
        _id: row._id,
        status: 'held',
      },
      {
        $set: {
          status: 'release_eligible',
          eligibleAt: transitionAt,
          updatedAt: transitionAt,
        },
        $push: {
          stateTransitions: {
            fromStatus: 'held',
            toStatus: 'release_eligible',
            actor: normalizedActor,
            reason: normalizedReason,
            occurredAt: transitionAt,
          },
        },
      }
    );

    if (updateResult.modifiedCount !== 1) {
      throw new Error(
        `[revenue-ledger-eligibility] Concurrent state change for ledger row ${String(
          row._id
        )}`
      );
    }

    results.push({
      ledgerId: row._id,
      idempotencyKey: row.idempotencyKey,
      transitioned: true,
      status: 'release_eligible',
    });
  }

  return {
    actor: normalizedActor,
    reason: normalizedReason,
    transitionedAt: transitionAt,
    rows: results,
    transitionedCount: results.filter((result) => result.transitioned).length,
    existingEligibleCount: results.filter((result) => !result.transitioned)
      .length,
  };
}