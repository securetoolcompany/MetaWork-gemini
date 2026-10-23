// lib/tokenized-funds/nillion/rewards.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateNillionRewards } from './rewards.js';

const WALLET_A = '0x1111111111111111111111111111111111111111';
const WALLET_B = '0x2222222222222222222222222222222222222222';

function makeSnapshot() {
  return {
    nodeId: '19',
    blockTimestamp: '110',
    ownerMatches: true,
    stakeBaseUnits: '100000000',
    enrolledStakeBaseUnits: '100000000',

    status: {
      earning: true,
      enrolled: true,
      stakeEligible: true,
      keyValid: true,
      retired: false,
      stakeSynced: true,
    },

    emissions: {
      accruedBaseUnits: '2000000',
      snapshotIndex: '0',
      index: '0',
      lastTouch: '100',
      totalEnrolledBaseUnits: '100000000',
      rateBaseUnitsPerSecond: '1000000',
    },

    warnings: [],
  };
}

function makeConfig() {
  return {
    version: 1,
    managementFeeBps: 5000,
    managementFeeBasis: 'rewards_after_operating_costs',
    nodes: {
      '19': {
        stakers: [
          { wallet: WALLET_A, amountNil: '60' },
          { wallet: WALLET_B, amountNil: '40' },
        ],
      },
    },
  };
}

test('calculates live pending rewards rather than accrued alone', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
  );

  // 2 NIL accrued + 10 seconds at 1 NIL/second.
  assert.equal(result.grossPendingBaseUnits, '12000000');
});

test('applies the 50% fee and allocates rewards proportionally', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
  );

  assert.equal(result.estimatedManagementFeeBaseUnits, '6000000');
  assert.equal(result.estimatedInvestorPendingBaseUnits, '6000000');
  assert.equal(result.allocationsMatch, true);
  assert.equal(result.canShowInvestorEstimates, true);

  assert.deepEqual(result.investors, [
    {
      wallet: WALLET_A,
      stakeBaseUnits: '60000000',
      participationBps: '6000',
      estimatedPendingBaseUnits: '3600000',
    },
    {
      wallet: WALLET_B,
      stakeBaseUnits: '40000000',
      participationBps: '4000',
      estimatedPendingBaseUnits: '2400000',
    },
  ]);
});

test('deducts operating costs before calculating the management fee', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
    { pendingOperatingCostsBaseUnits: '2000000' },
  );

  assert.equal(result.operatingCostsIncluded, true);
  assert.equal(result.pendingOperatingCostsBaseUnits, '2000000');
  assert.equal(result.estimatedManagementFeeBaseUnits, '5000000');
  assert.equal(result.estimatedInvestorPendingBaseUnits, '5000000');
  assert.equal(
    result.investors[0].estimatedPendingBaseUnits,
    '3000000',
  );
  assert.equal(
    result.investors[1].estimatedPendingBaseUnits,
    '2000000',
  );
});

test('explicitly identifies unknown operating costs', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
  );

  assert.equal(result.operatingCostsIncluded, false);
  assert.equal(result.pendingOperatingCostsBaseUnits, null);
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes('exclude operating costs'),
    ),
  );
});

test('allows explicitly entered zero operating costs', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
    { pendingOperatingCostsBaseUnits: '0' },
  );

  assert.equal(result.operatingCostsIncluded, true);
  assert.equal(result.pendingOperatingCostsBaseUnits, '0');
});

test('does not produce negative rewards when costs exceed earnings', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
    { pendingOperatingCostsBaseUnits: '20000000' },
  );

  assert.equal(result.estimatedManagementFeeBaseUnits, '0');
  assert.equal(result.estimatedInvestorPendingBaseUnits, '0');
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes('costs exceed pending rewards'),
    ),
  );
});

test('empty investor configuration keeps node rewards visible', () => {
  const config = makeConfig();
  config.nodes['19'].stakers = [];

  const result = calculateNillionRewards(makeSnapshot(), config);

  assert.equal(result.grossPendingBaseUnits, '12000000');
  assert.equal(result.allocationsMatch, false);
  assert.equal(result.canShowInvestorEstimates, false);
  assert.deepEqual(result.investors, []);
  assert.equal(result.roundingDustBaseUnits, null);
});

test('withholds investor estimates when allocations do not reconcile', () => {
  const config = makeConfig();
  config.nodes['19'].stakers[0].amountNil = '59';

  const result = calculateNillionRewards(makeSnapshot(), config);

  assert.equal(result.recordedStakeBaseUnits, '99000000');
  assert.equal(result.allocationsMatch, false);
  assert.equal(result.canShowInvestorEstimates, false);
  assert.deepEqual(result.investors, []);
});

test('withholds investor estimates when the owner does not match', () => {
  const snapshot = makeSnapshot();
  snapshot.ownerMatches = false;

  const result = calculateNillionRewards(snapshot, makeConfig());

  assert.equal(result.canShowInvestorEstimates, false);
  assert.deepEqual(result.investors, []);
});

test('withholds investor estimates when emission stake is out of sync', () => {
  const snapshot = makeSnapshot();
  snapshot.status.stakeSynced = false;

  const result = calculateNillionRewards(snapshot, makeConfig());

  assert.equal(result.canShowInvestorEstimates, false);
  assert.deepEqual(result.investors, []);
});

test('unenrolled nodes retain accrued rewards without new accrual', () => {
  const snapshot = makeSnapshot();
  snapshot.status.enrolled = false;
  snapshot.status.earning = false;

  const result = calculateNillionRewards(snapshot, makeConfig());

  assert.equal(result.grossPendingBaseUnits, '2000000');
  assert.equal(result.projections.grossWeeklyBaseUnits, '0');
});

test('zero network stake does not cause division by zero', () => {
  const snapshot = makeSnapshot();
  snapshot.emissions.totalEnrolledBaseUnits = '0';

  const result = calculateNillionRewards(snapshot, makeConfig());

  assert.equal(result.grossPendingBaseUnits, '2000000');
  assert.equal(result.projections.grossWeeklyBaseUnits, '0');
});

test('reports rounding dust without overallocating investor rewards', () => {
  const snapshot = makeSnapshot();
  snapshot.emissions.accruedBaseUnits = '2000001';

  const result = calculateNillionRewards(snapshot, makeConfig());

  assert.equal(result.estimatedInvestorPendingBaseUnits, '6000001');
  assert.equal(result.roundingDustBaseUnits, '1');

  const allocated = result.investors.reduce(
    (sum, investor) =>
      sum + BigInt(investor.estimatedPendingBaseUnits),
    0n,
  );

  assert.equal(
    allocated + BigInt(result.roundingDustBaseUnits),
    BigInt(result.estimatedInvestorPendingBaseUnits),
  );
});

test('rejects invalid wallet addresses', () => {
  const config = makeConfig();
  config.nodes['19'].stakers[0].wallet = 'not-a-wallet';

  assert.throws(
    () => calculateNillionRewards(makeSnapshot(), config),
    /Invalid investor wallet/,
  );
});

test('rejects duplicate wallet addresses', () => {
  const config = makeConfig();
  config.nodes['19'].stakers[1].wallet = WALLET_A;

  assert.throws(
    () => calculateNillionRewards(makeSnapshot(), config),
    /Duplicate investor wallet/,
  );
});

test('rejects stake amounts with more than six decimal places', () => {
  const config = makeConfig();
  config.nodes['19'].stakers[0].amountNil = '60.0000001';

  assert.throws(
    () => calculateNillionRewards(makeSnapshot(), config),
    /at most 6 decimal places/,
  );
});

test('rejects zero stake allocations', () => {
  const config = makeConfig();
  config.nodes['19'].stakers[0].amountNil = '0';

  assert.throws(
    () => calculateNillionRewards(makeSnapshot(), config),
    /greater than zero/,
  );
});

test('rejects invalid management fees', () => {
  const config = makeConfig();
  config.managementFeeBps = 10001;

  assert.throws(
    () => calculateNillionRewards(makeSnapshot(), config),
    /managementFeeBps/,
  );
});

test('rejects unsupported management fee policies', () => {
  const config = makeConfig();
  config.managementFeeBasis = 'gross_rewards';

  assert.throws(
    () => calculateNillionRewards(makeSnapshot(), config),
    /Unsupported management fee basis/,
  );
});

test('rejects negative operating costs', () => {
  assert.throws(
    () =>
      calculateNillionRewards(makeSnapshot(), makeConfig(), {
        pendingOperatingCostsBaseUnits: '-1',
      }),
    /non-negative integer string/,
  );
});

test('rejects a backwards reward index for an enrolled node', () => {
  const snapshot = makeSnapshot();
  snapshot.emissions.snapshotIndex = '999999999999999999999';

  assert.throws(
    () => calculateNillionRewards(snapshot, makeConfig()),
    /behind the node snapshot index/,
  );
});

test('results can be serialized as JSON', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
  );

  assert.doesNotThrow(() => JSON.stringify(result));
});

test('wallet-pending positions retain their ownership and reward share', () => {
  const config = makeConfig();

  config.nodes['19'].stakers[1] = {
    id: 'node-19-investor-1',
    wallet: null,
    amountNil: '40',
  };

  const result = calculateNillionRewards(makeSnapshot(), config);

  assert.equal(result.allocationsMatch, true);
  assert.equal(result.canShowInvestorEstimates, true);
  assert.equal(result.walletPendingCount, 1);
  assert.equal(
    result.estimatedWalletPendingRewardsBaseUnits,
    '2400000',
  );

  assert.equal(result.positions.length, 2);
  assert.equal(result.investors.length, 1);

  const pendingPosition = result.positions.find(
    (position) => position.id === 'node-19-investor-1',
  );

  assert.ok(pendingPosition);
  assert.equal(pendingPosition.wallet, null);
  assert.equal(pendingPosition.receivingWalletStatus, 'pending');
  assert.equal(pendingPosition.participationBps, '4000');
  assert.equal(
    pendingPosition.estimatedPendingBaseUnits,
    '2400000',
  );

  // The wallet-bearing position keeps only its own 60% share.
  assert.equal(
    result.investors[0].estimatedPendingBaseUnits,
    '3600000',
  );
});

test('wallet-pending positions require an explicit stable ID', () => {
  const config = makeConfig();
  config.nodes['19'].stakers[1].wallet = null;

  assert.throws(
    () => calculateNillionRewards(makeSnapshot(), config),
    /wallet-pending position requires an explicit ID/,
  );
});

test('rejects duplicate explicit position IDs', () => {
  const config = makeConfig();

  config.nodes['19'].stakers[0].id = 'same-position';
  config.nodes['19'].stakers[1].id = 'same-position';

  assert.throws(
    () => calculateNillionRewards(makeSnapshot(), config),
    /Duplicate position ID/,
  );
});

test('adding a receiving wallet preserves position identity and earnings', () => {
  const config = makeConfig();

  config.nodes['19'].stakers[1] = {
    id: 'node-19-investor-1',
    wallet: null,
    amountNil: '40',
  };

  const before = calculateNillionRewards(makeSnapshot(), config);

  config.version += 1;
  config.nodes['19'].stakers[1].wallet = WALLET_B;

  const after = calculateNillionRewards(makeSnapshot(), config);

  const beforePosition = before.positions.find(
    (position) => position.id === 'node-19-investor-1',
  );

  const afterPosition = after.positions.find(
    (position) => position.id === 'node-19-investor-1',
  );

  assert.ok(beforePosition);
  assert.ok(afterPosition);

  assert.equal(afterPosition.id, beforePosition.id);
  assert.equal(
    afterPosition.stakeBaseUnits,
    beforePosition.stakeBaseUnits,
  );
  assert.equal(
    afterPosition.estimatedPendingBaseUnits,
    beforePosition.estimatedPendingBaseUnits,
  );

  assert.equal(afterPosition.wallet, WALLET_B);
  assert.equal(afterPosition.receivingWalletStatus, 'provided');
  assert.equal(after.walletPendingCount, 0);
  assert.equal(after.estimatedWalletPendingRewardsBaseUnits, '0');
  assert.equal(after.investors.length, 2);
});

test('rounding dust includes wallet-pending allocations correctly', () => {
  const snapshot = makeSnapshot();
  snapshot.emissions.accruedBaseUnits = '2000001';

  const config = makeConfig();

  config.nodes['19'].stakers[1] = {
    id: 'node-19-investor-1',
    wallet: null,
    amountNil: '40',
  };

  const result = calculateNillionRewards(snapshot, config);

  const allocatedAcrossAllPositions = result.positions.reduce(
    (sum, position) =>
      sum + BigInt(position.estimatedPendingBaseUnits),
    0n,
  );

  assert.equal(result.roundingDustBaseUnits, '1');

  assert.equal(
    allocatedAcrossAllPositions + BigInt(result.roundingDustBaseUnits),
    BigInt(result.estimatedInvestorPendingBaseUnits),
  );

  assert.equal(
    result.estimatedWalletPendingRewardsBaseUnits,
    '2400000',
  );
});


test('position breakdown reconciles gross, costs, fee, and pending', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
  );

  const a = result.positions.find((p) => p.wallet === WALLET_A);

  assert.equal(a.grossShareBaseUnits, '7200000');
  assert.equal(a.operatingCostsShareBaseUnits, '0');
  assert.equal(a.managementFeeShareBaseUnits, '3600000');
  assert.equal(a.estimatedPendingBaseUnits, '3600000');
});

test('position breakdown deducts operating costs before the fee', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
    { pendingOperatingCostsBaseUnits: '2000000' },
  );

  const a = result.positions.find((p) => p.wallet === WALLET_A);

  assert.equal(a.grossShareBaseUnits, '7200000');
  assert.equal(a.operatingCostsShareBaseUnits, '1200000');
  assert.equal(a.managementFeeShareBaseUnits, '3000000');
  assert.equal(a.estimatedPendingBaseUnits, '3000000');
});

test('position breakdown never goes negative when costs exceed rewards', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
    { pendingOperatingCostsBaseUnits: '20000000' },
  );

  const a = result.positions.find((p) => p.wallet === WALLET_A);

  assert.equal(a.operatingCostsShareBaseUnits, '7200000');
  assert.equal(a.managementFeeShareBaseUnits, '0');
  assert.equal(a.estimatedPendingBaseUnits, '0');
});

test('position breakdown reconciles exactly with rounding dust', () => {
  const snapshot = makeSnapshot();
  snapshot.emissions.accruedBaseUnits = '2000001';

  const result = calculateNillionRewards(snapshot, makeConfig());

  for (const position of result.positions) {
    assert.equal(
      BigInt(position.grossShareBaseUnits) -
        BigInt(position.operatingCostsShareBaseUnits) -
        BigInt(position.managementFeeShareBaseUnits),
      BigInt(position.estimatedPendingBaseUnits),
    );
  }
});

test('position projections are proportional shares after the fee', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
  );

  const a = result.positions.find((p) => p.wallet === WALLET_A);

  // Node gross: 86,400 NIL/day. After 50% fee: 43,200. 60% share: 25,920.
  assert.equal(a.projections.dailyAfterFeeBaseUnits, '25920000000');
  assert.equal(a.projections.weeklyAfterFeeBaseUnits, '181440000000');
  assert.equal(a.projections.yearlyAfterFeeBaseUnits, '9460800000000');
});

test('wallet-pending positions also receive the breakdown', () => {
  const config = makeConfig();

  config.nodes['19'].stakers[1] = {
    id: 'node-19-investor-1',
    wallet: null,
    amountNil: '40',
  };

  const result = calculateNillionRewards(makeSnapshot(), config);

  const pending = result.positions.find(
    (p) => p.id === 'node-19-investor-1',
  );

  assert.equal(pending.grossShareBaseUnits, '4800000');
  assert.equal(pending.managementFeeShareBaseUnits, '2400000');
  assert.equal(pending.estimatedPendingBaseUnits, '2400000');
});

test('withheld estimates produce no position breakdown', () => {
  const snapshot = makeSnapshot();
  snapshot.ownerMatches = false;

  const result = calculateNillionRewards(snapshot, makeConfig());

  assert.deepEqual(result.positions, []);
});


test('position projections show before-fee, fee, and after-fee', () => {
  const result = calculateNillionRewards(
    makeSnapshot(),
    makeConfig(),
  );

  const a = result.positions.find((p) => p.wallet === WALLET_A);
  const p = a.projections;

  assert.equal(p.dailyGrossBaseUnits, '51840000000');
  assert.equal(p.dailyManagementFeeBaseUnits, '25920000000');
  assert.equal(p.dailyAfterFeeBaseUnits, '25920000000');

  assert.equal(p.weeklyGrossBaseUnits, '362880000000');
  assert.equal(p.yearlyGrossBaseUnits, '18921600000000');

  for (const period of ['daily', 'weekly', 'yearly']) {
    const key = (suffix) => p[`${period}${suffix}BaseUnits`];

    assert.equal(
      BigInt(key('Gross')) - BigInt(key('ManagementFee')),
      BigInt(key('AfterFee')),
    );
  }
});