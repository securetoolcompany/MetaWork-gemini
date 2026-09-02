import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import algosdk from 'algosdk';
import crypto from 'crypto';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import {
  getAlgodClient,
  getTransactionParams,
  getUsdcAssetId,
  getSigner,
} from '@/lib/algorand';

export const dynamic = 'force-dynamic';

const RESERVE_FUNDING_MICROALGOS = 210_000;

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

function getRevenuePoolAppId() {
  const appId = Number(process.env.GLOBAL_POOL_APP_ID);

  if (!Number.isSafeInteger(appId) || appId <= 0) {
    throw new Error(
      'GLOBAL_POOL_APP_ID must be configured as a positive integer.'
    );
  }

  return appId;
}

function poolBoxName(poolKey) {
  return new Uint8Array(
    Buffer.concat([
      Buffer.from('p_', 'utf8'),
      Buffer.from(poolKey, 'utf8'),
    ])
  );
}

function packStakeholders(stakeholders) {
  if (!Array.isArray(stakeholders) || stakeholders.length === 0) {
    throw new Error(
      'Product revenue pool requires at least one stakeholder.'
    );
  }

  const packed = Buffer.alloc(stakeholders.length * 34);
  let offset = 0;
  let totalBps = 0;

  for (const stakeholder of stakeholders) {
    const address = String(stakeholder?.address || '')
      .trim()
      .toUpperCase();

    const bps = Number(stakeholder?.bps);

    if (!algosdk.isValidAddress(address)) {
      throw new Error(
        'Product revenue pool contains an invalid stakeholder address.'
      );
    }

    if (
      !Number.isSafeInteger(bps) ||
      bps <= 0 ||
      bps > 10_000
    ) {
      throw new Error(
        'Product revenue pool contains an invalid stakeholder allocation.'
      );
    }

    const publicKey = algosdk.decodeAddress(address).publicKey;

    Buffer.from(publicKey).copy(packed, offset);
    packed[offset + 32] = (bps >> 8) & 0xff;
    packed[offset + 33] = bps & 0xff;

    offset += 34;
    totalBps += bps;
  }

  if (totalBps !== 10_000) {
    throw new Error(
      'Product revenue stakeholder allocations must total 10,000 basis points.'
    );
  }

  return new Uint8Array(packed);
}

function getPoolBoxRevenueTokenId(boxValue) {
  const rawValue =
    boxValue instanceof Uint8Array
      ? boxValue
      : new Uint8Array(boxValue);

  if (rawValue.length < 8) {
    throw new Error(
      'Created product revenue pool box is missing its revenue token ID.'
    );
  }

  const view = new DataView(
    rawValue.buffer,
    rawValue.byteOffset,
    rawValue.byteLength
  );

  const revenueTokenId = Number(view.getBigUint64(0, false));

  if (!Number.isSafeInteger(revenueTokenId) || revenueTokenId <= 0) {
    throw new Error(
      'Created product revenue pool did not report a valid revenue token ID.'
    );
  }

  return revenueTokenId;
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

function createResponse(product, extra = {}) {
  const pool = product?.productRevenuePool || {};

  return serialize({
    success: true,

    product: {
      id: String(product?._id || ''),
      name:
        product?.name ||
        product?.title ||
        product?.externalProductId ||
        'Untitled product',
      tokenizationStatus: pool.tokenizationStatus || null,
    },

    productRevenuePool: {
      poolKey: pool.poolKey || null,
      revenuePoolAppId: pool.revenuePoolAppId || null,
      revenuePoolAddress: pool.revenuePoolAddress || null,
      revenueTokenAssetId: pool.revenueTokenAssetId || null,
      mbrPaymentTxId: pool.mbrPaymentTxId || null,
      mbrPaidMicroAlgos: pool.mbrPaidMicroAlgos || null,
      poolCreationTxId: pool.poolCreationTxId || null,
      poolCreatedAt: pool.poolCreatedAt || null,
    },

    ...extra,
  });
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

    const ownershipFilter = createOwnedProductFilter(
      productFilter,
      userId
    );

    const { db } = await connectToDatabase();

    const product = await db
      .collection('products')
      .findOne(ownershipFilter);

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
          error:
            'Product revenue tokenization and confirmed funding are required.',
        },
        { status: 409 }
      );
    }

    if (
      productRevenuePool.tokenizationStatus === 'active' &&
      productRevenuePool.revenueTokenAssetId
    ) {
      return NextResponse.json(
        createResponse(product, {
          recovered: true,
        })
      );
    }

    if (
      productRevenuePool.tokenizationStatus !== 'creating' ||
      fundingAttempt.status !== 'confirmed' ||
      !productRevenuePool.mbrPaymentTxId ||
      !Number.isSafeInteger(
        Number(productRevenuePool.mbrPaidMicroAlgos)
      ) ||
      Number(productRevenuePool.mbrPaidMicroAlgos) <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This product is not eligible for revenue pool creation.',
        },
        { status: 409 }
      );
    }

    const poolKey = String(productRevenuePool.poolKey || '').trim();

    if (!poolKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Product revenue tokenization is missing its pool key.',
        },
        { status: 409 }
      );
    }

    const poolAppId = getRevenuePoolAppId();
    const algod = getAlgodClient();
    const appAddress = algosdk
      .getApplicationAddress(poolAppId)
      .toString();

    const boxName = poolBoxName(poolKey);

    /*
     * Reconcile before creating: if the pool box is already present,
     * store its ASA ID instead of submitting another creation group.
     */
    try {
      const existingBox = await algod
        .getApplicationBoxByName(poolAppId, boxName)
        .do();

      const existingBoxValue =
        existingBox?.value || existingBox;

      if (existingBoxValue) {
        const revenueTokenAssetId =
          getPoolBoxRevenueTokenId(existingBoxValue);

        const now = new Date();

        const reconcileResult = await db
          .collection('products')
          .findOneAndUpdate(
            {
              _id: product._id,
              'productRevenuePool.poolKey': poolKey,
              'productRevenuePool.fundingAttempt.status':
                'confirmed',
              'productRevenuePool.tokenizationStatus': {
                $in: ['creating', 'active'],
              },
            },
            {
              $set: {
                'productRevenuePool.tokenizationStatus': 'active',
                'productRevenuePool.revenuePoolAppId': poolAppId,
                'productRevenuePool.revenuePoolAddress': appAddress,
                'productRevenuePool.revenueTokenAssetId':
                  revenueTokenAssetId,
                'productRevenuePool.poolCreatedAt':
                  productRevenuePool.poolCreatedAt || now,
                'productRevenuePool.updatedAt': now,
                updatedAt: now,
              },
            },
            {
              returnDocument: 'after',
            }
          );

        const reconciledProduct =
          reconcileResult?.value ||
          reconcileResult ||
          (await db.collection('products').findOne({
            _id: product._id,
          }));

        return NextResponse.json(
          createResponse(reconciledProduct, {
            recovered: true,
          })
        );
      }
    } catch (error) {
      if (Number(error?.status) !== 404) {
        throw error;
      }
    }

    /*
     * Claim creation before broadcast. A second browser refresh or request
     * cannot create a duplicate pool group.
     */
    const claimId = crypto.randomUUID();
    const claimedAt = new Date();

    const claimResult = await db
      .collection('products')
      .findOneAndUpdate(
        {
          _id: product._id,
          'productRevenuePool.poolKey': poolKey,
          'productRevenuePool.tokenizationStatus': 'creating',
          'productRevenuePool.fundingAttempt.status': 'confirmed',
          'productRevenuePool.revenueTokenAssetId': null,
          'productRevenuePool.poolCreationAttempt.status': {
            $nin: ['submitting', 'submitted', 'confirming'],
          },
        },
        {
          $set: {
            'productRevenuePool.poolCreationAttempt': {
              id: claimId,
              status: 'submitting',
              claimedAt,
              poolKey,
              appId: poolAppId,
            },
            'productRevenuePool.updatedAt': claimedAt,
            updatedAt: claimedAt,
          },
        },
        {
          returnDocument: 'after',
        }
      );

    const claimedProduct =
      claimResult?.value || claimResult || null;

    if (!claimedProduct) {
      const currentProduct = await db
        .collection('products')
        .findOne({
          _id: product._id,
        });

      return NextResponse.json(
        createResponse(currentProduct, {
          recovered: true,
          pending: true,
        }),
        { status: 202 }
      );
    }

    const platformSigner = getSigner();
    const suggestedParams = await getTransactionParams();
    const stakeholders = packStakeholders(
      claimedProduct.productRevenuePool.stakeholders
    );

    const poolBoxMbrMicroAlgos = Number(
      claimedProduct.productRevenuePool.mbr
        ?.poolBoxMbrMicroAlgos
    );

    if (
      !Number.isSafeInteger(poolBoxMbrMicroAlgos) ||
      poolBoxMbrMicroAlgos <= 0
    ) {
      throw new Error(
        'Product revenue tokenization is missing its exact pool-box MBR.'
      );
    }

    const reserveFundingTxn =
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: platformSigner.address,
        receiver: appAddress,
        amount: RESERVE_FUNDING_MICROALGOS,
        suggestedParams,
      });

    const poolMbrPaymentTxn =
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: platformSigner.address,
        receiver: appAddress,
        amount: poolBoxMbrMicroAlgos,
        suggestedParams,
      });

    const displayName = String(
      claimedProduct.productRevenuePool.displayName ||
        claimedProduct.name ||
        claimedProduct.title ||
        'Product Revenue'
    );

    const appTxn =
      algosdk.makeApplicationNoOpTxnFromObject({
        sender: platformSigner.address,
        appIndex: poolAppId,
        appArgs: [
          new TextEncoder().encode('create_pool'),
          new TextEncoder().encode(poolKey),
          new TextEncoder().encode(
            `Rev ${displayName.substring(0, 10)}`
          ),
          new TextEncoder().encode('REV'),
          stakeholders,
          algosdk.encodeUint64(1),
        ],
        foreignAssets: [getUsdcAssetId('testnet')],
        boxes: [
          {
            appIndex: poolAppId,
            name: boxName,
          },
        ],
        suggestedParams: {
          ...suggestedParams,
          fee: BigInt(3000),
          flatFee: true,
        },
      });

    algosdk.assignGroupID([
      reserveFundingTxn,
      poolMbrPaymentTxn,
      appTxn,
    ]);

    const signedGroup = [
      platformSigner.signTxn(reserveFundingTxn),
      platformSigner.signTxn(poolMbrPaymentTxn),
      platformSigner.signTxn(appTxn),
    ];

    let poolCreationTxId;

    try {
      const submitResponse = await algod
        .sendRawTransaction(signedGroup)
        .do();

      poolCreationTxId =
        submitResponse?.txid ||
        submitResponse?.txId ||
        appTxn.txID();
    } catch (error) {
      const now = new Date();

      await db.collection('products').updateOne(
        {
          _id: product._id,
          'productRevenuePool.poolCreationAttempt.id': claimId,
          'productRevenuePool.poolCreationAttempt.status':
            'submitting',
        },
        {
          $set: {
            'productRevenuePool.poolCreationAttempt.status':
              'failed',
            'productRevenuePool.poolCreationAttempt.failedAt':
              now,
            'productRevenuePool.poolCreationAttempt.failureMessage':
              error?.message || 'Pool creation broadcast failed.',
            'productRevenuePool.updatedAt': now,
            updatedAt: now,
          },
        }
      );

      throw error;
    }

    const submittedAt = new Date();

    await db.collection('products').updateOne(
      {
        _id: product._id,
        'productRevenuePool.poolCreationAttempt.id': claimId,
        'productRevenuePool.poolCreationAttempt.status':
          'submitting',
      },
      {
        $set: {
          'productRevenuePool.poolCreationAttempt.status':
            'confirming',
          'productRevenuePool.poolCreationAttempt.txId':
            poolCreationTxId,
          'productRevenuePool.poolCreationAttempt.submittedAt':
            submittedAt,
          'productRevenuePool.updatedAt': submittedAt,
          updatedAt: submittedAt,
        },
      }
    );

    let confirmation;

    try {
      confirmation = await algosdk.waitForConfirmation(
        algod,
        poolCreationTxId,
        12
      );
    } catch {
      const pendingProduct = await db
        .collection('products')
        .findOne({
          _id: product._id,
        });

      return NextResponse.json(
        createResponse(pendingProduct, {
          pending: true,
        }),
        { status: 202 }
      );
    }

    const confirmedRound = Number(
      confirmation?.['confirmed-round'] ||
        confirmation?.confirmedRound ||
        0
    );

    if (!confirmedRound) {
      const pendingProduct = await db
        .collection('products')
        .findOne({
          _id: product._id,
        });

      return NextResponse.json(
        createResponse(pendingProduct, {
          pending: true,
        }),
        { status: 202 }
      );
    }

    const createdBox = await algod
      .getApplicationBoxByName(poolAppId, boxName)
      .do();

    const revenueTokenAssetId = getPoolBoxRevenueTokenId(
      createdBox?.value || createdBox
    );

    const completedAt = new Date();

    const completeResult = await db
      .collection('products')
      .findOneAndUpdate(
        {
          _id: product._id,
          'productRevenuePool.poolCreationAttempt.id': claimId,
          'productRevenuePool.poolCreationAttempt.txId':
            poolCreationTxId,
          'productRevenuePool.poolCreationAttempt.status': {
            $in: ['submitting', 'confirming'],
          },
        },
        {
          $set: {
            'productRevenuePool.tokenizationStatus': 'active',
            'productRevenuePool.revenuePoolAppId': poolAppId,
            'productRevenuePool.revenuePoolAddress': appAddress,
            'productRevenuePool.revenueTokenAssetId':
              revenueTokenAssetId,
            'productRevenuePool.poolCreationTxId':
              poolCreationTxId,
            'productRevenuePool.poolCreatedAt': completedAt,

            'productRevenuePool.poolCreationAttempt.status':
              'confirmed',
            'productRevenuePool.poolCreationAttempt.confirmedAt':
              completedAt,
            'productRevenuePool.poolCreationAttempt.confirmedRound':
              confirmedRound,
            'productRevenuePool.updatedAt': completedAt,
            updatedAt: completedAt,
          },
        },
        {
          returnDocument: 'after',
        }
      );

    const completedProduct =
      completeResult?.value ||
      completeResult ||
      (await db.collection('products').findOne({
        _id: product._id,
      }));

    return NextResponse.json(
      createResponse(completedProduct, {
        confirmed: true,
      })
    );
  } catch (error) {
    console.error(
      '[products/revenue-tokenization/create] failed:',
      {
        message: error?.message,
      }
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to create the product revenue pool.',
      },
      { status: 500 }
    );
  }
}