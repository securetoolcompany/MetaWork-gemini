// scripts/review-nillion-payment.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  access,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';

import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
} from 'viem';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from '../lib/tokenized-funds/nillion/payouts.js';

import {
  recordNillionPayoutDraft,
} from '../lib/tokenized-funds/nillion/payout-ledger.js';

import {
  NILLION_CONTRACTS,
} from '../lib/tokenized-funds/nillion/config.js';

import {
  reviewNillionPayment,
} from './review-nillion-payment.mjs';

const OWNER = '0x1111111111111111111111111111111111111111';
const WALLET = '0x2222222222222222222222222222222222222222';

const CLAIM_TX = `0x${'a'.repeat(64)}`;
const PAYMENT_TX = `0x${'d'.repeat(64)}`;
const BLOCK_HASH = `0x${'e'.repeat(64)}`;

const transferAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'nillion-payment-'));

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const paths = {
    ledger: join(directory, 'ledger.json'),
    payment: join(directory, 'payment.json'),
    out: join(directory, 'proposed.json'),
  };

  const allocationConfig = {
    version: 2,
    managementFeeBps: 5000,
    nodes: {
      '19': {
        stakers: [
          { id: 'position-a', wallet: WALLET, amountNil: '60' },
          { id: 'position-b', wallet: null, amountNil: '40' },
        ],
      },
    },
  };

  const empty = createEmptyNillionPayoutLedger();

  const draft = buildNillionPayoutDraft({
    batchId: 'batch-1',
    nodeId: '19',
    allocationConfig,
    onChainStakeBaseUnits: '100000000',
    expectedOwner: OWNER,
    claims: [
      {
        nodeId: '19',
        owner: OWNER,
        transactionHash: CLAIM_TX,
        logIndex: '1',
        blockNumber: '100',
        blockHash: `0x${'b'.repeat(64)}`,
        amountBaseUnits: '12000000',
      },
    ],
    ledger: empty,
  });

  const ledger = recordNillionPayoutDraft({
    ledger: empty,
    draft,
    allocationConfig,
    expectedOwner: OWNER,
    reviewedAt: '2026-10-24T16:00:00.000Z',
  });

  const ledgerText = JSON.stringify(ledger);

  const request = {
    schemaVersion: 1,
    chainId: 1,
    ledgerFileSha256: sha256(ledgerText),
    transactionHash: PAYMENT_TX,
    logIndex: '9',
    allocations: [
      {
        batchId: 'batch-1',
        positionId: 'position-a',
        amountBaseUnits: '1000000',
      },
    ],
  };

  const receipt = {
    status: 'success',
    transactionHash: PAYMENT_TX,
    blockNumber: 200n,
    blockHash: BLOCK_HASH,
    logs: [
      {
        address: NILLION_CONTRACTS.nilToken,
        transactionHash: PAYMENT_TX,
        blockNumber: 200n,
        blockHash: BLOCK_HASH,
        logIndex: 9,
        removed: false,
        topics: encodeEventTopics({
          abi: transferAbi,
          eventName: 'Transfer',
          args: { from: OWNER, to: WALLET },
        }),
        data: encodeAbiParameters(
          [{ type: 'uint256' }],
          [1000000n],
        ),
      },
    ],
  };

  const rpcClient = {
    getChainId: async () => 1,
    getTransactionReceipt: async () => receipt,
    getBlock: async ({ blockTag }) => ({
      number: blockTag === 'finalized' ? 210n : 200n,
      hash: BLOCK_HASH,
    }),
  };

  await writeFile(paths.ledger, ledgerText);
  await writeFile(paths.payment, JSON.stringify(request));

  return {
    paths,
    ledgerText,
    request,
    receipt,
    rpcClient,

    saveRequest: () =>
      writeFile(paths.payment, JSON.stringify(request)),

    run: () =>
      reviewNillionPayment({
        args: [
          '--payment', paths.payment,
          '--ledger', paths.ledger,
          '--out', paths.out,
        ],
        rpcClient,
      }),
  };
}

async function rejectsWithoutOutput(f, pattern) {
  const before = await readFile(f.paths.ledger, 'utf8');

  await assert.rejects(f.run, pattern);

  assert.equal(await exists(f.paths.out), false);
  assert.equal(await readFile(f.paths.ledger, 'utf8'), before);
}

test('payment CLI writes a proposed settlement without changing the real ledger', async (t) => {
  const f = await fixture(t);

  const summary = await f.run();
  const proposed = JSON.parse(await readFile(f.paths.out, 'utf8'));

  assert.equal(summary.totalRecordedPaidBaseUnits, '1000000');
  assert.equal(summary.totalRecordedUnpaidBaseUnits, '5000000');
  assert.equal(proposed.settlements.length, 1);
  assert.equal(await readFile(f.paths.ledger, 'utf8'), f.ledgerText);
});

test('payment CLI rejects a stale ledger hash', async (t) => {
  const f = await fixture(t);
  await writeFile(f.paths.ledger, `${f.ledgerText}\n`);

  await rejectsWithoutOutput(f, /Ledger changed/);
});

test('payment CLI rejects failed transaction receipts', async (t) => {
  const f = await fixture(t);
  f.receipt.status = 'reverted';

  await rejectsWithoutOutput(f, /unsuccessful or incomplete/);
});

test('payment CLI rejects an amount that differs from assigned obligations', async (t) => {
  const f = await fixture(t);

  f.receipt.logs[0].data = encodeAbiParameters(
    [{ type: 'uint256' }],
    [2000000n],
  );

  await rejectsWithoutOutput(f, /sender, recipient, or amount/);
});

test('payment CLI rejects unfinalized payment blocks', async (t) => {
  const f = await fixture(t);

  f.rpcClient.getBlock = async ({ blockTag }) => ({
    number: blockTag === 'finalized' ? 199n : 200n,
    hash: BLOCK_HASH,
  });

  await rejectsWithoutOutput(f, /not finalized/);
});

test('payment CLI rejects unknown obligation assignments', async (t) => {
  const f = await fixture(t);
  f.request.allocations[0].batchId = 'missing';
  await f.saveRequest();

  await rejectsWithoutOutput(f, /unknown obligation/);
});

test('payment CLI refuses an existing output file', async (t) => {
  const f = await fixture(t);
  await writeFile(f.paths.out, 'DO NOT REPLACE');

  await assert.rejects(f.run, (error) => error.code === 'EEXIST');

  assert.equal(await readFile(f.paths.out, 'utf8'), 'DO NOT REPLACE');
  assert.equal(await readFile(f.paths.ledger, 'utf8'), f.ledgerText);
});

test('payment CLI rejects source changes during RPC verification', async (t) => {
  const f = await fixture(t);

  f.rpcClient.getTransactionReceipt = async () => {
    await writeFile(f.paths.payment, `${JSON.stringify(f.request)}\n`);
    return f.receipt;
  };

  await rejectsWithoutOutput(f, /Input files changed during review/);
});

test('payment CLI rejects a transfer already recorded in the ledger', async (t) => {
  const f = await fixture(t);
  await f.run();

  const proposedText = await readFile(f.paths.out, 'utf8');

  await writeFile(f.paths.ledger, proposedText);
  await rm(f.paths.out);

  f.request.ledgerFileSha256 = sha256(proposedText);
  await f.saveRequest();

  await rejectsWithoutOutput(f, /already recorded/);
});