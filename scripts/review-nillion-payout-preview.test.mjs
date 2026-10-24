// scripts/review-nillion-payout-preview.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  access,
} from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
} from 'viem';

import {
  reviewNillionPayoutPreview,
} from './review-nillion-payout-preview.mjs';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from '../lib/tokenized-funds/nillion/payouts.js';

import {
  NILLION_CONTRACTS,
  NILLION_EXPECTED_OWNER,
  NILLION_NODES,
} from '../lib/tokenized-funds/nillion/config.js';

const OWNER = NILLION_EXPECTED_OWNER;
const WALLET = '0x2222222222222222222222222222222222222222';

const TX = `0x${'a'.repeat(64)}`;
const BLOCK_HASH = `0x${'b'.repeat(64)}`;
const WRONG_HASH = `0x${'c'.repeat(64)}`;

const NODE = NILLION_NODES.find((node) => node.id === '19');
const BLOCK_NUMBER = BigInt(NODE.rewardsStartBlock) + 100n;

const claimAbi = parseAbi([
  'event Claimed(uint256 indexed nodeId, address indexed owner, uint256 amount)',
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
  const directory = await mkdtemp(join(tmpdir(), 'nillion-review-'));

  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const paths = {
    allocation: join(directory, 'stakers.json'),
    ledger: join(directory, 'ledger.json'),
    preview: join(directory, 'preview.json'),
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

  const ledger = createEmptyNillionPayoutLedger();

  const claim = {
    nodeId: '19',
    owner: OWNER,
    transactionHash: TX,
    logIndex: '7',
    blockNumber: BLOCK_NUMBER.toString(),
    blockHash: BLOCK_HASH,
    amountBaseUnits: '12000000',
  };

  const draft = buildNillionPayoutDraft({
    batchId: 'test-batch-19',
    nodeId: '19',
    allocationConfig,
    onChainStakeBaseUnits: '100000000',
    expectedOwner: OWNER,
    claims: [claim],
    ledger,
  });

  const allocationText = JSON.stringify(allocationConfig);
  const ledgerText = JSON.stringify(ledger);

  const preview = {
    schemaVersion: 1,
    mode: 'dry_run',
    chainId: 1,
    currency: 'NIL',
    decimals: 6,
    snapshot: {
      finality: 'finalized',
      blockNumber: BLOCK_NUMBER.toString(),
      blockHash: BLOCK_HASH,
    },
    sources: {
      ...NILLION_CONTRACTS,
      allocationVersion: 2,
      allocationFileSha256: sha256(allocationText),
      ledgerFileSha256: sha256(ledgerText),
    },
    assumptions: {
      allocationsUnchangedSinceNodeLaunch: true,
    },
    drafts: [draft],
  };

  const receipt = {
    status: 'success',
    transactionHash: TX,
    blockNumber: BLOCK_NUMBER,
    blockHash: BLOCK_HASH,
    logs: [
      {
        address: NILLION_CONTRACTS.emissions,
        transactionHash: TX,
        blockNumber: BLOCK_NUMBER,
        blockHash: BLOCK_HASH,
        logIndex: 7,
        removed: false,
        topics: encodeEventTopics({
          abi: claimAbi,
          eventName: 'Claimed',
          args: {
            nodeId: 19n,
            owner: OWNER,
          },
        }),
        data: encodeAbiParameters(
          [{ type: 'uint256' }],
          [12000000n],
        ),
      },
    ],
  };

  const rpcClient = {
    getChainId: async () => 1,

    getBlock: async () => ({
      number: BLOCK_NUMBER,
      hash: BLOCK_HASH,
    }),

    readContract: async ({ functionName }) => {
      if (functionName === 'ownerOf') return OWNER;
      if (functionName === 'stakeOf') return 100000000n;
      throw new Error(`Unexpected function: ${functionName}`);
    },

    getTransactionReceipt: async () => receipt,
  };

  await Promise.all([
    writeFile(paths.allocation, allocationText),
    writeFile(paths.ledger, ledgerText),
    writeFile(paths.preview, JSON.stringify(preview)),
  ]);

  return {
    paths,
    ledgerText,
    allocationText,
    preview,
    receipt,
    rpcClient,

    savePreview: () =>
      writeFile(paths.preview, JSON.stringify(preview)),

    run: () =>
      reviewNillionPayoutPreview({
        args: [
          '--preview', paths.preview,
          '--ledger', paths.ledger,
          '--out', paths.out,
        ],
        rpcClient,
        allocationFile: paths.allocation,
      }),
  };
}

async function rejectsWithoutWriting(f, pattern) {
  const ledgerBefore = await readFile(f.paths.ledger, 'utf8');

  await assert.rejects(f.run, pattern);

  assert.equal(await exists(f.paths.out), false);
  assert.equal(
    await readFile(f.paths.ledger, 'utf8'),
    ledgerBefore,
  );
}

test('valid receipt creates a proposed ledger without changing inputs', async (t) => {
  const f = await fixture(t);

  await f.run();

  const proposed = JSON.parse(await readFile(f.paths.out, 'utf8'));

  assert.equal(proposed.entries.length, 1);
  assert.equal(proposed.entries[0].status, 'recorded');
  assert.equal(proposed.entries[0].grossClaimedBaseUnits, '12000000');
  assert.equal(proposed.entries[0].managementFeeBaseUnits, '6000000');
  assert.equal(
    proposed.entries[0].positions[0].allocatedBaseUnits,
    '3600000',
  );
  assert.equal(
    proposed.entries[0].positions[1].allocatedBaseUnits,
    '2400000',
  );
  assert.deepEqual(proposed.entries[0].payments, []);

  assert.equal(await readFile(f.paths.ledger, 'utf8'), f.ledgerText);
  assert.equal(
    await readFile(f.paths.allocation, 'utf8'),
    f.allocationText,
  );
});

test('empty preview writes no proposed ledger', async (t) => {
  const f = await fixture(t);
  f.preview.drafts = [];
  await f.savePreview();

  await f.run();

  assert.equal(await exists(f.paths.out), false);
  assert.equal(await readFile(f.paths.ledger, 'utf8'), f.ledgerText);
});

test('rejects a failed transaction receipt', async (t) => {
  const f = await fixture(t);
  f.receipt.status = 'reverted';

  await rejectsWithoutWriting(f, /receipt failed/);
});

test('rejects a log from the wrong contract', async (t) => {
  const f = await fixture(t);
  f.receipt.logs[0].address = WALLET;

  await rejectsWithoutWriting(f, /another contract/);
});

test('rejects a receipt amount different from the draft', async (t) => {
  const f = await fixture(t);

  f.receipt.logs[0].data = encodeAbiParameters(
    [{ type: 'uint256' }],
    [12000001n],
  );

  await rejectsWithoutWriting(f, /event values do not match/);
});

test('rejects a receipt with the wrong block hash', async (t) => {
  const f = await fixture(t);
  f.receipt.blockHash = WRONG_HASH;

  await rejectsWithoutWriting(f, /receipt failed/);
});

test('rejects a receipt whose block is not canonical', async (t) => {
  const f = await fixture(t);
  let calls = 0;

  f.rpcClient.getBlock = async () => {
    calls += 1;

    return {
      number: BLOCK_NUMBER,
      hash: calls === 3 ? WRONG_HASH : BLOCK_HASH,
    };
  };

  await rejectsWithoutWriting(f, /not in the canonical block/);
});

test('rejects duplicated claim events in a draft', async (t) => {
  const f = await fixture(t);

  f.preview.drafts[0].claims.push({
    ...f.preview.drafts[0].claims[0],
  });

  await f.savePreview();

  await rejectsWithoutWriting(f, /duplicated or already recorded/);
});

test('rejects a changed allocation file before review', async (t) => {
  const f = await fixture(t);
  await writeFile(f.paths.allocation, `${f.allocationText}\n`);

  await rejectsWithoutWriting(f, /changed after preview generation/);
});

test('rejects a changed ledger file before review', async (t) => {
  const f = await fixture(t);
  await writeFile(f.paths.ledger, `${f.ledgerText}\n`);

  await rejectsWithoutWriting(f, /changed after preview generation/);
});

test('rejects source changes during receipt verification', async (t) => {
  const f = await fixture(t);

  f.rpcClient.getTransactionReceipt = async () => {
    await writeFile(f.paths.allocation, `${f.allocationText}\n`);
    return f.receipt;
  };

  await rejectsWithoutWriting(f, /changed during review/);
});

test('refuses to overwrite an existing proposed ledger', async (t) => {
  const f = await fixture(t);
  await writeFile(f.paths.out, 'KEEP THIS FILE');

  await assert.rejects(
    f.run,
    (error) => error.code === 'EEXIST',
  );

  assert.equal(await readFile(f.paths.out, 'utf8'), 'KEEP THIS FILE');
  assert.equal(await readFile(f.paths.ledger, 'utf8'), f.ledgerText);
});

test('rejects the wrong node owner at the snapshot', async (t) => {
  const f = await fixture(t);

  f.rpcClient.readContract = async ({ functionName }) =>
    functionName === 'ownerOf' ? WALLET : 100000000n;

  await rejectsWithoutWriting(f, /snapshot owner or stake mismatch/);
});

test('rejects altered allocation amounts even with a valid receipt', async (t) => {
  const f = await fixture(t);

  f.preview.drafts[0].positions[0].allocatedBaseUnits = '9999999';
  await f.savePreview();

  await rejectsWithoutWriting(f, /does not match the recalculated/);
});