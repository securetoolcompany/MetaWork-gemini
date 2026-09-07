import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import {
  buildProductRevenuePoolDraft,
  createProductRevenuePoolKey,
} from '@/lib/product-revenue-tokenization';
import { CREDIT_COSTS } from '@/lib/credit-costs';
import {
  createTokenizationWithCredits,
  InsufficientCreditsError,
  TokenizationConflictError,
} from '@/lib/tokenization-credits';

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

function buildProductResponse(
  product,
  productRevenuePool,
  {
    resumed = false,
    creditCharged = 0,
    creditsRemaining = null,
  } = {}
) {
  return serialize({
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
      poolKey: productRevenuePool.poolKey,
      ownerAddress: productRevenuePool.ownerAddress,
      displayName: productRevenuePool.displayName,
      tokenizationStatus: productRevenuePool.tokenizationStatus,
      tokenizationVersion: productRevenuePool.tokenizationVersion,
      stakeholders: productRevenuePool.stakeholders,
      mbr: productRevenuePool.mbr,
    },

    credits: {
      charged: creditCharged,
      remaining: creditsRemaining,
    },

    ...(resumed ? { resumed: true } : {}),
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

    const { client, db } = await connectToDatabase();

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
          credits: 1,
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

    if (
      currentPoolStatus === 'pending_funding' &&
      product?.productRevenuePool?.creditStatus === 'consumed'
    ) {
      return NextResponse.json(
        buildProductResponse(
          product,
          product.productRevenuePool,
          {
            resumed: true,
            creditCharged: 0,
            creditsRemaining: Number(user.credits || 0),
          }
        )
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

    const creditCost = CREDIT_COSTS.MINT_IP;
    const poolKey = createProductRevenuePoolKey(product);

    const tokenizationDraft = {
      ...poolDraft,

      poolKey,
      ownerAddress: selectedVerifiedWallet.address,

      creditCost,
      creditStatus: 'consumed',

      mbrPaidMicroAlgos: null,
      mbrPaymentTxId: null,

      revenuePoolAppId: null,
      revenuePoolAddress: null,
      revenueTokenAssetId: null,

      preparedAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const creditTransaction = await createTokenizationWithCredits({
        client,
        db,
        userFilter: userIdentityFilter,
        creditCost,
        operation: 'product_revenue_tokenization',
        persist: async ({
          session,
          creditCost: chargedCreditCost,
          user: updatedUser,
        }) => {
          const productUpdate = await db.collection('products').updateOne(
            {
              $and: [
                ownershipFilter,
                {
                  $or: [
                    {
                      'productRevenuePool.tokenizationStatus': {
                        $exists: false,
                      },
                    },
                    {
                      'productRevenuePool.tokenizationStatus': {
                        $nin: [
                          'active',
                          'creating',
                          'pending_funding',
                        ],
                      },
                    },
                  ],
                },
              ],
            },
            {
              $set: {
                productRevenuePool: {
                  ...tokenizationDraft,
                  creditCost: chargedCreditCost,
                  creditStatus: 'consumed',
                },
                updatedAt: new Date(),
              },
            },
            { session }
          );

          if (productUpdate.matchedCount !== 1) {
            throw new TokenizationConflictError(
              'Product tokenization was already prepared or changed by another request.'
            );
          }
          return {
            remainingCredits: Number(updatedUser.credits || 0),
          };
        },
      });
      const remainingCredits = Number(
        creditTransaction?.remainingCredits
      );

      return NextResponse.json(
        buildProductResponse(product, tokenizationDraft, {
          creditCharged: creditCost,
          creditsRemaining: Number.isFinite(remainingCredits)
            ? remainingCredits
            : null,
        })
      );
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient credits to tokenize this product.',
            code: 'INSUFFICIENT_CREDITS',
          },
          { status: 402 }
        );
      }

      if (error instanceof TokenizationConflictError) {
        const latestProduct = await db
          .collection('products')
          .findOne(ownershipFilter);

        if (
          latestProduct?.productRevenuePool?.tokenizationStatus ===
            'pending_funding' &&
          latestProduct?.productRevenuePool?.creditStatus === 'consumed'
        ) {
          const latestUser = await db.collection('users').findOne(
            userIdentityFilter,
            {
              projection: {
                credits: 1,
              },
            }
          );

          return NextResponse.json(
            buildProductResponse(
              latestProduct,
              latestProduct.productRevenuePool,
              {
                resumed: true,
                creditCharged: 0,
                creditsRemaining: Number(latestUser?.credits || 0),
              }
            )
          );
        }

        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: 'TOKENIZATION_CONFLICT',
          },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json(
      buildProductResponse(product, tokenizationDraft, {
        creditCharged: creditCost,
        creditsRemaining: Number(
          creditTransaction?.remainingCredits ?? 0
        ),
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
      { status: 500 }
    );
  }
}