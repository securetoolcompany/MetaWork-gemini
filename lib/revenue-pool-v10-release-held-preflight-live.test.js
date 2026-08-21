import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  V10ReleaseLivePreflightError,
  preflightLiveV10ReleaseHeld,
} from './revenue-pool-v10-release-held-preflight-live.js';

const APP_ID = 769218532;
const POOL_KEY = '6a8731f9cf853e8374a571ca';
const CURRENT_ROUND_ID = 3;
const STAKEHOLDER_COUNT = 2;
const HELD_USDC_ATOMIC_UNITS = 4_000_000n;

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
    status: 'deposited',
    revenuePoolAppId: APP_ID,
    poolKey: POOL_KEY,
    ...overrides,
  };
}

function encodePoolBox({
  heldUsdcAtomicUnits = HELD_USDC_ATOMIC_UNITS,
  currentRoundId = BigInt(CURRENT_ROUND_ID),
  stakeholderCount = STAKEHOLDER_COUNT,
} = {}) {
  const bytes = new Uint8Array(73 + stakeholderCount * 35);
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  view.setBigUint64(0, 8001n, false);
  view.setBigUint64(8, 0n, false);
  view.setBigUint64(
    24,
    BigInt(heldUsdcAtomicUnits),
    false,
  );
  view.setBigUint64(
    32,
    BigInt(currentRoundId),
    false,
  );
  bytes[40] = stakeholderCount;

  return bytes;
}

function makeAccount({
  algoBalance = 1_000_000n,
} = {}) {
  return {
    amount: algoBalance,
    assets: [],
  };
}

function createAlgodClient({
  application = { params: { 'global-state': [] } },
  poolBoxValue = encodePoolBox(),
  adminAccount = makeAccount(),
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
          if (address !== adminAddress) {
            throw new Error(`Unexpected account read: ${address}`);
          }

          if (failures.adminAccount) {
            throw failures.adminAccount;
          }

          return adminAccount;
        },
      };
    },
  };
}

function createDependencies({
  algodClient,
  suggestedParams = makeSuggestedParams(),
} = {}) {
  return {
    algodClient,
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
        'getSignerFn must not be called when adminAddress is supplied',
      );
    },
    async getTransactionParamsFn() {
      return suggestedParams;
    },
  };
}

test('reads live V10 state and proposes an unsigned release-held group', async () => {
  const algodClient = createAlgodClient();

  const result = await preflightLiveV10ReleaseHeld({
    batch: makeBatch(),
    adminAddress,
    ...createDependencies({ algodClient }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.proposedGroup.action, 'release_held');
  assert.equal(result.proposedGroup.transactionCount, 2);
  assert.equal(result.proposedGroup.currentRoundId, CURRENT_ROUND_ID);
  assert.equal(
    result.proposedGroup.nextRoundId,
    CURRENT_ROUND_ID + 1,
  );
  assert.equal(result.unsignedGroup.transactions.length, 2);

  const [, appCallTxn] = result.unsignedGroup.transactions;

  assert.equal(
    Buffer.from(appCallTxn.applicationCall.appArgs[0]).toString(),
    'release_held',
  );

  assert.equal(
    Buffer.from(appCallTxn.applicationCall.appArgs[1]).toString(),
    POOL_KEY,
  );

  assert.equal(
    new DataView(
      appCallTxn.applicationCall.appArgs[2].buffer,
      appCallTxn.applicationCall.appArgs[2].byteOffset,
      appCallTxn.applicationCall.appArgs[2].byteLength,
    ).getBigUint64(0, false),
    0n,
  );

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
  assert.deepEqual(algodClient.calls.accounts, [adminAddress]);

  assert.deepEqual(result.liveReadMetadata, {
    network: 'testnet',
    revenuePoolAppId: APP_ID,
    poolKey: POOL_KEY,
    appAddress,
    adminAddress,
    expectedRevenuePoolAppId: APP_ID,
  });
});

test('does not sign or submit a V10 release group', async () => {
  const algodClient = createAlgodClient();

  const result = await preflightLiveV10ReleaseHeld({
    batch: makeBatch(),
    adminAddress,
    ...createDependencies({ algodClient }),
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
    Object.prototype.hasOwnProperty.call(result, 'submission'),
    false,
  );
});

test('rejects non-deposited batch status before Algod reads', async () => {
  const algodClient = createAlgodClient();

  await assert.rejects(
    () =>
      preflightLiveV10ReleaseHeld({
        batch: makeBatch({ status: 'created' }),
        adminAddress,
        ...createDependencies({ algodClient }),
      }),
    (error) =>
      error instanceof V10ReleaseLivePreflightError &&
      error.code === 'INVALID_BATCH_STATUS',
  );

  assert.deepEqual(algodClient.calls.application, []);
  assert.deepEqual(algodClient.calls.box, []);
  assert.deepEqual(algodClient.calls.accounts, []);
});

test('fails closed when a required Algod read fails', async () => {
  const algodClient = createAlgodClient({
    failures: {
      poolBox: new Error('box unavailable'),
    },
  });

  await assert.rejects(
    () =>
      preflightLiveV10ReleaseHeld({
        batch: makeBatch(),
        adminAddress,
        ...createDependencies({ algodClient }),
      }),
    (error) =>
      error instanceof V10ReleaseLivePreflightError &&
      error.code === 'ALGOD_READ_FAILED' &&
      /pool box/.test(error.message),
  );
});

test('returns blocked preflight when live V10 held balance is zero', async () => {
  const algodClient = createAlgodClient({
    poolBoxValue: encodePoolBox({
      heldUsdcAtomicUnits: 0n,
    }),
  });

  const result = await preflightLiveV10ReleaseHeld({
    batch: makeBatch(),
    adminAddress,
    ...createDependencies({ algodClient }),
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.reasons.some(({ code }) => code === 'NO_HELD_FUNDS'),
    true,
  );
  assert.equal(result.unsignedGroup, null);
});