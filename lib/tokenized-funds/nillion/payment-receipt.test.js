// lib/tokenized-funds/nillion/payment-receipt.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
} from 'viem';

import {
  NILLION_CONTRACTS,
} from './config.js';

import {
  verifyNillionPaymentTransfer,
} from './payment-receipt.js';

const SENDER = '0x1111111111111111111111111111111111111111';
const RECIPIENT = '0x2222222222222222222222222222222222222222';
const OTHER = '0x3333333333333333333333333333333333333333';

const TX = `0x${'a'.repeat(64)}`;
const BLOCK_HASH = `0x${'b'.repeat(64)}`;
const OTHER_HASH = `0x${'c'.repeat(64)}`;

const transferAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function fixture() {
  return {
    chainId: 1,
    transactionHash: TX,
    logIndex: '7',
    expectedSender: SENDER,
    expectedRecipient: RECIPIENT,
    expectedAmountBaseUnits: '3600000',

    receipt: {
      status: 'success',
      transactionHash: TX,
      blockNumber: 100n,
      blockHash: BLOCK_HASH,
      logs: [
        {
          address: NILLION_CONTRACTS.nilToken,
          transactionHash: TX,
          blockNumber: 100n,
          blockHash: BLOCK_HASH,
          logIndex: 7,
          removed: false,
          topics: encodeEventTopics({
            abi: transferAbi,
            eventName: 'Transfer',
            args: {
              from: SENDER,
              to: RECIPIENT,
            },
          }),
          data: encodeAbiParameters(
            [{ type: 'uint256' }],
            [3600000n],
          ),
        },
      ],
    },

    canonicalBlock: {
      number: 100n,
      hash: BLOCK_HASH,
    },

    finalizedBlock: {
      number: 110n,
      hash: OTHER_HASH,
    },
  };
}

test('verifies a matching finalized NIL transfer', () => {
  const result = verifyNillionPaymentTransfer(fixture());

  assert.equal(result.eventId, `1:${TX}:7`);
  assert.equal(result.from, SENDER);
  assert.equal(result.to, RECIPIENT);
  assert.equal(result.amountBaseUnits, '3600000');
  assert.equal(result.finality, 'finalized');
});

test('does not mutate inputs and returns JSON-safe evidence', () => {
  const args = fixture();
  const before = structuredClone(args);

  const result = verifyNillionPaymentTransfer(args);

  assert.deepEqual(args, before);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('rejects another chain', () => {
  const args = fixture();
  args.chainId = 137;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /Ethereum mainnet/,
  );
});

test('rejects failed receipts', () => {
  const args = fixture();
  args.receipt.status = 'reverted';

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /unsuccessful or mismatched/,
  );
});

test('rejects a different transaction receipt', () => {
  const args = fixture();
  args.receipt.transactionHash = OTHER_HASH;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /unsuccessful or mismatched/,
  );
});

test('rejects a different token contract', () => {
  const args = fixture();
  args.receipt.logs[0].address = OTHER;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /metadata or token contract/,
  );
});

test('rejects a different transfer sender', () => {
  const args = fixture();
  args.expectedSender = OTHER;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /sender, recipient, or amount/,
  );
});

test('rejects a different transfer recipient', () => {
  const args = fixture();
  args.expectedRecipient = OTHER;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /sender, recipient, or amount/,
  );
});

test('rejects a different amount', () => {
  const args = fixture();
  args.expectedAmountBaseUnits = '3600001';

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /sender, recipient, or amount/,
  );
});

test('rejects a missing or repeated log index', () => {
  const args = fixture();
  args.logIndex = '8';

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /exactly one payment log/,
  );

  args.logIndex = '7';
  args.receipt.logs.push({ ...args.receipt.logs[0] });

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /exactly one payment log/,
  );
});

test('rejects removed logs', () => {
  const args = fixture();
  args.receipt.logs[0].removed = true;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /metadata or token contract/,
  );
});

test('rejects a noncanonical receipt block', () => {
  const args = fixture();
  args.canonicalBlock.hash = OTHER_HASH;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /not in the canonical block/,
  );
});

test('rejects a payment newer than the finalized head', () => {
  const args = fixture();
  args.finalizedBlock.number = 99n;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /not finalized/,
  );
});

test('rejects a conflicting hash at the finalized height', () => {
  const args = fixture();
  args.finalizedBlock.number = 100n;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /Finalized block hash/,
  );
});

test('rejects zero amounts and self-transfers', () => {
  const args = fixture();
  args.expectedAmountBaseUnits = '0';

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /must be positive/,
  );

  args.expectedAmountBaseUnits = '3600000';
  args.expectedRecipient = SENDER;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /self-transfer/,
  );
});

test('rejects mismatched log block metadata', () => {
  const args = fixture();
  args.receipt.logs[0].blockHash = OTHER_HASH;

  assert.throws(
    () => verifyNillionPaymentTransfer(args),
    /metadata or token contract/,
  );
});