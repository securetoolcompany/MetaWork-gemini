// lib/tokenized-funds/nillion/claim-discovery.js

import { parseAbi, parseAbiItem, parseUnits } from 'viem';

import {
  NILLION_CONTRACTS,
  NILLION_EXPECTED_OWNER,
  NILLION_NODES,
} from './config.js';

import {
  buildNillionPayoutDraft,
} from './payouts.js';

import {
  buildNillionDistributionProposal,
} from './distribution-proposal.js';

const HASH = /^0x[0-9a-fA-F]{64}$/;

const stakingAbi = parseAbi([
  'function ownerOf(uint256 nodeId) view returns (address)',
  'function stakeOf(uint256 nodeId) view returns (uint256)',
]);

const claimedEvent = parseAbiItem(
  'event Claimed(uint256 indexed nodeId, address indexed owner, uint256 amount)',
);

function sameAddress(left, right) {
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    left.toLowerCase() === right.toLowerCase()
  );
}

function sourceProposal(ledger, allocationConfig) {
  // Reuses ledger validation, fee-policy validation, and canonical hashes.
  return buildNillionDistributionProposal({
    ledger,
    allocationConfig,
    expectedOwner: NILLION_EXPECTED_OWNER,
    drafts: [],
  });
}

export async function readNillionClaimLogs({
  client,
  emissions,
  nodeId,
  fromBlock,
  toBlock,
}) {
  if (
    typeof fromBlock !== 'bigint' ||
    typeof toBlock !== 'bigint' ||
    fromBlock < 0n ||
    toBlock < fromBlock
  ) {
    throw new Error('Invalid claim scan range.');
  }

  const logs = [];
  const chunkSize = 2_000n;

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end =
      start + chunkSize - 1n > toBlock
        ? toBlock
        : start + chunkSize - 1n;

    const chunk = await client.getLogs({
      address: emissions,
      event: claimedEvent,
      args: { nodeId: BigInt(nodeId) },
      fromBlock: start,
      toBlock: end,
      strict: true,
    });

    if (!Array.isArray(chunk)) {
      throw new Error('RPC did not return a claim-log array.');
    }

    for (const log of chunk) {
      if (
        typeof log.blockNumber !== 'bigint' ||
        log.blockNumber < start ||
        log.blockNumber > end
      ) {
        throw new Error('RPC returned a claim outside the requested range.');
      }
    }

    logs.push(...chunk);
  }

  return logs;
}

export async function discoverNillionClaimDrafts({
  client,
  ledger,
  allocationConfig,
  confirmedAllocationSha256,
}) {
  const initial = sourceProposal(ledger, allocationConfig);

  // The confirmation must come from trusted operator configuration.
  // It must not be computed automatically from the current input
  // merely to bypass this check.
  if (
    typeof confirmedAllocationSha256 !== 'string' ||
    confirmedAllocationSha256 !== initial.sources.allocationSha256
  ) {
    throw new Error(
      'Fixed-allocation history must be confirmed for this exact allocation configuration.',
    );
  }

  const state = structuredClone({ ledger, allocationConfig });

  if ((await client.getChainId()) !== 1) {
    throw new Error('RPC is not Ethereum mainnet.');
  }

  const snapshot = await client.getBlock({ blockTag: 'finalized' });

  if (
    typeof snapshot?.number !== 'bigint' ||
    snapshot.number < 0n ||
    typeof snapshot.hash !== 'string' ||
    !HASH.test(snapshot.hash) ||
    typeof snapshot.timestamp !== 'bigint' ||
    snapshot.timestamp < 0n ||
    snapshot.timestamp > 8_640_000_000_000n
  ) {
    throw new Error('Invalid finalized discovery snapshot.');
  }

  const reviewedAt = new Date(
    Number(snapshot.timestamp) * 1000,
  ).toISOString();

  const recordedClaims = new Set(
    state.ledger.entries.flatMap(
      (entry) => entry.claims.map((claim) => claim.eventId),
    ),
  );

  const discoveredEvents = new Set();
  const drafts = [];
  const nodeResults = [];

  for (const node of NILLION_NODES) {
    const fromBlock = BigInt(node.rewardsStartBlock);

    if (fromBlock > snapshot.number) {
      throw new Error('Node rewards start after the discovery snapshot.');
    }

    const stakers = state.allocationConfig.nodes?.[node.id]?.stakers;

    if (!Array.isArray(stakers) || stakers.length === 0) {
      throw new Error(`Node ${node.id}: missing current allocations.`);
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

    const [owner, stake, logs] = await Promise.all([
      client.readContract({
        address: NILLION_CONTRACTS.staking,
        abi: stakingAbi,
        functionName: 'ownerOf',
        args: [BigInt(node.id)],
        blockNumber: snapshot.number,
      }),

      client.readContract({
        address: NILLION_CONTRACTS.staking,
        abi: stakingAbi,
        functionName: 'stakeOf',
        args: [BigInt(node.id)],
        blockNumber: snapshot.number,
      }),

      readNillionClaimLogs({
        client,
        emissions: NILLION_CONTRACTS.emissions,
        nodeId: node.id,
        fromBlock,
        toBlock: snapshot.number,
      }),
    ]);

    // These checks also run when the node has no claims.
    if (!sameAddress(owner, NILLION_EXPECTED_OWNER)) {
      throw new Error(`Node ${node.id}: unexpected current owner.`);
    }

    if (typeof stake !== 'bigint' || stake !== recordedStake) {
      throw new Error(`Node ${node.id}: current stake mismatch.`);
    }

    const claims = [];

    for (const log of logs) {
      if (
        log.removed ||
        !sameAddress(log.address, NILLION_CONTRACTS.emissions) ||
        typeof log.transactionHash !== 'string' ||
        !HASH.test(log.transactionHash) ||
        typeof log.blockHash !== 'string' ||
        !HASH.test(log.blockHash) ||
        !Number.isSafeInteger(log.logIndex) ||
        log.logIndex < 0 ||
        typeof log.args?.nodeId !== 'bigint' ||
        log.args.nodeId.toString() !== node.id ||
        !sameAddress(log.args.owner, NILLION_EXPECTED_OWNER) ||
        typeof log.args.amount !== 'bigint' ||
        log.args.amount < 0n
      ) {
        throw new Error('Malformed or unexpected claim log.');
      }

      const eventId =
        `1:${log.transactionHash.toLowerCase()}:${log.logIndex}`;

      if (discoveredEvents.has(eventId)) {
        throw new Error('RPC returned a duplicate claim event.');
      }

      discoveredEvents.add(eventId);

      if (recordedClaims.has(eventId)) continue;

      claims.push({
        nodeId: node.id,
        owner: log.args.owner,
        transactionHash: log.transactionHash.toLowerCase(),
        logIndex: String(log.logIndex),
        blockNumber: log.blockNumber.toString(),
        blockHash: log.blockHash.toLowerCase(),
        amountBaseUnits: log.args.amount.toString(),
      });
    }

    claims.sort((left, right) => {
      const blockDifference =
        BigInt(left.blockNumber) - BigInt(right.blockNumber);

      if (blockDifference !== 0n) {
        return blockDifference < 0n ? -1 : 1;
      }

      return Number(left.logIndex) - Number(right.logIndex);
    });

    if (claims.length > 0) {
      drafts.push(
        buildNillionPayoutDraft({
          batchId: `node-${node.id}-through-${snapshot.number}`,
          nodeId: node.id,
          allocationConfig: state.allocationConfig,
          onChainStakeBaseUnits: stake.toString(),
          expectedOwner: NILLION_EXPECTED_OWNER,
          claims,
          ledger: state.ledger,
        }),
      );
    }

    nodeResults.push({
      nodeId: node.id,
      status: claims.length > 0 ? 'draft_created' : 'no_new_claims',
      totalClaimEventsFound: logs.length,
      newClaimEvents: claims.length,
      onChainStakeBaseUnits: stake.toString(),
    });
  }

  const snapshotCheck = await client.getBlock({
    blockNumber: snapshot.number,
  });

  if (
    snapshotCheck?.number !== snapshot.number ||
    typeof snapshotCheck.hash !== 'string' ||
    snapshotCheck.hash.toLowerCase() !== snapshot.hash.toLowerCase()
  ) {
    throw new Error('Discovery snapshot changed.');
  }

  const current = sourceProposal(ledger, allocationConfig);

  if (
    current.sources.ledgerSha256 !== initial.sources.ledgerSha256 ||
    current.sources.allocationSha256 !== initial.sources.allocationSha256
  ) {
    throw new Error('Discovery input state changed.');
  }

  return {
    schemaVersion: 1,
    mode: 'discovery_only',
    approvalRequired: true,
    executionEnabled: false,
    snapshot: {
      finality: 'finalized',
      blockNumber: snapshot.number.toString(),
      blockHash: snapshot.hash.toLowerCase(),
      blockTimestamp: snapshot.timestamp.toString(),
    },
    sources: initial.sources,
    fixedAllocationConfirmation: {
      allocationSha256: confirmedAllocationSha256,
      assertion: 'economic_allocations_unchanged_since_node_launch',
    },
    reviewedAt,
    nodeResults,
    drafts,
    notices: [
      'Discovery only. No claims, payments, approvals, or ledger writes.',
      'The configured RPC is trusted to return complete log results.',
      'Draft receipts still require fresh verification before approval.',
      'The fixed-allocation assertion is supplied by the operator, not proven on-chain.',
      'Claims after the identified finalized snapshot are outside this scan.',
    ],
  };
}