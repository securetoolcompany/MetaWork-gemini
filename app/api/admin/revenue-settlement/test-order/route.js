import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { verifyToken } from '@/lib/auth';
import { getAlgodClient, getIndexerClient } from '@/lib/algorand';
import { connectToDatabase } from '@/lib/mongodb';
import {
  createHeldRevenueLedgerEntriesForOrder,
} from '@/lib/revenue-ledger-service';
import {
  createSettlementBatchFromEligibleRows,
} from '@/lib/revenue-settlement-batches';
import {
  prepareAndPersistV10RecipientSnapshot,
} from '@/lib/revenue-settlement-service';
import {
  manuallyMarkRevenueLedgerRowsReleaseEligible,
} from '@/lib/revenue-ledger-transitions';

const TEST_ORDER_ID = '6a8b950f162f525b10171543';
const FEWQ_POOL_KEY = '6a8b8bccd9540168859a0bff';
const FEWQ_REVENUE_POOL_APP_ID = 769218532;
const FEWQ_REVENUE_TOKEN_ASA_ID = 769768414;
const V10_APP_ADDRESS =
  'QTPY7Y7XIZZP5Q2F2BADPMXSRX6R6FDPWKUNKI76Y3WTEPCQZVUSBO6NNY';

function getToken(request) {
  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  return bearerToken || null;
}

async function requireAdmin(request, db) {
  const token = getToken(request);

  if (!token) {
    throw new Error('Unauthorized');
  }

  const decoded = verifyToken(token);

  if (decoded.role === 'admin' || decoded.isAdmin === true) {
    return decoded;
  }

  const users = db.collection('users');
  const userId = decoded.userId || decoded.id || decoded._id;

  if (!userId || !ObjectId.isValid(String(userId))) {
    throw new Error('Forbidden');
  }

  const user = await users.findOne({
    _id: new ObjectId(String(userId)),
  });

  if (user?.isAdmin === true || user?.role === 'admin') {
    return decoded;
  }

  throw new Error('Forbidden');
}

function assertTestModeEnabled() {
  const explicitlyEnabled =
    process.env.TESTNET_REVENUE_SETTLEMENT_ENABLED === 'true';

  if (process.env.NODE_ENV === 'production' && !explicitlyEnabled) {
    throw new Error(
      'Test settlement endpoint is disabled in production. Set TESTNET_REVENUE_SETTLEMENT_ENABLED=true only for an explicitly approved testnet run.',
    );
  }
}

function toPlainValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof ObjectId) {
    return value.toString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toPlainValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        toPlainValue(nestedValue),
      ]),
    );
  }

  return value;
}

function assertFeWQSnapshot(snapshot) {
  const holderSnapshot = snapshot?.holderSnapshot ?? snapshot;
  const roundPayees =
    snapshot?.roundPayees ??
    holderSnapshot?.roundPayees ??
    [];

  const totalUsdcAtomicUnits = BigInt(
    snapshot?.totalUsdcAtomicUnits ??
      holderSnapshot?.totalUsdcAtomicUnits ??
      0,
  );

  const roundPayeeTotal = roundPayees.reduce(
    (sum, payee) =>
      sum + BigInt(
				payee.amountUsdcAtomicUnits ??
					payee.usdcAtomicUnits ??
					payee.amount ??
					0,
			),
					0n,
				);

  const appAddressWasIncluded = roundPayees.some(
    (payee) =>
      payee.address === V10_APP_ADDRESS ||
      payee.walletAddress === V10_APP_ADDRESS,
  );

  return {
    poolKey: holderSnapshot?.poolKey ?? null,
    appHeldRevUnits: holderSnapshot?.appHeldRevUnits ?? null,
    virtualUnclaimedRevUnits:
      holderSnapshot?.virtualUnclaimedRevUnits ?? null,
    externalHolderEntries:
      holderSnapshot?.externalHolderEntries ?? [],
    unclaimedStakeholderEntries:
      holderSnapshot?.unclaimedStakeholderEntries ?? [],
    roundPayees,
    totalUsdcAtomicUnits: totalUsdcAtomicUnits.toString(),
    roundPayeeTotalUsdcAtomicUnits: roundPayeeTotal.toString(),
    payeesEqualBatchTotal: roundPayeeTotal === totalUsdcAtomicUnits,
    v10ApplicationIsNotPayee: !appAddressWasIncluded,
  };
}

export async function POST(request) {
  try {
    assertTestModeEnabled();

    const { db } = await connectToDatabase();
    const actor = await requireAdmin(request, db);

    const orders = db.collection('orders');
    const revenueLedger = db.collection('revenue_ledger');
    const settlementBatches = db.collection(
      'revenue_settlement_batches',
    );

    const order = await orders.findOne({
      _id: new ObjectId(TEST_ORDER_ID),
    });

    if (!order) {
      return NextResponse.json(
        {
          error: `Test order ${TEST_ORDER_ID} was not found`,
        },
        { status: 404 },
      );
    }

    if (order.status !== 'paid') {
      return NextResponse.json(
        {
          error: 'Test order is not paid',
          orderStatus: order.status ?? null,
        },
        { status: 409 },
      );
    }

    const requestedNow = new Date();
    const testEligibilityNow = new Date(
      requestedNow.getTime() + 15 * 24 * 60 * 60 * 1000,
    );

    const existingLedgerRows = await revenueLedger
			.find({
				orderId: TEST_ORDER_ID,
			})
			.toArray();

		const ledgerResult =
			existingLedgerRows.length === 0
				? await createHeldRevenueLedgerEntriesForOrder({
						db,
						order,
						now: requestedNow,
					})
				: {
						orderId: TEST_ORDER_ID,
						createdCount: 0,
						existingCount: existingLedgerRows.length,
						reusedExistingRows: true,
					};

		const heldLedgerRowCount = await revenueLedger.countDocuments({
			orderId: TEST_ORDER_ID,
			status: 'held',
			voidedAt: null,
		});

		const releaseEligibilityResult =
			heldLedgerRowCount > 0
				? await manuallyMarkRevenueLedgerRowsReleaseEligible({
						db,
						orderId: TEST_ORDER_ID,
						actor: String(
							actor.userId ?? actor.id ?? actor._id ?? 'unknown',
						),
						now: testEligibilityNow,
					})
				: {
						alreadyReleaseEligible: true,
						releasedCount: 0,
					};

		const batches = [];

    while (true) {
      const batch = await createSettlementBatchFromEligibleRows({
        db,
        orderId: TEST_ORDER_ID,
        now: testEligibilityNow,
      });

      if (!batch) {
        break;
      }

      batches.push(batch);
    }

		const currentLedgerRows = await revenueLedger
			.find({
				orderId: TEST_ORDER_ID,
				settlementBatchId: { $ne: null },
			})
			.project({ settlementBatchId: 1 })
			.toArray();

		const batchIdsToPrepare = [
			...new Map(
				[
					...batches.map((batch) => batch.batchId),
					...currentLedgerRows.map((row) => row.settlementBatchId),
				]
					.filter(Boolean)
					.map((batchId) => [String(batchId), batchId]),
			).values(),
		];

    const algodClient = getAlgodClient();
    const indexerClient = getIndexerClient();

    const preparedSnapshots = [];

    for (const batchId of batchIdsToPrepare) {
			const snapshot =
				await prepareAndPersistV10RecipientSnapshot({
					db,
					batchId,
					indexerClient,
					algodClient,
					now: testEligibilityNow,
				});

			preparedSnapshots.push({
				batchId: String(batchId),
				snapshot,
			});
		}

    const ledgerRows = await revenueLedger
      .find({
        orderId: TEST_ORDER_ID,
      })
      .sort({ createdAt: -1 })
      .toArray();

    const persistedBatches = await settlementBatches
      .find({
        $or: [
          { orderId: TEST_ORDER_ID },
          { sourceOrderId: TEST_ORDER_ID },
          { poolKey: FEWQ_POOL_KEY },
          { revenueTokenAssetId: FEWQ_REVENUE_TOKEN_ASA_ID },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray();

    const feWQBatch = persistedBatches.find(
      (batch) =>
        String(batch.poolKey) === FEWQ_POOL_KEY &&
        Number(batch.revenuePoolAppId) === FEWQ_REVENUE_POOL_APP_ID &&
        Number(batch.revenueTokenAssetId) ===
          FEWQ_REVENUE_TOKEN_ASA_ID,
    );

    const feWQPreparedSnapshot = preparedSnapshots.find(
      ({ batchId }) => String(feWQBatch?._id) === batchId,
    );

    const feWQAssertions = feWQPreparedSnapshot
      ? assertFeWQSnapshot(feWQPreparedSnapshot.snapshot)
      : {
          error:
            'No feWQ recipient snapshot was prepared during this run. Inspect the batches and ledger rows returned below.',
        };

    await db.collection('revenue_settlement_test_audit').insertOne({
			testMode: true,
			action: 'prepare_test_order_payout',
			actorId: String(
					actor.userId ?? actor.id ?? actor._id ?? 'unknown',
			),
			orderId: TEST_ORDER_ID,
			simulatedEligibilityNow: testEligibilityNow,
			ledgerResult,
			releaseEligibilityResult,
			preparedBatchIds: batchIdsToPrepare.map(String),
			createdBatchIds: batches
				.map((batch) => batch.batchId)
				.filter(Boolean)
				.map(String),
      preparedRecipientSnapshotBatchIds: preparedSnapshots.map(
        ({ batchId }) => batchId,
      ),
      onChainDepositAttempted: false,
      onChainTransactionSubmitted: false,
      createdAt: requestedNow,
    });

    return NextResponse.json({
      ok: true,
      testMode: true,
      orderId: TEST_ORDER_ID,
      simulatedEligibilityNow: testEligibilityNow.toISOString(),
      onChainDepositAttempted: false,
      onChainTransactionSubmitted: false,
      ledgerResult: toPlainValue(ledgerResult),
			releaseEligibilityResult: toPlainValue(
				releaseEligibilityResult,
			),
			createdBatchCount: batches.length,
			preparedBatchIds: batchIdsToPrepare.map(String),
      createdBatchIds: batches
				.map((batch) => batch.batchId)
				.filter(Boolean)
				.map(String),
      preparedRecipientSnapshotBatchIds: preparedSnapshots.map(
        ({ batchId }) => batchId,
      ),
      feWQ: {
        poolKey: FEWQ_POOL_KEY,
        revenuePoolAppId: FEWQ_REVENUE_POOL_APP_ID,
        revenueTokenAssetId: FEWQ_REVENUE_TOKEN_ASA_ID,
        batch: toPlainValue(feWQBatch ?? null),
        assertions: toPlainValue(feWQAssertions),
      },
      ledgerRows: toPlainValue(ledgerRows),
      batches: toPlainValue(persistedBatches),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to prepare test settlement';

    const status =
      message === 'Unauthorized'
        ? 401
        : message === 'Forbidden'
          ? 403
          : 500;

    return NextResponse.json(
      {
        error: message,
        testMode: true,
        onChainDepositAttempted: false,
        onChainTransactionSubmitted: false,
      },
      { status },
    );
  }
}