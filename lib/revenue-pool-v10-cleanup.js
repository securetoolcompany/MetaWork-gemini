import algosdk from 'algosdk';
import { createHash } from 'node:crypto';

import { createV10RoundBoxName } from './revenue-pool-v10-payout.js';

export const V10_CLEANUP_ACTION = 'cleanup_round';

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function assertSafeInteger(value, fieldName, { minimum = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(
      `${fieldName} must be a safe integer greater than or equal to ${minimum}`,
    );
  }

  return value;
}

function assertValidAddress(value, fieldName) {
  const address = assertNonEmptyString(value, fieldName);

  if (!algosdk.isValidAddress(address)) {
    throw new TypeError(`${fieldName} must be a valid Algorand address`);
  }

  return address;
}

function encodeUint64(value, fieldName) {
  const normalized = assertSafeInteger(value, fieldName, {
    minimum: 0,
  });
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(normalized));

  return new Uint8Array(bytes);
}

/**
 * Builds one unsigned V10 cleanup_round application call.
 *
 * The contract deletes the referenced payout-round box and returns that
 * box's minimum-balance reserve to the admin sender by inner ALGO payment.
 * No companion payment or atomic transaction group is required.
 */
export function buildUnsignedV10CleanupRoundTransaction({
  appId,
  poolKey,
  roundId,
  sender,
  suggestedParams,
}) {
  const normalizedAppId = assertSafeInteger(appId, 'appId', {
    minimum: 1,
  });
  const normalizedPoolKey = assertNonEmptyString(poolKey, 'poolKey');
  const normalizedRoundId = assertSafeInteger(roundId, 'roundId', {
    minimum: 1,
  });
  const normalizedSender = assertValidAddress(sender, 'sender');

  if (!suggestedParams || typeof suggestedParams !== 'object') {
    throw new TypeError('suggestedParams must be an object');
  }

  const appAddress = algosdk.getApplicationAddress(normalizedAppId);

    const cleanupSuggestedParams = {
        ...suggestedParams,
        flatFee: true,
        fee: 2_000,
    };

  const transaction = algosdk.makeApplicationNoOpTxnFromObject({
    sender: normalizedSender,
    appIndex: normalizedAppId,
    appArgs: [
      new Uint8Array(Buffer.from(V10_CLEANUP_ACTION, 'utf8')),
      new Uint8Array(Buffer.from(normalizedPoolKey, 'utf8')),
      encodeUint64(normalizedRoundId, 'roundId'),
    ],
    boxes: [
      {
        appIndex: 0,
        name: createV10RoundBoxName(
          normalizedPoolKey,
          normalizedRoundId,
        ),
      },
    ],
    suggestedParams: cleanupSuggestedParams,
  });

  const unsignedTransactionBase64 = Buffer.from(
    transaction.toByte(),
  ).toString('base64');

  return Object.freeze({
    action: V10_CLEANUP_ACTION,
    appId: normalizedAppId,
    poolKey: normalizedPoolKey,
    roundId: normalizedRoundId,
    sender: normalizedSender,
    appAddress,

    transactionCount: 1,
    transactionId: transaction.txID(),

    unsignedTransactionBase64,
    unsignedTransactionHash: `sha256:${createHash('sha256')
      .update(unsignedTransactionBase64)
      .digest('hex')}`,
  });
}