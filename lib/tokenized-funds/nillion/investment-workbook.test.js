// lib/tokenized-funds/nillion/investment-workbook.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import {
  buildNillionInvestmentWorkbook,
} from './investment-workbook.js';

const WALLET_A = '0x1111111111111111111111111111111111111111';
const WALLET_B = '0x2222222222222222222222222222222222222222';
const TX = `0x${'a'.repeat(64)}`;
const BLOCK = `0x${'b'.repeat(64)}`;

function input() {
  const projections = {};

  for (const period of ['daily', 'weekly', 'yearly']) {
    projections[`${period}GrossBaseUnits`] = '2000000';
    projections[`${period}ManagementFeeBaseUnits`] = '1000000';
    projections[`${period}AfterFeeBaseUnits`] = '1000000';
  }

  return {
    wallet: WALLET_A,
    node: {
      nodeId: '19',
      name: 'Nillion Node #19',
      fetchedAt: '2026-10-24T19:00:00.000Z',
      blockNumber: '12345678',
      rewards: {
        managementFeeBps: 5000,
        managementFeeBasis: 'gross_rewards_operator_covers_costs',
        canShowInvestorEstimates: true,
        warnings: [],
        positions: [
          {
            id: 'position-a',
            wallet: WALLET_A,
            stakeBaseUnits: '60000000',
            participationBps: '6000',
            grossShareBaseUnits: '7200000',
            managementFeeShareBaseUnits: '3600000',
            estimatedPendingBaseUnits: '3600000',
            projections: { ...projections },
          },
          {
            id: 'position-b',
            wallet: WALLET_B,
            stakeBaseUnits: '40000000',
            participationBps: '4000',
            grossShareBaseUnits: '4800000',
            managementFeeShareBaseUnits: '2400000',
            estimatedPendingBaseUnits: '2400000',
            projections: { ...projections },
          },
        ],
      },
      payouts: {
        available: true,
        status: 'recorded',
        currency: 'NIL',
        decimals: 6,
        scope: 'recorded_ledger_only',
        includesLiveUnclaimedRewards: false,
        freshChainVerificationPerformed: false,
        message: 'Recorded ledger only.',
        positions: [
          {
            nodeId: '19',
            positionId: 'position-a',
            wallet: WALLET_A,
            recordedAllocatedBaseUnits: '3000000',
            recordedPaidBaseUnits: '1000000',
            recordedUnpaidBaseUnits: '2000000',
          },
          {
            nodeId: '19',
            positionId: 'position-b',
            wallet: WALLET_B,
            recordedAllocatedBaseUnits: '2000000',
            recordedPaidBaseUnits: '0',
            recordedUnpaidBaseUnits: '2000000',
          },
        ],
        payments: [
          {
            batchId: 'batch-1',
            positionId: 'position-a',
            wallet: WALLET_A,
            amountBaseUnits: '1000000',
            transactionHash: TX,
            logIndex: '7',
            blockNumber: '12345000',
            blockHash: BLOCK,
          },
        ],
      },
    },
  };
}

function summaryValue(workbook, field) {
  const sheet = workbook.getWorksheet('Summary');
  let value;

  sheet.eachRow((row) => {
    if (row.getCell(1).value === field) {
      value = row.getCell(2).value;
    }
  });

  return value;
}

test('creates six sheets and separates live estimates from ledger balances', () => {
  const workbook = buildNillionInvestmentWorkbook(input());

  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    [
      'Summary',
      'Live estimates',
      'ETH estimates',
      'Projections',
      'Recorded distributions',
      'Payment history',
    ],
  );

  assert.equal(
    workbook.getWorksheet('Live estimates').getCell('F2').value,
    '3.600000',
  );

  assert.equal(
    workbook.getWorksheet('Recorded distributions').getCell('D2').value,
    '2.000000',
  );

  assert.equal(
    workbook.getWorksheet('Payment history').getCell('C2').value,
    '1.000000',
  );
});

test('exports only the selected wallet and keeps wallet-pending shares out', () => {
  const args = input();

  args.node.rewards.positions.push({
    ...args.node.rewards.positions[1],
    id: 'wallet-pending',
    wallet: null,
  });

  const workbook = buildNillionInvestmentWorkbook(args);
  const live = workbook.getWorksheet('Live estimates');

  assert.equal(live.rowCount, 2);
  assert.equal(live.getCell('A2').value, 'position-a');
  assert.equal(workbook.getWorksheet('Projections').rowCount, 4);

  args.wallet = WALLET_B;

  const other = buildNillionInvestmentWorkbook(args);
  assert.equal(
    other.getWorksheet('Live estimates').getCell('A2').value,
    'position-b',
  );
  assert.equal(
    other.getWorksheet('Payment history').getCell('A2').value,
    'No payments recorded for this wallet on this node.',
  );
});

test('withheld live estimates do not suppress available ledger records', () => {
  const args = input();
  args.node.rewards.canShowInvestorEstimates = false;

  const workbook = buildNillionInvestmentWorkbook(args);

  assert.match(
    workbook.getWorksheet('Live estimates').getCell('A2').value,
    /Unavailable/,
  );

  assert.equal(
    workbook.getWorksheet('Recorded distributions').getCell('B2').value,
    '3.000000',
  );
});

test('missing and unavailable payout reports never become zero balances', () => {
  for (const report of [
    undefined,
    { available: false, message: 'Ledger unavailable.' },
  ]) {
    const args = input();
    args.node.payouts = report;

    const workbook = buildNillionInvestmentWorkbook(args);

    assert.match(
      summaryValue(workbook, 'Recorded payout status'),
      /Unavailable/,
    );

    const sheet = workbook.getWorksheet('Recorded distributions');
    assert.match(sheet.getCell('A2').value, /Unavailable/);
    assert.equal(sheet.getCell('B2').value, null);
  }
});

test('an empty ledger is distinct from unavailable reporting', () => {
  const args = input();
  args.node.payouts.status = 'empty';
  args.node.payouts.positions = [];
  args.node.payouts.payments = [];

  const workbook = buildNillionInvestmentWorkbook(args);

  assert.match(
    summaryValue(workbook, 'Recorded payout status'),
    /No distributions recorded/,
  );

  assert.equal(
    workbook.getWorksheet('Recorded distributions').getCell('B2').value,
    null,
  );
});

test('preserves exact large amounts and literal text through XLSX round-trip', async () => {
  const args = input();
  args.node.name = '=1+1';
  args.node.rewards.positions[0].stakeBaseUnits =
    '9007199254740993123456789';

  const workbook = buildNillionInvestmentWorkbook(args);
  const buffer = await workbook.xlsx.writeBuffer();

  assert.ok(buffer.byteLength > 0);

  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);

  assert.equal(summaryValue(loaded, 'Node name'), '=1+1');

  const cell = loaded.getWorksheet('Live estimates').getCell('B2');
  assert.equal(cell.value, '9007199254740993123.456789');
  assert.equal(cell.type, ExcelJS.ValueType.String);
});

test('rejects invalid wallets, old fee policies, and malformed amounts', () => {
  const badWallet = input();
  badWallet.wallet = 'not-a-wallet';

  assert.throws(
    () => buildNillionInvestmentWorkbook(badWallet),
    /valid receiving wallet/,
  );

  const oldPolicy = input();
  oldPolicy.node.rewards.managementFeeBasis =
    'rewards_after_operating_costs';

  assert.throws(
    () => buildNillionInvestmentWorkbook(oldPolicy),
    /Unsupported Nillion management fee basis/,
  );

  const badAmount = input();
  badAmount.node.rewards.positions[0].estimatedPendingBaseUnits = '1.5';

  assert.throws(
    () => buildNillionInvestmentWorkbook(badAmount),
    /non-negative integer string/,
  );
});

test('rejects a selected-wallet payment without a matching node position', () => {
  const args = input();
  args.node.payouts.positions[0].nodeId = '20';

  assert.throws(
    () => buildNillionInvestmentWorkbook(args),
    /Payment does not match/,
  );
});

test('preserves zero values and does not mutate its input', () => {
  const args = input();
  args.node.rewards.positions[0].estimatedPendingBaseUnits = '0';
  const before = JSON.stringify(args);

  const workbook = buildNillionInvestmentWorkbook(args);

  assert.equal(
    workbook.getWorksheet('Live estimates').getCell('F2').value,
    '0.000000',
  );
  assert.equal(JSON.stringify(args), before);
});

test('carries snapshot warnings and the operating-cost disclosure', () => {
  const args = input();
  args.snapshotWarning = 'Showing the last successful snapshot.';

  const workbook = buildNillionInvestmentWorkbook(args);

  assert.equal(
    summaryValue(workbook, 'Snapshot warning'),
    args.snapshotWarning,
  );

  assert.match(
    summaryValue(workbook, 'Fee policy'),
    /No additional operating-cost deduction/,
  );
});

test('exports the selected wallet ETH estimates as exact text', () => {
  const args = input();

  args.node.eth = {
    available: true,
    accruedWei: '1000000000000000000',
    sharesPosted: '2',
    canShowInvestorEstimates: true,
    positions: [
      {
        id: 'position-a',
        wallet: WALLET_A,
        grossShareWei: '600000000000000000',
        managementFeeShareWei: '300000000000000000',
        estimatedPendingWei: '300000000000000000',
      },
      {
        id: 'position-b',
        wallet: WALLET_B,
        grossShareWei: '400000000000000000',
        managementFeeShareWei: '200000000000000000',
        estimatedPendingWei: '200000000000000000',
      },
    ],
  };

  const workbook = buildNillionInvestmentWorkbook(args);
  const sheet = workbook.getWorksheet('ETH estimates');

  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.getCell('A2').value, 'position-a');
  assert.equal(sheet.getCell('B2').value, '0.600000000000000000');
  assert.equal(sheet.getCell('C2').value, '0.300000000000000000');
  assert.equal(sheet.getCell('D2').value, '0.300000000000000000');

  assert.equal(
    summaryValue(workbook, 'Node ETH earned (whole node, gross)'),
    '1.000000000000000000 ETH',
  );
  assert.equal(
    summaryValue(workbook, 'Node shares posted (whole node)'),
    '2',
  );
});

test('missing ETH data is marked unavailable and never becomes zero', () => {
  const workbook = buildNillionInvestmentWorkbook(input());
  const sheet = workbook.getWorksheet('ETH estimates');

  assert.match(summaryValue(workbook, 'ETH estimate status'), /Unavailable/);
  assert.match(sheet.getCell('A2').value, /Unavailable/);
  assert.equal(sheet.getCell('B2').value, null);
});