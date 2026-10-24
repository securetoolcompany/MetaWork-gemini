// scripts/review-nillion-payment.mjs

import dotenv from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createPublicClient,
  http,
} from 'viem';

import { mainnet } from 'viem/chains';

import {
  recordNillionPayment,
  summarizeNillionPayoutLedger,
} from '../lib/tokenized-funds/nillion/payout-ledger.js';

dotenv.config({ path: '.env.local', quiet: true });

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function readOptions(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];

    if (
      !['--payment', '--ledger', '--out'].includes(flag) ||
      !value ||
      value.startsWith('--') ||
      options[flag.slice(2)]
    ) {
      throw new Error(
        'Usage: node scripts/review-nillion-payment.mjs ' +
          '--payment <payment-review.json> --ledger <ledger.json> ' +
          '--out <proposed-ledger.json>',
      );
    }

    options[flag.slice(2)] = resolve(value);
  }

  if (!options.payment || !options.ledger || !options.out) {
    throw new Error('--payment, --ledger, and --out are required.');
  }

  if (
    options.out === options.payment ||
    options.out === options.ledger
  ) {
    throw new Error('Output must be separate from input files.');
  }

  return options;
}

function readAssignments(request, ledger) {
  if (
    request?.schemaVersion !== 1 ||
    request.chainId !== 1 ||
    !/^0x[0-9a-fA-F]{64}$/.test(request.transactionHash ?? '') ||
    !/^\d+$/.test(request.logIndex ?? '') ||
    !Array.isArray(request.allocations) ||
    request.allocations.length === 0
  ) {
    throw new Error('Invalid payment review request.');
  }

  let sender = null;
  let recipient = null;
  let total = 0n;
  const seen = new Set();

  const allocations = request.allocations.map((allocation) => {
    if (
      !allocation ||
      typeof allocation.batchId !== 'string' ||
      typeof allocation.positionId !== 'string' ||
      !/^\d+$/.test(allocation.amountBaseUnits ?? '') ||
      BigInt(allocation.amountBaseUnits) <= 0n
    ) {
      throw new Error('Invalid obligation assignment.');
    }

    const key = JSON.stringify([
      allocation.batchId,
      allocation.positionId,
    ]);

    if (seen.has(key)) {
      throw new Error('Duplicate obligation assignment.');
    }

    seen.add(key);

    const entry = ledger.entries.find(
      (batch) => batch.batchId === allocation.batchId,
    );

    const position = entry?.positions.find(
      (item) => item.positionId === allocation.positionId,
    );

    if (!entry || !position) {
      throw new Error('Payment references an unknown obligation.');
    }

    if (position.wallet === null) {
      throw new Error('A referenced position has no receiving wallet.');
    }

    if (
      typeof position.wallet !== 'string' ||
      typeof entry.owner !== 'string'
    ) {
      throw new Error('Invalid obligation owner or recipient.');
    }

    const nextSender = entry.owner.toLowerCase();
    const nextRecipient = position.wallet.toLowerCase();

    if (
      (sender !== null && sender !== nextSender) ||
      (recipient !== null && recipient !== nextRecipient)
    ) {
      throw new Error(
        'One transfer can only settle obligations with the same sender and recipient.',
      );
    }

    sender = nextSender;
    recipient = nextRecipient;
    total += BigInt(allocation.amountBaseUnits);

    return {
      batchId: allocation.batchId,
      positionId: allocation.positionId,
      amountBaseUnits: allocation.amountBaseUnits,
    };
  });

  return {
    sender,
    recipient,
    total: total.toString(),
    allocations,
  };
}

export async function reviewNillionPayment({
  args = process.argv.slice(2),
  rpcClient = null,
} = {}) {
  const options = readOptions(args);

  const [ledgerText, paymentText] = await Promise.all([
    readFile(options.ledger, 'utf8'),
    readFile(options.payment, 'utf8'),
  ]);

  const ledger = JSON.parse(ledgerText);
  const request = JSON.parse(paymentText);

  summarizeNillionPayoutLedger(ledger);

  if (request.ledgerFileSha256 !== sha256(ledgerText)) {
    throw new Error(
      'Ledger changed after payment review preparation. ' +
        'Review the current obligations and prepare a fresh request.',
    );
  }

  const assignment = readAssignments(request, ledger);

  const { NILLION_RPC_URL } = await import(
    '../lib/tokenized-funds/nillion/config.js'
  );

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

  const receipt = await client.getTransactionReceipt({
    hash: request.transactionHash,
  });

  if (
    receipt.status !== 'success' ||
    typeof receipt.blockNumber !== 'bigint' ||
    !receipt.blockHash ||
    !Array.isArray(receipt.logs)
  ) {
    throw new Error('Payment receipt is unsuccessful or incomplete.');
  }

  const [canonicalBlock, finalizedBlock] = await Promise.all([
    client.getBlock({ blockNumber: receipt.blockNumber }),
    client.getBlock({ blockTag: 'finalized' }),
  ]);

  const updated = recordNillionPayment({
    ledger,

    verification: {
      chainId: 1,
      transactionHash: request.transactionHash,
      logIndex: request.logIndex,
      expectedSender: assignment.sender,
      expectedRecipient: assignment.recipient,
      expectedAmountBaseUnits: assignment.total,

      // Store only receipt fields needed for verification.
      receipt: {
        status: receipt.status,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        logs: receipt.logs.filter(
          (log) => String(log.logIndex) === request.logIndex,
        ),
      },

      canonicalBlock: {
        number: canonicalBlock.number,
        hash: canonicalBlock.hash,
      },

      finalizedBlock: {
        number: finalizedBlock.number,
        hash: finalizedBlock.hash,
      },
    },

    allocations: assignment.allocations,
  });

  const [currentLedgerText, currentPaymentText, blockCheck] =
    await Promise.all([
      readFile(options.ledger, 'utf8'),
      readFile(options.payment, 'utf8'),
      client.getBlock({ blockNumber: receipt.blockNumber }),
    ]);

  if (
    sha256(currentLedgerText) !== sha256(ledgerText) ||
    sha256(currentPaymentText) !== sha256(paymentText)
  ) {
    throw new Error('Input files changed during review. Nothing written.');
  }

  if (
    !blockCheck.hash ||
    blockCheck.hash.toLowerCase() !== receipt.blockHash.toLowerCase()
  ) {
    throw new Error('Payment block changed during review. Nothing written.');
  }

  const summary = summarizeNillionPayoutLedger(updated);

  await writeFile(
    options.out,
    `${JSON.stringify(updated, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );

  console.log(`Proposed payment ledger saved: ${options.out}`);
  console.log(JSON.stringify(summary, null, 2));
  console.log('Real ledger unchanged. No transactions submitted.');

  return summary;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  reviewNillionPayment().catch((error) => {
    const message =
      error?.shortMessage ||
      error?.message ||
      'Payment review failed. Check your RPC configuration locally.';

    console.error(
      String(message).replace(/https?:\/\/[^\s]+/g, '[REDACTED URL]'),
    );

    process.exitCode = 1;
  });
}