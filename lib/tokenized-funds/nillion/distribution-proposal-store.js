// lib/tokenized-funds/nillion/distribution-proposal-store.js

import {
  NILLION_CONTRACTS,
  NILLION_EXPECTED_OWNER,
} from './config.js';

import {
  getNillionDistributionProposalSha256,
} from './distribution-proposal.js';

const OWNER = NILLION_EXPECTED_OWNER.toLowerCase();
const SCOPE = `ethereum:1:nillion:${OWNER}`;

const HASH = /^[0-9a-f]{64}$/;
const REVIEW_MAX_AGE_MS = 60_000;
const PENDING_LIFETIME_MS = 10 * 60_000;

function actor(value) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > 200
  ) {
    throw new Error('A server-authenticated actor ID is required.');
  }

  return value;
}

function proposalId(value) {
  if (typeof value !== 'string' || !HASH.test(value)) {
    throw new Error('Invalid proposal ID.');
  }

  return value;
}

function clockValue(now) {
  const value = now();

  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error('Invalid server clock.');
  }

  return new Date(value);
}

function validateReview(review, reviewCompletedAt, currentTime) {
  const completed = Date.parse(reviewCompletedAt);

  if (
    typeof reviewCompletedAt !== 'string' ||
    !Number.isFinite(completed) ||
    new Date(completed).toISOString() !== reviewCompletedAt ||
    completed > currentTime.getTime() ||
    currentTime.getTime() - completed > REVIEW_MAX_AGE_MS
  ) {
    throw new Error('A fresh server-side review is required.');
  }

  const proposal = review?.proposal;
  const verification = review?.verification;

  if (
    review?.status !== 'verified_for_human_review' ||
    review.approved !== false ||
    review.executionEnabled !== false ||
    proposal?.status !== 'review_required' ||
    proposal.chainId !== 1 ||
    proposal.owner !== OWNER ||
    proposal.tokenContract !== NILLION_CONTRACTS.nilToken.toLowerCase() ||
    proposal.approvalRequired !== true ||
    proposal.executionEnabled !== false ||
    !Array.isArray(proposal.batches) ||
    proposal.batches.length === 0 ||
    !/^\d+$/.test(proposal.accounting?.grossClaimedBaseUnits ?? '') ||
    BigInt(proposal.accounting.grossClaimedBaseUnits) === 0n ||
    verification?.chainId !== 1 ||
    verification.fundingBalanceChecked !== true ||
    verification.sourcesUnchangedDuringReview !== true
  ) {
    throw new Error('A nonempty verified distribution review is required.');
  }

  const required =
    proposal.accounting.requiredOutstandingReserveBaseUnits;

  if (
    !/^\d+$/.test(required ?? '') ||
    !/^\d+$/.test(verification.ownerNilBalanceBaseUnits ?? '') ||
    verification.requiredOutstandingReserveBaseUnits !== required ||
    BigInt(verification.ownerNilBalanceBaseUnits) < BigInt(required)
  ) {
    throw new Error('Review reserve verification does not match the proposal.');
  }

  const id = proposalId(proposal.proposalSha256);

  if (getNillionDistributionProposalSha256(proposal) !== id) {
    throw new Error('Proposal contents do not match their digest.');
  }

  if (Buffer.byteLength(JSON.stringify(review), 'utf8') > 1_000_000) {
    throw new Error('Review exceeds the supported storage size.');
  }

  return id;
}

export function createNillionProposalStore({
  collection,
  now = () => new Date(),
}) {
  let initialized = false;

  function requireInitialized() {
    if (!initialized) {
      throw new Error('Proposal store indexes must be initialized first.');
    }
  }

  async function initialize() {
    await collection.createIndex(
      { scope: 1 },
      {
        name: 'one_active_nillion_proposal_per_owner',
        unique: true,
        partialFilterExpression: { active: true },
      },
    );

    initialized = true;
  }

  async function expirePendingAt(currentTime) {
    return collection.findOneAndUpdate(
      {
        scope: SCOPE,
        active: true,
        status: 'pending',
        expiresAt: { $lte: currentTime },
      },
      {
        $set: {
          status: 'expired',
          active: false,
          updatedAt: currentTime,
        },
        $push: {
          audit: {
            event: 'expired',
            at: currentTime.toISOString(),
          },
        },
      },
      {
        returnDocument: 'after',
        includeResultMetadata: false,
      },
    );
  }

  async function prepare({
    review,
    reviewCompletedAt,
    actorId,
  }) {
    requireInitialized();

    const currentTime = clockValue(now);
    const preparedBy = actor(actorId);
    const storedReview = structuredClone(review);

    const id = validateReview(
      storedReview,
      reviewCompletedAt,
      currentTime,
    );

    await expirePendingAt(currentTime);

    const document = {
      _id: id,
      scope: SCOPE,
      schemaVersion: 1,
      status: 'pending',
      active: true,
      executionEnabled: false,
      preparedBy,
      preparedAt: currentTime,
      updatedAt: currentTime,
      expiresAt: new Date(
        currentTime.getTime() + PENDING_LIFETIME_MS,
      ),
      reviewCompletedAt,
      review: storedReview,
      audit: [
        {
          event: 'prepared',
          actorId: preparedBy,
          at: currentTime.toISOString(),
        },
      ],
    };

    try {
      await collection.insertOne(document);
      return structuredClone(document);
    } catch (error) {
      if (error?.code !== 11000) throw error;

      const existing = await collection.findOne({
        _id: id,
        scope: SCOPE,
      });

      if (
        existing?.active === true &&
        ['pending', 'approved'].includes(existing.status)
      ) {
        return existing;
      }

      if (existing) {
        throw new Error('This proposal already has a terminal decision.');
      }

      throw new Error('Another active distribution proposal exists.');
    }
  }

  async function approve({
    id,
    freshReview,
    reviewCompletedAt,
    actorId,
  }) {
    requireInitialized();

    const currentTime = clockValue(now);
    const approvedBy = actor(actorId);
    const expectedId = proposalId(id);
    const checkedReview = structuredClone(freshReview);

    if (
      validateReview(
        checkedReview,
        reviewCompletedAt,
        currentTime,
      ) !== expectedId
    ) {
      throw new Error('Fresh review does not match the stored proposal.');
    }

    const existing = await collection.findOne({
      _id: expectedId,
      scope: SCOPE,
    });

    if (existing?.status === 'approved' && existing.active === true) {
      return existing;
    }

    const approved = await collection.findOneAndUpdate(
      {
        _id: expectedId,
        scope: SCOPE,
        active: true,
        status: 'pending',
        expiresAt: { $gt: currentTime },
      },
      {
        $set: {
          status: 'approved',
          approvedBy,
          approvedAt: currentTime,
          updatedAt: currentTime,
          approvalReviewCompletedAt: reviewCompletedAt,
          approvalVerification: structuredClone(
            checkedReview.verification,
          ),
          executionEnabled: false,
        },
        $push: {
          audit: {
            event: 'approved',
            actorId: approvedBy,
            at: currentTime.toISOString(),
          },
        },
      },
      {
        returnDocument: 'after',
        includeResultMetadata: false,
      },
    );

    if (!approved) {
      throw new Error('Proposal is missing, expired, or no longer pending.');
    }

    return approved;
  }

  async function reject({ id, actorId }) {
    requireInitialized();

    const currentTime = clockValue(now);
    const rejectedBy = actor(actorId);

    const rejected = await collection.findOneAndUpdate(
      {
        _id: proposalId(id),
        scope: SCOPE,
        active: true,
        status: 'pending',
      },
      {
        $set: {
          status: 'rejected',
          active: false,
          rejectedBy,
          rejectedAt: currentTime,
          updatedAt: currentTime,
        },
        $push: {
          audit: {
            event: 'rejected',
            actorId: rejectedBy,
            at: currentTime.toISOString(),
          },
        },
      },
      {
        returnDocument: 'after',
        includeResultMetadata: false,
      },
    );

    if (!rejected) {
      throw new Error('Only a pending proposal can be rejected.');
    }

    return rejected;
  }

  async function expirePending() {
    requireInitialized();
    return expirePendingAt(clockValue(now));
  }

    async function get(id) {
    requireInitialized();

    return collection.findOne({
      _id: proposalId(id),
      scope: SCOPE,
    });
  }

  async function getActive() {
    requireInitialized();

    return collection.findOne({
      scope: SCOPE,
      active: true,
    });
  }

  return {
    initialize,
    prepare,
    approve,
    reject,
    expirePending,
    get,
    getActive,
  };
}