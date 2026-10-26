// lib/tokenized-funds/nillion/distribution-discovery-review.js

import {
  NILLION_EXPECTED_OWNER,
} from './config.js';

import {
  buildNillionDistributionProposal,
} from './distribution-proposal.js';

import {
  discoverNillionClaimDrafts,
} from './claim-discovery.js';

import {
  reviewNillionDistributionProposal,
} from './distribution-review.js';

const HASH = /^0x[0-9a-fA-F]{64}$/;

function baseProposal(state) {
  return buildNillionDistributionProposal({
    ledger: state.ledger,
    allocationConfig: state.allocationConfig,
    expectedOwner: NILLION_EXPECTED_OWNER,
    drafts: [],
  });
}

function sameSources(left, right) {
  return (
    left?.ledgerSha256 === right?.ledgerSha256 &&
    left?.allocationSha256 === right?.allocationSha256 &&
    left?.allocationVersion === right?.allocationVersion
  );
}

export function createNillionDiscoveryReviewer({
  discover = discoverNillionClaimDrafts,
  review = reviewNillionDistributionProposal,
} = {}) {
  return async function reviewWithDiscovery({
    loadState,
    client,
    confirmedAllocationSha256,
  }) {
    if (
      typeof confirmedAllocationSha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(confirmedAllocationSha256)
    ) {
      throw new Error(
        'An explicit server-side fixed-allocation confirmation is required.',
      );
    }

    const initialState = structuredClone(await loadState());
    const initial = baseProposal(initialState);

    if (
      confirmedAllocationSha256 !== initial.sources.allocationSha256
    ) {
      throw new Error(
        'Fixed-allocation confirmation does not match current allocations.',
      );
    }

    const discovery = await discover({
      client,
      ledger: initialState.ledger,
      allocationConfig: initialState.allocationConfig,
      confirmedAllocationSha256,
    });

    if (
      !sameSources(discovery.sources, initial.sources) ||
      discovery.snapshot?.finality !== 'finalized' ||
      !/^\d+$/.test(discovery.snapshot?.blockNumber ?? '') ||
      typeof discovery.snapshot?.blockHash !== 'string' ||
      !HASH.test(discovery.snapshot.blockHash) ||
      !Array.isArray(discovery.drafts)
    ) {
      throw new Error('Discovery does not match the source snapshot.');
    }

    // Freeze these drafts for this review. Do not rescan on each
    // state reload and silently produce a different proposal.
    const drafts = structuredClone(discovery.drafts);
    const reviewedAt = discovery.reviewedAt;

    async function loadUnchangedState() {
      const currentState = structuredClone(await loadState());
      const current = baseProposal(currentState);

      if (!sameSources(current.sources, initial.sources)) {
        throw new Error('Source state changed after claim discovery.');
      }

      return {
        ledger: currentState.ledger,
        allocationConfig: currentState.allocationConfig,
        drafts: structuredClone(drafts),
        reviewedAt,
      };
    }

    const result = await review({
      loadState: loadUnchangedState,
      client,
    });

    if (
      !sameSources(result.proposal?.sources, initial.sources) ||
      result.approved !== false ||
      result.executionEnabled !== false
    ) {
      throw new Error('Review result does not match discovery inputs.');
    }

    const reviewFinalizedBlock =
      result.verification?.finalizedBlockNumber;

    if (
      typeof reviewFinalizedBlock !== 'string' ||
      !/^\d+$/.test(reviewFinalizedBlock) ||
      BigInt(reviewFinalizedBlock) <
        BigInt(discovery.snapshot.blockNumber)
    ) {
      throw new Error(
        'Review finality does not cover the discovery snapshot.',
      );
    }

    const anchor = await client.getBlock({
      blockNumber: BigInt(discovery.snapshot.blockNumber),
    });

    if (
      anchor?.number !== BigInt(discovery.snapshot.blockNumber) ||
      typeof anchor.hash !== 'string' ||
      anchor.hash.toLowerCase() !==
        discovery.snapshot.blockHash.toLowerCase()
    ) {
      throw new Error('Discovery anchor changed during review.');
    }

    await loadUnchangedState();

    return {
      ...result,

      claimDiscovery: {
        mode: 'finalized_claim_discovery',
        snapshot: structuredClone(discovery.snapshot),
        sources: structuredClone(discovery.sources),
        fixedAllocationConfirmation: structuredClone(
          discovery.fixedAllocationConfirmation,
        ),
        nodeResults: structuredClone(discovery.nodeResults),
        newDraftCount: drafts.length,
        ledgerChanged: false,
        notices: structuredClone(discovery.notices),
      },
    };
  };
}

export const reviewNillionDistributionWithDiscovery =
  createNillionDiscoveryReviewer();