import assert from 'node:assert/strict';
import test from 'node:test';

import algosdk from 'algosdk';

import {
  preflightV10DepositUsdc,
} from './revenue-pool-v10-deposit-preflight.js';

const APP_ID = 7001;
const USDC_ASSET_ID = 10458941;
const REV_ASSET_ID = 8001;
const POOL_KEY = 'ip-asset-a';
const DEPOSIT_AMOUNT = 5_330_000;

const adminAddress = algosdk.generateAccount().addr.toString();
const proxyAddress = algosdk.generateAccount().addr.toString();
const unauthorizedAddress = algosdk.generateAccount().addr.toString();

const ADMIN_PUBLIC_KEY = Uint8Array.from([
  209, 126, 10, 187, 180, 117, 64, 65,
  99, 182, 189, 35, 118, 184, 88, 13,
  217, 32, 253, 149, 147, 46, 33, 243,
  37, 92, 128, 223, 106, 200, 129, 134,
]);

const EXPECTED_ADMIN =
  '2F7AVO5UOVAECY5WXURXNOCYBXMSB7MVSMXCD4ZFLSAN62WIQGDERT7JTY';

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

function encodePoolBox({
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

  view.setBigUint64(0, BigInt(revenueTokenAssetId), false);
  view.setBigUint64(
    8,
    BigInt(unallocatedUsdcAtomicUnits),
    false,
  );
  view.setBigUint64(24, BigInt(heldUsdcAtomicUnits), false);
  view.setBigUint64(32, BigInt(currentRoundId), false);
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

test('accepts a typed SDK Uint8Array global admin value', () => {
  const application = {
    params: {
      globalState: [
        {
          key: new Uint8Array(Buffer.from('admin', 'utf8')),
          value: {
            bytes: ADMIN_PUBLIC_KEY,
          },
        },
      ],
    },
  };

  const result = preflightV10DepositUsdc(
    makeInput({
      application,
      depositorAddress: EXPECTED_ADMIN,
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(
    result.freshnessSnapshot.appAdminAddress,
    EXPECTED_ADMIN,
  );
});

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

function makeInput(overrides = {}) {
  return {
    revenuePoolAppId: APP_ID,
    expectedRevenuePoolAppId: APP_ID,
    usdcAssetId: USDC_ASSET_ID,
    depositorAddress: adminAddress,
    poolKey: POOL_KEY,
    revenueTokenAssetId: REV_ASSET_ID,
    amountUsdcAtomicUnits: DEPOSIT_AMOUNT,
    suggestedParams: makeSuggestedParams(),
    application: makeApplication(),
    poolBoxValue: encodePoolBox(),
    appAccount: makeAccount({
      usdcBalance: 0n,
    }),
    depositorAccount: makeAccount({
      usdcBalance: 10_000_000n,
    }),
    ...overrides,
  };
}

test('preflights an authorized V10 deposit and proposes the exact unsigned group', () => {
  const result = preflightV10DepositUsdc(makeInput());

  assert.equal(result.ok, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.appUsdcBalanceAtomicUnits, 0);
  assert.equal(
    result.depositorUsdcBalanceAtomicUnits,
    10_000_000,
  );
  assert.equal(
    result.depositorAlgoBalanceMicroAlgos,
    1_000_000,
  );
  assert.equal(
    result.requiredOuterFeesMicroAlgos,
    3000,
  );

  assert.equal(result.proposedGroup.action, 'deposit_held');
  assert.equal(result.proposedGroup.transactionCount, 2);
  assert.equal(
    result.proposedGroup.usdcTransferTransactionIndex,
    0,
  );
  assert.equal(
    result.proposedGroup.appCallTransactionIndex,
    1,
  );
  assert.equal(
    typeof result.proposedGroup.groupId,
    'string',
  );
  assert.equal(
    typeof result.proposedGroup.transactionIds.usdcTransfer,
    'string',
  );
  assert.equal(
    typeof result.proposedGroup.transactionIds.appCall,
    'string',
  );
  assert.match(
    result.proposedGroup.unsignedTransactionHash,
    /^sha256:[a-f0-9]{64}$/,
  );
  assert.equal(result.unsignedGroup.transactions.length, 2);

  const [, appCallTxn] = result.unsignedGroup.transactions;

	assert.equal(
	Buffer.from(appCallTxn.applicationCall.appArgs[0]).toString(),
	'deposit_held',
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

  assert.deepEqual(result.freshnessSnapshot, {
    revenuePoolAppId: APP_ID,
    expectedRevenuePoolAppId: APP_ID,
    usdcAssetId: USDC_ASSET_ID,
    depositorAddress: adminAddress,
    poolKey: POOL_KEY,
    revenueTokenAssetId: REV_ASSET_ID,
    amountUsdcAtomicUnits: String(DEPOSIT_AMOUNT),
    appAdminAddress: adminAddress,
    proxyAddress: null,
    poolRevenueTokenAssetId: String(REV_ASSET_ID),
    poolUnallocatedUsdcAtomicUnits: '400000',
    poolHeldUsdcAtomicUnits: '0',
    poolCurrentRoundId: '3',
    poolStakeholderCount: 1,
    depositorUsdcBalance: '10000000',
    depositorAlgoBalance: '1000000',
    requiredOuterFeesMicroAlgos: 3000,
  });
});

test('accepts the exact configured pool proxy as depositor', () => {
  const result = preflightV10DepositUsdc(
    makeInput({
      depositorAddress: proxyAddress,
      poolBoxValue: encodePoolBox({
        proxy: proxyAddress,
      }),
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(
    result.freshnessSnapshot.proxyAddress,
    proxyAddress,
  );
  assert.equal(
    result.freshnessSnapshot.depositorAddress,
    proxyAddress,
  );
});

test('rejects a mismatched expected V10 app ID', () => {
  const result = preflightV10DepositUsdc(
    makeInput({
      expectedRevenuePoolAppId: APP_ID + 1,
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.reasons.some(
      ({ code }) => code === 'APP_ID_MISMATCH',
    ),
    true,
  );
  assert.equal(result.unsignedGroup, null);
});

test('rejects a mismatched pool REV ASA target', () => {
  const result = preflightV10DepositUsdc(
    makeInput({
      poolBoxValue: encodePoolBox({
        revenueTokenAssetId: REV_ASSET_ID + 1,
      }),
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.reasons.some(
      ({ code }) =>
        code === 'REVENUE_TOKEN_ASSET_MISMATCH',
    ),
    true,
  );
  assert.equal(result.unsignedGroup, null);
});

test('rejects a depositor that is neither admin nor exact pool proxy', () => {
  const result = preflightV10DepositUsdc(
    makeInput({
      depositorAddress: unauthorizedAddress,
      poolBoxValue: encodePoolBox({
        proxy: proxyAddress,
      }),
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.reasons.some(
      ({ code }) => code === 'UNAUTHORIZED_DEPOSITOR',
    ),
    true,
  );
  assert.equal(result.unsignedGroup, null);
});

test('rejects an app account that is not opted into V10 USDC', () => {
  const result = preflightV10DepositUsdc(
    makeInput({
      appAccount: makeAccount({
        includeUsdc: false,
      }),
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.reasons.some(
      ({ code }) => code === 'APP_USDC_NOT_OPTED_IN',
    ),
    true,
  );
  assert.equal(result.unsignedGroup, null);
});

test('rejects a depositor without USDC opt-in or sufficient frozen deposit amount', () => {
  const noOptIn = preflightV10DepositUsdc(
    makeInput({
      depositorAccount: makeAccount({
        includeUsdc: false,
      }),
    }),
  );

  assert.equal(noOptIn.ok, false);
  assert.equal(
    noOptIn.reasons.some(
      ({ code }) => code === 'DEPOSITOR_USDC_NOT_OPTED_IN',
    ),
    true,
  );

  const insufficientUsdc = preflightV10DepositUsdc(
    makeInput({
      depositorAccount: makeAccount({
        usdcBalance: BigInt(DEPOSIT_AMOUNT - 1),
      }),
    }),
  );

  assert.equal(insufficientUsdc.ok, false);
  assert.equal(
    insufficientUsdc.reasons.some(
      ({ code }) => code === 'INSUFFICIENT_USDC',
    ),
    true,
  );
  assert.match(
    insufficientUsdc.reasons.find(
      ({ code }) => code === 'INSUFFICIENT_USDC',
    ).message,
    /short by 1 atomic units/,
  );
});

test('rejects insufficient ALGO for the V10 deposit outer fees', () => {
  const result = preflightV10DepositUsdc(
    makeInput({
      depositorAccount: makeAccount({
        algoBalance: 2999n,
      }),
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(
    result.reasons.some(
      ({ code }) => code === 'INSUFFICIENT_ALGO',
    ),
    true,
  );
  assert.match(
    result.reasons.find(
      ({ code }) => code === 'INSUFFICIENT_ALGO',
    ).message,
    /short by 1 microALGOs/,
  );
});

test('rejects malformed pool boxes and invalid suggested params', () => {
  const malformedPool = preflightV10DepositUsdc(
    makeInput({
      poolBoxValue: new Uint8Array(10),
    }),
  );

  assert.equal(malformedPool.ok, false);
  assert.equal(
    malformedPool.reasons.some(
      ({ code }) => code === 'POOL_BOX_INVALID',
    ),
    true,
  );

  const invalidParams = preflightV10DepositUsdc(
    makeInput({
      suggestedParams: {
        firstValid: 1,
      },
    }),
  );

  assert.equal(invalidParams.ok, false);
  assert.equal(
    invalidParams.reasons.some(
      ({ code }) => code === 'INVALID_SUGGESTED_PARAMS',
    ),
    true,
  );
});

test('refresh-only preflight returns the same freshness snapshot without building a group', () => {
  const normal = preflightV10DepositUsdc(makeInput());

  const refreshOnly = preflightV10DepositUsdc(
    makeInput({
      suggestedParams: {
        ...makeSuggestedParams(),
        firstValid: 900n,
        lastValid: 1900n,
      },
      buildUnsignedGroup: false,
    }),
  );

  assert.equal(refreshOnly.ok, true);
  assert.equal(refreshOnly.proposedGroup, null);
  assert.equal(refreshOnly.unsignedGroup, null);
  assert.deepEqual(
    refreshOnly.freshnessSnapshot,
    normal.freshnessSnapshot,
  );
});