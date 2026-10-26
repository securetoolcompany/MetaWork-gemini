// scripts/preview-nillion-payouts.mjs

import dotenv from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import {
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
} from 'viem';

import { mainnet } from 'viem/chains';

import {
  buildNillionPayoutDraft,
} from '../lib/tokenized-funds/nillion/payouts.js';

import {
  readNillionClaimLogs as readClaimLogs,
} from '../lib/tokenized-funds/nillion/claim-discovery.js';

dotenv.config({ path: '.env.local', quiet: true });

const stakingAbi = parseAbi([
  'function ownerOf(uint256 nodeId) view returns (address)',
  'function stakeOf(uint256 nodeId) view returns (uint256)',
]);

const claimedEvent = parseAbiItem(
  'event Claimed(uint256 indexed nodeId, address indexed owner, uint256 amount)',
);

function readOptions() {
  const args = process.argv.slice(2);
  const options = {
    ledger: null,
    out: null,
    fixedAllocationsConfirmed: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--confirm-fixed-allocations') {
      options.fixedAllocationsConfirmed = true;
      continue;
    }

    if (arg !== '--ledger' && arg !== '--out') {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const value = args[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    options[arg.slice(2)] = value;
    index += 1;
  }

  if (!options.ledger || !options.out) {
    throw new Error(
      'Usage: node scripts/preview-nillion-payouts.mjs ' +
        '--ledger <ledger.json> --out <preview.json> ' +
        '--confirm-fixed-allocations',
    );
  }

  if (!options.fixedAllocationsConfirmed) {
    throw new Error(
      'This first version requires unchanged allocations since node launch. ' +
        'Confirm that with --confirm-fixed-allocations. ' +
        'If ownership or stake changed, historical allocation accounting ' +
        'is required instead.',
    );
  }

  return options;
}

function readRecordedClaimIds(ledger) {
  if (
    ledger?.schemaVersion !== 1 ||
    ledger.chainId !== 1 ||
    ledger.currency !== 'NIL' ||
    ledger.decimals !== 6 ||
    !Array.isArray(ledger.entries)
  ) {
    throw new Error('Invalid payout ledger.');
  }

  const eventIds = new Set();
  const batchIds = new Set();

  for (const entry of ledger.entries) {
    if (
      !entry ||
      typeof entry.batchId !== 'string' ||
      !Array.isArray(entry.claims) ||
      batchIds.has(entry.batchId)
    ) {
      throw new Error('Invalid or duplicate ledger batch.');
    }

    batchIds.add(entry.batchId);

    for (const claim of entry.claims) {
      if (
        typeof claim.eventId !== 'string' ||
        eventIds.has(claim.eventId)
      ) {
        throw new Error('Invalid or duplicate ledger claim.');
      }

      eventIds.add(claim.eventId);
    }
  }

  return eventIds;
}

async function main() {
  const options = readOptions();

  // Dynamic import ensures .env.local is loaded before config.js.
  const {
    NILLION_CONTRACTS,
    NILLION_EXPECTED_OWNER,
    NILLION_NODES,
    NILLION_RPC_URL,
  } = await import('../lib/tokenized-funds/nillion/config.js');

  const allocationPath = resolve(
    'data/tokenized-funds/nillion/stakers.json',
  );

  const ledgerPath = resolve(options.ledger);
  const outputPath = resolve(options.out);

  if (outputPath === ledgerPath || outputPath === allocationPath) {
    throw new Error('Preview output cannot replace source files.');
  }

  const [allocationText, ledgerText] = await Promise.all([
    readFile(allocationPath, 'utf8'),
    readFile(ledgerPath, 'utf8'),
  ]);

  const allocationConfig = JSON.parse(allocationText);
  const ledger = JSON.parse(ledgerText);
  const recordedClaimIds = readRecordedClaimIds(ledger);

  const client = createPublicClient({
    chain: mainnet,
    transport: http(NILLION_RPC_URL, {
      timeout: 30_000,
      retryCount: 2,
    }),
  });

  if ((await client.getChainId()) !== 1) {
    throw new Error('RPC is not Ethereum mainnet.');
  }

  const snapshot = await client.getBlock({
    blockTag: 'finalized',
  });

  if (snapshot.number === null || !snapshot.hash) {
    throw new Error('Unable to obtain a finalized Ethereum snapshot.');
  }

  const nodeResults = [];
  const drafts = [];

  for (const node of NILLION_NODES) {
    const nodeId = String(node.id);
    const fromBlock = BigInt(node.rewardsStartBlock);

    if (fromBlock > snapshot.number) {
      throw new Error(`Node ${nodeId} starts after the snapshot.`);
    }

    console.log(
      `Node #${nodeId}: scanning blocks ` +
        `${fromBlock} through ${snapshot.number}...`,
    );

    const [owner, stake, logs] = await Promise.all([
      client.readContract({
        address: NILLION_CONTRACTS.staking,
        abi: stakingAbi,
        functionName: 'ownerOf',
        args: [BigInt(nodeId)],
        blockNumber: snapshot.number,
      }),

      client.readContract({
        address: NILLION_CONTRACTS.staking,
        abi: stakingAbi,
        functionName: 'stakeOf',
        args: [BigInt(nodeId)],
        blockNumber: snapshot.number,
      }),

      readClaimLogs({
        client,
        emissions: NILLION_CONTRACTS.emissions,
        nodeId,
        fromBlock,
        toBlock: snapshot.number,
      }),
    ]);

    if (
      owner.toLowerCase() !==
      NILLION_EXPECTED_OWNER.toLowerCase()
    ) {
      throw new Error(`Node ${nodeId}: unexpected current owner.`);
    }

    const recordedStake = allocationConfig.nodes?.[nodeId]?.stakers;

    if (!Array.isArray(recordedStake) || recordedStake.length === 0) {
      throw new Error(`Node ${nodeId}: missing allocation records.`);
    }

    const claims = [];

    for (const log of logs) {
      if (
        log.removed ||
        log.transactionHash === null ||
        log.blockHash === null ||
        log.blockNumber === null ||
        log.logIndex === null ||
        log.args.nodeId === undefined ||
        log.args.owner === undefined ||
        log.args.amount === undefined
      ) {
        throw new Error(`Node ${nodeId}: incomplete claim log.`);
      }

      if (
        log.args.owner.toLowerCase() !==
        NILLION_EXPECTED_OWNER.toLowerCase()
      ) {
        throw new Error(
          `Node ${nodeId}: a historical claim has a different owner. ` +
            'Manual historical review is required.',
        );
      }

      const eventId =
        `1:${log.transactionHash.toLowerCase()}:${log.logIndex}`;

      if (recordedClaimIds.has(eventId)) {
        continue;
      }

      claims.push({
        nodeId,
        owner: log.args.owner,
        transactionHash: log.transactionHash,
        logIndex: String(log.logIndex),
        blockNumber: log.blockNumber.toString(),
        blockHash: log.blockHash,
        amountBaseUnits: log.args.amount.toString(),
      });
    }

    if (claims.length === 0) {
      nodeResults.push({
        nodeId,
        status: 'no_new_claims',
        totalClaimEventsFound: logs.length,
        newClaimEvents: 0,
        onChainStakeBaseUnits: stake.toString(),
      });

      console.log(`Node #${nodeId}: no new claim events.`);
      continue;
    }

    const draft = buildNillionPayoutDraft({
      batchId: `node-${nodeId}-through-${snapshot.number}`,
      nodeId,
      allocationConfig,
      onChainStakeBaseUnits: stake.toString(),
      expectedOwner: NILLION_EXPECTED_OWNER,
      claims,
      ledger,
    });

    drafts.push(draft);

    nodeResults.push({
      nodeId,
      status: 'draft_created',
      totalClaimEventsFound: logs.length,
      newClaimEvents: claims.length,
      grossClaimedBaseUnits: draft.grossClaimedBaseUnits,
      managementFeeBaseUnits: draft.managementFeeBaseUnits,
      distributableBaseUnits: draft.distributableBaseUnits,
      walletPendingBaseUnits: draft.walletPendingBaseUnits,
      roundingRemainderBaseUnits: draft.roundingRemainderBaseUnits,
    });

    console.log(
      `Node #${nodeId}: draft created from ${claims.length} claim event(s).`,
    );
  }

  const snapshotCheck = await client.getBlock({
    blockNumber: snapshot.number,
  });

  if (snapshotCheck.hash !== snapshot.hash) {
    throw new Error('Snapshot block changed. No preview was written.');
  }

  const preview = {
    schemaVersion: 1,
    mode: 'dry_run',
    generatedAt: new Date().toISOString(),
    chainId: 1,
    currency: 'NIL',
    decimals: 6,
    snapshot: {
      finality: 'finalized',
      blockNumber: snapshot.number.toString(),
      blockHash: snapshot.hash,
      blockTimestamp: snapshot.timestamp.toString(),
    },
    sources: {
      emissions: NILLION_CONTRACTS.emissions,
      staking: NILLION_CONTRACTS.staking,
      nilToken: NILLION_CONTRACTS.nilToken,
      allocationVersion: allocationConfig.version,
      allocationFileSha256: createHash('sha256')
        .update(allocationText)
        .digest('hex'),
      ledgerFileSha256: createHash('sha256')
        .update(ledgerText)
        .digest('hex'),
    },
    assumptions: {
      allocationsUnchangedSinceNodeLaunch: true,
      ethereumReadsTrustedToConfiguredRpc: true,
    },
    notices: [
      'Preview only. No transactions were signed or submitted.',
      'Ledger was not changed.',
      'Only finalized Claimed events are allocated.',
      'Unclaimed dashboard estimates are excluded.',
      'Previously unpaid ledger amounts are not aggregated in this preview.',
      'ETH Covenant rewards are excluded.',
      'Current allocation version is applied only under the fixed-allocation assumption.',
    ],
    nodeResults,
    drafts,
  };

  await writeFile(
    outputPath,
    `${JSON.stringify(preview, null, 2)}\n`,
    {
      encoding: 'utf8',
      flag: 'wx',
    },
  );

  console.log(`Preview saved: ${outputPath}`);
  console.log('No claims, payments, or ledger updates were performed.');
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});