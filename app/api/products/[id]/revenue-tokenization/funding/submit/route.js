import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import algosdk from 'algosdk';
import crypto from 'crypto';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { getAlgodClient } from '@/lib/algorand';

export const dynamic = 'force-dynamic';

const MAX_SIGNED_TRANSACTION_BYTES = 16 * 1024;

function getToken(request) {
  const authorization = request.headers.get('authorization');

  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : null;

  return bearerToken || request.cookies.get('auth_token')?.value || null;
}

function getAuthenticatedUserId(request) {
  const token = getToken(request);

  if (!token) {
    return null;
  }

  try {
    const decoded = verifyToken(token);

    return decoded?.userId ? String(decoded.userId) : null;
  } catch {
    return null;
  }
}

function normalizeAlgorandAddress(address) {
  return String(address || '').trim().toUpperCase();
}

function createProductIdFilter(id) {
  const normalizedId = String(id || '').trim();

  if (!normalizedId || normalizedId === 'undefined') {
    return null;
  }

  const filters = [
    { id: normalizedId },
    { externalProductId: normalizedId },
  ];

  if (ObjectId.isValid(normalizedId)) {
    filters.push({
      _id: new ObjectId(normalizedId),
    });
  }

  return {
    $or: filters,
  };
}

function createOwnedProductFilter(productFilter, userId) {
  return {
    $and: [
      productFilter,
      {
        $or: [
          { userId },
          { ownerId: userId },
        ],
      },
    ],
  };
}

function serialize(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === 'bigint') {
        return nestedValue.toString();
      }

      return nestedValue;
    })
  );
}

function createFundingResponse(product, fundingAttempt, extra = {}) {
  return serialize({
    success: true,

    product: {
      id: String(product._id),
      name:
        product.name ||
        product.title ||
        product.externalProductId ||
        'Untitled product',
      tokenizationStatus:
        product.productRevenuePool?.tokenizationStatus || null,
    },

    fundingAttempt: {
      id: fundingAttempt?.id || null,
      status: fundingAttempt?.status || null,
      expectedTransactionId:
        fundingAttempt?.expectedTransactionId || null,
      submittedTransactionId:
        fundingAttempt?.submittedTransactionId || null,
      submittedAt: fundingAttempt?.submittedAt || null,
      confirmedAt: fundingAttempt?.confirmedAt || null,
      confirmedRound: fundingAttempt?.confirmedRound || null,
      expiresAt: fundingAttempt?.expiresAt || null,
      failureCode: fundingAttempt?.failureCode || null,
      failureMessage: fundingAttempt?.failureMessage || null,
    },

    ...extra,
  });
}

function decodeSignedTransactionBase64(signedTransactionBase64) {
  if (
    typeof signedTransactionBase64 !== 'string' ||
    !signedTransactionBase64.trim()
  ) {
    throw new Error('A signed Algorand transaction is required.');
  }

  let signedTransactionBytes;

  try {
    signedTransactionBytes = Buffer.from(
      signedTransactionBase64,
      'base64'
    );
  } catch {
    throw new Error('The signed transaction is not valid base64.');
  }

  if (
    !signedTransactionBytes.length ||
    signedTransactionBytes.length > MAX_SIGNED_TRANSACTION_BYTES
  ) {
    throw new Error('The signed transaction has an invalid byte length.');
  }

  try {
    return {
      signedTransactionBytes,
      signedTransaction: algosdk.decodeSignedTransaction(
        signedTransactionBytes
      ),
    };
  } catch {
    throw new Error('The signed transaction could not be decoded.');
  }
}

function getTransactionAddress(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return normalizeAlgorandAddress(value);
  }

  if (value.publicKey instanceof Uint8Array) {
    return normalizeAlgorandAddress(
      algosdk.encodeAddress(value.publicKey)
    );
  }

  if (value instanceof Uint8Array) {
    return normalizeAlgorandAddress(
      algosdk.encodeAddress(value)
    );
  }

  return '';
}

function getTransactionGenesisHashBase64(transaction) {
  if (!transaction?.genesisHash) {
    return '';
  }

  return Buffer.from(transaction.genesisHash).toString('base64');
}

function hasUnsafeAddress(value) {
  return Boolean(getTransactionAddress(value));
}

function validateSignedFundingTransaction({
  signedTransaction,
  fundingAttempt,
}) {
  const transaction = signedTransaction?.txn;

  if (!transaction) {
    throw new Error('The signed payload does not contain a transaction.');
  }

  if (transaction.type !== 'pay') {
    throw new Error('The signed transaction must be an ALGO payment.');
  }

  const expectedTransactionId = fundingAttempt.expectedTransactionId;
  const actualTransactionId = transaction.txID();

  if (
    !expectedTransactionId ||
    actualTransactionId !== expectedTransactionId
  ) {
    throw new Error(
      'The signed transaction does not match the prepared funding payment.'
    );
  }

  const expectedOwnerAddress = normalizeAlgorandAddress(
    fundingAttempt.ownerAddress
  );

  const expectedReceiverAddress = normalizeAlgorandAddress(
    fundingAttempt.receiverAddress
  );

  const actualSenderAddress = getTransactionAddress(transaction.sender);
  const actualReceiverAddress = getTransactionAddress(
    transaction.payment?.receiver || transaction.to
  );
  if (
    !expectedOwnerAddress ||
    actualSenderAddress !== expectedOwnerAddress
  ) {
    throw new Error(
      'The signed transaction sender does not match the funding owner.'
    );
  }

  if (
    !expectedReceiverAddress ||
    actualReceiverAddress !== expectedReceiverAddress
  ) {
    throw new Error(
      'The signed transaction receiver does not match the prepared payment.'
    );
  }

  const expectedAmount = Number(fundingAttempt.amountMicroAlgos);
  const actualAmount = Number(
    transaction.payment?.amount ?? transaction.amount
    );

  if (
    !Number.isSafeInteger(expectedAmount) ||
    expectedAmount <= 0 ||
    actualAmount !== expectedAmount
  ) {
    throw new Error(
      'The signed transaction amount does not match the prepared payment.'
    );
  }

  if (hasUnsafeAddress(transaction.closeRemainderTo)) {
    throw new Error(
      'Funding payments must not include a close remainder address.'
    );
  }

  if (hasUnsafeAddress(transaction.reKeyTo)) {
    throw new Error(
      'Funding payments must not include a rekey address.'
    );
  }

  const expectedTransaction = fundingAttempt.transaction || {};

  const expectedFee = Number(expectedTransaction.feeMicroAlgos);
  const actualFee = Number(transaction.fee);

  if (
    Number.isSafeInteger(expectedFee) &&
    expectedFee >= 0 &&
    actualFee !== expectedFee
  ) {
    throw new Error(
      'The signed transaction fee does not match the prepared payment.'
    );
  }

  const expectedFirstValidRound = Number(
    expectedTransaction.firstValidRound
  );
  const expectedLastValidRound = Number(
    expectedTransaction.lastValidRound
  );

  if (
    Number.isSafeInteger(expectedFirstValidRound) &&
    Number(transaction.firstValid) !== expectedFirstValidRound
  ) {
    throw new Error(
      'The signed transaction first valid round does not match the prepared payment.'
    );
  }

  if (
    Number.isSafeInteger(expectedLastValidRound) &&
    Number(transaction.lastValid) !== expectedLastValidRound
  ) {
    throw new Error(
      'The signed transaction last valid round does not match the prepared payment.'
    );
  }

  if (
    expectedTransaction.genesisId &&
    transaction.genesisID !== expectedTransaction.genesisId
  ) {
    throw new Error(
      'The signed transaction network does not match the prepared payment.'
    );
  }

  const actualGenesisHashBase64 =
    getTransactionGenesisHashBase64(transaction);

  if (
    expectedTransaction.genesisHashBase64 &&
    actualGenesisHashBase64 !==
      expectedTransaction.genesisHashBase64
  ) {
    throw new Error(
      'The signed transaction genesis hash does not match the prepared payment.'
    );
  }

  return {
    transactionId: actualTransactionId,
  };
}

function isExpired(fundingAttempt) {
  const expiresAt = new Date(fundingAttempt?.expiresAt);

  return (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  );
}

async function loadOwnedProduct({
  db,
  ownershipFilter,
}) {
  return db.collection('products').findOne(ownershipFilter);
}

async function markFundingAttemptExpired({
  db,
  ownershipFilter,
  fundingAttemptId,
}) {
  const now = new Date();

  return db.collection('products').findOneAndUpdate(
    {
      ...ownershipFilter,
      'productRevenuePool.tokenizationStatus':
        'awaiting_funding_signature',
      'productRevenuePool.fundingAttempt.id': fundingAttemptId,
      'productRevenuePool.fundingAttempt.status':
        'awaiting_signature',
    },
    {
      $set: {
        'productRevenuePool.tokenizationStatus': 'pending_funding',
        'productRevenuePool.fundingAttempt.status': 'expired',
        'productRevenuePool.updatedAt': now,
        updatedAt: now,
      },
    },
    {
      returnDocument: 'after',
    }
  );
}

async function reconcileSubmittedFundingAttempt({
  db,
  ownershipFilter,
  fundingAttempt,
}) {
  const transactionId =
    fundingAttempt.submittedTransactionId ||
    fundingAttempt.expectedTransactionId;

  if (!transactionId) {
    return null;
  }

  const algod = getAlgodClient();

  try {
    const pendingTransaction =
      await algod.pendingTransactionInformation(transactionId).do();

    const poolError =
      pendingTransaction?.['pool-error'] ||
      pendingTransaction?.poolError ||
      '';

    const confirmedRound = Number(
      pendingTransaction?.['confirmed-round'] ||
        pendingTransaction?.confirmedRound ||
        0
    );

    const now = new Date();

    if (poolError) {
      return db.collection('products').findOneAndUpdate(
        {
          ...ownershipFilter,
          'productRevenuePool.fundingAttempt.id': fundingAttempt.id,
          'productRevenuePool.fundingAttempt.expectedTransactionId':
            fundingAttempt.expectedTransactionId,
          'productRevenuePool.fundingAttempt.status': {
            $in: ['submitting', 'submitted', 'confirming'],
          },
        },
        {
          $set: {
            'productRevenuePool.fundingAttempt.status': 'failed',
            'productRevenuePool.fundingAttempt.failureCode':
              'ALGOD_POOL_ERROR',
            'productRevenuePool.fundingAttempt.failureMessage':
              String(poolError),
            'productRevenuePool.fundingAttempt.failedAt': now,
            'productRevenuePool.updatedAt': now,
            updatedAt: now,
          },
        },
        {
          returnDocument: 'after',
        }
      );
    }

    if (confirmedRound) {
      return db.collection('products').findOneAndUpdate(
        {
          ...ownershipFilter,
          'productRevenuePool.fundingAttempt.id': fundingAttempt.id,
          'productRevenuePool.fundingAttempt.expectedTransactionId':
            fundingAttempt.expectedTransactionId,
          'productRevenuePool.fundingAttempt.status': {
            $in: ['submitting', 'submitted', 'confirming'],
          },
        },
        {
          $set: {
            'productRevenuePool.fundingAttempt.status': 'confirmed',
            'productRevenuePool.fundingAttempt.submittedTransactionId':
              transactionId,
            'productRevenuePool.fundingAttempt.submittedAt':
              fundingAttempt.submittedAt || now,
            'productRevenuePool.fundingAttempt.confirmedAt': now,
            'productRevenuePool.fundingAttempt.confirmedRound':
              confirmedRound,

            'productRevenuePool.mbrPaidMicroAlgos':
              Number(fundingAttempt.amountMicroAlgos),
            'productRevenuePool.mbrPaymentTxId': transactionId,
            'productRevenuePool.tokenizationStatus': 'creating',

            'productRevenuePool.updatedAt': now,
            updatedAt: now,
          },
        },
        {
          returnDocument: 'after',
        }
      );
    }

    /*
     * Algod located the tx but it has not confirmed yet.
     * This recovers the ambiguous “broadcast accepted but DB write failed”
     * case without creating a second payment.
     */
    return db.collection('products').findOneAndUpdate(
      {
        ...ownershipFilter,
        'productRevenuePool.fundingAttempt.id': fundingAttempt.id,
        'productRevenuePool.fundingAttempt.expectedTransactionId':
          fundingAttempt.expectedTransactionId,
        'productRevenuePool.fundingAttempt.status': {
          $in: ['submitting', 'submitted', 'confirming'],
        },
      },
      {
        $set: {
          'productRevenuePool.fundingAttempt.status': 'confirming',
          'productRevenuePool.fundingAttempt.submittedTransactionId':
            transactionId,
          'productRevenuePool.fundingAttempt.submittedAt':
            fundingAttempt.submittedAt || now,
          'productRevenuePool.updatedAt': now,
          updatedAt: now,
        },
      },
      {
        returnDocument: 'after',
      }
    );
  } catch {
    /*
     * The transaction cannot currently be found by Algod.
     * Leave the durable claim intact. Do not mark it failed and do not
     * broadcast again automatically; that preserves the no-duplicate-payment
     * invariant while the state is uncertain.
     */
    return null;
  }
}

export async function POST(request, { params }) {
  try {
    const userId = getAuthenticatedUserId(request);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication is required.',
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    const productFilter = createProductIdFilter(id);

    if (!productFilter) {
      return NextResponse.json(
        {
          success: false,
          error: 'A valid product ID is required.',
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const fundingAttemptId = String(
      body?.fundingAttemptId || ''
    ).trim();

    const expectedTransactionId = String(
      body?.expectedTransactionId || ''
    ).trim();

    const signedTransactionBase64 = String(
      body?.signedTransactionBase64 || ''
    ).trim();

    if (
      !fundingAttemptId ||
      !expectedTransactionId ||
      !signedTransactionBase64
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'fundingAttemptId, expectedTransactionId, and signedTransactionBase64 are required.',
        },
        { status: 400 }
      );
    }

    const ownershipFilter = createOwnedProductFilter(
      productFilter,
      userId
    );

    const { db } = await connectToDatabase();

    const product = await loadOwnedProduct({
      db,
      ownershipFilter,
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found.',
        },
        { status: 404 }
      );
    }

    const productRevenuePool = product.productRevenuePool;
    const fundingAttempt = productRevenuePool?.fundingAttempt;

    if (!productRevenuePool || !fundingAttempt) {
      return NextResponse.json(
        {
          success: false,
          error: 'No funding attempt exists for this product.',
        },
        { status: 409 }
      );
    }

    if (
      fundingAttempt.id !== fundingAttemptId ||
      fundingAttempt.expectedTransactionId !== expectedTransactionId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The submitted funding attempt does not match this product payment.',
        },
        { status: 409 }
      );
    }

    if (fundingAttempt.status === 'confirmed') {
      return NextResponse.json(
        createFundingResponse(product, fundingAttempt, {
          recovered: true,
        })
      );
    }

    if (
      ['submitting', 'submitted', 'confirming'].includes(
        fundingAttempt.status
      )
    ) {
      const reconciledResult = await reconcileSubmittedFundingAttempt({
        db,
        ownershipFilter,
        fundingAttempt,
      });

      const currentProduct =
        reconciledResult?.value ||
        (await loadOwnedProduct({
          db,
          ownershipFilter,
        }));

      return NextResponse.json(
        createFundingResponse(
          currentProduct,
          currentProduct?.productRevenuePool?.fundingAttempt,
          {
            recovered: true,
            pending:
              currentProduct?.productRevenuePool?.fundingAttempt
                ?.status !== 'confirmed',
          }
        )
      );
    }

    if (
      productRevenuePool.tokenizationStatus !==
      'awaiting_funding_signature'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This product is not currently eligible for funding submission.',
        },
        { status: 409 }
      );
    }

    if (fundingAttempt.status !== 'awaiting_signature') {
      return NextResponse.json(
        {
          success: false,
          error:
            'This funding attempt is not eligible for submission.',
        },
        { status: 409 }
      );
    }

    if (isExpired(fundingAttempt)) {
      const expiredResult = await markFundingAttemptExpired({
        db,
        ownershipFilter,
        fundingAttemptId,
      });

      return NextResponse.json(
        {
          success: false,
          code: 'FUNDING_ATTEMPT_EXPIRED',
          error:
            'The funding payment expired. Funding can now be prepared again.',
          fundingAttempt:
            expiredResult?.value?.productRevenuePool
              ?.fundingAttempt || null,
        },
        { status: 410 }
      );
    }

    const {
      signedTransactionBytes,
      signedTransaction,
    } = decodeSignedTransactionBase64(signedTransactionBase64);

    const { transactionId } = validateSignedFundingTransaction({
      signedTransaction,
      fundingAttempt,
    });

    if (transactionId !== expectedTransactionId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The signed payment transaction ID does not match the submitted expected transaction ID.',
        },
        { status: 409 }
      );
    }

    const now = new Date();
    const submissionClaimId = crypto.randomUUID();

		console.log(
			'[products/revenue-tokenization/funding/submit] attempting claim:',
			{
				fundingAttemptId,
				expectedTransactionId,
				currentStatus: fundingAttempt.status,
			}
		);

    const claimResult = await db.collection('products').findOneAndUpdate(
      {
				_id: product._id,
				'productRevenuePool.fundingAttempt.id': fundingAttemptId,
				'productRevenuePool.fundingAttempt.expectedTransactionId':
					expectedTransactionId,
				'productRevenuePool.fundingAttempt.status':
					'awaiting_signature',
			},
      {
        $set: {
          'productRevenuePool.fundingAttempt.status': 'submitting',
          'productRevenuePool.fundingAttempt.submissionClaimId':
            submissionClaimId,
          'productRevenuePool.fundingAttempt.submissionClaimedAt':
            now,
          'productRevenuePool.updatedAt': now,
          updatedAt: now,
        },
      },
      {
        returnDocument: 'after',
      }
    );

		const claimedProduct =
			claimResult?.value || claimResult || null;

		console.log(
			'[products/revenue-tokenization/funding/submit] claim result:',
			{
				claimed: Boolean(claimedProduct),
				resultingStatus:
					claimedProduct?.productRevenuePool?.fundingAttempt?.status ||
					null,
			}
		);

		if (!claimedProduct) {
			const currentProduct = await loadOwnedProduct({
				db,
				ownershipFilter,
			});

			return NextResponse.json(
				createFundingResponse(
					currentProduct,
					currentProduct?.productRevenuePool?.fundingAttempt,
					{
						recovered: true,
					}
				),
				{ status: 409 }
			);
		}

		const claimedFundingAttempt =
			claimedProduct.productRevenuePool.fundingAttempt;
    const algod = getAlgodClient();

    let submittedTransactionId;

    try {
      const submitResponse = await algod
        .sendRawTransaction(signedTransactionBytes)
        .do();

      submittedTransactionId =
        submitResponse?.txId ||
        submitResponse?.txid ||
        transactionId;
    } catch (error) {
      const message =
        error?.message || 'Algorand rejected the funding payment.';

      const failedAt = new Date();

      await db.collection('products').updateOne(
        {
          ...ownershipFilter,
          'productRevenuePool.fundingAttempt.id': fundingAttemptId,
          'productRevenuePool.fundingAttempt.submissionClaimId':
            submissionClaimId,
          'productRevenuePool.fundingAttempt.status': 'submitting',
        },
        {
          $set: {
            'productRevenuePool.fundingAttempt.status': 'failed',
            'productRevenuePool.fundingAttempt.failureCode':
              'ALGOD_BROADCAST_FAILED',
            'productRevenuePool.fundingAttempt.failureMessage':
              message,
            'productRevenuePool.fundingAttempt.failedAt': failedAt,
            'productRevenuePool.updatedAt': failedAt,
            updatedAt: failedAt,
          },
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            'Algorand could not accept the funding payment. No funding confirmation was recorded.',
        },
        { status: 502 }
      );
    }

    const submittedAt = new Date();

    await db.collection('products').updateOne(
      {
        ...ownershipFilter,
        'productRevenuePool.fundingAttempt.id': fundingAttemptId,
        'productRevenuePool.fundingAttempt.submissionClaimId':
          submissionClaimId,
        'productRevenuePool.fundingAttempt.status': 'submitting',
      },
      {
        $set: {
          'productRevenuePool.fundingAttempt.status': 'confirming',
          'productRevenuePool.fundingAttempt.submittedTransactionId':
            submittedTransactionId,
          'productRevenuePool.fundingAttempt.submittedAt':
            submittedAt,
          'productRevenuePool.fundingAttempt.submissionResponse': {
            transactionId: submittedTransactionId,
          },
          'productRevenuePool.updatedAt': submittedAt,
          updatedAt: submittedAt,
        },
      }
    );

    let confirmation;

    try {
      confirmation = await algosdk.waitForConfirmation(
        algod,
        submittedTransactionId,
        12
        );
    } catch {
      const pendingProduct = await loadOwnedProduct({
        db,
        ownershipFilter,
      });

      return NextResponse.json(
        createFundingResponse(
          pendingProduct,
          pendingProduct?.productRevenuePool?.fundingAttempt,
          {
            pending: true,
          }
        ),
        { status: 202 }
      );
    }

    const confirmedRound = Number(
      confirmation?.['confirmed-round'] ||
        confirmation?.confirmedRound ||
        0
    );

    if (!confirmedRound) {
      const pendingProduct = await loadOwnedProduct({
        db,
        ownershipFilter,
      });

      return NextResponse.json(
        createFundingResponse(
          pendingProduct,
          pendingProduct?.productRevenuePool?.fundingAttempt,
          {
            pending: true,
          }
        ),
        { status: 202 }
      );
    }

    const confirmedAt = new Date();

    const confirmedResult = await db.collection('products').findOneAndUpdate(
      {
        ...ownershipFilter,
        'productRevenuePool.fundingAttempt.id': fundingAttemptId,
        'productRevenuePool.fundingAttempt.expectedTransactionId':
          expectedTransactionId,
        'productRevenuePool.fundingAttempt.submittedTransactionId':
          submittedTransactionId,
        'productRevenuePool.fundingAttempt.status': {
          $in: ['submitting', 'submitted', 'confirming'],
        },
      },
      {
        $set: {
          'productRevenuePool.fundingAttempt.status': 'confirmed',
					'productRevenuePool.fundingAttempt.confirmedAt': confirmedAt,
					'productRevenuePool.fundingAttempt.confirmedRound':
					confirmedRound,

					'productRevenuePool.mbrPaidMicroAlgos':
					Number(claimedFundingAttempt.amountMicroAlgos),
					'productRevenuePool.mbrPaymentTxId': submittedTransactionId,
					'productRevenuePool.tokenizationStatus': 'creating',

					'productRevenuePool.updatedAt': confirmedAt,
					updatedAt: confirmedAt,
        },
      },
      {
        returnDocument: 'after',
      }
    );

    const confirmedProduct =
      confirmedResult?.value ||
      (await loadOwnedProduct({
        db,
        ownershipFilter,
      }));

    return NextResponse.json(
      createFundingResponse(
        confirmedProduct,
        confirmedProduct?.productRevenuePool?.fundingAttempt,
        {
          confirmed: true,
        }
      )
    );
  } catch (error) {
    console.error(
      '[products/revenue-tokenization/funding/submit] failed:',
      {
        message: error?.message,
      }
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to submit product revenue-pool funding.',
      },
      { status: 500 }
    );
  }
}