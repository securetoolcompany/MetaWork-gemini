import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

function getToken(request) {
  const authorization = request.headers.get('authorization');

  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  return bearerToken || request.cookies.get('auth_token')?.value || null;
}

async function getAuthenticatedAdmin(request) {
  const token = getToken(request);

  if (!token) {
    return null;
  }

  try {
    const decoded = verifyToken(token);

    if (!decoded?.userId) {
      return null;
    }

    if (decoded.role === 'admin' || decoded.isAdmin === true) {
      return decoded;
    }

    const { db } = await connectToDatabase();

    const user = await db.collection('users').findOne({
      id: decoded.userId,
    });

    return user?.isAdmin === true || user?.role === 'admin'
      ? decoded
      : null;
  } catch (error) {
    console.error(
      '[admin/revenue-settlement/batches] authentication error:',
      error,
    );

    return null;
  }
}

function serialize(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === 'bigint') {
        return nestedValue.toString();
      }

      return nestedValue;
    }),
  );
}

function parseBatchId(value) {
  if (typeof value !== 'string' || !ObjectId.isValid(value)) {
    return null;
  }

  return new ObjectId(value);
}

function toBatchSummary(batch) {
  const depositAttempt = batch.depositAttempt
    ? {
        attemptKey: batch.depositAttempt.attemptKey,
        operation: batch.depositAttempt.operation,
        status: batch.depositAttempt.status,
        groupId: batch.depositAttempt.groupId,
        unsignedTransactionHash:
          batch.depositAttempt.unsignedTransactionHash,
        transactionIds: batch.depositAttempt.transactionIds,
        usdcTransferTransactionIndex:
          batch.depositAttempt.usdcTransferTransactionIndex,
        appCallTransactionIndex:
          batch.depositAttempt.appCallTransactionIndex,
        target: batch.depositAttempt.target,
        amountUsdcAtomicUnits:
          batch.depositAttempt.amountUsdcAtomicUnits,
        preparedAt: batch.depositAttempt.preparedAt,
        submittedAt: batch.depositAttempt.submittedAt,
        confirmedAt: batch.depositAttempt.confirmedAt,
        failureCode: batch.depositAttempt.failureCode,
        failureMessage: batch.depositAttempt.failureMessage,
      }
    : null;

  return {
    batchId: String(batch._id),
    batchKey: batch.batchKey,
    status: batch.status,

    revenuePoolAppId: batch.revenuePoolAppId,
    poolKey: batch.poolKey,
    revenueTokenAssetId: batch.revenueTokenAssetId,

    totalAllocationCents: batch.totalAllocationCents,
    totalUsdcAtomicUnits: batch.totalUsdcAtomicUnits,

    depositAttempt,
    usdcDepositTxId: batch.usdcDepositTxId ?? null,
    usdcDepositConfirmedAt: batch.usdcDepositConfirmedAt ?? null,

    depositLedgerMaterializationKey:
      batch.depositLedgerMaterializationKey ?? null,
    depositLedgerMaterializedAt:
      batch.depositLedgerMaterializedAt ?? null,

    revenueRoundId: batch.revenueRoundId ?? null,
    revenueRoundTxId: batch.revenueRoundTxId ?? null,
    revenueRoundCreatedAt:
      batch.revenueRoundCreatedAt ?? null,

    createdAt: batch.createdAt ?? null,
    updatedAt: batch.updatedAt ?? null,
  };
}

export async function GET(request) {
  const admin = await getAuthenticatedAdmin(request);

  if (!admin) {
    return NextResponse.json(
      {
        success: false,
        error: 'Administrator authorization is required.',
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const poolKey = searchParams.get('poolKey')?.trim() || null;
  const batchId = searchParams.get('batchId')?.trim() || null;

  try {
    const { db } = await connectToDatabase();
    const settlementBatches = db.collection(
      'revenue_settlement_batches',
    );

    if (batchId) {
			const mongoBatchId = parseBatchId(batchId);

			if (!mongoBatchId) {
			return NextResponse.json(
					{
					success: false,
					error: 'batchId must be a valid MongoDB ObjectId.',
					},
					{ status: 400 },
			);
			}

			const batch = await settlementBatches.findOne({
			_id: mongoBatchId,
			});

      if (!batch) {
        return NextResponse.json(
          {
            success: false,
            error: `Settlement batch ${batchId} was not found.`,
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        serialize({
          success: true,
          batch: toBatchSummary(batch),
        }),
      );
    }

    const filter = poolKey ? { poolKey } : {};

    const batches = await settlementBatches
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json(
      serialize({
        success: true,
        batches: batches.map(toBatchSummary),
      }),
    );
  } catch (error) {
    console.error(
      '[admin/revenue-settlement/batches] failed to load batches:',
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to load revenue settlement batches.',
      },
      { status: 500 },
    );
  }
}