// lib/tokenized-funds/nillion/payment-receipt.js

import {
  decodeEventLog,
  isAddress,
  parseAbi,
} from 'viem';

import {
  NILLION_CONTRACTS,
} from './config.js';

const transferAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function hash(value, field) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw new Error(`Invalid ${field}.`);
  }

  return value.toLowerCase();
}

function address(value, field) {
  if (
    typeof value !== 'string' ||
    !isAddress(value, { strict: false }) ||
    value.toLowerCase() === ZERO_ADDRESS
  ) {
    throw new Error(`Invalid ${field}.`);
  }

  return value.toLowerCase();
}

function integer(value, field) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`Invalid ${field}.`);
  }

  return BigInt(value);
}

export function verifyNillionPaymentTransfer({
  chainId,
  transactionHash,
  logIndex,
  expectedSender,
  expectedRecipient,
  expectedAmountBaseUnits,
  receipt,
  canonicalBlock,
  finalizedBlock,
}) {
  if (chainId !== 1) {
    throw new Error('Payment verification requires Ethereum mainnet.');
  }

  const txHash = hash(transactionHash, 'transaction hash');
  const index = integer(logIndex, 'log index');
  const sender = address(expectedSender, 'expected sender');
  const recipient = address(expectedRecipient, 'expected recipient');
  const expectedAmount = integer(
    expectedAmountBaseUnits,
    'expected payment amount',
  );

  if (sender === recipient) {
    throw new Error('A self-transfer cannot settle an investor payment.');
  }

  if (expectedAmount <= 0n) {
    throw new Error('Payment amount must be positive.');
  }

  if (
    !receipt ||
    receipt.status !== 'success' ||
    hash(receipt.transactionHash, 'receipt transaction hash') !== txHash ||
    typeof receipt.blockNumber !== 'bigint' ||
    receipt.blockNumber < 0n ||
    !Array.isArray(receipt.logs)
  ) {
    throw new Error('Payment receipt is unsuccessful or mismatched.');
  }

  const receiptBlockHash = hash(
    receipt.blockHash,
    'receipt block hash',
  );

  if (
    !canonicalBlock ||
    canonicalBlock.number !== receipt.blockNumber ||
    hash(canonicalBlock.hash, 'canonical block hash') !== receiptBlockHash
  ) {
    throw new Error('Payment receipt is not in the canonical block.');
  }

  if (
    !finalizedBlock ||
    typeof finalizedBlock.number !== 'bigint' ||
    finalizedBlock.number < receipt.blockNumber
  ) {
    throw new Error('Payment block is not finalized.');
  }

  const finalizedHash = hash(finalizedBlock.hash, 'finalized block hash');

  if (
    finalizedBlock.number === receipt.blockNumber &&
    finalizedHash !== receiptBlockHash
  ) {
    throw new Error('Finalized block hash does not match the payment block.');
  }

  const matches = receipt.logs.filter(
    (log) => String(log.logIndex) === index.toString(),
  );

  if (matches.length !== 1) {
    throw new Error('Expected exactly one payment log at the specified index.');
  }

  const log = matches[0];

  if (
    log.removed ||
    address(log.address, 'log contract') !==
      NILLION_CONTRACTS.nilToken.toLowerCase() ||
    hash(log.transactionHash, 'log transaction hash') !== txHash ||
    log.blockNumber !== receipt.blockNumber ||
    hash(log.blockHash, 'log block hash') !== receiptBlockHash
  ) {
    throw new Error('Payment log metadata or token contract does not match.');
  }

  const decoded = decodeEventLog({
    abi: transferAbi,
    eventName: 'Transfer',
    topics: log.topics,
    data: log.data,
    strict: true,
  });

  if (
    address(decoded.args.from, 'transfer sender') !== sender ||
    address(decoded.args.to, 'transfer recipient') !== recipient ||
    decoded.args.value !== expectedAmount
  ) {
    throw new Error('Transfer sender, recipient, or amount does not match.');
  }

  return {
    eventId: `1:${txHash}:${index}`,
    chainId: 1,
    tokenContract: NILLION_CONTRACTS.nilToken.toLowerCase(),
    transactionHash: txHash,
    logIndex: index.toString(),
    blockNumber: receipt.blockNumber.toString(),
    blockHash: receiptBlockHash,
    from: sender,
    to: recipient,
    amountBaseUnits: expectedAmount.toString(),
    finality: 'finalized',
  };
}