import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  V10DepositLivePreflightError,
  preflightLiveV10Deposit,
} from './revenue-pool-v10-deposit-preflight-live.js';

const APP_ID = 769218532;
const USDC_ASSET_ID = 10458941;
const REV_ASSET_ID = 8001;
const POOL_KEY = 'ip-asset-a';
const DEPOSIT_AMOUNT = 5_330_000;

const adminAddress = algosdk.generateAccount().addr.toString();
const appAddress = algosdk
  .getApplicationAddress(APP_ID)
  .toString();

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

function makeBatch(overrides = {}) {
  return {
    _id: 'batch-1',
    status: 'recipient_snapshot_prepared',
    revenuePoolAppId: APP_ID,
    poolKey: POOL_KEY,
    revenueTokenAssetId: REV_ASSET_ID,
    totalAllocationCents: 533,
    totalUsdcAtomicUnits: DEPOSIT_AMOUNT,
    ...overrides,
  };
}

function makeApplication(admin = adminAddress) {
  return {
    params: {
      'global-state': [
        {
          key: Buffer.from('admin').toString('base64'),
          value: {
            bytes: Buffer.from(
              algosdk.decodeAddress(admin).publicKey,
            ).toString('base64'),
          },
        },
      ],
    },
  };
}

function encodePoolBox({
  revenueTokenAssetId = REV_ASSET_ID,
  proxyAddress = null,
} = {}) {
  const bytes = new Uint8Array(73 + 35);
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  view.setBigUint64(0, BigInt(revenueTokenAssetId), false);
  view.setBigUint64(8, 400_000n, false);
  view.setBigUint64(24, 0n, false);
  view.setBigUint64(32, 3n, false);
  bytes[40] = 1;

  if (proxyAddress) {
    bytes.set(
      algosdk.decodeAddress(proxyAddress).publicKey,
      41,
    );
  }

  bytes.set(
    algosdk.decodeAddress(adminAddress).publicKey,
    73,
  );
  bytes[105] = 0x27;
  bytes[106] = 0x10;
  bytes[107] = 0;

  return bytes;
}

function makeAccount({
  algoBalance = 1_000_000n,
  usdcBalance = 10_000_000n,
  includeUsdc = true,
} = {}) {
  return {
    amount: algoBalance,
    assets: includeUsdc
      ? [
          {
            'asset-id': USDC_ASSET_ID,
            amount: usdcBalance,
          },
        ]
      : [],
  };
}

function createAlgodClient({
  application = makeApplication(),
  poolBoxValue = encodePoolBox(),
  appAccount = makeAccount({ usdcBalance: 0n }),
  depositorAccount = makeAccount(),
  failures = {},
} = {}) {
  const calls = {
    application: [],
    box: [],
    accounts: [],
  };

  return {
    calls,

    getApplicationByID(applicationId) {
      calls.application.push(applicationId);

      return {
        async do() {
          if (failures.application) {
            throw failures.application;
          }

          return application;
        },
      };
    },

    getApplicationBoxByName(applicationId, boxName) {
      calls.box.push({
        applicationId,
        boxName: new Uint8Array(boxName),
      });

      return {
        async do() {
          if (failures.poolBox) {
            throw failures.poolBox;
          }

          return { value: poolBoxValue };
        },
      };
    },

    accountInformation(address) {
      calls.accounts.push(address);

      return {
        async do() {
          if (address === appAddress) {
            if (failures.appAccount) {
              throw failures.appAccount;
            }

            return appAccount;
          }

          if (address === adminAddress) {
            if (failures.depositorAccount) {
              throw failures.depositorAccount;
            }

            return depositorAccount;
          }

          throw new Error(`Unexpected account read: ${address}`);
        },
      };
    },
  };
}

function createDependencies({
  algodClient,
  suggestedParams = makeSuggestedParams(),
} = {}) {
  const signer = {
    address: adminAddress,
    signTxn() {
      throw new Error('signTxn must never be called by preflight');
    },
    signTxns() {
      throw new Error('signTxns must never be called by preflight');
    },
  };

  return {
    algodClient,
    signer,
    environment: {
      NEXT_PUBLIC_REVENUE_POOL_APP_ID: String(APP_ID),
    },
    getAlgodClientFn() {
      throw new Error(
        'getAlgodClientFn must not be called when algodClient is injected',
      );
    },
    getSignerFn() {
      throw new Error(
        'getSignerFn must not be called when signer is injected',
      );
    },
    getUsdcAssetIdFn(network) {
      assert.equal(network, 'testnet');
      return USDC_ASSET_ID;
    },
    async getTransactionParamsFn() {
      return suggestedParams;
    },
  };
}

test('reads Algod state and returns a V10 unsigned deposit proposal', async () => {
  const algodClient = createAlgodClient();
  const result = await preflightLiveV10Deposit({
    batch: makeBatch(),
    ...createDependencies({ algodClient }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.proposedGroup.action, 'deposit_usdc');
  assert.equal(result.proposedGroup.transactionCount, 2);
  assert.equal(result.unsignedGroup.transactions.length, 2);

  assert.deepEqual(algodClient.calls.application, [APP_ID]);
  assert.equal(algodClient.calls.box.length, 1);
  assert.equal(
    algodClient.calls.box[0].applicationId,
    APP_ID,
  );
  assert.deepEqual(
    Array.from(algodClient.calls.box[0].boxName),
    Array.from(Buffer.from(`p_${POOL_KEY}`)),
  );
  assert.deepEqual(
    algodClient.calls.accounts,
    [appAddress, adminAddress],
  );

  assert.deepEqual(result.liveReadMetadata, {
    network: 'testnet',
    revenuePoolAppId: APP_ID,
    poolKey: POOL_KEY,
    appAddress,
    depositorAddress: adminAddress,
    usdcAssetId: USDC_ASSET_ID,
    expectedRevenuePoolAppId: APP_ID,
  });
});

test('does not invoke signer methods, sign, or submit', async () => {
  const algodClient = createAlgodClient();
  const dependencies = createDependencies({ algodClient });

  const result = await preflightLiveV10Deposit({
    batch: makeBatch(),
    ...dependencies,
  });

  assert.equal(result.ok, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result,
      'signedTransactions',
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result,
      'submission',
    ),
    false,
  );
});

test('rejects invalid batch status before any Algod read', async () => {
  const algodClient = createAlgodClient();

  await assert.rejects(
    () =>
      preflightLiveV10Deposit({
        batch: makeBatch({ status: 'created' }),
        ...createDependencies({ algodClient }),
      }),
    (error) =>
      error instanceof V10DepositLivePreflightError &&
      error.code === 'INVALID_BATCH_STATUS',
  );

  assert.deepEqual(algodClient.calls.application, []);
  assert.deepEqual(algodClient.calls.box, []);
  assert.deepEqual(algodClient.calls.accounts, []);
});

test('rejects non-reconciling frozen batch money before any Algod read', async () => {
  const algodClient = createAlgodClient();

  await assert.rejects(
    () =>
      preflightLiveV10Deposit({
        batch: makeBatch({
          totalUsdcAtomicUnits: DEPOSIT_AMOUNT - 1,
        }),
        ...createDependencies({ algodClient }),
      }),
    (error) =>
      error instanceof V10DepositLivePreflightError &&
      error.code === 'BATCH_TOTAL_MISMATCH',
  );

  assert.deepEqual(algodClient.calls.application, []);
  assert.deepEqual(algodClient.calls.box, []);
  assert.deepEqual(algodClient.calls.accounts, []);
});

test('rejects missing expected V10 app configuration before Algod reads', async () => {
  const algodClient = createAlgodClient();
  const dependencies = createDependencies({ algodClient });

  await assert.rejects(
    () =>
      preflightLiveV10Deposit({
        batch: makeBatch(),
        ...dependencies,
        environment: {},
      }),
    (error) =>
      error instanceof V10DepositLivePreflightError &&
      error.code === 'MISSING_EXPECTED_APP_ID',
  );

  assert.deepEqual(algodClient.calls.application, []);
});

test('fails closed when any required Algod read fails', async () => {
  const algodClient = createAlgodClient({
    failures: {
      poolBox: new Error('box unavailable'),
    },
  });

  await assert.rejects(
    () =>
      preflightLiveV10Deposit({
        batch: makeBatch(),
        ...createDependencies({ algodClient }),
      }),
    (error) =>
      error instanceof V10DepositLivePreflightError &&
      error.code === 'ALGOD_READ_FAILED' &&
      /pool box/.test(error.message),
  );
});

test('uses explicit depositor address without calling getSigner', async () => {
  const algodClient = createAlgodClient();
  const dependencies = createDependencies({ algodClient });

  const result = await preflightLiveV10Deposit({
    batch: makeBatch(),
    depositorAddress: adminAddress,
    ...dependencies,
    signer: null,
    getSignerFn() {
      throw new Error(
        'getSignerFn must not be called with depositorAddress',
      );
    },
  });

  assert.equal(result.ok, true);
  assert.equal(
    result.liveReadMetadata.depositorAddress,
    adminAddress,
  );
});