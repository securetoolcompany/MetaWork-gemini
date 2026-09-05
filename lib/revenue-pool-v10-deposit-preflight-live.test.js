import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  preflightLiveV10Deposit,
} from './revenue-pool-v10-deposit-preflight-live.js';

const APP_ID = 7001;
const USDC_ASSET_ID = 10458941;
const REV_ASSET_ID = 8001;
const POOL_KEY = 'ip-asset-a';
const DEPOSIT_AMOUNT = 2_000_000;
const TOTAL_ALLOCATION_CENTS = 200;

const admin = algosdk.generateAccount();
const proxy = algosdk.generateAccount();

const adminAddress = admin.addr.toString();
const proxyAddress = proxy.addr.toString();

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

function makePoolBox({
  revenueTokenAssetId = REV_ASSET_ID,
  unallocatedUsdcAtomicUnits = 400_000n,
  heldUsdcAtomicUnits = 0n,
  currentRoundId = 3n,
  stakeholderCount = 1,
  proxy = null,
} = {}) {
  const bytes = new Uint8Array(73 + stakeholderCount * 35);
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  view.setBigUint64(
    0,
    BigInt(revenueTokenAssetId),
    false,
  );

  view.setBigUint64(
    8,
    BigInt(unallocatedUsdcAtomicUnits),
    false,
  );

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

  if (proxy) {
    bytes.set(
      algosdk.decodeAddress(proxy).publicKey,
      41,
    );
  }

  for (let index = 0; index < stakeholderCount; index += 1) {
    const offset = 73 + index * 35;

    bytes.set(
      algosdk.decodeAddress(adminAddress).publicKey,
      offset,
    );

    bytes[offset + 32] = 0x27;
    bytes[offset + 33] = 0x10;
    bytes[offset + 34] = 0;
  }

  return bytes;
}

function makeApplication() {
  return {
    params: {
      'global-state': [
        {
          key: Buffer.from(
            'admin',
            'utf8',
          ).toString('base64'),
          value: {
            bytes: Buffer.from(
              algosdk.decodeAddress(adminAddress).publicKey,
            ).toString('base64'),
          },
        },
      ],
    },
  };
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

function makeBatch(overrides = {}) {
  return {
    _id: 'batch-v10-usdc-only',
    batchId: 'batch-v10-usdc-only',
    status: 'recipient_snapshot_prepared',
    revenuePoolAppId: APP_ID,
    poolKey: POOL_KEY,
    revenueTokenAssetId: REV_ASSET_ID,

    // $2.00 represented in cents.
    totalAllocationCents: TOTAL_ALLOCATION_CENTS,

    // $2.00 represented as 6-decimal USDC atomic units.
    totalUsdcAtomicUnits: DEPOSIT_AMOUNT,

    ...overrides,
  };
}

function createAlgodClient({
  application = makeApplication(),
  poolBoxValue = makePoolBox(),
  appAccount = makeAccount({
    usdcBalance: 0n,
  }),
  depositorAccount = makeAccount({
    usdcBalance: 10_000_000n,
  }),
  suggestedParams = makeSuggestedParams(),
} = {}) {
  return {
    getApplicationByID(appId) {
      assert.equal(appId, APP_ID);

      return {
        do: async () => application,
      };
    },

    getApplicationBoxByName(appId, boxName) {
      assert.equal(appId, APP_ID);

      assert.equal(
        Buffer.from(boxName).toString('utf8'),
        `p_${POOL_KEY}`,
      );

      return {
        do: async () => ({
          value: poolBoxValue,
        }),
      };
    },

    accountInformation(address) {
      const applicationAddress = algosdk
        .getApplicationAddress(APP_ID)
        .toString();

      return {
        do: async () =>
          address === applicationAddress
            ? appAccount
            : depositorAccount,
      };
    },

    getTransactionParams() {
      return {
        do: async () => suggestedParams,
      };
    },
  };
}

function createDependencies({
  algodClient = createAlgodClient(),
} = {}) {
  return {
    algodClient,
    expectedRevenuePoolAppId: APP_ID,
    usdcAssetId: USDC_ASSET_ID,
  };
}

test(
  'preflights a V10 unallocated USDC deposit using fresh chain reads',
  async () => {
    const result = await preflightLiveV10Deposit({
      batch: makeBatch(),
      depositorAddress: adminAddress,
      ...createDependencies(),
    });

    assert.equal(result.ok, true);

    assert.equal(
      result.proposedGroup.action,
      'deposit_usdc',
    );

    assert.equal(
      result.proposedGroup.transactionCount,
      2,
    );

    assert.equal(
      result.proposedGroup.usdcTransferTransactionIndex,
      0,
    );

    assert.equal(
      result.proposedGroup.appCallTransactionIndex,
      1,
    );

    assert.equal(
      result.freshnessSnapshot.poolKey,
      POOL_KEY,
    );

    assert.equal(
      result.freshnessSnapshot.amountUsdcAtomicUnits,
      String(DEPOSIT_AMOUNT),
    );
  },
);

test(
  'accepts the configured pool proxy as V10 USDC depositor',
  async () => {
    const algodClient = createAlgodClient({
      poolBoxValue: makePoolBox({
        proxy: proxyAddress,
      }),
    });

    const result = await preflightLiveV10Deposit({
      batch: makeBatch(),
      depositorAddress: proxyAddress,
      ...createDependencies({ algodClient }),
    });

    assert.equal(result.ok, true);

    assert.equal(
      result.proposedGroup.action,
      'deposit_usdc',
    );

    assert.equal(
      result.freshnessSnapshot.depositorAddress,
      proxyAddress,
    );

    assert.equal(
      result.freshnessSnapshot.proxyAddress,
      proxyAddress,
    );
  },
);

test(
  'rejects an invalid settlement batch before any Algod calls',
  async () => {
    let algodCalled = false;

    const algodClient = {
      getApplicationByID() {
        algodCalled = true;
        throw new Error('Algod must not be called');
      },
    };

    await assert.rejects(
      preflightLiveV10Deposit({
        batch: makeBatch({
          totalAllocationCents: 0,
          totalUsdcAtomicUnits: 0,
        }),
        depositorAddress: adminAddress,
        ...createDependencies({ algodClient }),
      }),
      /totalAllocationCents/i,
    );

    assert.equal(algodCalled, false);
  },
);

test(
  'fails closed when the application account is not opted into USDC',
  async () => {
    const algodClient = createAlgodClient({
      appAccount: makeAccount({
        includeUsdc: false,
      }),
    });

    const result = await preflightLiveV10Deposit({
      batch: makeBatch(),
      depositorAddress: adminAddress,
      ...createDependencies({ algodClient }),
    });

    assert.equal(result.ok, false);

    assert.equal(
      result.reasons.some(
        ({ code }) => code === 'APP_USDC_NOT_OPTED_IN',
      ),
      true,
    );

    assert.equal(result.unsignedGroup, null);
  },
);

test(
  'returns a fresh V10 USDC deposit preflight result from read-only chain inputs',
  async () => {
    const result = await preflightLiveV10Deposit({
      batch: makeBatch(),
      depositorAddress: adminAddress,
      ...createDependencies(),
    });

    assert.equal(result.ok, true);

    assert.equal(
      result.proposedGroup.action,
      'deposit_usdc',
    );

    assert.equal(
      result.proposedGroup.transactionCount,
      2,
    );

    assert.equal(
      result.proposedGroup.usdcTransferTransactionIndex,
      0,
    );

    assert.equal(
      result.proposedGroup.appCallTransactionIndex,
      1,
    );

    assert.equal(
      result.freshnessSnapshot.poolUnallocatedUsdcAtomicUnits,
      '400000',
    );

    assert.equal(
      result.freshnessSnapshot.poolHeldUsdcAtomicUnits,
      '0',
    );
  },
);