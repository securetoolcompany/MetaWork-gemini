// lib/tokenized-funds/nillion/investment-workbook.js

import ExcelJS from 'exceljs';
import { isAddress } from 'viem';

import {
  NILLION_FEE_DISCLOSURE,
  validateNillionFeePolicy,
} from './fee-policy.js';

function text(value) {
  if (typeof value !== 'string') {
    throw new Error('Workbook values must be strings.');
  }

  if (value.length > 32_767) {
    throw new Error('Workbook value exceeds the Excel cell limit.');
  }

  return value;
}

function unsigned(value, field) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`${field} must be a non-negative integer string.`);
  }

  return BigInt(value);
}

function nil(value) {
  const amount = unsigned(value, 'NIL amount');

  return `${amount / 1_000_000n}.${(amount % 1_000_000n)
    .toString()
    .padStart(6, '0')}`;
}

function eth(value) {
  const amount = unsigned(value, 'ETH amount');
  const scale = 10n ** 18n;

  return `${amount / scale}.${(amount % scale)
    .toString()
    .padStart(18, '0')}`;
}

function percent(value) {
  const bps = unsigned(value, 'Basis points');

  return `${bps / 100n}.${(bps % 100n)
    .toString()
    .padStart(2, '0')}%`;
}

function sameWallet(value, wallet) {
  return (
    typeof value === 'string' &&
    value.toLowerCase() === wallet
  );
}

function addSheet(workbook, name, headers, rows) {
  const sheet = workbook.addWorksheet(name);

  sheet.addRow(headers.map(text));

  for (const row of rows) {
    // Assign strings only: never formula or hyperlink objects.
    sheet.addRow(row.map(text));
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  sheet.columns.forEach((column, index) => {
    column.width = index === 0 ? 40 : 32;
    column.numFmt = '@';
  });

  sheet.getRow(1).font = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };

  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF172554' },
  };

  sheet.eachRow((row) => {
    row.alignment = {
      vertical: 'top',
      wrapText: true,
    };
  });

  return sheet;
}

export function buildNillionInvestmentWorkbook({
  node,
  wallet,
  snapshotWarning = null,
}) {
  if (
    typeof wallet !== 'string' ||
    !isAddress(wallet, { strict: false })
  ) {
    throw new Error('A valid receiving wallet is required.');
  }

  if (
    !node ||
    typeof node.nodeId !== 'string' ||
    !/^\d+$/.test(node.nodeId)
  ) {
    throw new Error('A valid node snapshot is required.');
  }

  text(node.name);
  unsigned(node.blockNumber, 'Snapshot block');

  if (
    typeof node.fetchedAt !== 'string' ||
    !Number.isFinite(Date.parse(node.fetchedAt))
  ) {
    throw new Error('A valid snapshot timestamp is required.');
  }

  if (snapshotWarning !== null) text(snapshotWarning);

  validateNillionFeePolicy(node.rewards);

  const selectedWallet = wallet.toLowerCase();
  const rewards = node.rewards;

  if (
    typeof rewards.canShowInvestorEstimates !== 'boolean' ||
    !Array.isArray(rewards.positions) ||
    !Array.isArray(rewards.warnings)
  ) {
    throw new Error('Invalid reward report.');
  }

  const positions = rewards.canShowInvestorEstimates
    ? rewards.positions.filter((position) =>
        sameWallet(position.wallet, selectedWallet),
      )
    : [];

  const rewardStatus = !rewards.canShowInvestorEstimates
    ? 'Unavailable: allocation or chain checks do not reconcile.'
    : positions.length === 0
      ? 'No live allocation found for the selected wallet.'
      : 'Live unclaimed estimates; not payments received.';

    const ethData = node.eth;

  const ethAvailable =
    ethData?.available === true &&
    typeof ethData.accruedWei === 'string' &&
    typeof ethData.sharesPosted === 'string';

  const ethPositions =
    ethAvailable &&
    ethData.canShowInvestorEstimates === true &&
    Array.isArray(ethData.positions)
      ? ethData.positions.filter((position) =>
          sameWallet(position.wallet, selectedWallet),
        )
      : [];

  const ethStatus = ethData === undefined || ethData === null
    ? 'Unavailable: no ETH earnings supplied.'
    : !ethAvailable
      ? 'Unavailable: ETH earnings could not be read.'
      : ethData.canShowInvestorEstimates !== true
        ? 'Unavailable: allocation or chain checks do not reconcile.'
        : ethPositions.length === 0
          ? 'No live allocation found for the selected wallet.'
          : 'Live accrued estimates; not payments received.';

  const report = node.payouts;

  if (
    report !== undefined &&
    report !== null &&
    typeof report.available !== 'boolean'
  ) {
    throw new Error('Invalid payout availability.');
  }

  const payoutsAvailable = report?.available === true;

  if (
    payoutsAvailable &&
    (
      report.currency !== 'NIL' ||
      report.decimals !== 6 ||
      report.scope !== 'recorded_ledger_only' ||
      report.includesLiveUnclaimedRewards !== false ||
      report.freshChainVerificationPerformed !== false ||
      !Array.isArray(report.positions) ||
      !Array.isArray(report.payments)
    )
  ) {
    throw new Error('Unsupported payout report.');
  }

  const recordedPositions = payoutsAvailable
    ? report.positions.filter(
        (position) =>
          position.nodeId === node.nodeId &&
          sameWallet(position.wallet, selectedWallet),
      )
    : [];

  const positionKeys = new Set(
    recordedPositions.map((position) => text(position.positionId)),
  );

  const payments = payoutsAvailable
    ? report.payments.filter((payment) =>
        sameWallet(payment.wallet, selectedWallet),
      )
    : [];

  for (const payment of payments) {
    if (!positionKeys.has(payment.positionId)) {
      throw new Error(
        'Payment does not match a selected-wallet position on this node.',
      );
    }
  }

  const payoutStatus = !payoutsAvailable
    ? 'Unavailable: no recorded payout balance can be confirmed.'
    : recordedPositions.length === 0 && payments.length === 0
      ? 'No distributions recorded for this wallet on this node.'
      : 'Published ledger records; not fresh chain verification.';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MetaWork';
  workbook.title = `Nillion Node ${node.nodeId} investment report`;

  addSheet(workbook, 'Summary', ['Field', 'Value'], [
    ['Node ID', node.nodeId],
    ['Node name', node.name],
    ['Receiving wallet', selectedWallet],
    ['Snapshot time', node.fetchedAt],
    ['Snapshot block', node.blockNumber],
    ['Snapshot warning', snapshotWarning ?? 'None supplied'],
    ['Reward currency', 'NIL'],
    ['Amount representation', 'Exact decimal text; six decimal places'],
    ['Management fee', '50% of gross rewards'],
    ['Fee policy', NILLION_FEE_DISCLOSURE],
    ['Live estimate status', rewardStatus],
		['ETH estimate status', ethStatus],
    [
      'Node ETH earned (whole node, gross)',
      ethAvailable
        ? `${eth(ethData.accruedWei)} ETH`
        : 'Unavailable',
    ],
    [
      'Node shares posted (whole node)',
      ethAvailable ? text(ethData.sharesPosted) : 'Unavailable',
    ],
    ['Recorded payout status', payoutStatus],
    [
      'Payout report message',
      report?.message === undefined
        ? 'No payout report supplied.'
        : text(report.message),
    ],
    ['Scope', 'Selected wallet on this node only'],
    [
      'Important distinction',
      'Unclaimed estimates are not paid or unpaid ledger balances.',
    ],
    [
      'Payment rows',
      'Amounts assigned to obligations; not necessarily full transfers.',
    ],
    [
      'Principal and USD',
      'Principal price calculations and USD returns are not included.',
    ],
    [
      'Warnings',
      rewards.warnings.map(text).join('\n') || 'None supplied',
    ],
  ]);

  addSheet(
    workbook,
    'Live estimates',
    [
      'Position ID',
      'Recorded stake NIL',
      'Ownership share',
      'Gross reward share NIL',
      'Management fee share NIL',
      'Estimated pending NIL',
    ],
    positions.length === 0
      ? [[rewardStatus]]
      : positions.map((position) => [
          text(position.id),
          nil(position.stakeBaseUnits),
          percent(position.participationBps),
          nil(position.grossShareBaseUnits),
          nil(position.managementFeeShareBaseUnits),
          nil(position.estimatedPendingBaseUnits),
        ]),
  );

	addSheet(
    workbook,
    'ETH estimates',
    [
      'Position ID',
      'Gross ETH share',
      'Management fee share ETH',
      'Estimated ETH distribution',
    ],
    ethPositions.length === 0
      ? [[ethStatus]]
      : ethPositions.map((position) => [
          text(position.id),
          eth(position.grossShareWei),
          eth(position.managementFeeShareWei),
          eth(position.estimatedPendingWei),
        ]),
  );

  addSheet(
    workbook,
    'Projections',
    [
      'Position ID',
      'Period',
      'Gross share NIL',
      'Management fee share NIL',
      'After-fee estimate NIL',
      'Assumption',
    ],
    positions.length === 0
      ? [[rewardStatus]]
      : positions.flatMap((position) =>
          ['daily', 'weekly', 'yearly'].map((period) => [
            text(position.id),
            period,
            nil(position.projections[`${period}GrossBaseUnits`]),
            nil(position.projections[`${period}ManagementFeeBaseUnits`]),
            nil(position.projections[`${period}AfterFeeBaseUnits`]),
            'Current conditions continue; no compounding; 365-day year.',
          ]),
        ),
  );

  addSheet(
    workbook,
    'Recorded distributions',
    [
      'Position ID',
      'Allocated NIL',
      'Paid NIL',
      'Unpaid NIL',
    ],
    recordedPositions.length === 0
      ? [[payoutStatus]]
      : recordedPositions.map((position) => [
          text(position.positionId),
          nil(position.recordedAllocatedBaseUnits),
          nil(position.recordedPaidBaseUnits),
          nil(position.recordedUnpaidBaseUnits),
        ]),
  );

  addSheet(
    workbook,
    'Payment history',
    [
      'Batch ID',
      'Position ID',
      'Amount assigned NIL',
      'Transaction hash',
      'Log index',
      'Block number',
      'Block hash',
    ],
    payments.length === 0
      ? [[
          payoutsAvailable
            ? 'No payments recorded for this wallet on this node.'
            : payoutStatus,
        ]]
      : payments.map((payment) => {
          if (
            !/^0x[a-fA-F0-9]{64}$/.test(payment.transactionHash) ||
            !/^0x[a-fA-F0-9]{64}$/.test(payment.blockHash)
          ) {
            throw new Error('Invalid recorded payment hash.');
          }

          unsigned(payment.logIndex, 'Payment log index');
          unsigned(payment.blockNumber, 'Payment block');

          return [
            text(payment.batchId),
            text(payment.positionId),
            nil(payment.amountBaseUnits),
            text(payment.transactionHash),
            payment.logIndex,
            payment.blockNumber,
            text(payment.blockHash),
          ];
        }),
  );

  return workbook;
}