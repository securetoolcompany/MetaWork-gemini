// lib/tokenized-funds/nillion/distribution-approval-service.js

import { parseUnits } from 'viem';

import { NILLION_EXPECTED_OWNER } from './config.js';
import { buildNillionPayoutDraft } from './payouts.js';

export class NillionApprovalError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = 'NillionApprovalError';
    this.status = status;
  }
}

// Static domain messages thrown by the proposal store.
const DOMAIN_STORE_MESSAGE =
  /missing, expired, or no longer pending|Only a pending proposal|Another active distribution proposal|terminal decision|fresh server-side review|nonempty verified distribution review|does not match the stored proposal|reserve verification|digest/;

async function guarded(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof NillionApprovalError) throw error;

    // Plain Errors only: database/driver errors keep their own class
    // and fall through to the generic failure response.
    if (
      error instanceof Error &&
      error.constructor === Error &&
      DOMAIN_STORE_MESSAGE.test(error.message)
    ) {
      throw new NillionApprovalError(error.message, 409);
    }

    throw error;
  }
}

function recordedStakeBaseUnits(allocationConfig, nodeId) {
  const stakers = allocationConfig?.nodes?.[nodeId]?.stakers;

  if (!Array.isArray(stakers) || stakers.length === 0) {
    throw new NillionApprovalError(
      'Current allocations are missing for a stored batch.',
      409,
    );
  }

  let total = 0n;

  for (const staker of stakers) {
    if (
      typeof staker?.amountNil !== 'string' ||
      !/^\d+(?:\.\d{1,6})?$/.test(staker.amountNil)
    ) {
      throw new NillionApprovalError(
        'Current allocation amount is invalid.',
        409,
      );
    }

    total += parseUnits(staker.amountNil, 6);
  }

  return total.toString();
}

// Rebuilds the exact drafts that produced a stored proposal, using only
// the frozen claim references. No chain scan happens here.
export function rebuildNillionDraftsFromProposal(proposal, state) {
  if (
    !Array.isArray(proposal?.newBatchIds) ||
    proposal.newBatchIds.length === 0 ||
    !Array.isArray(proposal.batches)
  ) {
    throw new NillionApprovalError(
      'Stored proposal does not contain reviewable drafts.',
      409,
    );
  }

  const batchesById = new Map(
    proposal.batches.map((batch) => [batch.batchId, batch]),
  );

  const reviewedAtValues = new Set();

  const drafts = proposal.newBatchIds.map((batchId) => {
    const batch = batchesById.get(batchId);

    if (!batch || !Array.isArray(batch.claims)) {
      throw new NillionApprovalError(
        'Stored proposal is missing a reviewed batch.',
        409,
      );
    }

    reviewedAtValues.add(batch.reviewedAt);

    return buildNillionPayoutDraft({
      batchId,
      nodeId: batch.nodeId,
      allocationConfig: state.allocationConfig,
      onChainStakeBaseUnits: recordedStakeBaseUnits(
        state.allocationConfig,
        batch.nodeId,
      ),
      expectedOwner: NILLION_EXPECTED_OWNER,
      claims: batch.claims,
      ledger: state.ledger,
    });
  });

  if (reviewedAtValues.size !== 1) {
    throw new NillionApprovalError(
      'Stored proposal batches have inconsistent review times.',
      409,
    );
  }

  return { drafts, reviewedAt: [...reviewedAtValues][0] };
}

export function createNillionApprovalService({
  getStore,
  createClient,
  getConfirmedAllocationSha256,
  loadState,
  reviewWithDiscovery,
  review,
  now = () => new Date(),
}) {
  async function getActive() {
    const store = await getStore();
    await store.expirePending();
    return store.getActive();
  }

  async function prepare({ actorId }) {
    const store = await getStore();
    await store.expirePending();

    // Avoid an expensive scan when the active slot is already taken.
    const active = await store.getActive();

    if (active?.status === 'approved') {
      throw new NillionApprovalError(
        'An approved distribution proposal already occupies the active slot.',
        409,
      );
    }

    if (active) {
      return {
        status: 'existing_pending',
        stored: false,
        proposal: active,
      };
    }

    const result = await reviewWithDiscovery({
      loadState,
      client: createClient(),
      confirmedAllocationSha256: getConfirmedAllocationSha256(),
    });

    // Timestamp taken when the review finishes, not when it began.
    const reviewCompletedAt = now().toISOString();

    if (result.status === 'nothing_to_review') {
      return {
        status: 'nothing_to_review',
        stored: false,
        claimDiscovery: result.claimDiscovery,
      };
    }

    if (result.status !== 'verified_for_human_review') {
      throw new NillionApprovalError(
        'The review did not produce a verifiable proposal.',
        409,
      );
    }

    const proposal = await guarded(() =>
      store.prepare({
        review: result,
        reviewCompletedAt,
        actorId,
      }),
    );

    return { status: 'pending_approval', stored: true, proposal };
  }

  async function approve({ id, actorId }) {
    const store = await getStore();
    await store.expirePending();

    const stored = await store.get(id);

    if (!stored) {
      throw new NillionApprovalError('Proposal was not found.', 404);
    }

    // A repeated approval changes nothing and performs no review.
    if (stored.status === 'approved' && stored.active === true) {
      return { status: 'approved', proposal: stored };
    }

    if (stored.status !== 'pending' || stored.active !== true) {
      throw new NillionApprovalError(
        'Only a pending proposal can be approved.',
        409,
      );
    }

    const storedProposal = stored.review?.proposal;

    // Each call rebuilds the frozen drafts against the current files.
    // A changed ledger or allocation produces a different digest.
    async function loadFrozenState() {
      const state = structuredClone(await loadState());
      const { drafts, reviewedAt } = rebuildNillionDraftsFromProposal(
        storedProposal,
        state,
      );

      return {
        ledger: state.ledger,
        allocationConfig: state.allocationConfig,
        drafts,
        reviewedAt,
      };
    }

    const freshReview = await review({
      loadState: loadFrozenState,
      client: createClient(),
    });

    const reviewCompletedAt = now().toISOString();

    if (freshReview?.proposal?.proposalSha256 !== stored._id) {
      throw new NillionApprovalError(
        'The stored proposal no longer matches freshly verified inputs.',
        409,
      );
    }

    const approved = await guarded(() =>
      store.approve({
        id: stored._id,
        freshReview,
        reviewCompletedAt,
        actorId,
      }),
    );

    return { status: 'approved', proposal: approved };
  }

  async function reject({ id, actorId }) {
    const store = await getStore();
    await store.expirePending();

    const rejected = await guarded(() => store.reject({ id, actorId }));

    return { status: 'rejected', proposal: rejected };
  }

  return { getActive, prepare, approve, reject };
}