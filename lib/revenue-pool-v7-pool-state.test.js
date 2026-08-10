// lib/revenue-pool-v7-pool-state.test.js

import assert from 'node:assert/strict';
import algosdk from 'algosdk';

import {
  decodeV7PoolBox,
  getV7PoolBoxExpectedByteLength,
  readV7PoolState,
  V7PoolAppIdMismatchError,
  V7PoolBoxMalformedError,
  V7PoolBoxNotFoundError,
  V7PoolStateNetworkError,
} from './revenue-pool-v7-pool-state.js';

import { getV7PoolBoxName } from './revenue-pool-v7-settlement.js';

const IP_ASSET_ID = 'ip-asset-a';
const REVENUE_POOL_APP_ID = 7001;

const POOL_HEADER_BYTES = 73;
const STAKEHOLDER_ENTRY_BYTES = 35;

const REV_ASA_OFFSET = 0;
const UNALLOCATED_OFFSET = 8;
const TOTAL_CLAIMED_OFFSET = 16;
const HELD_OFFSET = 24;
const CURRENT_ROUND_OFFSET = 32;
const STAKEHOLDER_COUNT_OFFSET = 40;
const PROXY_ADDRESS_OFFSET = 41;
const STAKEHOLDERS_OFFSET = 73;

const STAKEHOLDER_BPS_OFFSET = 32;
const STAKEHOLDER_TOKEN_CLAIMED_OFFSET = 34;

const stakeholderOnePublicKey = Uint8Array.from(
  Array.from({ length: 32 }, (_, index) => index + 1)
);

const stakeholderTwoPublicKey = Uint8Array.from(
  Array.from({ length: 32 }, (_, index) => index + 33)
);

const proxyPublicKey = Uint8Array.from(
  Array.from({ length: 32 }, (_, index) => 255 - index)
);

const stakeholderOneAddress = algosdk.encodeAddress(stakeholderOnePublicKey);
const stakeholderTwoAddress = algosdk.encodeAddress(stakeholderTwoPublicKey);
const proxyAddress = algosdk.encodeAddress(proxyPublicKey);

function writeUint64(buffer, offset, value) {
  buffer.writeBigUInt64BE(BigInt(value), offset);
}

function setUint16BigEndian(bytes, offset, value) {
  new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).setUint16(offset, value, false);
}

function setUint64BigEndian(bytes, offset, value) {
  new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).setBigUint64(offset, BigInt(value), false);
}

function createPoolBoxFixture({
  revenueTokenAssetId = 9001n,
  unallocatedUsdcAtomicUnits = 1250000n,
  totalClaimedUsdcAtomicUnits = 250000n,
  heldUsdcAtomicUnits = 8530000n,
  currentRoundId = 4n,
  proxyAddressBytes = new Uint8Array(32),
  stakeholders = [
    {
      publicKey: stakeholderOnePublicKey,
      bps: 6000,
      tokenClaimed: false,
    },
    {
      publicKey: stakeholderTwoPublicKey,
      bps: 4000,
      tokenClaimed: true,
    },
  ],
} = {}) {
  const box = Buffer.alloc(
    POOL_HEADER_BYTES + stakeholders.length * STAKEHOLDER_ENTRY_BYTES
  );

  writeUint64(box, REV_ASA_OFFSET, revenueTokenAssetId);
  writeUint64(box, UNALLOCATED_OFFSET, unallocatedUsdcAtomicUnits);
  writeUint64(box, TOTAL_CLAIMED_OFFSET, totalClaimedUsdcAtomicUnits);
  writeUint64(box, HELD_OFFSET, heldUsdcAtomicUnits);
  writeUint64(box, CURRENT_ROUND_OFFSET, currentRoundId);

  box[STAKEHOLDER_COUNT_OFFSET] = stakeholders.length;
  Buffer.from(proxyAddressBytes).copy(box, PROXY_ADDRESS_OFFSET);

  for (let index = 0; index < stakeholders.length; index += 1) {
    const stakeholder = stakeholders[index];
    const entryOffset =
      STAKEHOLDERS_OFFSET + index * STAKEHOLDER_ENTRY_BYTES;

    Buffer.from(stakeholder.publicKey).copy(box, entryOffset);
    box.writeUInt16BE(
      stakeholder.bps,
      entryOffset + STAKEHOLDER_BPS_OFFSET
    );
    box[entryOffset + STAKEHOLDER_TOKEN_CLAIMED_OFFSET] =
      stakeholder.tokenClaimed ? 1 : 0;
  }

  return new Uint8Array(box);
}

const validPoolBox = createPoolBoxFixture();

assert.equal(getV7PoolBoxExpectedByteLength(1), 108);
assert.equal(getV7PoolBoxExpectedByteLength(2), 143);
assert.equal(validPoolBox.length, getV7PoolBoxExpectedByteLength(2));

assert.throws(
  () => getV7PoolBoxExpectedByteLength(0),
  /stakeholderCount/
);

assert.throws(
  () => getV7PoolBoxExpectedByteLength(101),
  /stakeholderCount/
);

const decodedPool = decodeV7PoolBox({
  ipAssetId: IP_ASSET_ID,
  boxValue: validPoolBox,
});

assert.equal(decodedPool.ipAssetId, IP_ASSET_ID);
assert.equal(decodedPool.revenueTokenAssetId, 9001n);
assert.equal(decodedPool.unallocatedUsdcAtomicUnits, 1250000n);
assert.equal(decodedPool.totalClaimedUsdcAtomicUnits, 250000n);
assert.equal(decodedPool.heldUsdcAtomicUnits, 8530000n);
assert.equal(decodedPool.currentRoundId, 4n);
assert.equal(decodedPool.stakeholderCount, 2);
assert.equal(decodedPool.proxyAddress, null);
assert.equal(decodedPool.stakeholders.length, 2);

assert.deepEqual(decodedPool.stakeholders[0], {
  address: stakeholderOneAddress,
  bps: 6000,
  tokensClaimed: false,
});

assert.deepEqual(decodedPool.stakeholders[1], {
  address: stakeholderTwoAddress,
  bps: 4000,
  tokensClaimed: true,
});

assert.equal(Object.isFrozen(decodedPool), true);
assert.equal(Object.isFrozen(decodedPool.stakeholders), true);
assert.equal(Object.isFrozen(decodedPool.stakeholders[0]), true);

assert.throws(() => {
  decodedPool.stakeholders.push({
    address: stakeholderOneAddress,
    bps: 1,
    tokensClaimed: false,
  });
}, TypeError);

const decodedWithProxy = decodeV7PoolBox({
  ipAssetId: IP_ASSET_ID,
  boxValue: createPoolBoxFixture({
    proxyAddressBytes: proxyPublicKey,
  }),
});

assert.equal(decodedWithProxy.proxyAddress, proxyAddress);

const decodedBase64Pool = decodeV7PoolBox({
  ipAssetId: IP_ASSET_ID,
  boxValue: Buffer.from(validPoolBox).toString('base64'),
});

assert.equal(decodedBase64Pool.heldUsdcAtomicUnits, 8530000n);

assert.throws(
  () =>
    decodeV7PoolBox({
      ipAssetId: IP_ASSET_ID,
      boxValue: validPoolBox.slice(0, POOL_HEADER_BYTES - 1),
    }),
  V7PoolBoxMalformedError
);

assert.throws(
  () =>
    decodeV7PoolBox({
      ipAssetId: IP_ASSET_ID,
      boxValue: validPoolBox.slice(0, validPoolBox.length - 1),
    }),
  /length mismatch/
);

const invalidDeclaredCountBox = new Uint8Array(validPoolBox);
invalidDeclaredCountBox[STAKEHOLDER_COUNT_OFFSET] = 3;

assert.throws(
  () =>
    decodeV7PoolBox({
      ipAssetId: IP_ASSET_ID,
      boxValue: invalidDeclaredCountBox,
    }),
  /length mismatch/
);

const zeroBpsBox = new Uint8Array(validPoolBox);

setUint16BigEndian(
  zeroBpsBox,
  STAKEHOLDERS_OFFSET + STAKEHOLDER_BPS_OFFSET,
  0
);

assert.throws(
  () =>
    decodeV7PoolBox({
      ipAssetId: IP_ASSET_ID,
      boxValue: zeroBpsBox,
    }),
  /bps must be greater than zero/
);

const invalidBpsTotalBox = new Uint8Array(validPoolBox);

setUint16BigEndian(
  invalidBpsTotalBox,
  STAKEHOLDERS_OFFSET +
    STAKEHOLDER_ENTRY_BYTES +
    STAKEHOLDER_BPS_OFFSET,
  3999
);

assert.throws(
  () =>
    decodeV7PoolBox({
      ipAssetId: IP_ASSET_ID,
      boxValue: invalidBpsTotalBox,
    }),
  /BPS must total 10000/
);

const invalidClaimFlagBox = new Uint8Array(validPoolBox);
invalidClaimFlagBox[
  STAKEHOLDERS_OFFSET + STAKEHOLDER_TOKEN_CLAIMED_OFFSET
] = 2;

assert.throws(
  () =>
    decodeV7PoolBox({
      ipAssetId: IP_ASSET_ID,
      boxValue: invalidClaimFlagBox,
    }),
  /tokenClaimed flag must be 0 or 1/
);

const zeroRevenueAssetIdBox = new Uint8Array(validPoolBox);

setUint64BigEndian(
  zeroRevenueAssetIdBox,
  REV_ASA_OFFSET,
  0n
);

assert.throws(
  () =>
    decodeV7PoolBox({
      ipAssetId: IP_ASSET_ID,
      boxValue: zeroRevenueAssetIdBox,
    }),
  /revenueTokenAssetId/
);

const recordedRequests = [];

const successfulAlgodClient = {
  getApplicationBoxByName(appId, boxName) {
    recordedRequests.push({
      appId,
      boxName: new Uint8Array(boxName),
    });

    return {
      async do() {
        return { value: validPoolBox };
      },
    };
  },
};

const livePoolState = await readV7PoolState({
  algodClient: successfulAlgodClient,
  revenuePoolAppId: REVENUE_POOL_APP_ID,
  expectedRevenuePoolAppId: REVENUE_POOL_APP_ID,
  ipAssetId: IP_ASSET_ID,
});

assert.equal(livePoolState.heldUsdcAtomicUnits, 8530000n);
assert.equal(recordedRequests.length, 1);
assert.equal(recordedRequests[0].appId, REVENUE_POOL_APP_ID);
assert.deepEqual(
  Array.from(recordedRequests[0].boxName),
  Array.from(getV7PoolBoxName(IP_ASSET_ID))
);

const missingBoxAlgodClient = {
  getApplicationBoxByName() {
    return {
      async do() {
        const error = new Error('box not found');
        error.status = 404;
        throw error;
      },
    };
  },
};

await assert.rejects(
  () =>
    readV7PoolState({
      algodClient: missingBoxAlgodClient,
      revenuePoolAppId: REVENUE_POOL_APP_ID,
      expectedRevenuePoolAppId: REVENUE_POOL_APP_ID,
      ipAssetId: IP_ASSET_ID,
    }),
  V7PoolBoxNotFoundError
);

const failingAlgodClient = {
  getApplicationBoxByName() {
    return {
      async do() {
        const error = new Error('algod unavailable');
        error.status = 503;
        throw error;
      },
    };
  },
};

await assert.rejects(
  () =>
    readV7PoolState({
      algodClient: failingAlgodClient,
      revenuePoolAppId: REVENUE_POOL_APP_ID,
      expectedRevenuePoolAppId: REVENUE_POOL_APP_ID,
      ipAssetId: IP_ASSET_ID,
    }),
  V7PoolStateNetworkError
);

let mismatchClientCalled = false;

const mismatchAlgodClient = {
  getApplicationBoxByName() {
    mismatchClientCalled = true;

    return {
      async do() {
        return { value: validPoolBox };
      },
    };
  },
};

await assert.rejects(
  () =>
    readV7PoolState({
      algodClient: mismatchAlgodClient,
      revenuePoolAppId: REVENUE_POOL_APP_ID,
      expectedRevenuePoolAppId: REVENUE_POOL_APP_ID + 1,
      ipAssetId: IP_ASSET_ID,
    }),
  V7PoolAppIdMismatchError
);

assert.equal(mismatchClientCalled, false);

console.log('✅ revenue-pool-v7-pool-state tests passed');