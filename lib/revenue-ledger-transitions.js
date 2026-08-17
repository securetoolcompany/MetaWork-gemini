const MANUAL_TEST_RELEASE_REASON = 'manual_test_release';

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

function normalizeLedgerEntryIds(ledgerEntryIds) {
  if (ledgerEntryIds === undefined || ledgerEntryIds === null) {
    return [];
  }

  if (!Array.isArray(ledgerEntryIds) || ledgerEntryIds.length === 0) {
    throw new TypeError(
      'ledgerEntryIds must be a non-empty array when provided'
    );
  }

  const normalizedIds = ledgerEntryIds.map((ledgerEntryId) =>
    assertNonEmptyString(String(ledgerEntryId), 'ledgerEntryId')
  );

  return [...new Set(normalizedIds)];
}

function normalizeSelection({ ledgerEntryIds, orderId }) {
  const normalizedLedgerEntryIds = normalizeLedgerEntryIds(ledgerEntryIds);
  const normalizedOrderId =
    orderId === undefined || orderId === null
      ? null
      : assertNonEmptyString(String(orderId), 'orderId');

  if (
    (normalizedLedgerEntryIds.length === 0 && !normalizedOrderId) ||
    (normalizedLedgerEntryIds.length > 0 && normalizedOrderId)
  ) {
    throw new TypeError(
      'Provide exactly one selection: explicit ledgerEntryIds or one orderId'
    );
  }

  return {
    ledgerEntryIds: normalizedLedgerEntryIds,
    orderId: normalizedOrderId,
  };
}

function createManualTestReleaseEvent({
  ledgerEntryId,
  orderId,
  actor,
  occurredAt,
}) {
  return {
    ledgerEntryId: assertNonEmptyString(
      String(ledgerEntryId),
      'ledgerEntryId'
    ),
    orderId: assertNonEmptyString(String(orderId), 'orderId'),
    fromStatus: 'held',
    toStatus: 'release_eligible',
    reason: MANUAL_TEST_RELEASE_REASON,
    actor: assertNonEmptyString(actor, 'actor'),
    occurredAt: assertValidDate(occurredAt, 'occurredAt'),
  };
}

function buildSelectionFilter({ ledgerEntryIds, orderId }) {
  if (ledgerEntryIds.length > 0) {
    return {
      _id: { $in: ledgerEntryIds },
    };
  }

  return {
    orderId,
  };
}

export async function manuallyMarkRevenueLedgerRowsReleaseEligible({
  db,
  ledgerEntryIds,
  orderId,
  actor,
  now = new Date(),
}) {
  if (!db || typeof db.collection !== 'function') {
    throw new TypeError('db.collection must be available');
  }

  const normalizedActor = assertNonEmptyString(actor, 'actor');
  const normalizedNow = assertValidDate(now, 'now');
  const selection = normalizeSelection({
    ledgerEntryIds,
    orderId,
  });

  const revenueLedger = db.collection('revenue_ledger');
  const revenueLedgerEvents = db.collection('revenue_ledger_events');

  const selectedRows = await revenueLedger
    .find(buildSelectionFilter(selection))
    .toArray();

  if (selectedRows.length === 0) {
    throw new Error(
      '[revenue-ledger-transitions] No ledger rows matched the explicit selection'
    );
  }

  if (
    selection.ledgerEntryIds.length > 0 &&
    selectedRows.length !== selection.ledgerEntryIds.length
  ) {
    throw new Error(
      '[revenue-ledger-transitions] One or more explicit ledgerEntryIds were not found'
    );
  }

  const results = [];

  for (const row of selectedRows) {
    const ledgerEntryId = assertNonEmptyString(String(row?._id), 'row._id');
    const rowOrderId = assertNonEmptyString(String(row?.orderId), 'row.orderId');

    if (row.status === 'release_eligible') {
      results.push({
        ledgerEntryId,
        orderId: rowOrderId,
        changed: false,
        status: 'release_eligible',
      });
      continue;
    }

    if (row.status !== 'held') {
      throw new Error(
        `[revenue-ledger-transitions] Ledger row ${ledgerEntryId} must be held or release_eligible; received ${String(
          row.status
        )}`
      );
    }

    const transitionResult = await revenueLedger.updateOne(
      {
        _id: row._id,
        status: 'held',
      },
      {
        $set: {
          status: 'release_eligible',
          eligibleAt: normalizedNow,
          updatedAt: normalizedNow,
        },
      }
    );

    if (transitionResult.modifiedCount !== 1) {
      const currentRow = await revenueLedger.findOne({ _id: row._id });

      if (currentRow?.status === 'release_eligible') {
        results.push({
          ledgerEntryId,
          orderId: rowOrderId,
          changed: false,
          status: 'release_eligible',
        });
        continue;
      }

      throw new Error(
        `[revenue-ledger-transitions] Unable to transition ledger row ${ledgerEntryId}`
      );
    }

    const event = createManualTestReleaseEvent({
      ledgerEntryId,
      orderId: rowOrderId,
      actor: normalizedActor,
      occurredAt: normalizedNow,
    });

    await revenueLedgerEvents.insertOne(event);

    results.push({
      ledgerEntryId,
      orderId: rowOrderId,
      changed: true,
      status: 'release_eligible',
    });
  }

  return {
    reason: MANUAL_TEST_RELEASE_REASON,
    actor: normalizedActor,
    releasedAt: normalizedNow,
    rows: results,
    changedCount: results.filter((result) => result.changed).length,
    alreadyEligibleCount: results.filter((result) => !result.changed).length,
  };
}