import test from 'node:test';
import assert from 'node:assert/strict';
import algosdk from 'algosdk';

import {
  snapshotV10EffectiveRevenueOwners,
} from './revenue-pool-v10-effective-holder-snapshot.js';

function makeAddress() {
  return algosdk.generateAccount().addr.toString();
}

function makePoolBox(stakeholderAddress, revUnits = 10_000, claimFlag = 0) {
  const bytes = Buffer.alloc(73 + 35);

  bytes.writeBigUInt64BE(1n, 0);
  bytes.writeUInt8(1, 40);

  Buffer.from(algosdk.decodeAddress(stakeholderAddress).publicKey).copy(bytes, 73);
  bytes.writeUInt16BE(revUnits, 105);
  bytes.writeUInt8(claimFlag, 107);

  return bytes;
}

function makePoolBoxWithStakeholders(stakeholders) {
  const bytes = Buffer.alloc(73 + (35 * stakeholders.length));

  bytes.writeBigUInt64BE(1n, 0);
  bytes.writeUInt8(stakeholders.length, 40);

  for (const [index, stakeholder] of stakeholders.entries()) {
    const offset = 73 + (index * 35);

    Buffer.from(
      algosdk.decodeAddress(stakeholder.address).publicKey,
    ).copy(bytes, offset);

    bytes.writeUInt16BE(stakeholder.revUnits, offset + 32);
    bytes.writeUInt8(stakeholder.claimFlag ?? 0, offset + 34);
  }

  return bytes;
}

function makeAlgodClient(poolBox) {
  return {
    getApplicationBoxByName() {
      return {
        do: async () => ({ value: poolBox }),
      };
    },
  };
}

function makeSnapshot(entries) {
  return async () => ({
    entries,
    indexerRound: 1,
    algodStatusRound: 1,
    indexerLagRounds: 0,
  });
}

function sortEntries(entries) {
  return [...entries].sort((left, right) =>
    left.address.localeCompare(right.address),
  );
}

test('attributes app-held unclaimed REV to the configured stakeholder', async () => {
  const appId = 12345;
  const poolKey = 'test-pool-key';
  const assetId = 999;
  const stakeholder = makeAddress();
  const appAddress = algosdk.getApplicationAddress(appId).toString();

  const result = await snapshotV10EffectiveRevenueOwners({
    indexerClient: {},
    algodClient: makeAlgodClient(makePoolBox(stakeholder, 10_000, 0)),
    appId,
    poolKey,
    revenueTokenAssetId: assetId,
    snapshotRevenueTokenHolders: makeSnapshot([
      { address: appAddress, revUnits: '10000' },
    ]),
  });

  assert.equal(result.appAddress, appAddress);
  assert.equal(result.appHeldRevUnits, '10000');
  assert.equal(result.virtualUnclaimedRevUnits, '10000');
  assert.deepEqual(result.entries, [
    { address: stakeholder, revUnits: '10000' },
  ]);
  assert.equal(
    result.entries.some((entry) => entry.address === appAddress),
    false,
  );
});

test('rejects when app-held REV does not equal unclaimed stakeholder REV', async () => {
  const appId = 54321;
  const poolKey = 'test-pool-key';
  const assetId = 999;
  const stakeholder = makeAddress();
  const appAddress = algosdk.getApplicationAddress(appId).toString();

  await assert.rejects(
    snapshotV10EffectiveRevenueOwners({
      indexerClient: {},
      algodClient: makeAlgodClient(makePoolBox(stakeholder, 10_000, 0)),
      appId,
      poolKey,
      revenueTokenAssetId: assetId,
      snapshotRevenueTokenHolders: makeSnapshot([
        { address: appAddress, revUnits: '9000' },
        { address: makeAddress(), revUnits: '1000' },
      ]),
    }),
    (error) => error?.code === 'APP_CUSTODY_RECONCILIATION_MISMATCH',
  );
});

test('uses external REV holders after initial REV has been claimed and transferred', async () => {
  const appId = 67890;
  const poolKey = 'test-pool-key';
  const assetId = 999;
  const originalStakeholder = makeAddress();
  const buyer = makeAddress();

  const result = await snapshotV10EffectiveRevenueOwners({
    indexerClient: {},
    algodClient: makeAlgodClient(
      makePoolBox(originalStakeholder, 10_000, 1),
    ),
    appId,
    poolKey,
    revenueTokenAssetId: assetId,
    snapshotRevenueTokenHolders: makeSnapshot([
      { address: buyer, revUnits: '10000' },
    ]),
  });

  assert.equal(result.appHeldRevUnits, '0');
  assert.equal(result.virtualUnclaimedRevUnits, '0');
  assert.deepEqual(result.entries, [
    { address: buyer, revUnits: '10000' },
  ]);
});

test('combines external holders with virtual unclaimed REV', async () => {
  const appId = 24680;
  const poolKey = 'test-pool-key';
  const assetId = 999;
  const unclaimedStakeholder = makeAddress();
  const claimedStakeholder = makeAddress();
  const buyer = makeAddress();
  const appAddress = algosdk.getApplicationAddress(appId).toString();

  const result = await snapshotV10EffectiveRevenueOwners({
    indexerClient: {},
    algodClient: makeAlgodClient(makePoolBoxWithStakeholders([
      {
        address: unclaimedStakeholder,
        revUnits: 4_000,
        claimFlag: 0,
      },
      {
        address: claimedStakeholder,
        revUnits: 6_000,
        claimFlag: 1,
      },
    ])),
    appId,
    poolKey,
    revenueTokenAssetId: assetId,
    snapshotRevenueTokenHolders: makeSnapshot([
      { address: appAddress, revUnits: '4000' },
      { address: buyer, revUnits: '6000' },
    ]),
  });

  assert.equal(result.appHeldRevUnits, '4000');
  assert.equal(result.virtualUnclaimedRevUnits, '4000');
  assert.deepEqual(
    sortEntries(result.entries),
    sortEntries([
      { address: unclaimedStakeholder, revUnits: '4000' },
      { address: buyer, revUnits: '6000' },
    ]),
  );
  assert.equal(
    result.entries.some((entry) => entry.address === appAddress),
    false,
  );
});

test('preserves external holders when no REV is app-held and all REV is claimed', async () => {
  const appId = 13579;
  const poolKey = 'test-pool-key';
  const assetId = 999;
  const originalStakeholder = makeAddress();
  const holderOne = makeAddress();
  const holderTwo = makeAddress();

  const result = await snapshotV10EffectiveRevenueOwners({
    indexerClient: {},
    algodClient: makeAlgodClient(
      makePoolBox(originalStakeholder, 10_000, 1),
    ),
    appId,
    poolKey,
    revenueTokenAssetId: assetId,
    snapshotRevenueTokenHolders: makeSnapshot([
      { address: holderOne, revUnits: '6500' },
      { address: holderTwo, revUnits: '3500' },
    ]),
  });

  assert.equal(result.appHeldRevUnits, '0');
  assert.equal(result.virtualUnclaimedRevUnits, '0');
  assert.deepEqual(
    sortEntries(result.entries),
    sortEntries([
      { address: holderOne, revUnits: '6500' },
      { address: holderTwo, revUnits: '3500' },
    ]),
  );
});

test('rejects raw holder snapshots containing zero REV', async () => {
  const appId = 97531;
  const poolKey = 'test-pool-key';
  const assetId = 999;
  const stakeholder = makeAddress();
  const buyer = makeAddress();
  const appAddress = algosdk.getApplicationAddress(appId).toString();

  await assert.rejects(
    snapshotV10EffectiveRevenueOwners({
      indexerClient: {},
      algodClient: makeAlgodClient(makePoolBox(stakeholder, 10_000, 1)),
      appId,
      poolKey,
      revenueTokenAssetId: assetId,
      snapshotRevenueTokenHolders: makeSnapshot([
        { address: appAddress, revUnits: '0' },
        { address: buyer, revUnits: '10000' },
      ]),
    }),
    (error) => error?.code === 'INVALID_RAW_HOLDER_UNITS',
  );
});

test('rejects an unclaimed pool when the app holds no REV', async () => {
  const appId = 11223;
  const poolKey = 'test-pool-key';
  const assetId = 999;
  const stakeholder = makeAddress();
  const buyer = makeAddress();

  await assert.rejects(
    snapshotV10EffectiveRevenueOwners({
      indexerClient: {},
      algodClient: makeAlgodClient(makePoolBox(stakeholder, 10_000, 0)),
      appId,
      poolKey,
      revenueTokenAssetId: assetId,
      snapshotRevenueTokenHolders: makeSnapshot([
        { address: buyer, revUnits: '10000' },
      ]),
    }),
    (error) => error?.code === 'APP_CUSTODY_RECONCILIATION_MISMATCH',
  );
});

test('fails closed when the V10 pool box cannot be read', async () => {
  const appId = 44556;
  const poolKey = 'test-pool-key';
  const assetId = 999;

  const algodClient = {
    getApplicationBoxByName() {
      return {
        do: async () => {
          throw new Error('pool box not found');
        },
      };
    },
  };

  await assert.rejects(
    snapshotV10EffectiveRevenueOwners({
      indexerClient: {},
      algodClient,
      appId,
      poolKey,
      revenueTokenAssetId: assetId,
      snapshotRevenueTokenHolders: makeSnapshot([]),
    }),
    (error) =>
      error?.code === 'POOL_BOX_READ_FAILED' ||
      error?.message?.includes('Unable to read V10 pool box'),
  );
});