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

/**
 * Decodes and validates a persisted unsigned V10 create_payout_round group.
 *
 * This function does not obtain suggested parameters, rebuild a replacement
 * group, sign, submit, or broadcast. It validates the exact durable unsigned
 * transaction bytes that will be presented to the wallet for signing.
 */
export function rebuildV10CreatePayoutRoundGroupFromUnsignedTransactions({
  unsignedTransactionsBase64,
  appId,
  poolKey,
  sender,
  roundPayees,
  totalUsdcAtomicUnits,
  nextRoundId,
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
  const normalizedPayees = normalizeRoundPayees(
    roundPayees,
    normalizedTotal,
  );

  if (
    !Array.isArray(unsignedTransactionsBase64) ||
    unsignedTransactionsBase64.length !== 2
  ) {
    throw new TypeError(
      'unsignedTransactionsBase64 must contain exactly two transactions',
    );
  }

  const normalizedUnsignedTransactionsBase64 =
    unsignedTransactionsBase64.map((encodedTransaction, index) => {
      if (
        typeof encodedTransaction !== 'string' ||
        !encodedTransaction.trim()
      ) {
        throw new TypeError(
          `unsignedTransactionsBase64[${index}] must be a non-empty base64 string`,
        );
      }

      return encodedTransaction;
    });

  let appCall;
  let companionPayment;

  try {
    appCall = algosdk.decodeUnsignedTransaction(
      Buffer.from(normalizedUnsignedTransactionsBase64[0], 'base64'),
    );
    companionPayment = algosdk.decodeUnsignedTransaction(
      Buffer.from(normalizedUnsignedTransactionsBase64[1], 'base64'),
    );
  } catch (cause) {
    throw new TypeError(
      'unsignedTransactionsBase64 must contain valid Algorand unsigned transactions',
      { cause },
    );
  }

  const appCallGroupId = Buffer.from(appCall.group ?? []).toString(
    'base64',
  );
  const companionPaymentGroupId = Buffer.from(
    companionPayment.group ?? [],
  ).toString('base64');

  if (!appCallGroupId || !companionPaymentGroupId) {
    throw new Error(
      'Persisted payout-round transactions must both belong to a group',
    );
  }

  if (appCallGroupId !== companionPaymentGroupId) {
    throw new Error(
      'Persisted payout-round transactions must belong to the same group',
    );
  }

  if (appCall.type !== 'appl') {
    throw new Error(
      'Payout-round transaction index 0 must be an application call',
    );
  }

  if (companionPayment.type !== 'pay') {
    throw new Error(
      'Payout-round transaction index 1 must be a companion payment',
    );
  }

  const appCallSenderBytes = appCall.sender?.publicKey;
  const companionPaymentSenderBytes =
    companionPayment.sender?.publicKey;

  if (!appCallSenderBytes) {
    throw new Error(
      'Payout-round application call sender is unavailable',
    );
  }

  if (!companionPaymentSenderBytes) {
    throw new Error(
      'Payout-round companion payment sender is unavailable',
    );
  }

  const appCallSender = algosdk.encodeAddress(
    appCallSenderBytes,
  );
  const companionPaymentSender = algosdk.encodeAddress(
    companionPaymentSenderBytes,
  );

  if (
    appCallSender !== normalizedSender ||
    companionPaymentSender !== normalizedSender
  ) {
    throw new Error(
      'Persisted payout-round transaction sender does not match the expected signer',
    );
  }

  const appCallAppId = Number(
    appCall.applicationCall?.appIndex ??
      appCall.appIndex,
  );

  if (appCallAppId !== normalizedAppId) {
    throw new Error(
      'Persisted payout-round application call does not target the expected app ID',
    );
  }

  const expectedAppAddress = algosdk
    .getApplicationAddress(normalizedAppId)
    .toString();

  const companionPaymentReceiver =
    companionPayment.payment?.receiver?.publicKey
      ? algosdk.encodeAddress(
          companionPayment.payment.receiver.publicKey,
        )
      : null;

  if (companionPaymentReceiver !== expectedAppAddress) {
    throw new Error(
      'Persisted payout-round companion payment does not target the application address',
    );
  }

  const expectedRoundBoxMbrMicroalgos =
    calculateV10PayoutRoundBoxMbrMicroalgos({
      poolKey: normalizedPoolKey,
      recipientCount: normalizedPayees.length,
    });

    if (
      companionPayment.payment?.amount !==
      BigInt(expectedRoundBoxMbrMicroalgos)
    ) {
      throw new Error(
        'Persisted payout-round companion payment amount does not match expected round-box MBR',
      );
    }

  const packedPayees = createV10RoundPayeesBytes({
    roundPayees: normalizedPayees,
    totalUsdcAtomicUnits: normalizedTotal,
  });

  const expectedAppArgs = [
    Buffer.from(V10_PAYOUT_ACTION, 'utf8'),
    Buffer.from(normalizedPoolKey, 'utf8'),
    Buffer.from(encodeUint64(normalizedTotal, 'totalUsdcAtomicUnits')),
    ...splitPayeeChunks(packedPayees).map((chunk) => Buffer.from(chunk)),
    Buffer.from(encodeUint64(1, 'companionPaymentIndex')),
  ];

  const appCallArgs =
    appCall.applicationCall?.appArgs ??
    appCall.appArgs;

  if (!Array.isArray(appCallArgs)) {
    throw new Error(
      'Persisted payout-round application call must contain application arguments',
    );
  }

  if (appCallArgs.length !== expectedAppArgs.length) {
    throw new Error(
      'Persisted payout-round application argument count does not match frozen payout data',
    );
  }

  for (let index = 0; index < expectedAppArgs.length; index += 1) {
    const actual = Buffer.from(appCallArgs[index]);
    const expected = expectedAppArgs[index];

    if (!actual.equals(expected)) {
      throw new Error(
        `Persisted payout-round application argument ${index} does not match frozen payout data`,
      );
    }
  }

  const appCallBoxes =
    appCall.applicationCall?.boxes ??
    appCall.boxes;

  if (!Array.isArray(appCallBoxes) || appCallBoxes.length !== 2) {
    throw new Error(
      'Persisted payout-round application call must reference exactly two boxes',
    );
  }

  const expectedPoolBox = Buffer.from(
    createV10PoolBoxName(normalizedPoolKey),
  );
  const expectedRoundBox = Buffer.from(
    createV10RoundBoxName(normalizedPoolKey, normalizedNextRoundId),
  );

  const [poolBox, roundBox] = appCallBoxes;

    const poolBoxAppIndex = Number(
    poolBox.appIndex ?? poolBox.app ?? poolBox.index,
  );
  const roundBoxAppIndex = Number(
    roundBox.appIndex ?? roundBox.app ?? roundBox.index,
  );

  const poolBoxName = poolBox.name ?? poolBox.n;
  const roundBoxName = roundBox.name ?? roundBox.n;

  if (
    poolBoxAppIndex !== 0 ||
    !poolBoxName ||
    !Buffer.from(poolBoxName).equals(expectedPoolBox)
  ) {
    throw new Error(
      'Persisted payout-round application call pool box does not match expected pool key',
    );
  }

  if (
    roundBoxAppIndex !== 0 ||
    !roundBoxName ||
    !Buffer.from(roundBoxName).equals(expectedRoundBox)
  ) {
    throw new Error(
      'Persisted payout-round application call round box does not match expected next round ID',
    );
  }

  const reencodedUnsignedTransactionsBase64 = [
    Buffer.from(appCall.toByte()).toString('base64'),
    Buffer.from(companionPayment.toByte()).toString('base64'),
  ];

  if (
    reencodedUnsignedTransactionsBase64[0] !==
      normalizedUnsignedTransactionsBase64[0] ||
    reencodedUnsignedTransactionsBase64[1] !==
      normalizedUnsignedTransactionsBase64[1]
  ) {
    throw new Error(
      'Persisted payout-round unsigned transaction bytes are not canonically encoded',
    );
  }

  return Object.freeze({
    action: V10_PAYOUT_ACTION,
    appId: normalizedAppId,
    poolKey: normalizedPoolKey,
    sender: normalizedSender,
    appAddress: expectedAppAddress,
    totalUsdcAtomicUnits: normalizedTotal,
    recipientCount: normalizedPayees.length,
    nextRoundId: normalizedNextRoundId,
    roundPayees: normalizedPayees,
    roundPayeesHash: `sha256:${createHash('sha256')
      .update(Buffer.from(packedPayees))
      .digest('hex')}`,
    roundBoxMbrMicroalgos: expectedRoundBoxMbrMicroalgos,
    companionPaymentIndex: 1,
    transactionCount: 2,
    appCallTransactionIndex: 0,
    companionPaymentTransactionIndex: 1,
    groupId: appCallGroupId,
    transactionIds: Object.freeze({
      appCall: appCall.txID(),
      companionPayment: companionPayment.txID(),
    }),
    unsignedTransactionsBase64: Object.freeze(
      reencodedUnsignedTransactionsBase64,
    ),
    unsignedTransactionHash: hashUnsignedTransactions(
      reencodedUnsignedTransactionsBase64,
    ),
  });
}