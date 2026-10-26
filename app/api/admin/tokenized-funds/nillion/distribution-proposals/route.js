// app/api/admin/tokenized-funds/nillion/distribution-proposals/route.js

import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { ObjectId } from 'mongodb';

import {
  createNillionReviewStateLoader,
  getNillionReviewAdmin,
} from '@/lib/tokenized-funds/nillion/distribution-review-service.js';

import {
  reviewNillionDistributionProposal,
} from '@/lib/tokenized-funds/nillion/distribution-review.js';

import {
  reviewNillionDistributionWithDiscovery,
} from '@/lib/tokenized-funds/nillion/distribution-discovery-review.js';

import {
  createNillionProposalStore,
} from '@/lib/tokenized-funds/nillion/distribution-proposal-store.js';

import {
  createNillionApprovalService,
} from '@/lib/tokenized-funds/nillion/distribution-approval-service.js';

import {
  createNillionApprovalHandlers,
} from '@/lib/tokenized-funds/nillion/distribution-approval-handler.js';

import {
  NILLION_RPC_URL,
} from '@/lib/tokenized-funds/nillion/config.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLECTION = 'nillion_distribution_proposals';

async function authenticate(request) {
  // The shared auth helper has a development fallback secret.
  // This financial endpoint must not accept that fallback.
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

      const identities = [{ _id: userId }, { id: userId }, { userId }];

      if (ObjectId.isValid(userId)) {
        identities.push({ _id: new ObjectId(userId) });
      }

      return db.collection('users').findOne(
        { $or: identities },
        { projection: { _id: 1, role: 1, isAdmin: 1 } },
      );
    },
  });
}

let storePromise;

// The first call creates the collection and its unique index.
// Only reachable after the explicit enable flag is set.
function getStore() {
  if (!storePromise) {
    storePromise = (async () => {
      const { connectToDatabase } = await import('@/lib/mongodb.js');
      const { db } = await connectToDatabase();

      const store = createNillionProposalStore({
        collection: db.collection(COLLECTION, {
          writeConcern: { w: 'majority' },
        }),
      });

      await store.initialize();
      return store;
    })().catch((error) => {
      storePromise = undefined;
      throw error;
    });
  }

  return storePromise;
}

const service = createNillionApprovalService({
  getStore,

  createClient: () =>
    createPublicClient({
      chain: mainnet,
      transport: http(NILLION_RPC_URL, {
        timeout: 30_000,
        retryCount: 2,
      }),
    }),

  getConfirmedAllocationSha256: () =>
    process.env.NILLION_FIXED_ALLOCATION_SHA256?.trim(),

  loadState: createNillionReviewStateLoader(),
  reviewWithDiscovery: reviewNillionDistributionWithDiscovery,
  review: reviewNillionDistributionProposal,
});

export const { GET, POST } = createNillionApprovalHandlers({
  authenticate,
  isEnabled: () => process.env.NILLION_PROPOSAL_STORE_ENABLED === 'true',
  service,
});