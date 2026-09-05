import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  V10DepositValidationError,
  V10_APP_CALL_TRANSACTION_INDEX,
  V10_DEPOSIT_USDC_ACTION,
  V10_USDC_TRANSFER_TRANSACTION_INDEX,
  buildV10DepositUsdcGroup,
  getV10PoolBoxName,
  getV10PreparedGroupMetadata,
  rebuildV10DepositGroupFromUnsignedTransactions,
} from './revenue-pool-v10-deposit.js';

const APP_ID = 7001;
const USDC_ASSET_ID = 10458941;
const REV_ASSET_ID = 8001;
const POOL_KEY = 'ip-asset-a';
const DEPOSIT_AMOUNT = 5_330_000;

function makeSuggestedParams() {
  return {
    fee: 1000n,
    minFee: 1000n,
    firstValid: 100n,
    lastValid: 1100n,
    genesisHash: new Uint8Array(32).fill(1),
    genesisID: 'testnet-v1.0',
    flatFee: false,
  };
}

function makeInput(overrides = {}) {
  return {
    revenuePoolAppId: APP_ID,
    usdcAssetId: USDC_ASSET_ID,
    depositorAddress: algosdk.generateAccount().addr.toString(),
    poolKey: POOL_KEY,
    usdcAtomicUnits: DEPOSIT_AMOUNT,
    suggestedParams: makeSuggestedParams(),
    ...overrides,
  };
}

function decodeUnsignedTransactions(metadata) {
  return metadata.unsignedTransactionsBase64.map((encodedTransaction) =>
    algosdk.decodeUnsignedTransaction(
      new Uint8Array(Buffer.from(encodedTransaction, 'base64')),
    ),
  );
}

test('builds the exact V10 two-transaction deposit group', () => {
  const input = makeInput();

  const result = buildV10DepositUsdcGroup(input);

  assert.equal(result.transactionCount, 2);
  assert.equal(
    result.usdcTransferTransactionIndex,
    V10_USDC_TRANSFER_TRANSACTION_INDEX,
  );
  assert.equal(
    result.appCallTransactionIndex,
    V10_APP_CALL_TRANSACTION_INDEX,
  );
  assert.equal(result.amountUsdcAtomicUnits, DEPOSIT_AMOUNT);
  assert.match(result.groupId, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.match(result.transactionIds.usdcTransfer, /^[A-Z0-9]+$/);
  assert.match(result.transactionIds.appCall, /^[A-Z0-9]+$/);
  assert.match(result.unsignedTransactionHash, /^sha256:[a-f0-9]{64}$/);

  const [transferTxn, appCallTxn] = result.transactions;

  assert.equal(transferTxn.type, 'axfer');
  assert.equal(appCallTxn.type, 'appl');

  assert.equal(
    Buffer.from(appCallTxn.applicationCall.appArgs[0]).toString(),
    V10_DEPOSIT_USDC_ACTION,
  );
  assert.equal(
    Buffer.from(appCallTxn.applicationCall.appArgs[1]).toString(),
    POOL_KEY,
  );

  const companionIndexBytes =
    appCallTxn.applicationCall.appArgs[2];

  assert.equal(companionIndexBytes.length, 8);
  assert.equal(
    new DataView(
      companionIndexBytes.buffer,
      companionIndexBytes.byteOffset,
      companionIndexBytes.byteLength,
    ).getBigUint64(0, false),
    0n,
  );

  assert.deepEqual(
    Array.from(appCallTxn.applicationCall.boxes[0].name),
    Array.from(getV10PoolBoxName(POOL_KEY)),
  );

  assert.deepEqual(
    appCallTxn.applicationCall.foreignAssets,
    [BigInt(USDC_ASSET_ID)],
  );

  assert.equal(
    result.target.revenuePoolAppId,
    APP_ID,
  );
  assert.equal(result.target.poolKey, POOL_KEY);
  assert.equal(result.target.usdcAssetId, USDC_ASSET_ID);
  assert.equal(result.target.revenueTokenAssetId, null);
});

test('transfers exactly the frozen USDC atomic-unit amount to the app address', () => {
  const input = makeInput();
  const result = buildV10DepositUsdcGroup(input);
  const transferTxn = result.transactions[0];

  assert.equal(
    transferTxn.assetTransfer.assetIndex,
    BigInt(USDC_ASSET_ID),
  );
  assert.equal(
    transferTxn.assetTransfer.amount,
    BigInt(DEPOSIT_AMOUNT),
  );
  assert.equal(
    transferTxn.assetTransfer.receiver.toString(),
    algosdk.getApplicationAddress(APP_ID).toString(),
  );
});

test('returns deterministic group and transaction IDs for identical frozen inputs', () => {
  const address = algosdk.generateAccount().addr.toString();
  const input = makeInput({ depositorAddress: address });

  const first = buildV10DepositUsdcGroup(input);
  const second = buildV10DepositUsdcGroup(input);

  assert.equal(first.groupId, second.groupId);
  assert.deepEqual(first.transactionIds, second.transactionIds);
  assert.equal(
    first.unsignedTransactionHash,
    second.unsignedTransactionHash,
  );
  assert.deepEqual(
    first.unsignedTransactionsBase64,
    second.unsignedTransactionsBase64,
  );
});

test('rebuilds an identical V10 deposit group from persisted unsigned transaction bytes', () => {
  const input = makeInput();
  const built = buildV10DepositUsdcGroup(input);

  const rebuilt = rebuildV10DepositGroupFromUnsignedTransactions({
    unsignedTransactionsBase64: built.unsignedTransactionsBase64,
    target: {
      revenuePoolAppId: APP_ID,
      poolKey: POOL_KEY,
      revenueTokenAssetId: REV_ASSET_ID,
      usdcAssetId: USDC_ASSET_ID,
    },
    usdcAtomicUnits: DEPOSIT_AMOUNT,
  });

  assert.equal(rebuilt.groupId, built.groupId);
  assert.deepEqual(rebuilt.transactionIds, built.transactionIds);
  assert.equal(
    rebuilt.unsignedTransactionHash,
    built.unsignedTransactionHash,
  );
  assert.deepEqual(
    rebuilt.unsignedTransactionsBase64,
    built.unsignedTransactionsBase64,
  );
  assert.equal(rebuilt.target.revenueTokenAssetId, REV_ASSET_ID);
});

test('rejects invalid app ID, USDC asset ID, pool key, address, and amount inputs', () => {
  const address = algosdk.generateAccount().addr.toString();

  const invalidInputs = [
    {
      revenuePoolAppId: 0,
      expectedCode: 'INVALID_INTEGER',
    },
    {
      usdcAssetId: 0,
      expectedCode: 'INVALID_INTEGER',
    },
    {
      poolKey: '',
      expectedCode: 'INVALID_POOL_KEY',
    },
    {
      poolKey: 'a'.repeat(51),
      expectedCode: 'INVALID_POOL_KEY',
    },
    {
      depositorAddress: 'not-an-address',
      expectedCode: 'INVALID_ADDRESS',
    },
    {
      usdcAtomicUnits: 0,
      expectedCode: 'INVALID_INTEGER',
    },
    {
      usdcAtomicUnits: Number.MAX_SAFE_INTEGER + 1,
      expectedCode: 'INVALID_INTEGER',
    },
    {
      suggestedParams: null,
      expectedCode: 'INVALID_SUGGESTED_PARAMS',
    },
  ];

  for (const invalidInput of invalidInputs) {
    assert.throws(
      () =>
        buildV10DepositUsdcGroup(
          makeInput({
            depositorAddress: address,
            ...invalidInput,
          }),
        ),
      (error) =>
        error instanceof V10DepositValidationError &&
        error.code === invalidInput.expectedCode,
    );
  }
});

test('rejects wrong app-call ordering and action in prepared metadata validation', () => {
  const built = buildV10DepositUsdcGroup(makeInput());
  const transactions = decodeUnsignedTransactions(built);

  assert.throws(
    () =>
      getV10PreparedGroupMetadata({
        transactions: [transactions[1], transactions[0]],
        target: {
          revenuePoolAppId: APP_ID,
          poolKey: POOL_KEY,
          revenueTokenAssetId: REV_ASSET_ID,
          usdcAssetId: USDC_ASSET_ID,
        },
        usdcAtomicUnits: DEPOSIT_AMOUNT,
      }),
    (error) =>
      error instanceof V10DepositValidationError &&
      error.code === 'INVALID_TRANSACTION_ORDER',
  );

  const mutated = decodeUnsignedTransactions(built);

  mutated[1].applicationCall.appArgs[0] =
    new TextEncoder().encode('invalid_deposit_action');

  assert.throws(
    () =>
      getV10PreparedGroupMetadata({
        transactions: mutated,
        target: {
          revenuePoolAppId: APP_ID,
          poolKey: POOL_KEY,
          revenueTokenAssetId: REV_ASSET_ID,
          usdcAssetId: USDC_ASSET_ID,
        },
        usdcAtomicUnits: DEPOSIT_AMOUNT,
      }),
    (error) =>
      error instanceof V10DepositValidationError &&
      error.code === 'INVALID_APP_ACTION',
  );
});

test('rejects a wrong pool box, USDC asset, companion index, receiver, or amount', () => {
  const built = buildV10DepositUsdcGroup(makeInput());

  const failures = [
    {
      mutate(transactions) {
        transactions[1].applicationCall.boxes[0].name =
          getV10PoolBoxName('other-pool');
      },
      expectedCode: 'INVALID_POOL_BOX_REFERENCE',
    },
    {
      mutate(transactions) {
        transactions[1].applicationCall.foreignAssets = [
          USDC_ASSET_ID + 1,
        ];
      },
      expectedCode: 'INVALID_FOREIGN_ASSETS',
    },
    {
      mutate(transactions) {
        transactions[1].applicationCall.appArgs[2] =
          algosdk.encodeUint64(1);
      },
      expectedCode: 'INVALID_COMPANION_INDEX',
    },
    {
      mutate(transactions) {
        transactions[0].assetTransfer.amount = BigInt(
          DEPOSIT_AMOUNT - 1,
        );
      },
      expectedCode: 'USDC_AMOUNT_MISMATCH',
    },
    {
      mutate(transactions) {
        transactions[0].assetTransfer.receiver =
          algosdk.generateAccount().addr.toString();
      },
      expectedCode: 'INVALID_USDC_RECEIVER',
    },
  ];

  for (const failure of failures) {
    const transactions = decodeUnsignedTransactions(built);

    failure.mutate(transactions);

    assert.throws(
      () =>
        getV10PreparedGroupMetadata({
          transactions,
          target: {
            revenuePoolAppId: APP_ID,
            poolKey: POOL_KEY,
            revenueTokenAssetId: REV_ASSET_ID,
            usdcAssetId: USDC_ASSET_ID,
          },
          usdcAtomicUnits: DEPOSIT_AMOUNT,
        }),
      (error) =>
        error instanceof V10DepositValidationError &&
        error.code === failure.expectedCode,
    );
  }
});

test('does not sign, submit, or expose a network client in the builder API', () => {
  const result = buildV10DepositUsdcGroup(makeInput());

  assert.equal(
    typeof result.sign,
    'undefined',
  );
  assert.equal(
    typeof result.submit,
    'undefined',
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'signedTransactions'),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'algodClient'),
    false,
  );
});

test('builds an unsigned V10 unallocated USDC deposit group', () => {
  const depositor = algosdk.generateAccount().addr.toString();

  const group = buildV10DepositUsdcGroup({
    revenuePoolAppId: 7001,
    usdcAssetId: 10458941,
    depositorAddress: depositor,
    poolKey: 'pool-key-1',
    usdcAtomicUnits: 2_000_000,
    suggestedParams: makeSuggestedParams(),
  });

  assert.equal(group.transactionCount, 2);
  assert.equal(group.usdcTransferTransactionIndex, 0);
  assert.equal(group.appCallTransactionIndex, 1);
  assert.equal(group.target.revenuePoolAppId, 7001);
  assert.equal(group.target.poolKey, 'pool-key-1');
  assert.equal(group.target.usdcAssetId, 10458941);
  assert.equal(group.amountUsdcAtomicUnits, 2_000_000);
  assert.ok(group.groupId);
  assert.ok(group.unsignedTransactionHash);
  assert.ok(group.transactionIds.usdcTransfer);
  assert.ok(group.transactionIds.appCall);
  assert.equal(group.unsignedTransactionsBase64.length, 2);

  const usdcTransfer = algosdk.decodeUnsignedTransaction(
    new Uint8Array(
      Buffer.from(group.unsignedTransactionsBase64[0], 'base64'),
    ),
  );

  const appCall = algosdk.decodeUnsignedTransaction(
    new Uint8Array(
      Buffer.from(group.unsignedTransactionsBase64[1], 'base64'),
    ),
  );

  assert.equal(usdcTransfer.type, 'axfer');
  assert.equal(appCall.type, 'appl');

  assert.equal(
    Buffer.from(appCall.applicationCall.appArgs[0]).toString('utf8'),
    V10_DEPOSIT_USDC_ACTION,
  );

  assert.equal(
    Buffer.from(appCall.applicationCall.appArgs[1]).toString('utf8'),
    'pool-key-1',
  );

  assert.equal(
    algosdk.decodeUint64(appCall.applicationCall.appArgs[2]),
    0,
  );

  assert.equal(
    usdcTransfer.assetTransfer.assetIndex,
    10458941n,
  );

  assert.equal(
    usdcTransfer.assetTransfer.amount,
    2_000_000n,
  );

  assert.equal(
    usdcTransfer.assetTransfer.receiver.toString(),
    algosdk.getApplicationAddress(7001).toString(),
  );
});