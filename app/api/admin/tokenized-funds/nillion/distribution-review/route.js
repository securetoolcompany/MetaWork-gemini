// app/api/admin/tokenized-funds/nillion/distribution-review/route.js

import {
  createPublicClient,
  http,
} from 'viem';

import { mainnet } from 'viem/chains';
import { ObjectId } from 'mongodb';

import {
  createNillionReviewStateLoader,
  getNillionReviewAdmin,
  createNillionReviewHandler,
} from '@/lib/tokenized-funds/nillion/distribution-review-service.js';

import {
  reviewNillionDistributionWithDiscovery,
} from '@/lib/tokenized-funds/nillion/distribution-discovery-review.js';

import {
  NILLION_RPC_URL,
} from '@/lib/tokenized-funds/nillion/config.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authenticate(request) {
  // The shared auth helper has a development fallback secret.
  // This financial-review endpoint must not accept that fallback.
  const secret = process.env.NEXTAUTH_SECRET;

  if (
    typeof secret !== 'string' ||
    secret.trim().length === 0 ||
    secret.trim() === 'metawork-secret-key'
  ) {
    throw new Error('Explicit authentication configuration is required.');
  }

  return getNillionReviewAdmin(request, {
    verifyToken: async (token) => {
      const { verifyToken } = await import('@/lib/auth.js');
      return verifyToken(token);
    },

    findUser: async (userId) => {
      const { connectToDatabase } = await import('@/lib/mongodb.js');
      const { db } = await connectToDatabase();

      const identities = [
        { _id: userId },
        { id: userId },
        { userId },
      ];

      if (ObjectId.isValid(userId)) {
        identities.push({ _id: new ObjectId(userId) });
      }

      return db.collection('users').findOne(
        { $or: identities },
        {
          projection: {
            _id: 1,
            role: 1,
            isAdmin: 1,
          },
        },
      );
    },
  });
}

export const GET = createNillionReviewHandler({
  authenticate,

  runReview: async () => {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(NILLION_RPC_URL, {
        timeout: 30_000,
        retryCount: 2,
      }),
    });

    return reviewNillionDistributionWithDiscovery({
      loadState: createNillionReviewStateLoader(),
      client,
      confirmedAllocationSha256:
        process.env.NILLION_FIXED_ALLOCATION_SHA256?.trim(),
    });
  },
});