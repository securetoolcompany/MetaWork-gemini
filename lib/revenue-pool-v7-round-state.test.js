import assert from 'node:assert/strict';
import algosdk from 'algosdk';

import {
  decodeV7RoundBox,
  deriveV7ReleaseState,
  readV7ActiveRoundState,
  V7RoundBoxMalformedError,
  V7RoundStateNetworkError,
} from './revenue-pool-v7-round-state.js';

const IP_ASSET_ID = 'ip-asset-a';
const APP_ID = 7001;
const HEADER_BYTES = 18;
const ENTRY_BYTES = 41;

const firstPublicKey = Uint8Array.from(
  Array.from({ length: 32 }, (_, index) => index + 1)
);
const secondPublicKey = Uint8Array.from(
  Array.from({ length: 32 }, (_, index) => index + 33)
);

function createRoundBox({
  total = 1000n,
  timestamp = 1700000000n,
  entries = [
    { publicKey: firstPublicKey, amount: 600n, claimed: true },
    { publicKey: secondPublicKey, amount: 400n, claimed: false },
  ],
} = {}) {
  const box = Buffer.alloc(HEADER_BYTES + entries.length * ENTRY_BYTES);

  box.writeBigUInt64BE(total, 0);
  box.writeBigUInt64BE(timestamp, 8);
  box.writeUInt16BE(entries.length, 16);

  entries.forEach((entry, index) => {
    const offset = HEADER_BYTES + index * ENTRY_BYTES;

    Buffer.from(entry.publicKey).copy(box, offset);
    box.writeBigUInt64BE(entry.amount, offset + 32);
    box[offset + 40] = entry.claimed ? 1 : 0;
  });

  return new Uint8Array(box);
}

const roundBox = createRoundBox();

const poolWithoutHeldFunds = {
  currentRoundId: 4n,
  heldUsdcAtomicUnits: 0n,
};

const decoded = decodeV7RoundBox({
  ipAssetId: IP_ASSET_ID,
  roundId: 4n,
  boxValue: roundBox,
});

assert.equal(decoded.totalUsdcAtomicUnits, 1000n);
assert.equal(decoded.createdAtUnixSeconds, 1700000000n);
assert.equal(decoded.entryCount, 2);
assert.equal(decoded.totalAllocatedUsdcAtomicUnits, 1000n);
assert.equal(decoded.totalClaimedUsdcAtomicUnits, 600n);
assert.equal(decoded.totalUnclaimedUsdcAtomicUnits, 400n);
assert.equal(decoded.claimedEntryCount, 1);
assert.equal(decoded.unclaimedEntryCount, 1);
assert.equal(decoded.isComplete, false);
assert.equal(
  decoded.entries[0].address,
  algosdk.encodeAddress(firstPublicKey)
);
assert.equal(decoded.entries[0].claimed, true);
assert.equal(
  decoded.entries[1].address,
  algosdk.encodeAddress(secondPublicKey)
);
assert.equal(Object.isFrozen(decoded), true);
assert.equal(Object.isFrozen(decoded.entries), true);

assert.throws(
  () =>
    decodeV7RoundBox({
      ipAssetId: IP_ASSET_ID,
      roundId: 4n,
      boxValue: roundBox.slice(0, -1),
    }),
  V7RoundBoxMalformedError
);

const invalidFlag = new Uint8Array(roundBox);
invalidFlag[HEADER_BYTES + 40] = 2;

assert.throws(
  () =>
    decodeV7RoundBox({
      ipAssetId: IP_ASSET_ID,
      roundId: 4n,
      boxValue: invalidFlag,
    }),
  /claimed flag must be 0 or 1/
);

const overAllocated = createRoundBox({
  total: 999n,
});

assert.throws(
  () =>
    decodeV7RoundBox({
      ipAssetId: IP_ASSET_ID,
      roundId: 4n,
      boxValue: overAllocated,
    }),
  /cannot exceed the round total/
);

assert.equal(
  deriveV7ReleaseState({
    poolState: poolWithoutHeldFunds,
    activeRound: decoded,
  }).releaseStatus,
  'pending'
);

const completeRound = decodeV7RoundBox({
  ipAssetId: IP_ASSET_ID,
  roundId: 4n,
  boxValue: createRoundBox({
    entries: [
      { publicKey: firstPublicKey, amount: 600n, claimed: true },
      { publicKey: secondPublicKey, amount: 400n, claimed: true },
    ],
  }),
});

assert.equal(
  deriveV7ReleaseState({
    poolState: poolWithoutHeldFunds,
    activeRound: completeRound,
  }).releaseStatus,
  'complete'
);

assert.equal(
  deriveV7ReleaseState({
    poolState: {
      currentRoundId: 4n,
      heldUsdcAtomicUnits: 1n,
    },
    activeRound: decoded,
  }).releaseStatus,
  'ready'
);

assert.equal(
  deriveV7ReleaseState({
    poolState: poolWithoutHeldFunds,
    activeRound: null,
    roundReadStatus: 'missing',
    reason: 'missing fixture',
  }).releaseStatus,
  'blocked'
);

const requests = [];

const successfulAlgod = {
  getApplicationBoxByName(appId, boxName) {
    requests.push({
      appId,
      boxName: new Uint8Array(boxName),
    });

    return {
      do: async () => ({ value: roundBox }),
    };
  },
};

const readPending = await readV7ActiveRoundState({
  algodClient: successfulAlgod,
  revenuePoolAppId: APP_ID,
  expectedRevenuePoolAppId: APP_ID,
  ipAssetId: IP_ASSET_ID,
  poolState: poolWithoutHeldFunds,
});

assert.equal(readPending.releaseStatus, 'pending');
assert.equal(requests.length, 1);
assert.equal(requests[0].appId, APP_ID);

const missingAlgod = {
  getApplicationBoxByName() {
    return {
      async do() {
        const error = new Error('not found');
        error.status = 404;
        throw error;
      },
    };
  },
};

const missingRound = await readV7ActiveRoundState({
  algodClient: missingAlgod,
  revenuePoolAppId: APP_ID,
  expectedRevenuePoolAppId: APP_ID,
  ipAssetId: IP_ASSET_ID,
  poolState: poolWithoutHeldFunds,
});

assert.equal(missingRound.releaseStatus, 'blocked');
assert.equal(missingRound.roundReadStatus, 'missing');

const failingAlgod = {
  getApplicationBoxByName() {
    return {
      async do() {
        const error = new Error('unavailable');
        error.status = 503;
        throw error;
      },
    };
  },
};

await assert.rejects(
  () =>
    readV7ActiveRoundState({
      algodClient: failingAlgod,
      revenuePoolAppId: APP_ID,
      expectedRevenuePoolAppId: APP_ID,
      ipAssetId: IP_ASSET_ID,
      poolState: poolWithoutHeldFunds,
    }),
  V7RoundStateNetworkError
);

let mismatchCalled = false;

const mismatchAlgod = {
  getApplicationBoxByName() {
    mismatchCalled = true;

    return {
      do: async () => ({ value: roundBox }),
    };
  },
};

const mismatch = await readV7ActiveRoundState({
  algodClient: mismatchAlgod,
  revenuePoolAppId: APP_ID,
  expectedRevenuePoolAppId: APP_ID + 1,
  ipAssetId: IP_ASSET_ID,
  poolState: {
    currentRoundId: 4n,
    heldUsdcAtomicUnits: 1n,
  },
});

assert.equal(mismatch.releaseStatus, 'blocked');
assert.equal(mismatch.roundReadStatus, 'app-id-mismatch');
assert.equal(mismatchCalled, false);

console.log('✅ revenue-pool-v7-round-state tests passed');