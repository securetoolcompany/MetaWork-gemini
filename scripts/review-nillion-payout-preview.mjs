// scripts/review-nillion-payout-preview.mjs

import dotenv from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import {
  createPublicClient,
  decodeEventLog,
  http,
  parseAbi,
} from 'viem';

import { mainnet } from 'viem/chains';

import {
  recordNillionPayoutDraft,
  summarizeNillionPayoutLedger,
} from '../lib/tokenized-funds/nillion/payout-ledger.js';

import { pathToFileURL } from 'node:url';

dotenv.config({ path: '.env.local', quiet: true });

const claimAbi = parseAbi([
  'event Claimed(uint256 indexed nodeId, address indexed owner, uint256 amount)',
]);

const stakingAbi = parseAbi([
  'function ownerOf(uint256 nodeId) view returns (address)',
  'function stakeOf(uint256 nodeId) view returns (uint256)',
]);

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function sameAddress(left, right) {
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    left.toLowerCase() === right.toLowerCase()
  );
}

function readOptions(args = process.argv.slice(2)) {
  const options = {};

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];

    if (
      !['--preview', '--ledger', '--out'].includes(flag) ||
      !value ||
      value.startsWith('--') ||
      options[flag.slice(2)]
    ) {
      throw new Error(
        'Usage: node scripts/review-nillion-payout-preview.mjs ' +
          '--preview <preview.json> --ledger <ledger.json> ' +
          '--out <proposed-ledger.json>',
      );
    }

    options[flag.slice(2)] = resolve(value);
  }

  if (!options.preview || !options.ledger || !options.out) {
    throw new Error('--preview, --ledger, and --out are required.');
  }

  return options;
}

export async function reviewNillionPayoutPreview({
  args = process.argv.slice(2),
  rpcClient = null,
  allocationFile = 'data/tokenized-funds/nillion/stakers.json',
} = {}) {
  const options = readOptions(args);
  const allocationPath = resolve(allocationFile);

  if (
    [options.preview, options.ledger, allocationPath].includes(options.out)
  ) {
    throw new Error('Output must be separate from every input file.');
  }

  const {
    NILLION_CONTRACTS,
    NILLION_EXPECTED_OWNER,
    NILLION_NODES,
    NILLION_RPC_URL,
  } = await import('../lib/tokenized-funds/nillion/config.js');

  const [previewText, ledgerText, allocationText] = await Promise.all([
    readFile(options.preview, 'utf8'),
    readFile(options.ledger, 'utf8'),
    readFile(allocationPath, 'utf8'),
  ]);

  const preview = JSON.parse(previewText);
  const ledger = JSON.parse(ledgerText);
  const allocationConfig = JSON.parse(allocationText);

  // Validate existing accounting before inspecting the preview.
  summarizeNillionPayoutLedger(ledger);

  if (
    preview.schemaVersion !== 1 ||
    preview.mode !== 'dry_run' ||
    preview.chainId !== 1 ||
    preview.currency !== 'NIL' ||
    preview.decimals !== 6 ||
    preview.snapshot?.finality !== 'finalized' ||
    !/^\d+$/.test(preview.snapshot?.blockNumber ?? '') ||
    !/^0x[0-9a-fA-F]{64}$/.test(preview.snapshot?.blockHash ?? '') ||
    !Array.isArray(preview.drafts) ||
    preview.assumptions?.allocationsUnchangedSinceNodeLaunch !== true
  ) {
    throw new Error('Invalid or unsupported preview.');
  }

  if (
    preview.sources?.allocationFileSha256 !== sha256(allocationText) ||
    preview.sources?.ledgerFileSha256 !== sha256(ledgerText)
  ) {
    throw new Error(
      'Allocation or ledger file changed after preview generation. ' +
        'Generate and review a fresh preview.',
    );
  }

  if (
    preview.sources.allocationVersion !== allocationConfig.version ||
    !sameAddress(
      preview.sources.emissions,
      NILLION_CONTRACTS.emissions,
    ) ||
    !sameAddress(
      preview.sources.staking,
      NILLION_CONTRACTS.staking,
    ) ||
    !sameAddress(
      preview.sources.nilToken,
      NILLION_CONTRACTS.nilToken,
    )
  ) {
    throw new Error('Preview sources do not match current configuration.');
  }

    const client = rpcClient ?? createPublicClient({
    chain: mainnet,
    transport: http(NILLION_RPC_URL, {
      timeout: 30_000,
      retryCount: 2,
    }),
  });

  if ((await client.getChainId()) !== 1) {
    throw new Error('RPC is not Ethereum mainnet.');
  }

  const snapshotNumber = BigInt(preview.snapshot.blockNumber);

  const [finalized, snapshot] = await Promise.all([
    client.getBlock({ blockTag: 'finalized' }),
    client.getBlock({ blockNumber: snapshotNumber }),
  ]);

  if (
    finalized.number === null ||
    snapshotNumber > finalized.number ||
    snapshot.hash?.toLowerCase() !==
      preview.snapshot.blockHash.toLowerCase()
  ) {
    throw new Error('Preview snapshot is not canonical and finalized.');
  }

  if (preview.drafts.length === 0) {
    console.log('Preview validated. Nothing to record.');
    console.log('No proposed ledger was written. Real ledger unchanged.');
    return;
  }

  const receiptCache = new Map();
  const blockCache = new Map();
  const seenNodes = new Set();
  const reviewedAt = new Date().toISOString();

  let proposedLedger = ledger;

  for (const draft of preview.drafts) {
    const node = NILLION_NODES.find(
      (entry) => entry.id === draft.nodeId,
    );

    if (
      !node ||
      seenNodes.has(draft.nodeId) ||
      !Array.isArray(draft.claims) ||
      draft.claims.length === 0 ||
      !sameAddress(draft.owner, NILLION_EXPECTED_OWNER)
    ) {
      throw new Error('Invalid, repeated, or unexpected draft node.');
    }

    seenNodes.add(draft.nodeId);

    const [owner, stake] = await Promise.all([
      client.readContract({
        address: NILLION_CONTRACTS.staking,
        abi: stakingAbi,
        functionName: 'ownerOf',
        args: [BigInt(node.id)],
        blockNumber: snapshotNumber,
      }),

      client.readContract({
        address: NILLION_CONTRACTS.staking,
        abi: stakingAbi,
        functionName: 'stakeOf',
        args: [BigInt(node.id)],
        blockNumber: snapshotNumber,
      }),
    ]);

    if (
      !sameAddress(owner, NILLION_EXPECTED_OWNER) ||
      stake.toString() !== draft.recordedStakeBaseUnits
    ) {
      throw new Error(`Node #${node.id}: snapshot owner or stake mismatch.`);
    }

    for (const claim of draft.claims) {
      if (
        typeof claim.transactionHash !== 'string' ||
        !/^0x[0-9a-fA-F]{64}$/.test(claim.transactionHash) ||
        !/^\d+$/.test(claim.blockNumber ?? '') ||
        !/^\d+$/.test(claim.logIndex ?? '') ||
        !/^0x[0-9a-fA-F]{64}$/.test(claim.blockHash ?? '')
      ) {
        throw new Error('Malformed claim reference.');
      }

      const claimBlock = BigInt(claim.blockNumber);

      if (
        claimBlock < BigInt(node.rewardsStartBlock) ||
        claimBlock > snapshotNumber
      ) {
        throw new Error('Claim is outside the preview scan range.');
      }

      const hash = claim.transactionHash.toLowerCase();

      if (!receiptCache.has(hash)) {
        receiptCache.set(
          hash,
          await client.getTransactionReceipt({ hash }),
        );
      }

      const receipt = receiptCache.get(hash);

      if (
        receipt.status !== 'success' ||
        receipt.blockNumber !== claimBlock ||
        receipt.blockHash.toLowerCase() !== claim.blockHash.toLowerCase()
      ) {
        throw new Error('Claim receipt failed or does not match the preview.');
      }

      if (!blockCache.has(claim.blockNumber)) {
        blockCache.set(
          claim.blockNumber,
          await client.getBlock({ blockNumber: claimBlock }),
        );
      }

      if (
        blockCache.get(claim.blockNumber).hash?.toLowerCase() !==
        receipt.blockHash.toLowerCase()
      ) {
        throw new Error('Claim receipt is not in the canonical block.');
      }

      const log = receipt.logs.find(
        (entry) => String(entry.logIndex) === claim.logIndex,
      );

      if (
        !log ||
        log.removed ||
        !sameAddress(log.address, NILLION_CONTRACTS.emissions)
      ) {
        throw new Error('Claim log is missing or emitted by another contract.');
      }

      const decoded = decodeEventLog({
        abi: claimAbi,
        eventName: 'Claimed',
        data: log.data,
        topics: log.topics,
        strict: true,
      });

      if (
        decoded.args.nodeId.toString() !== draft.nodeId ||
        claim.nodeId !== draft.nodeId ||
        !sameAddress(decoded.args.owner, NILLION_EXPECTED_OWNER) ||
        !sameAddress(decoded.args.owner, claim.owner) ||
        decoded.args.amount.toString() !== claim.amountBaseUnits
      ) {
        throw new Error('Claim event values do not match the preview.');
      }

      const eventId = `1:${hash}:${claim.logIndex}`;

      if (claim.eventId !== eventId) {
        throw new Error('Claim event ID does not match its receipt.');
      }
    }

    proposedLedger = recordNillionPayoutDraft({
      ledger: proposedLedger,
      draft,
      allocationConfig,
      expectedOwner: NILLION_EXPECTED_OWNER,
      reviewedAt,
    });

    console.log(`Node #${node.id}: claims verified and draft recalculated.`);
  }

  // Refuse to save a proposal if source files changed during review.
  const [currentLedgerText, currentAllocationText] = await Promise.all([
    readFile(options.ledger, 'utf8'),
    readFile(allocationPath, 'utf8'),
  ]);

  if (
    sha256(currentLedgerText) !== sha256(ledgerText) ||
    sha256(currentAllocationText) !== sha256(allocationText)
  ) {
    throw new Error('Source files changed during review. Nothing written.');
  }

  const snapshotCheck = await client.getBlock({
    blockNumber: snapshotNumber,
  });

  if (snapshotCheck.hash !== snapshot.hash) {
    throw new Error('Snapshot changed during review. Nothing written.');
  }

  const summary = summarizeNillionPayoutLedger(proposedLedger);

  await writeFile(
    options.out,
    `${JSON.stringify(proposedLedger, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );

  console.log(`Proposed ledger saved: ${options.out}`);
  console.log(JSON.stringify(summary, null, 2));
  console.log('Real ledger unchanged. No transactions submitted.');
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  reviewNillionPayoutPreview().catch((error) => {
    const message =
      error?.shortMessage ||
      error?.message ||
      'Review failed. Check your RPC configuration locally.';

    console.error(
      String(message).replace(/https?:\/\/[^\s]+/g, '[REDACTED URL]'),
    );

    process.exitCode = 1;
  });
}