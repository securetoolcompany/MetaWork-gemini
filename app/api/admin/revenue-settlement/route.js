import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { getAlgodClient, getIndexerClient } from '@/lib/algorand';
import {
  RevenueSettlementRecipientSnapshotValidationError,
  prepareAndPersistV10RecipientSnapshot,
  prepareAndPersistV10DepositAttempt,
  resetExpiredV10DepositPreparation,
  persistSubmittedV10DepositAttempt,
  persistConfirmedV10DepositBatch,
  materializeConfirmedDepositIntoLedger,
  createPayoutRoundFromMaterializedDeposit,
  preparePayoutRoundDistribution,
	prepareCreatePayoutRoundSubmission,
	persistSubmittedV10CreatePayoutRoundSubmission
} from '@/lib/revenue-settlement-service';
import {
  readV10DepositRecoveryState,
} from '@/lib/revenue-pool-v10-deposit-recovery';
import {
  preflightLiveV10CreatePayoutRound,
} from '@/lib/revenue-pool-v10-payout-preflight-live';

export const dynamic = 'force-dynamic';

const SUPPORTED_ACTIONS = new Set([
  'prepare_recipient_snapshot',
  'prepare_deposit',
  'prepare_unallocated_usdc_deposit',
	'reset_expired_deposit_preparation',
  'mark_submitted',
  'recover_deposit',
  'confirm_deposit',
  'materialize_deposit',
  'create_payout_round',
  'prepare_payout_round_submission',
  'mark_payout_round_submitted',
  'prepare_distribution',
]);

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
    const users = db.collection('users');

    const user = await users.findOne({
      $or: [
        { id: decoded.userId },
        ...(ObjectId.isValid(String(decoded.userId))
          ? [{ _id: new ObjectId(String(decoded.userId)) }]
          : []),
      ],
    });

    return user?.isAdmin === true || user?.role === 'admin'
      ? decoded
      : null;
  } catch (error) {
    console.error(
      '[admin/revenue-settlement] authentication error:',
      error,
    );

    return null;
  }
}

function parseBatchId(value) {
  if (typeof value !== 'string' || !ObjectId.isValid(value)) {
    return null;
  }

  return new ObjectId(value);
}

function parseDepositorAddress(value) {
  if (
    typeof value !== 'string' ||
    !algosdk.isValidAddress(value.trim())
  ) {
    return null;
  }

  return value.trim();
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

function toDepositAttemptResponse(depositAttempt, {
  includeUnsignedTransactions = false,
} = {}) {
  if (!depositAttempt) {
    return null;
  }

  const result = {
    attemptKey: depositAttempt.attemptKey,
    operation: depositAttempt.operation,
    status: depositAttempt.status,
    groupId: depositAttempt.groupId,
    unsignedTransactionHash:
      depositAttempt.unsignedTransactionHash,
    transactionIds: depositAttempt.transactionIds,
    usdcTransferTransactionIndex:
      depositAttempt.usdcTransferTransactionIndex,
    appCallTransactionIndex:
      depositAttempt.appCallTransactionIndex,
    target: depositAttempt.target,
    amountUsdcAtomicUnits:
      depositAttempt.amountUsdcAtomicUnits,
    preparedAt: depositAttempt.preparedAt,
    submittedAt: depositAttempt.submittedAt,
    confirmedAt: depositAttempt.confirmedAt,
    failureCode: depositAttempt.failureCode,
    failureMessage: depositAttempt.failureMessage,
  };

  if (includeUnsignedTransactions) {
    result.unsignedTransactionsBase64 =
      depositAttempt.unsignedTransactionsBase64;
  }

  return result;
}

function toPayoutSubmissionAttemptResponse(
  payoutSubmissionAttempt,
  { includeUnsignedTransactions = false } = {},
) {
  if (!payoutSubmissionAttempt) {
    return null;
  }

  const result = {
    attemptKey: payoutSubmissionAttempt.attemptKey,
    operation: payoutSubmissionAttempt.operation,
    status: payoutSubmissionAttempt.status,
    payoutRoundKey: payoutSubmissionAttempt.payoutRoundKey,
    totalUsdcAtomicUnits:
      payoutSubmissionAttempt.totalUsdcAtomicUnits,
    roundPayeesHash: payoutSubmissionAttempt.roundPayeesHash,
    nextRoundId: payoutSubmissionAttempt.nextRoundId,
    sender: payoutSubmissionAttempt.sender,
    groupId: payoutSubmissionAttempt.groupId,
    unsignedTransactionHash:
      payoutSubmissionAttempt.unsignedTransactionHash,
    transactionIds: payoutSubmissionAttempt.transactionIds,
    roundBoxMbrMicroalgos:
      payoutSubmissionAttempt.roundBoxMbrMicroalgos,
    preparedAt: payoutSubmissionAttempt.preparedAt,
    submittedAt: payoutSubmissionAttempt.submittedAt,
    confirmedAt: payoutSubmissionAttempt.confirmedAt,
    failureCode: payoutSubmissionAttempt.failureCode ?? null,
    failureMessage: payoutSubmissionAttempt.failureMessage ?? null,
  };

  if (includeUnsignedTransactions) {
    result.unsignedTransactionsBase64 =
      payoutSubmissionAttempt.unsignedTransactionsBase64;
  }

  return result;
}

function toActionResponse({
  action,
  batchId,
  batchStatus = null,
  depositAttempt = null,
  payoutSubmissionAttempt = null,
  recovery = null,
  materialization = null,
  payoutRound = null,
  distribution = null,
  includeUnsignedTransactions = false,
}) {
  return serialize({
    success: true,
    action,
    batchId: String(batchId),
    batchStatus,
    depositAttempt: toDepositAttemptResponse(depositAttempt, {
      includeUnsignedTransactions,
    }),
    payoutSubmissionAttempt: toPayoutSubmissionAttemptResponse(
      payoutSubmissionAttempt,
      {
        includeUnsignedTransactions,
      },
    ),
    recovery,
    materialization,
    payoutRound,
    distribution,
  });
}

function getErrorStatus(error) {
  if (
    error instanceof RevenueSettlementRecipientSnapshotValidationError
  ) {
    if (error.code === 'BATCH_NOT_FOUND') {
      return 404;
    }

    return 409;
  }

  return 500;
}

async function getBatchOrThrow(db, mongoBatchId) {
  const batch = await db
    .collection('revenue_settlement_batches')
    .findOne({ _id: mongoBatchId });

  if (!batch) {
    throw new RevenueSettlementRecipientSnapshotValidationError(
      `Settlement batch ${String(mongoBatchId)} was not found`,
      { code: 'BATCH_NOT_FOUND' },
    );
  }

  return batch;
}

async function readRecovery({
  db,
  mongoBatchId,
  algodClient,
  indexerClient,
}) {
  const batch = await getBatchOrThrow(db, mongoBatchId);

  return readV10DepositRecoveryState({
    algodClient,
    indexerClient,
    batch,
  });
}

export async function POST(request) {
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

  let body;

  try {
    body = await request.json();
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Request body must be valid JSON.',
      },
      { status: 400 },
    );
  }

  const action = String(body?.action || '').trim();
  const batchId = String(body?.batchId || '').trim();

  const depositorAddress = parseDepositorAddress(
    body?.depositorAddress,
  );

  if (!SUPPORTED_ACTIONS.has(action)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unsupported settlement action.',
      },
      { status: 400 },
    );
  }

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

  try {
    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();
    const indexerClient = getIndexerClient();

    if (action === 'prepare_recipient_snapshot') {
      const snapshot = await prepareAndPersistV10RecipientSnapshot({
        db,
        batchId: mongoBatchId,
        indexerClient,
        algodClient,
      });

      return NextResponse.json(
        toActionResponse({
          action,
          batchId: mongoBatchId,
          batchStatus: snapshot.toStatus,
        }),
      );
    }

    if (
      action === 'prepare_deposit' ||
      action === 'prepare_unallocated_usdc_deposit'
    ) {
      if (!depositorAddress) {
        return NextResponse.json(
          {
            success: false,
            error:
              'depositorAddress must be a valid connected Algorand wallet address.',
          },
          { status: 400 },
        );
      }

      const prepared = await prepareAndPersistV10DepositAttempt({
        db,
        batchId: mongoBatchId,
        depositType:
          action === 'prepare_unallocated_usdc_deposit'
            ? 'usdc'
            : 'held',
        preflightOptions: {
          depositorAddress,
          algodClient,
          network:
            process.env.ALGORAND_NETWORK ||
            process.env.NEXT_PUBLIC_ALGORAND_NETWORK ||
            'testnet',
        },
      });

      return NextResponse.json(
        toActionResponse({
          action,
          batchId: mongoBatchId,
          batchStatus: prepared.status,
          depositAttempt: prepared.depositAttempt,
          includeUnsignedTransactions: true,
        }),
      );
    }

		if (action === 'reset_expired_deposit_preparation') {
			const reset = await resetExpiredV10DepositPreparation({
				db,
				batchId: mongoBatchId,
			});

			return NextResponse.json(
				toActionResponse({
					action,
					batchId: mongoBatchId,
					batchStatus: reset.status,
				}),
			);
		}

    if (action === 'mark_submitted') {
      const submitted = await persistSubmittedV10DepositAttempt({
        db,
        batchId: mongoBatchId,
      });

      return NextResponse.json(
        toActionResponse({
          action,
          batchId: mongoBatchId,
          batchStatus: submitted.status,
          depositAttempt: submitted.depositAttempt,
        }),
      );
    }

    if (action === 'recover_deposit') {
      const recovery = await readRecovery({
        db,
        mongoBatchId,
        algodClient,
        indexerClient,
      });

      return NextResponse.json(
        toActionResponse({
          action,
          batchId: mongoBatchId,
          batchStatus: recovery.batchStatus,
          recovery,
        }),
      );
    }

    if (action === 'confirm_deposit') {
      const recovery = await readRecovery({
        db,
        mongoBatchId,
        algodClient,
        indexerClient,
      });

      if (recovery.outcome !== 'confirmed') {
        return NextResponse.json(
          toActionResponse({
            action,
            batchId: mongoBatchId,
            batchStatus: recovery.batchStatus,
            recovery,
          }),
          { status: 409 },
        );
      }

      const confirmed = await persistConfirmedV10DepositBatch({
        db,
        batchId: mongoBatchId,
        recovery,
      });

      return NextResponse.json(
        toActionResponse({
          action,
          batchId: mongoBatchId,
          batchStatus: confirmed.status,
          depositAttempt: confirmed.depositAttempt,
          recovery,
        }),
      );
    }

    if (action === 'materialize_deposit') {
      const materialization =
        await materializeConfirmedDepositIntoLedger({
          db,
          batchId: mongoBatchId,
        });

      const batch = await getBatchOrThrow(db, mongoBatchId);

      return NextResponse.json(
        toActionResponse({
          action,
          batchId: mongoBatchId,
          batchStatus: batch.status,
          depositAttempt: batch.depositAttempt,
          materialization,
        }),
      );
    }

    if (action === 'create_payout_round') {
      const payoutRound =
        await createPayoutRoundFromMaterializedDeposit({
          db,
          batchId: mongoBatchId,
        });

      const batch = await getBatchOrThrow(db, mongoBatchId);

      return NextResponse.json(
        toActionResponse({
          action,
          batchId: mongoBatchId,
          batchStatus: batch.status,
          depositAttempt: batch.depositAttempt,
          payoutRound,
        }),
      );
    }

		if (action === 'prepare_payout_round_submission') {
			if (!depositorAddress) {
				return NextResponse.json(
					{
						success: false,
						error:
							'depositorAddress must be a valid connected Algorand wallet address.',
					},
					{ status: 400 },
				);
			}

			const suggestedParams = await algodClient
				.getTransactionParams()
				.do();

			const prepared = await prepareCreatePayoutRoundSubmission({
				db,
				batchId: mongoBatchId,
				sender: depositorAddress,
				suggestedParams,
				algodClient,
			});

			return NextResponse.json(
				toActionResponse({
					action,
					batchId: mongoBatchId,
					batchStatus: prepared.status,
					payoutSubmissionAttempt: prepared,
					includeUnsignedTransactions: true,
				}),
			);
		}

		if (action === 'mark_payout_round_submitted') {
			const submitted =
				await persistSubmittedV10CreatePayoutRoundSubmission({
					db,
					batchId: mongoBatchId,
				});

			return NextResponse.json(
				toActionResponse({
					action,
					batchId: mongoBatchId,
					batchStatus: submitted.status,
					payoutSubmissionAttempt:
						submitted.payoutSubmissionAttempt,
				}),
			);
		}

    const distribution = await preparePayoutRoundDistribution({
      db,
      batchId: mongoBatchId,
    });

    return NextResponse.json(
      toActionResponse({
        action,
        batchId: mongoBatchId,
        batchStatus: 'round_created',
        distribution,
      }),
    );
  } catch (error) {
    console.error(
      `[admin/revenue-settlement] ${action} failed:`,
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to process revenue settlement action.',
        code: error?.code || 'REVENUE_SETTLEMENT_ACTION_FAILED',
      },
      { status: getErrorStatus(error) },
    );
  }
}