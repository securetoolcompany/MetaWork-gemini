import algosdk from 'algosdk';
import { createHash } from 'node:crypto';

export const V10_USDC_ASSET_ID = 10458941;
export const V10_PAYOUT_ACTION = 'create_payout_round';
export const V10_PAYOUT_ROUND_ENTRY_BYTES = 41;
export const V10_PAYOUT_ROUND_HEADER_BYTES = 18;
export const V10_POOL_BOX_PREFIX = 'p_';
export const V10_ROUND_BOX_PREFIX = 'rnd_';
export const V10_MAX_APP_ARG_BYTES = 2048;
export const V10_BOX_MBR_BASE_MICROALGOS = 2500;
export const V10_BOX_MBR_PER_BYTE_MICROALGOS = 400;

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

function getAddressBytes(address, fieldName) {
  return Buffer.from(
    algosdk.decodeAddress(assertValidAddress(address, fieldName)).publicKey,
  );
}

function compareRecipientAddresses(left, right) {
  return Buffer.compare(
    getAddressBytes(left.address, 'left.address'),
    getAddressBytes(right.address, 'right.address'),
  );
}

function normalizeRoundPayees(roundPayees, totalUsdcAtomicUnits) {
  if (!Array.isArray(roundPayees) || roundPayees.length === 0) {
    throw new TypeError('roundPayees must contain at least one recipient');
  }

  const seen = new Set();

  const normalized = roundPayees.map((payee, index) => {
    const address = assertValidAddress(
      payee?.address,
      `roundPayees[${index}].address`,
    );
    const amountUsdcAtomicUnits = assertSafeInteger(
      payee?.amountUsdcAtomicUnits,
      `roundPayees[${index}].amountUsdcAtomicUnits`,
      { minimum: 1 },
    );

    if (seen.has(address)) {
      throw new TypeError(
        `roundPayees contains duplicate recipient address ${address}`,
      );
    }

    seen.add(address);

    return {
      address,
      amountUsdcAtomicUnits,
    };
  });

  normalized.sort(compareRecipientAddresses);

  const total = normalized.reduce(
    (sum, payee) => sum + payee.amountUsdcAtomicUnits,
    0,
  );

  if (total !== totalUsdcAtomicUnits) {
    throw new RangeError(
      'roundPayees do not reconcile to totalUsdcAtomicUnits',
    );
  }

  return Object.freeze(
    normalized.map((payee) => Object.freeze({ ...payee })),
  );
}

export function createV10PoolBoxName(poolKey) {
  return new Uint8Array(
    Buffer.concat([
      Buffer.from(V10_POOL_BOX_PREFIX, 'utf8'),
      Buffer.from(assertNonEmptyString(poolKey, 'poolKey'), 'utf8'),
    ]),
  );
}

export function createV10RoundBoxName(poolKey, roundId) {
  const normalizedPoolKey = assertNonEmptyString(poolKey, 'poolKey');
  const normalizedRoundId = assertSafeInteger(roundId, 'roundId', {
    minimum: 1,
  });

  return new Uint8Array(
    Buffer.concat([
      Buffer.from(V10_ROUND_BOX_PREFIX, 'utf8'),
      Buffer.from(normalizedPoolKey, 'utf8'),
      Buffer.from(
        encodeUint64(normalizedRoundId, 'roundId'),
      ),
    ]),
  );
}

export function createV10RoundPayeesBytes({
  roundPayees,
  totalUsdcAtomicUnits,
}) {
  const normalizedPayees = normalizeRoundPayees(
    roundPayees,
    totalUsdcAtomicUnits,
  );

  return new Uint8Array(
    Buffer.concat(
      normalizedPayees.map((payee) =>
        Buffer.concat([
          getAddressBytes(payee.address, 'payee.address'),
          Buffer.from(
            encodeUint64(
              payee.amountUsdcAtomicUnits,
              'payee.amountUsdcAtomicUnits',
            ),
          ),
        ]),
      ),
    ),
  );
}

export function calculateV10PayoutRoundBoxMbrMicroalgos({
  poolKey,
  recipientCount,
}) {
  const normalizedPoolKey = assertNonEmptyString(poolKey, 'poolKey');
  const normalizedRecipientCount = assertSafeInteger(
    recipientCount,
    'recipientCount',
    { minimum: 1 },
  );

  const roundBoxSize =
    V10_PAYOUT_ROUND_HEADER_BYTES +
    normalizedRecipientCount * V10_PAYOUT_ROUND_ENTRY_BYTES;

  return (
    V10_BOX_MBR_BASE_MICROALGOS +
    V10_BOX_MBR_PER_BYTE_MICROALGOS *
      (12 + Buffer.byteLength(normalizedPoolKey, 'utf8') + roundBoxSize)
  );
}

function splitPayeeChunks(payeeBytes) {
  const chunks = [];

  for (
    let offset = 0;
    offset < payeeBytes.length;
    offset += V10_MAX_APP_ARG_BYTES
  ) {
    chunks.push(
      new Uint8Array(
        payeeBytes.slice(
          offset,
          Math.min(offset + V10_MAX_APP_ARG_BYTES, payeeBytes.length),
        ),
      ),
    );
  }

  return chunks;
}

function hashUnsignedTransactions(unsignedTransactionsBase64) {
  return `sha256:${createHash('sha256')
    .update(unsignedTransactionsBase64.join(':'))
    .digest('hex')}`;
}

/**
 * Builds an unsigned V10 create_payout_round atomic group.
 *
 * Group transaction 0: app call.
 * Group transaction 1: companion ALGO payment to the app account that
 * supplies the payout-round box minimum balance.
 *
 * The final app argument encodes the companion payment group index: 1.
 */
export function buildUnsignedV10CreatePayoutRoundGroup({
  appId,
  poolKey,
  sender,
  roundPayees,
  totalUsdcAtomicUnits,
  nextRoundId,
  suggestedParams,
}) {
  const normalizedAppId = assertSafeInteger(appId, 'appId', {
    minimum: 1,
  });
  const normalizedPoolKey = assertNonEmptyString(poolKey, 'poolKey');
  const normalizedSender = assertValidAddress(sender, 'sender');
  const normalizedTotal = assertSafeInteger(
    totalUsdcAtomicUnits,
    'totalUsdcAtomicUnits',
    { minimum: 1 },
  );
  const normalizedNextRoundId = assertSafeInteger(
    nextRoundId,
    'nextRoundId',
    { minimum: 1 },
  );

  if (!suggestedParams || typeof suggestedParams !== 'object') {
    throw new TypeError('suggestedParams must be an object');
  }

  const normalizedPayees = normalizeRoundPayees(
    roundPayees,
    normalizedTotal,
  );

  const packedPayees = createV10RoundPayeesBytes({
    roundPayees: normalizedPayees,
    totalUsdcAtomicUnits: normalizedTotal,
  });

  const payeeChunks = splitPayeeChunks(packedPayees);
  const applicationArgCount = 3 + payeeChunks.length + 1;

  if (applicationArgCount > 16) {
    throw new RangeError(
      `create_payout_round requires ${applicationArgCount} application arguments; maximum is 16`,
    );
  }

  if (payeeChunks.length === 0) {
    throw new Error('At least one packed payee chunk is required');
  }

  const companionPaymentIndex = 1;
  const appAddress = algosdk.getApplicationAddress(normalizedAppId);

  const roundBoxMbrMicroalgos =
    calculateV10PayoutRoundBoxMbrMicroalgos({
      poolKey: normalizedPoolKey,
      recipientCount: normalizedPayees.length,
    });

  const appCall = algosdk.makeApplicationNoOpTxnFromObject({
    sender: normalizedSender,
    appIndex: normalizedAppId,
    appArgs: [
      new Uint8Array(Buffer.from(V10_PAYOUT_ACTION, 'utf8')),
      new Uint8Array(Buffer.from(normalizedPoolKey, 'utf8')),
      encodeUint64(normalizedTotal, 'totalUsdcAtomicUnits'),
      ...payeeChunks,
      encodeUint64(
        companionPaymentIndex,
        'companionPaymentIndex',
      ),
    ],
    boxes: [
      {
        appIndex: 0,
        name: createV10PoolBoxName(normalizedPoolKey),
      },
      {
        appIndex: 0,
        name: createV10RoundBoxName(
          normalizedPoolKey,
          normalizedNextRoundId,
        ),
      },
    ],
    suggestedParams,
  });

  const companionPayment = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: normalizedSender,
    receiver: appAddress,
    amount: roundBoxMbrMicroalgos,
    suggestedParams,
  });

  algosdk.assignGroupID([appCall, companionPayment]);

  const unsignedTransactionsBase64 = [
    Buffer.from(appCall.toByte()).toString('base64'),
    Buffer.from(companionPayment.toByte()).toString('base64'),
  ];

  return Object.freeze({
    action: V10_PAYOUT_ACTION,
    appId: normalizedAppId,
    poolKey: normalizedPoolKey,
    sender: normalizedSender,
    appAddress,
    usdcAssetId: V10_USDC_ASSET_ID,

    totalUsdcAtomicUnits: normalizedTotal,
    recipientCount: normalizedPayees.length,
    nextRoundId: normalizedNextRoundId,
    roundPayees: normalizedPayees,
    packedPayeesBase64: Buffer.from(packedPayees).toString('base64'),

    roundBoxMbrMicroalgos,
    companionPaymentIndex,

    transactionCount: 2,
    appCallTransactionIndex: 0,
    companionPaymentTransactionIndex: 1,

    groupId: Buffer.from(appCall.group).toString('base64'),
    transactionIds: Object.freeze({
      appCall: appCall.txID(),
      companionPayment: companionPayment.txID(),
    }),

    unsignedTransactionsBase64: Object.freeze(
      unsignedTransactionsBase64,
    ),
    unsignedTransactionHash: hashUnsignedTransactions(
      unsignedTransactionsBase64,
    ),
    roundPayeesHash: `sha256:${createHash('sha256')
      .update(Buffer.from(packedPayees))
      .digest('hex')}`,
  });
}