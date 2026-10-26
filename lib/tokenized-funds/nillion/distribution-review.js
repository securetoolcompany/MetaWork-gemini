// lib/tokenized-funds/nillion/distribution-review.js

import { decodeEventLog, parseAbi, parseUnits } from 'viem';

import {
  NILLION_CONTRACTS,
  NILLION_EXPECTED_OWNER,
  NILLION_NODES,
} from './config.js';

import {
  buildNillionDistributionProposal,
} from './distribution-proposal.js';

import {
  verifyNillionPaymentTransfer,
} from './payment-receipt.js';

const EXPECTED_IMPLEMENTATION =
  '0xd9d71b6c4b7c2c03eb7f1dbb3d509f54483e5f7c';

const IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

const HASH = /^0x[0-9a-fA-F]{64}$/;

const stakingAbi = parseAbi([
  'function ownerOf(uint256 nodeId) view returns (address)',
  'function stakeOf(uint256 nodeId) view returns (uint256)',
]);

const tokenAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
]);

const claimAbi = parseAbi([
  'event Claimed(uint256 indexed nodeId, address indexed owner, uint256 amount)',
]);

function sameAddress(left, right) {
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    left.toLowerCase() === right.toLowerCase()
  );
}

function integer(value, field) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`Invalid ${field}.`);
  }

  return BigInt(value);
}

function checkBlock(block, field) {
  if (
    !block ||
    typeof block.number !== 'bigint' ||
    block.number < 0n ||
    typeof block.hash !== 'string' ||
    !HASH.test(block.hash)
  ) {
    throw new Error(`Invalid ${field} block.`);
  }

  return block;
}

function proposalFromState(state) {
  return buildNillionDistributionProposal({
    ledger: state.ledger,
    allocationConfig: state.allocationConfig,
    drafts: state.drafts ?? [],
    reviewedAt: state.reviewedAt,
    // Never accept an operating owner supplied by a browser.
    expectedOwner: NILLION_EXPECTED_OWNER,
  });
}

export async function reviewNillionDistributionProposal({
  loadState,
  client,
}) {
  if (typeof loadState !== 'function' || !client) {
    throw new Error('A trusted state loader and RPC client are required.');
  }

  // The caller must load these inputs from trusted server-side storage.
  const state = structuredClone(await loadState());
  const proposal = proposalFromState(state);

  if ((await client.getChainId()) !== 1) {
    throw new Error('RPC is not Ethereum mainnet.');
  }

  const [latestInput, finalizedInput] = await Promise.all([
    client.getBlock({ blockTag: 'latest' }),
    client.getBlock({ blockTag: 'finalized' }),
  ]);

  const latest = checkBlock(latestInput, 'review snapshot');
  const finalized = checkBlock(finalizedInput, 'finalized');

  if (finalized.number > latest.number) {
    throw new Error('Finalized block is ahead of the review snapshot.');
  }

  const storage = await client.getStorageAt({
    address: NILLION_CONTRACTS.emissions,
    slot: IMPLEMENTATION_SLOT,
    blockNumber: latest.number,
  });

  if (
    typeof storage !== 'string' ||
    !HASH.test(storage) ||
    `0x${storage.slice(-40)}`.toLowerCase() !== EXPECTED_IMPLEMENTATION
  ) {
    throw new Error('Emissions implementation changed or is unavailable.');
  }

  const receiptCache = new Map();
  const blockCache = new Map();

  async function canonicalBlock(number) {
    const key = number.toString();

    if (!blockCache.has(key)) {
      const block = checkBlock(
        await client.getBlock({ blockNumber: number }),
        'receipt',
      );

      if (block.number !== number) {
        throw new Error('RPC returned a different receipt block.');
      }

      blockCache.set(key, block);
    }

    return blockCache.get(key);
  }

  async function checkedReceipt(hash) {
    if (typeof hash !== 'string' || !HASH.test(hash)) {
      throw new Error('Invalid transaction hash.');
    }

    const key = hash.toLowerCase();

    if (!receiptCache.has(key)) {
      const receipt = await client.getTransactionReceipt({ hash });

      if (
        !receipt ||
        receipt.status !== 'success' ||
        typeof receipt.transactionHash !== 'string' ||
        receipt.transactionHash.toLowerCase() !== key ||
        typeof receipt.blockNumber !== 'bigint' ||
        receipt.blockNumber < 0n ||
        receipt.blockNumber > finalized.number ||
        typeof receipt.blockHash !== 'string' ||
        !HASH.test(receipt.blockHash) ||
        !Array.isArray(receipt.logs)
      ) {
        throw new Error('Receipt is failed, mismatched, or not finalized.');
      }

      const block = await canonicalBlock(receipt.blockNumber);

      if (block.hash.toLowerCase() !== receipt.blockHash.toLowerCase()) {
        throw new Error('Receipt is not in the canonical block.');
      }

      receiptCache.set(key, receipt);
    }

    return receiptCache.get(key);
  }

  const checkedNodes = new Set();
  let verifiedClaimCount = 0;

  for (const batch of proposal.batches) {
    const node = NILLION_NODES.find(
      (item) => item.id === batch.nodeId,
    );

    if (!node) {
      throw new Error('Proposal references an unconfigured node.');
    }

    if (!checkedNodes.has(node.id)) {
      const stakers = state.allocationConfig.nodes?.[node.id]?.stakers;

      if (!Array.isArray(stakers) || stakers.length === 0) {
        throw new Error('Current node allocations are missing.');
      }

      let recordedStake = 0n;

      for (const position of stakers) {
        if (
          typeof position.amountNil !== 'string' ||
          !/^\d+(?:\.\d{1,6})?$/.test(position.amountNil)
        ) {
          throw new Error('Invalid current allocation amount.');
        }

        const amount = parseUnits(position.amountNil, 6);

        if (amount <= 0n) {
          throw new Error('Current allocation stake must be positive.');
        }

        recordedStake += amount;
      }

      const [owner, stake] = await Promise.all([
        client.readContract({
          address: NILLION_CONTRACTS.staking,
          abi: stakingAbi,
          functionName: 'ownerOf',
          args: [BigInt(node.id)],
          blockNumber: latest.number,
        }),
        client.readContract({
          address: NILLION_CONTRACTS.staking,
          abi: stakingAbi,
          functionName: 'stakeOf',
          args: [BigInt(node.id)],
          blockNumber: latest.number,
        }),
      ]);

      if (!sameAddress(owner, NILLION_EXPECTED_OWNER)) {
        throw new Error('Current node owner does not match configuration.');
      }

      if (typeof stake !== 'bigint' || stake !== recordedStake) {
        throw new Error('Current allocations do not match on-chain stake.');
      }

      checkedNodes.add(node.id);
    }

    for (const claim of batch.claims) {
      const blockNumber = integer(claim.blockNumber, 'claim block');

      if (
        claim.nodeId !== node.id ||
        blockNumber < BigInt(node.rewardsStartBlock) ||
        !sameAddress(claim.owner, NILLION_EXPECTED_OWNER)
      ) {
        throw new Error('Claim node, owner, or launch boundary mismatch.');
      }

      const receipt = await checkedReceipt(claim.transactionHash);

      if (
        receipt.blockNumber !== blockNumber ||
        receipt.blockHash.toLowerCase() !== claim.blockHash.toLowerCase()
      ) {
        throw new Error('Claim receipt does not match the recorded reference.');
      }

      const logIndex = integer(claim.logIndex, 'claim log index');

      const matches = receipt.logs.filter(
        (log) => String(log.logIndex) === logIndex.toString(),
      );

      if (matches.length !== 1) {
        throw new Error('Expected exactly one referenced claim log.');
      }

      const log = matches[0];

      if (
        log.removed ||
        !sameAddress(log.address, NILLION_CONTRACTS.emissions) ||
        typeof log.transactionHash !== 'string' ||
        log.transactionHash.toLowerCase() !==
          receipt.transactionHash.toLowerCase() ||
        log.blockNumber !== receipt.blockNumber ||
        typeof log.blockHash !== 'string' ||
        log.blockHash.toLowerCase() !== receipt.blockHash.toLowerCase()
      ) {
        throw new Error('Claim log metadata or emitting contract mismatch.');
      }

      const decoded = decodeEventLog({
        abi: claimAbi,
        eventName: 'Claimed',
        topics: log.topics,
        data: log.data,
        strict: true,
      });

      if (
        decoded.args.nodeId.toString() !== node.id ||
        !sameAddress(decoded.args.owner, NILLION_EXPECTED_OWNER) ||
        decoded.args.amount.toString() !== claim.amountBaseUnits ||
        claim.eventId !==
          `1:${receipt.transactionHash.toLowerCase()}:${logIndex}`
      ) {
        throw new Error('Claim event values do not match the proposal.');
      }

      verifiedClaimCount += 1;
    }
  }

  let verifiedPaymentCount = 0;

  for (const settlement of state.ledger.settlements ?? []) {
    const stored = settlement.verification;
    const receipt = await checkedReceipt(stored.transactionHash);

    if (
      receipt.blockNumber !==
        integer(stored.receipt.blockNumber, 'stored payment block') ||
      typeof stored.receipt.blockHash !== 'string' ||
      receipt.blockHash.toLowerCase() !==
        stored.receipt.blockHash.toLowerCase()
    ) {
      throw new Error(
        'Fresh payment receipt differs from the recorded settlement reference.',
      );
    }

    verifyNillionPaymentTransfer({
      chainId: 1,
      transactionHash: stored.transactionHash,
      logIndex: stored.logIndex,
      expectedSender: stored.expectedSender,
      expectedRecipient: stored.expectedRecipient,
      expectedAmountBaseUnits: stored.expectedAmountBaseUnits,
      receipt,
      canonicalBlock: await canonicalBlock(receipt.blockNumber),
      finalizedBlock: finalized,
    });

    verifiedPaymentCount += 1;
  }

  const balance = await client.readContract({
    address: NILLION_CONTRACTS.nilToken,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [NILLION_EXPECTED_OWNER],
    blockNumber: latest.number,
  });

  const required = BigInt(
    proposal.accounting.requiredOutstandingReserveBaseUnits,
  );

  if (typeof balance !== 'bigint' || balance < required) {
    throw new Error('Owner NIL balance does not cover outstanding reserves.');
  }

  // Rebuild from storage again rather than trusting the original snapshot.
  const currentProposal = proposalFromState(
    structuredClone(await loadState()),
  );

  if (currentProposal.proposalSha256 !== proposal.proposalSha256) {
    throw new Error('Proposal source state changed during review.');
  }

  // Recheck both chain anchors after all verification work.
  for (const anchor of [latest, finalized]) {
    const current = checkBlock(
      await client.getBlock({ blockNumber: anchor.number }),
      'review anchor',
    );

    if (
      current.number !== anchor.number ||
      current.hash.toLowerCase() !== anchor.hash.toLowerCase()
    ) {
      throw new Error('Review chain anchor changed.');
    }
  }

  return {
    schemaVersion: 1,
    status: proposal.status === 'nothing_to_review'
      ? 'nothing_to_review'
      : 'verified_for_human_review',
    approved: false,
    executionEnabled: false,
    proposal,
    verification: {
      chainId: 1,
      snapshotBlockNumber: latest.number.toString(),
      snapshotBlockHash: latest.hash.toLowerCase(),
      finalizedBlockNumber: finalized.number.toString(),
      finalizedBlockHash: finalized.hash.toLowerCase(),
      implementation: EXPECTED_IMPLEMENTATION,
      verifiedClaimCount,
      verifiedPaymentCount,
      ownerNilBalanceBaseUnits: balance.toString(),
      requiredOutstandingReserveBaseUnits: required.toString(),
      sourcesUnchangedDuringReview: true,
      fundingBalanceChecked: true,
      ethGasBalanceChecked: false,
    },
    notices: [
      'Review only. No approval, ledger writes, signing, or broadcasting.',
      'Claimed events are verified; separate incoming NIL transfer logs are not reconciled here.',
      'This does not scan for omitted or newly finalized claim events.',
      'Balances and ownership are checked at the identified review snapshot.',
      'Later approval and execution must revalidate source state and chain conditions.',
      'This unsigned review result is not an authorization credential.',
    ],
  };
}