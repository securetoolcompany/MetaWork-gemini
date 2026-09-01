import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import algosdk from 'algosdk';
import crypto from 'crypto';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import {
  getSigner,
  getTransactionParams,
} from '@/lib/algorand';

export const dynamic = 'force-dynamic';

const FUNDING_ATTEMPT_TTL_MS = 15 * 60 * 1000;

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

    return decoded?.userId
      ? String(decoded.userId)
      : null;
  } catch {
    return null;
  }
}

function normalizeAlgorandAddress(address) {
  return String(address || '').trim().toUpperCase();
}

function createUserIdentityFilter(userId) {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return null;
  }

  const filters = [
    { _id: normalizedUserId },
    { id: normalizedUserId },
    { userId: normalizedUserId },
  ];

  if (ObjectId.isValid(normalizedUserId)) {
    filters.unshift({
      _id: new ObjectId(normalizedUserId),
    });
  }

  return {
    $or: filters,
  };
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

function getVerifiedAlgorandWallets(user) {
  const walletsByAddress = new Map();

  for (const wallet of user?.wallets || []) {
    const address = normalizeAlgorandAddress(wallet?.address);
    const chain = String(wallet?.chain || 'algorand')
      .trim()
      .toLowerCase();

    if (!address || chain !== 'algorand' || wallet?.verified !== true) {
      continue;
    }

    if (!walletsByAddress.has(address)) {
      walletsByAddress.set(address, {
        ...wallet,
        address,
        chain: 'algorand',
      });
    }
  }

  return Array.from(walletsByAddress.values());
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

    const requestedWalletAddress = normalizeAlgorandAddress(
      body?.walletAddress
    );

    if (!requestedWalletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'A selected verified Algorand wallet is required.',
        },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const userIdentityFilter = createUserIdentityFilter(userId);

    if (!userIdentityFilter) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to resolve the authenticated user.',
        },
        { status: 401 }
      );
    }

    const user = await db.collection('users').findOne(
      userIdentityFilter,
      {
        projection: {
          _id: 1,
          id: 1,
          userId: 1,
          wallets: 1,
        },
      }
    );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authenticated user was not found.',
        },
        { status: 404 }
      );
    }

    const verifiedWallets = getVerifiedAlgorandWallets(user);

    const selectedWallet = verifiedWallets.find(
      (wallet) => wallet.address === requestedWalletAddress
    );

    if (!selectedWallet) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Choose a verified Algorand wallet linked to your MetaWork account.',
        },
        { status: 403 }
      );
    }

    const ownershipFilter = createOwnedProductFilter(
      productFilter,
      userId
    );

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

    const productRevenuePool = product?.productRevenuePool;
    const existingFundingAttempt =
      productRevenuePool?.fundingAttempt;

    if (!productRevenuePool) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Prepare product revenue tokenization before preparing funding.',
        },
        { status: 409 }
      );
    }

    if (productRevenuePool.tokenizationStatus === 'active') {
      return NextResponse.json(
        {
          success: false,
          error: 'This product revenue pool is already active.',
        },
        { status: 409 }
      );
    }

    if (
      productRevenuePool.tokenizationStatus ===
      'awaiting_funding_signature'
    ) {
      const existingExpiresAt = new Date(
        existingFundingAttempt?.expiresAt
      );

      const hasExpiredFundingAttempt =
        existingFundingAttempt?.status === 'awaiting_signature' &&
        !Number.isNaN(existingExpiresAt.getTime()) &&
        existingExpiresAt.getTime() <= Date.now();

      if (!hasExpiredFundingAttempt) {
        return NextResponse.json(
          {
            success: false,
            error:
              'A funding signature request is already active for this product.',
          },
          { status: 409 }
        );
      }

      const now = new Date();

      const expireResult = await db.collection('products').updateOne(
        {
          ...ownershipFilter,
          'productRevenuePool.tokenizationStatus':
            'awaiting_funding_signature',
          'productRevenuePool.fundingAttempt.id':
            existingFundingAttempt.id,
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
        }
      );

      if (expireResult.modifiedCount !== 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              'The funding attempt changed before expiration could be processed. Refresh and try again.',
          },
          { status: 409 }
        );
      }

      productRevenuePool.tokenizationStatus = 'pending_funding';
      productRevenuePool.fundingAttempt = {
        ...existingFundingAttempt,
        status: 'expired',
      };
    }

    if (
      productRevenuePool.tokenizationStatus !== 'pending_funding'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Product funding cannot be prepared while tokenization status is "${productRevenuePool.tokenizationStatus}".`,
        },
        { status: 409 }
      );
    }

    const storedOwnerAddress = normalizeAlgorandAddress(
      productRevenuePool.ownerAddress ||
        productRevenuePool.stakeholders?.[0]?.address
    );

    if (!storedOwnerAddress) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Prepared product revenue pool is missing its owner wallet address.',
        },
        { status: 409 }
      );
    }

    if (storedOwnerAddress !== selectedWallet.address) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Connect and select the same wallet that was used to prepare this product revenue pool.',
        },
        { status: 403 }
      );
    }

    const amountMicroAlgos = Number(
      productRevenuePool.mbr?.totalMicroAlgos
    );

    if (
      !Number.isSafeInteger(amountMicroAlgos) ||
      amountMicroAlgos <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Prepared product revenue pool is missing a valid MBR funding amount.',
        },
        { status: 409 }
      );
    }

    const platformSigner = getSigner();
    const receiverAddress = normalizeAlgorandAddress(
      platformSigner.address
    );

    if (!algosdk.isValidAddress(selectedWallet.address)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Selected wallet is not a valid Algorand address.',
        },
        { status: 400 }
      );
    }

    if (!algosdk.isValidAddress(receiverAddress)) {
      throw new Error(
        'The configured MetaWork platform signer address is invalid.'
      );
    }

    const suggestedParams = await getTransactionParams();

    const fundingTxn =
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: selectedWallet.address,
        receiver: receiverAddress,
        amount: amountMicroAlgos,
        suggestedParams,
      });

    const fundingAttemptId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + FUNDING_ATTEMPT_TTL_MS
    );
    
    const expectedTransactionId = fundingTxn.txID();

    const txnBase64 = Buffer.from(
      algosdk.encodeUnsignedTransaction(fundingTxn)
    ).toString('base64');

    const fundingAttempt = {
      id: fundingAttemptId,

      ownerAddress: selectedWallet.address,
      receiverAddress,

      amountMicroAlgos,
      expectedTransactionId,

      transaction: {
        index: 0,
        txnBase64,
        signers: [selectedWallet.address],
      },

      preparedAt: now,
      expiresAt,

      status: 'awaiting_signature',
    };

    const updateResult = await db.collection('products').updateOne(
      {
        ...ownershipFilter,
        'productRevenuePool.tokenizationStatus': 'pending_funding',
      },
      {
        $set: {
          'productRevenuePool.fundingAttempt': fundingAttempt,
          'productRevenuePool.tokenizationStatus':
            'awaiting_funding_signature',
          'productRevenuePool.updatedAt': now,
          updatedAt: now,
        },
      }
    );

    if (updateResult.modifiedCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Product funding state changed before the attempt could be created. Refresh and try again.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      serialize({
        success: true,

        product: {
          id: String(product._id),
          name:
            product.name ||
            product.title ||
            product.externalProductId ||
            'Untitled product',
        },

        fundingAttempt: {
          id: fundingAttemptId,
          status: fundingAttempt.status,
          expiresAt,
        },

        funding: {
          ownerAddress: selectedWallet.address,
          receiverAddress,

          amountMicroAlgos,
          amountAlgos: (amountMicroAlgos / 1_000_000).toFixed(6),

          expectedTransactionId,
        },

        transactions: [
          {
            index: 0,
            txnBase64,
            signers: [selectedWallet.address],
          },
        ],
      })
    );
  } catch (error) {
    console.error(
      '[products/revenue-tokenization/funding/prepare] failed:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to prepare product revenue-pool funding.',
      },
      { status: 500 }
    );
  }
}