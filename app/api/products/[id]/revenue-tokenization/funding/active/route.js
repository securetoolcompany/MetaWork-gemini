import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import algosdk from 'algosdk';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

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

export async function GET(request, { params }) {
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

    const url = new URL(request.url);
    const requestedWalletAddress = normalizeAlgorandAddress(
      url.searchParams.get('walletAddress')
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

    if (!algosdk.isValidAddress(requestedWalletAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Selected wallet is not a valid Algorand address.',
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
    const fundingAttempt = productRevenuePool?.fundingAttempt;

    if (!productRevenuePool || !fundingAttempt) {
      return NextResponse.json(
        {
          success: false,
          error: 'No product funding attempt exists for this product.',
        },
        { status: 404 }
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
            'This product does not have an active funding signature request.',
        },
        { status: 409 }
      );
    }

    if (fundingAttempt.status !== 'awaiting_signature') {
      return NextResponse.json(
        {
          success: false,
          error: 'The active funding attempt is not awaiting signature.',
        },
        { status: 409 }
      );
    }

    const attemptOwnerAddress = normalizeAlgorandAddress(
      fundingAttempt.ownerAddress
    );

    if (attemptOwnerAddress !== selectedWallet.address) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Connect and select the wallet used to prepare this funding payment.',
        },
        { status: 403 }
      );
    }

    const expiresAt = new Date(fundingAttempt.expiresAt);

    if (Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: 'The active funding attempt has an invalid expiration time.',
        },
        { status: 409 }
      );
    }

    if (expiresAt.getTime() <= Date.now()) {
      const now = new Date();

      await db.collection('products').updateOne(
        {
          ...ownershipFilter,
          'productRevenuePool.tokenizationStatus':
            'awaiting_funding_signature',
          'productRevenuePool.fundingAttempt.id': fundingAttempt.id,
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

    return NextResponse.json(
        {
          success: false,
          code: 'FUNDING_ATTEMPT_EXPIRED',
          error:
            'The funding signature request expired. Funding can now be prepared again.',
          diagnostics: {
            serverNow: new Date().toISOString(),
            serverNowMilliseconds: Date.now(),

            rawExpiresAt: fundingAttempt.expiresAt,
            rawExpiresAtType: typeof fundingAttempt.expiresAt,

            parsedExpiresAt: expiresAt.toISOString(),
            parsedExpiresAtMilliseconds: expiresAt.getTime(),

            comparison: {
                isExpired: expiresAt.getTime() <= Date.now(),
                millisecondsRemaining: expiresAt.getTime() - Date.now(),
            },

            attemptId: fundingAttempt.id,
            attemptStatus: fundingAttempt.status,
            },
        },
        {
          status: 410,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const txnBase64 = fundingAttempt?.transaction?.txnBase64;
    const signers = fundingAttempt?.transaction?.signers;

    if (
      !txnBase64 ||
      !Array.isArray(signers) ||
      signers.length !== 1 ||
      normalizeAlgorandAddress(signers[0]) !== selectedWallet.address
    ) {
      return NextResponse.json(
        {
          success: false,
          code: 'FUNDING_ATTEMPT_NOT_RECOVERABLE',
          error:
            'This funding attempt was created before transaction recovery was enabled. Wait for it to expire, then prepare funding again.',
        },
        { status: 409 }
      );
    }

    const amountMicroAlgos = Number(fundingAttempt.amountMicroAlgos);
    const receiverAddress = normalizeAlgorandAddress(
      fundingAttempt.receiverAddress
    );

    if (
      !Number.isSafeInteger(amountMicroAlgos) ||
      amountMicroAlgos <= 0 ||
      !algosdk.isValidAddress(receiverAddress)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'The active funding attempt contains invalid payment data.',
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
          id: fundingAttempt.id,
          status: fundingAttempt.status,
          expiresAt,
        },

        funding: {
          ownerAddress: selectedWallet.address,
          receiverAddress,
          amountMicroAlgos,
          amountAlgos: (amountMicroAlgos / 1_000_000).toFixed(6),
          expectedTransactionId: fundingAttempt.expectedTransactionId,
        },

        transactions: [
          {
            index: fundingAttempt.transaction.index ?? 0,
            txnBase64,
            signers,
          },
        ],
      }),
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      '[products/revenue-tokenization/funding/active] failed:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to retrieve the active product funding attempt.',
      },
      { status: 500 }
    );
  }
}