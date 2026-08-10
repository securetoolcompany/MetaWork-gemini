// lib/revenue-pool-v7-settlement.test.js
import assert from 'node:assert/strict';
import algosdk from 'algosdk';

import {
  buildV7DepositHeldGroup,
  buildV7ReleaseHeldGroup,
  calculateV7RoundMbrMicroAlgos,
  getV7PoolBoxName,
  getV7RoundBoxName,
} from './revenue-pool-v7-settlement.js';

function decodeArg(value) {
  return Buffer.from(value).toString();
}

function decodeUint64(value) {
  return Number(Buffer.from(value).readBigUInt64BE(0));
}

const adminAddress = algosdk.generateAccount().addr.toString();

const suggestedParams = {
  fee: 1000,
  firstValid: 1,
  lastValid: 1000,
  genesisHash: new Uint8Array(32),
  genesisID: 'testnet-v1.0',
};

assert.deepEqual(
  Array.from(getV7PoolBoxName('ip-asset-a')),
  Array.from(Buffer.from('p_ip-asset-a'))
);

const roundBoxName = getV7RoundBoxName('ip-asset-a', 4);
const expectedRoundBoxName = Buffer.concat([
  Buffer.from('rnd_ip-asset-a'),
  Buffer.from([0, 0, 0, 0, 0, 0, 0, 4]),
]);

assert.deepEqual(
  Array.from(roundBoxName),
  Array.from(expectedRoundBoxName)
);

assert.equal(
  calculateV7RoundMbrMicroAlgos({
    ipAssetId: 'ip-asset-a',
    stakeholderCount: 2,
  }),
  51300
);

const depositGroup = buildV7DepositHeldGroup({
  revenuePoolAppId: 7001,
  usdcAssetId: 10458941,
  adminAddress,
  ipAssetId: 'ip-asset-a',
  usdcAtomicUnits: 8530000,
  suggestedParams,
});

assert.equal(depositGroup.transactions.length, 2);
assert.equal(depositGroup.companionTransactionIndex, 0);
assert.equal(depositGroup.appCallTransactionIndex, 1);
assert.equal(depositGroup.revenuePoolAppId, 7001);
assert.equal(depositGroup.ipAssetId, 'ip-asset-a');
assert.equal(depositGroup.usdcAtomicUnits, 8530000);

const [depositTransfer, depositAppCall] = depositGroup.transactions;

assert.equal(depositTransfer.type, 'axfer');
assert.equal(Number(depositTransfer.assetTransfer.amount), 8530000);

assert.equal(depositAppCall.type, 'appl');
assert.equal(
  decodeArg(depositAppCall.applicationCall.appArgs[0]),
  'deposit_held'
);
assert.equal(
  decodeArg(depositAppCall.applicationCall.appArgs[1]),
  'ip-asset-a'
);
assert.equal(
  decodeUint64(depositAppCall.applicationCall.appArgs[2]),
  0
);
assert.equal(
  Number(depositAppCall.applicationCall.foreignAssets[0]),
  10458941
);
assert.deepEqual(
  Array.from(depositAppCall.applicationCall.boxes[0].name),
  Array.from(Buffer.from('p_ip-asset-a'))
);

assert.deepEqual(
  Array.from(depositTransfer.group),
  Array.from(depositAppCall.group)
);

const releaseGroup = buildV7ReleaseHeldGroup({
  revenuePoolAppId: 7001,
  usdcAssetId: 10458941,
  adminAddress,
  ipAssetId: 'ip-asset-a',
  currentRoundId: 4,
  stakeholderCount: 2,
  suggestedParams,
});

assert.equal(releaseGroup.transactions.length, 2);
assert.equal(releaseGroup.companionTransactionIndex, 0);
assert.equal(releaseGroup.appCallTransactionIndex, 1);
assert.equal(releaseGroup.currentRoundId, 4);
assert.equal(releaseGroup.nextRoundId, 5);
assert.equal(releaseGroup.roundMbrMicroAlgos, 51300);

const [mbrPayment, releaseAppCall] = releaseGroup.transactions;

assert.equal(mbrPayment.type, 'pay');
assert.equal(Number(mbrPayment.payment.amount), 51300);

assert.equal(releaseAppCall.type, 'appl');
assert.equal(
  decodeArg(releaseAppCall.applicationCall.appArgs[0]),
  'release_held'
);
assert.equal(
  decodeArg(releaseAppCall.applicationCall.appArgs[1]),
  'ip-asset-a'
);
assert.equal(
  decodeUint64(releaseAppCall.applicationCall.appArgs[2]),
  0
);
assert.equal(
  Number(releaseAppCall.applicationCall.foreignAssets[0]),
  10458941
);

assert.equal(releaseAppCall.applicationCall.boxes.length, 2);

assert.deepEqual(
  Array.from(releaseAppCall.applicationCall.boxes[0].name),
  Array.from(Buffer.from('p_ip-asset-a'))
);

assert.deepEqual(
  Array.from(releaseAppCall.applicationCall.boxes[1].name),
  Array.from(
    Buffer.concat([
      Buffer.from('rnd_ip-asset-a'),
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 5]),
    ])
  )
);

assert.deepEqual(
  Array.from(mbrPayment.group),
  Array.from(releaseAppCall.group)
);

assert.throws(
  () =>
    buildV7DepositHeldGroup({
      revenuePoolAppId: 7001,
      usdcAssetId: 10458941,
      adminAddress,
      ipAssetId: 'ip-asset-a',
      usdcAtomicUnits: 0,
      suggestedParams,
    }),
  /usdcAtomicUnits/
);

assert.throws(
  () =>
    buildV7ReleaseHeldGroup({
      revenuePoolAppId: 7001,
      usdcAssetId: 10458941,
      adminAddress,
      ipAssetId: 'ip-asset-a',
      currentRoundId: 0,
      stakeholderCount: 0,
      suggestedParams,
    }),
  /stakeholderCount/
);

console.log('✅ revenue-pool-v7-settlement tests passed');