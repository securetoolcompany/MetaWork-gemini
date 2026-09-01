import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import {
  buildProductRevenuePoolDraft,
  createProductRevenuePoolKey,
} from '@/lib/product-revenue-tokenization';

export const dynamic = 'force-dynamic';

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

    const stakeholders = Array.isArray(body?.stakeholders)
      ? body.stakeholders
      : [];

    if (!requestedWalletAddress) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Select and connect a verified Algorand wallet before preparing product tokenization.',
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

    const verifiedAlgorandWallets = getVerifiedAlgorandWallets(user);

    const selectedVerifiedWallet = verifiedAlgorandWallets.find(
      (wallet) => wallet.address === requestedWalletAddress
    );

    if (!selectedVerifiedWallet) {
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

    const currentPoolStatus =
      product?.productRevenuePool?.tokenizationStatus;

    if (
      currentPoolStatus === 'active' ||
      currentPoolStatus === 'creating'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This product already has an active or in-progress revenue pool.',
        },
        { status: 409 }
      );
    }

    const normalizedStakeholders = stakeholders.map(
      (stakeholder, index) => ({
        ...stakeholder,
        address: normalizeAlgorandAddress(
          stakeholder?.address ||
            (index === 0 ? selectedVerifiedWallet.address : '')
        ),
      })
    );

    const poolDraft = buildProductRevenuePoolDraft({
      product,
      productCreatorId: userId,
      stakeholders: normalizedStakeholders,
    });

    const poolKey = createProductRevenuePoolKey(product);

    const tokenizationDraft = {
      ...poolDraft,

      ownerAddress: selectedVerifiedWallet.address,

      mbrPaidMicroAlgos: null,
      mbrPaymentTxId: null,

      revenuePoolAppId: null,
      revenuePoolAddress: null,
      revenueTokenAssetId: null,

      preparedAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('products').updateOne(
      ownershipFilter,
      {
        $set: {
          productRevenuePool: tokenizationDraft,
          updatedAt: new Date(),
        },
      }
    );

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

        productRevenuePool: {
          poolKey,

          ownerAddress: tokenizationDraft.ownerAddress,

          displayName: tokenizationDraft.displayName,

          tokenizationStatus:
            tokenizationDraft.tokenizationStatus,

          tokenizationVersion:
            tokenizationDraft.tokenizationVersion,

          stakeholders: tokenizationDraft.stakeholders,

          mbr: tokenizationDraft.mbr,
        },
      })
    );
  } catch (error) {
    console.error(
      '[products/revenue-tokenization/prepare] failed:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Unable to prepare product revenue tokenization.',
      },
      { status: 400 }
    );
  }
}