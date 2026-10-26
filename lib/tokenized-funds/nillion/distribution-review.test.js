// lib/tokenized-funds/nillion/distribution-review.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
} from 'viem';

import {
  NILLION_CONTRACTS,
  NILLION_EXPECTED_OWNER,
} from './config.js';

import {
  buildNillionPayoutDraft,
  createEmptyNillionPayoutLedger,
} from './payouts.js';

import {
  reviewNillionDistributionProposal,
} from './distribution-review.js';

import {
  recordNillionPayoutDraft,
  recordNillionPayment,
} from './payout-ledger.js';

const OWNER = NILLION_EXPECTED_OWNER;
const INVESTOR = '0x2222222222222222222222222222222222222222';

const TX = `0x${'a'.repeat(64)}`;
const CLAIM_BLOCK = 26134590n;
const FINALIZED = 30000000n;
const LATEST = 30000010n;

function blockHash(number) {
  return `0x${number.toString(16).padStart(64, '0')}`;
}

function fixture() {
  const ledger = createEmptyNillionPayoutLedger();

  const allocationConfig = {
    version: 3,
    managementFeeBps: 5000,
    managementFeeBasis: 'gross_rewards_operator_covers_costs',
    nodes: {
      '19': {
        stakers: [
          { id: 'operator', wallet: OWNER, amountNil: '40' },
          { id: 'investor', wallet: INVESTOR, amountNil: '40' },
          { id: 'pending', wallet: null, amountNil: '20' },
        ],
      },
    },
  };

  const draft = buildNillionPayoutDraft({
    batchId: 'review-test-batch',
    nodeId: '19',
    allocationConfig,
    onChainStakeBaseUnits: '100000000',
    expectedOwner: OWNER,
    claims: [
      {
        nodeId: '19',
        owner: OWNER,
        transactionHash: TX,
        logIndex: '7',
        blockNumber: CLAIM_BLOCK.toString(),
        blockHash: blockHash(CLAIM_BLOCK),
        amountBaseUnits: '12000000',
      },
    ],
    ledger,
  });

  const state = {
    ledger,
    allocationConfig,
    drafts: [draft],
    reviewedAt: '2026-10-24T23:00:00.000Z',
  };

  const log = {
    address: NILLION_CONTRACTS.emissions,
    transactionHash: TX,
    blockNumber: CLAIM_BLOCK,
    blockHash: blockHash(CLAIM_BLOCK),
    logIndex: 7,
    removed: false,
    topics: encodeEventTopics({
      abi: parseAbi([
        'event Claimed(uint256 indexed nodeId, address indexed owner, uint256 amount)',
      ]),
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
  };

  const receipt = {
    status: 'success',
    transactionHash: TX,
    blockNumber: CLAIM_BLOCK,
    blockHash: blockHash(CLAIM_BLOCK),
    logs: [log],
  };

  const reads = [];

  const client = {
    async getChainId() {
      return 1;
    },

    async getBlock({ blockTag, blockNumber }) {
      const number = blockTag === 'latest'
        ? LATEST
        : blockTag === 'finalized'
          ? FINALIZED
          : blockNumber;

      return {
        number,
        hash: blockHash(number),
      };
    },

    async getStorageAt() {
      return (
        '0x' +
        '0'.repeat(24) +
        'd9d71b6c4b7c2c03eb7f1dbb3d509f54483e5f7c'
      );
    },

    async getTransactionReceipt() {
      return structuredClone(receipt);
    },

    async readContract(request) {
      reads.push(request);

      if (request.functionName === 'ownerOf') return OWNER;
      if (request.functionName === 'stakeOf') return 100000000n;
      if (request.functionName === 'balanceOf') return 6000000n;

      throw new Error('Unexpected contract read.');
    },
  };

  return {
    state,
    receipt,
    reads,
    client,
    loadState: async () => structuredClone(state),
  };
}

async function review(f) {
  return reviewNillionDistributionProposal({
    loadState: f.loadState,
    client: f.client,
  });
}

test('verifies claims, node state, and reserves without approving execution', async () => {
  const f = fixture();
  const before = JSON.stringify(f.state);

  const result = await review(f);

  assert.equal(result.status, 'verified_for_human_review');
  assert.equal(result.approved, false);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.verification.verifiedClaimCount, 1);
  assert.equal(result.verification.ownerNilBalanceBaseUnits, '6000000');
  assert.equal(result.verification.requiredOutstandingReserveBaseUnits, '6000000');
  assert.equal(result.verification.ethGasBalanceChecked, false);
  assert.equal(JSON.stringify(f.state), before);

  assert.ok(f.reads.every((request) => request.blockNumber === LATEST));
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('rejects another chain', async () => {
  const f = fixture();
  f.client.getChainId = async () => 137;

  await assert.rejects(review(f), /not Ethereum mainnet/);
});

test('rejects a changed implementation', async () => {
  const f = fixture();
  f.client.getStorageAt = async () => `0x${'0'.repeat(64)}`;

  await assert.rejects(review(f), /implementation changed/);
});

test('rejects a changed node owner', async () => {
  const f = fixture();
  const original = f.client.readContract;

  f.client.readContract = async (request) =>
    request.functionName === 'ownerOf'
      ? INVESTOR
      : original(request);

  await assert.rejects(review(f), /node owner does not match/);
});

test('rejects stake that no longer matches current allocations', async () => {
  const f = fixture();
  const original = f.client.readContract;

  f.client.readContract = async (request) =>
    request.functionName === 'stakeOf'
      ? 99000000n
      : original(request);

  await assert.rejects(review(f), /allocations do not match on-chain stake/);
});

test('rejects insufficient NIL reserves', async () => {
  const f = fixture();
  const original = f.client.readContract;

  f.client.readContract = async (request) =>
    request.functionName === 'balanceOf'
      ? 5999999n
      : original(request);

  await assert.rejects(review(f), /does not cover outstanding reserves/);
});

test('rejects failed claim receipts', async () => {
  const f = fixture();
  f.receipt.status = 'reverted';

  await assert.rejects(review(f), /Receipt is failed/);
});

test('rejects a claim that is not finalized', async () => {
  const f = fixture();
  f.receipt.blockNumber = FINALIZED + 1n;

  await assert.rejects(review(f), /not finalized/);
});

test('rejects a noncanonical claim receipt', async () => {
  const f = fixture();
  f.receipt.blockHash = `0x${'f'.repeat(64)}`;

  await assert.rejects(review(f), /not in the canonical block/);
});

test('rejects missing, duplicate, and removed claim logs', async () => {
  for (const mode of ['missing', 'duplicate', 'removed']) {
    const f = fixture();

    if (mode === 'missing') {
      f.receipt.logs = [];
    } else if (mode === 'duplicate') {
      f.receipt.logs.push(structuredClone(f.receipt.logs[0]));
    } else {
      f.receipt.logs[0].removed = true;
    }

    await assert.rejects(
      review(f),
      /exactly one referenced claim log|Claim log metadata/,
    );
  }
});

test('rejects another emitting contract and an altered event amount', async () => {
  const wrongContract = fixture();
  wrongContract.receipt.logs[0].address = NILLION_CONTRACTS.nilToken;

  await assert.rejects(review(wrongContract), /emitting contract mismatch/);

  const wrongAmount = fixture();
  wrongAmount.receipt.logs[0].data = encodeAbiParameters(
    [{ type: 'uint256' }],
    [9999999n],
  );

  await assert.rejects(review(wrongAmount), /event values do not match/);
});

test('rejects source state changing during review', async () => {
  const f = fixture();
  let calls = 0;

  f.loadState = async () => {
    calls += 1;

    const state = structuredClone(f.state);

    if (calls > 1) {
      state.allocationConfig.version = 4;
      state.drafts[0].allocationVersion = 4;
    }

    return state;
  };

  await assert.rejects(review(f), /source state changed during review/);
});

test('rejects a review anchor changing during verification', async () => {
  const f = fixture();
  const original = f.client.getBlock;

  f.client.getBlock = async (request) => {
    const block = await original(request);

    if (request.blockNumber === LATEST) {
      return { ...block, hash: `0x${'e'.repeat(64)}` };
    }

    return block;
  };

  await assert.rejects(review(f), /Review chain anchor changed/);
});

test('empty preclaim state does not invent a payable proposal', async () => {
  const f = fixture();
  f.state.drafts = [];

  const result = await review(f);

  assert.equal(result.status, 'nothing_to_review');
  assert.equal(result.verification.verifiedClaimCount, 0);
  assert.equal(result.verification.requiredOutstandingReserveBaseUnits, '0');
  assert.deepEqual(result.proposal.transfers, []);
  assert.equal(result.approved, false);
});

const PAYMENT_TX = `0x${'c'.repeat(64)}`;
const PAYMENT_BLOCK = CLAIM_BLOCK + 1n;

function fixtureWithRecordedPayment() {
  const f = fixture();

  const recordedLedger = recordNillionPayoutDraft({
    ledger: f.state.ledger,
    draft: f.state.drafts[0],
    allocationConfig: f.state.allocationConfig,
    expectedOwner: OWNER,
    reviewedAt: f.state.reviewedAt,
  });

  const paymentLog = {
    address: NILLION_CONTRACTS.nilToken,
    transactionHash: PAYMENT_TX,
    blockNumber: PAYMENT_BLOCK,
    blockHash: blockHash(PAYMENT_BLOCK),
    logIndex: 9,
    removed: false,
    topics: encodeEventTopics({
      abi: parseAbi([
        'event Transfer(address indexed from, address indexed to, uint256 value)',
      ]),
      eventName: 'Transfer',
      args: {
        from: OWNER,
        to: INVESTOR,
      },
    }),
    data: encodeAbiParameters(
      [{ type: 'uint256' }],
      [1000000n],
    ),
  };

  const paymentReceipt = {
    status: 'success',
    transactionHash: PAYMENT_TX,
    blockNumber: PAYMENT_BLOCK,
    blockHash: blockHash(PAYMENT_BLOCK),
    logs: [paymentLog],
  };

  f.state.ledger = recordNillionPayment({
    ledger: recordedLedger,

    verification: {
      chainId: 1,
      transactionHash: PAYMENT_TX,
      logIndex: '9',
      expectedSender: OWNER,
      expectedRecipient: INVESTOR,
      expectedAmountBaseUnits: '1000000',
      receipt: structuredClone(paymentReceipt),
      canonicalBlock: {
        number: PAYMENT_BLOCK,
        hash: blockHash(PAYMENT_BLOCK),
      },
      finalizedBlock: {
        number: FINALIZED,
        hash: blockHash(FINALIZED),
      },
    },

    allocations: [
      {
        batchId: 'review-test-batch',
        positionId: 'investor',
        amountBaseUnits: '1000000',
      },
    ],
  });

  // The draft is now recorded; do not attempt to record it again.
  f.state.drafts = [];

  const claimReceipt = f.client.getTransactionReceipt;

  f.client.getTransactionReceipt = async ({ hash }) => {
    if (hash.toLowerCase() === PAYMENT_TX) {
      return structuredClone(paymentReceipt);
    }

    return claimReceipt({ hash });
  };

  return {
    ...f,
    paymentReceipt,
  };
}

test('freshly verifies an existing payment and proposes only the unpaid remainder', async () => {
  const f = fixtureWithRecordedPayment();
  const before = JSON.stringify(f.state);

  const result = await review(f);

  assert.equal(result.status, 'verified_for_human_review');
  assert.equal(result.verification.verifiedClaimCount, 1);
  assert.equal(result.verification.verifiedPaymentCount, 1);

  assert.equal(
    result.proposal.accounting.alreadyPaidBaseUnits,
    '1000000',
  );

  assert.equal(
    result.proposal.transfers[0].amountBaseUnits,
    '1400000',
  );

  assert.equal(
    result.verification.requiredOutstandingReserveBaseUnits,
    '5000000',
  );

  assert.equal(result.approved, false);
  assert.equal(result.executionEnabled, false);
  assert.equal(JSON.stringify(f.state), before);
});

test('checks reserves after subtracting recorded payments', async () => {
  const f = fixtureWithRecordedPayment();
  const original = f.client.readContract;

  f.client.readContract = async (request) =>
    request.functionName === 'balanceOf'
      ? 4999999n
      : original(request);

  await assert.rejects(
    review(f),
    /does not cover outstanding reserves/,
  );
});

test('rejects an existing payment whose fresh receipt is failed', async () => {
  const f = fixtureWithRecordedPayment();
  f.paymentReceipt.status = 'reverted';

  await assert.rejects(
    review(f),
    /Receipt is failed/,
  );
});

test('rejects an existing payment that is no longer finalized', async () => {
  const f = fixtureWithRecordedPayment();

  f.paymentReceipt.blockNumber = FINALIZED + 1n;
  f.paymentReceipt.blockHash = blockHash(FINALIZED + 1n);

  await assert.rejects(
    review(f),
    /not finalized/,
  );
});

test('rejects a changed recipient in the freshly fetched payment log', async () => {
  const f = fixtureWithRecordedPayment();

  f.paymentReceipt.logs[0].topics = encodeEventTopics({
    abi: parseAbi([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]),
    eventName: 'Transfer',
    args: {
      from: OWNER,
      to: '0x3333333333333333333333333333333333333333',
    },
  });

  await assert.rejects(
    review(f),
    /Transfer sender, recipient, or amount does not match/,
  );
});

test('rejects a changed amount in the freshly fetched payment log', async () => {
  const f = fixtureWithRecordedPayment();

  f.paymentReceipt.logs[0].data = encodeAbiParameters(
    [{ type: 'uint256' }],
    [1000001n],
  );

  await assert.rejects(
    review(f),
    /Transfer sender, recipient, or amount does not match/,
  );
});

test('rejects a payment moved to a different canonical block than recorded', async () => {
  const f = fixtureWithRecordedPayment();
  const movedBlock = PAYMENT_BLOCK + 1n;

  f.paymentReceipt.blockNumber = movedBlock;
  f.paymentReceipt.blockHash = blockHash(movedBlock);

  f.paymentReceipt.logs[0].blockNumber = movedBlock;
  f.paymentReceipt.logs[0].blockHash = blockHash(movedBlock);

  await assert.rejects(
    review(f),
    /differs from the recorded settlement reference/,
  );
});

test('rejects a removed payment log during fresh verification', async () => {
  const f = fixtureWithRecordedPayment();
  f.paymentReceipt.logs[0].removed = true;

  await assert.rejects(
    review(f),
    /Payment log metadata or token contract does not match/,
  );
});