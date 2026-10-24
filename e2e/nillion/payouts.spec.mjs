// e2e/nillion/payouts.spec.mjs

import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';

const WALLET = '0x2222222222222222222222222222222222222222';
const OTHER_WALLET = '0x3333333333333333333333333333333333333333';
const OWNER = '0x1111111111111111111111111111111111111111';
const PAYMENT_TX = `0x${'a'.repeat(64)}`;
const BLOCK_HASH = `0x${'b'.repeat(64)}`;

function payoutReport(nodeId, mode) {
  if (mode === 'unavailable') {
    return {
      available: false,
      status: 'unavailable',
      message: 'Payout reporting is temporarily unavailable.',
    };
  }

  const populated = mode === 'populated';

  return {
    available: true,
    status: populated ? 'recorded' : 'empty',
    currency: 'NIL',
    decimals: 6,
    scope: 'recorded_ledger_only',
    includesLiveUnclaimedRewards: false,
    freshChainVerificationPerformed: false,
    message: populated
      ? 'Recorded distributions and reconciled payments only.'
      : 'No distributions recorded yet.',

    totals: {
      grossClaimedBaseUnits: populated ? '12000000' : '0',
      managementFeeBaseUnits: populated ? '6000000' : '0',
      recordedAllocatedBaseUnits: populated ? '3600000' : '0',
      recordedPaidBaseUnits: populated ? '1000000' : '0',
      recordedUnpaidBaseUnits: populated ? '2600000' : '0',
      roundingRemainderBaseUnits: '0',
    },

    positions: populated
      ? [
          {
            nodeId,
            positionId: `node-${nodeId}-test-position`,
            wallet: WALLET,
            receivingWalletStatus: 'provided',
            recordedAllocatedBaseUnits: '3600000',
            recordedPaidBaseUnits: '1000000',
            recordedUnpaidBaseUnits: '2600000',
            batchIds: [`test-batch-${nodeId}`],
          },
        ]
      : [],

    batches: [],

    payments: populated
      ? [
          {
            batchId: `test-batch-${nodeId}`,
            positionId: `node-${nodeId}-test-position`,
            wallet: WALLET,
            amountBaseUnits: '1000000',
            transactionHash: PAYMENT_TX,
            logIndex: '9',
            blockNumber: '200',
            blockHash: BLOCK_HASH,
          },
        ]
      : [],
  };
}

function nodeFixture(nodeId, mode) {
  const position = {
    id: `node-${nodeId}-test-position`,
    wallet: WALLET,
    receivingWalletStatus: 'provided',
    stakeBaseUnits: '60000000',
    participationBps: '6000',
    estimatedPendingBaseUnits: '3600000',
    grossShareBaseUnits: '7200000',
    operatingCostsShareBaseUnits: '0',
    managementFeeShareBaseUnits: '3600000',

    projections: {
      dailyGrossBaseUnits: '2000000',
      dailyManagementFeeBaseUnits: '1000000',
      dailyAfterFeeBaseUnits: '1000000',
      weeklyGrossBaseUnits: '14000000',
      weeklyManagementFeeBaseUnits: '7000000',
      weeklyAfterFeeBaseUnits: '7000000',
      yearlyGrossBaseUnits: '730000000',
      yearlyManagementFeeBaseUnits: '365000000',
      yearlyAfterFeeBaseUnits: '365000000',
    },
  };

  return {
    nodeId,
    name: `Nillion Node #${nodeId}`,
    owner: OWNER,
    stakeBaseUnits: '100000000',
    blockNumber: '200',
    fetchedAt: '2026-10-24T18:00:00.000Z',

    principalPerformance: {
      available: false,
      message: 'Price unavailable in this UI fixture.',
    },

    status: {
      earning: true,
      enrolled: true,
      stakeEligible: true,
      keyValid: true,
      retired: false,
      stakeSynced: true,
    },

    unbonding: [],

    rewards: {
      managementFeeBps: 5000,
      managementFeeBasis: 'gross_rewards_operator_covers_costs',
      grossPendingBaseUnits: '12000000',
      estimatedInvestorPendingBaseUnits: '6000000',
      canShowInvestorEstimates: true,
      operatingCostsIncluded: false,
      positions: [position],
      investors: [position],
      warnings: [],

      projections: {
        grossAprBps: '2200',
        investorAprAfterFeeBps: '1100',
        grossDailyBaseUnits: '3333333',
        grossWeeklyBaseUnits: '23333333',
        grossYearlyBaseUnits: '1216666666',
        investorDailyAfterFeeBaseUnits: '1666667',
        investorWeeklyAfterFeeBaseUnits: '11666667',
        investorYearlyAfterFeeBaseUnits: '608333333',
      },
    },

    payouts: payoutReport(nodeId, mode),
  };
}

async function openFixture(
  page,
  { mode = 'populated', wallet = WALLET } = {},
) {
  await page.route(
    '**/api/tokenized-funds/nillion/dashboard',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fundId: 'nillion',
          generatedAt: '2026-10-24T18:00:00.000Z',
					allocationVersion: 3,
          managementFeeBps: 5000,
          managementFeeBasis: 'gross_rewards_operator_covers_costs',
          payoutStatus: mode === 'unavailable' ? 'unavailable' : 'ok',
          status: 'ok',
          nodes: [
            nodeFixture('19', mode),
            nodeFixture('20', mode),
          ],
          errors: [],
        }),
      });
    },
  );

  const query = wallet ? `?wallet=${wallet}` : '';

  await page.goto(`/tokenized-funds/nillion/nodes/19${query}`);

  await expect(
    page.getByRole('heading', { name: 'Nillion Node #19', exact: true }),
  ).toBeVisible();
}

function payoutSection(page) {
  return page.locator('section[aria-labelledby="your-payouts-heading"]');
}

test('payout section is hidden until an address is selected', async ({ page }) => {
  await openFixture(page, { wallet: '' });

  await expect(
    page.getByRole('heading', { name: 'Node Performance', exact: true }),
  ).toBeVisible();

  await expect(payoutSection(page)).toHaveCount(0);
});

test('empty ledger shows an explicit empty state instead of earnings balances', async ({ page }) => {
  await openFixture(page, { mode: 'empty' });

  const section = payoutSection(page);

  await expect(section).toBeVisible();
  await expect(
    section.getByText('No distributions recorded yet', { exact: true }),
  ).toBeVisible();

  await expect(
    section.getByText('Recorded paid', { exact: true }),
  ).toHaveCount(0);

  await expect(section.getByRole('table')).toHaveCount(0);
});

test('populated payout report shows balances and a transaction link', async ({ page }) => {
  await openFixture(page);

  const section = payoutSection(page);

  await expect(section).toBeVisible();

  await expect(
    section.getByText('Recorded distributions allocated', { exact: true }),
  ).toBeVisible();

  await expect(
    section.getByText('Recorded paid', { exact: true }),
  ).toBeVisible();

  await expect(
    section.getByText('Recorded unpaid', { exact: true }),
  ).toBeVisible();

  await expect(section.getByText('3.600000', { exact: true })).toBeVisible();
  await expect(section.getByText('1.000000', { exact: true })).toBeVisible();
  await expect(section.getByText('2.600000', { exact: true })).toBeVisible();

  const table = section.getByRole('table');

  await expect(table).toBeVisible();
  await expect(table.getByText('test-batch-19', { exact: true })).toBeVisible();

  const link = table.getByRole('link');

  await expect(link).toHaveAttribute(
    'href',
    `https://etherscan.io/tx/${PAYMENT_TX}`,
  );
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('unavailable reporting shows a warning, not zero balances', async ({ page }) => {
  await openFixture(page, { mode: 'unavailable' });

  const section = payoutSection(page);

  await expect(section).toBeVisible();
  await expect(section.getByRole('status')).toContainText(
    'Payout reporting is temporarily unavailable.',
  );

  await expect(
    section.getByText('Recorded paid', { exact: true }),
  ).toHaveCount(0);

  await expect(
    section.getByText('No distributions recorded yet', { exact: true }),
  ).toHaveCount(0);

  await expect(section.getByRole('table')).toHaveCount(0);
});

test('changing the selected address hides the previous wallet payouts', async ({ page }) => {
  await openFixture(page);

  await expect(
    payoutSection(page).getByRole('table'),
  ).toBeVisible();

  await page.getByLabel('Ethereum wallet address', { exact: true }).fill(
    OTHER_WALLET,
  );

  await page.getByRole('button', {
    name: 'View my investment',
    exact: true,
  }).click();

  const section = payoutSection(page);

  await expect(
    section.getByText('No distributions recorded yet', { exact: true }),
  ).toBeVisible();

  await expect(section.getByRole('table')).toHaveCount(0);
});

test('mobile payout history stays inside a horizontally scrollable wrapper', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);

  const table = payoutSection(page).getByRole('table');

  await table.scrollIntoViewIfNeeded();
  await expect(table).toBeVisible();

  const layout = await table.evaluate((element) => {
    const wrapper = element.parentElement;
    const bounds = wrapper.getBoundingClientRect();

    return {
      overflowX: getComputedStyle(wrapper).overflowX,
      clientWidth: wrapper.clientWidth,
      scrollWidth: wrapper.scrollWidth,
      left: bounds.left,
      right: bounds.right,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.overflowX).toBe('auto');
  expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
});

function workbookSummaryValue(workbook, field) {
  const sheet = workbook.getWorksheet('Summary');
  expect(sheet).toBeDefined();

  let value;

  sheet.eachRow((row) => {
    if (row.getCell(1).value === field) {
      value = row.getCell(2).value;
    }
  });

  return value;
}

function workbookCellValues(workbook) {
  const values = [];

  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        values.push(cell.value);
      });
    });
  }

  return values;
}

async function downloadInvestmentWorkbook(page, wallet = WALLET) {
  const button = page.getByRole('button', {
    name: 'Download Excel report',
    exact: true,
  });

  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');

  await button.click();

  const download = await downloadPromise;

  expect(await download.failure()).toBeNull();

  expect(download.suggestedFilename()).toBe(
    `nillion-node-19-${wallet.toLowerCase()}-block-200.xlsx`,
  );

  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(downloadedPath);

  await expect(button).toBeEnabled();

  return workbook;
}

test('Excel export is hidden until a receiving wallet is selected', async ({
  page,
}) => {
  await openFixture(page, { wallet: '' });

  await expect(
    page.getByRole('button', {
      name: 'Download Excel report',
      exact: true,
    }),
  ).toHaveCount(0);

  await page.getByLabel('Ethereum wallet address', { exact: true }).fill(
    WALLET,
  );

  await page.getByRole('button', {
    name: 'View my investment',
    exact: true,
  }).click();

  await expect(
    page.getByRole('button', {
      name: 'Download Excel report',
      exact: true,
    }),
  ).toBeVisible();
});

test('Excel download contains the selected wallet snapshot and separate accounting sheets', async ({
  page,
}) => {
  await openFixture(page);

  const workbook = await downloadInvestmentWorkbook(page);

  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    'Summary',
    'Live estimates',
    'Projections',
    'Recorded distributions',
    'Payment history',
  ]);

  expect(workbookSummaryValue(workbook, 'Node ID')).toBe('19');

  expect(workbookSummaryValue(workbook, 'Receiving wallet')).toBe(
    WALLET.toLowerCase(),
  );

  expect(workbookSummaryValue(workbook, 'Snapshot block')).toBe('200');

  expect(workbookSummaryValue(workbook, 'Snapshot time')).toBe(
    '2026-10-24T18:00:00.000Z',
  );

  expect(workbookSummaryValue(workbook, 'Fee policy')).toContain(
    'No additional operating-cost deduction',
  );

  const live = workbook.getWorksheet('Live estimates');

  expect(live.rowCount).toBe(2);
  expect(live.getCell('A2').value).toBe('node-19-test-position');
  expect(live.getCell('B2').value).toBe('60.000000');
  expect(live.getCell('C2').value).toBe('60.00%');
  expect(live.getCell('D2').value).toBe('7.200000');
  expect(live.getCell('E2').value).toBe('3.600000');
  expect(live.getCell('F2').value).toBe('3.600000');

  const projections = workbook.getWorksheet('Projections');

  expect(projections.rowCount).toBe(4);
  expect(projections.getCell('B2').value).toBe('daily');
  expect(projections.getCell('C2').value).toBe('2.000000');
  expect(projections.getCell('D2').value).toBe('1.000000');
  expect(projections.getCell('E2').value).toBe('1.000000');

  const distributions = workbook.getWorksheet(
    'Recorded distributions',
  );

  expect(distributions.rowCount).toBe(2);
  expect(distributions.getCell('A2').value).toBe(
    'node-19-test-position',
  );
  expect(distributions.getCell('B2').value).toBe('3.600000');
  expect(distributions.getCell('C2').value).toBe('1.000000');
  expect(distributions.getCell('D2').value).toBe('2.600000');

  const payments = workbook.getWorksheet('Payment history');

  expect(payments.rowCount).toBe(2);
  expect(payments.getCell('A2').value).toBe('test-batch-19');
  expect(payments.getCell('B2').value).toBe('node-19-test-position');
  expect(payments.getCell('C2').value).toBe('1.000000');
  expect(payments.getCell('D2').value).toBe(PAYMENT_TX);
  expect(payments.getCell('E2').value).toBe('9');
  expect(payments.getCell('F2').value).toBe('200');
  expect(payments.getCell('G2').value).toBe(BLOCK_HASH);

  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        expect(cell.type).toBe(ExcelJS.ValueType.String);
      });
    });
  }

  expect(JSON.stringify(workbookCellValues(workbook))).not.toContain(
    'node-20-test-position',
  );
});

test('Excel export follows wallet changes without retaining previous wallet records', async ({
  page,
}) => {
  await openFixture(page);

  const first = await downloadInvestmentWorkbook(page);

  expect(
    first.getWorksheet('Payment history').getCell('D2').value,
  ).toBe(PAYMENT_TX);

  await page.getByLabel('Ethereum wallet address', { exact: true }).fill(
    OTHER_WALLET,
  );

  await page.getByRole('button', {
    name: 'View my investment',
    exact: true,
  }).click();

  await expect(
    payoutSection(page).getByText(
      'No distributions recorded yet',
      { exact: true },
    ),
  ).toBeVisible();

  const second = await downloadInvestmentWorkbook(page, OTHER_WALLET);

  expect(workbookSummaryValue(second, 'Receiving wallet')).toBe(
    OTHER_WALLET.toLowerCase(),
  );

  expect(
    second.getWorksheet('Live estimates').getCell('A2').value,
  ).toContain('No live allocation found');

  expect(
    second.getWorksheet('Recorded distributions').getCell('B2').value,
  ).toBeNull();

  expect(
    second.getWorksheet('Payment history').getCell('C2').value,
  ).toBeNull();

  const exportedValues = JSON.stringify(workbookCellValues(second));

  expect(exportedValues).not.toContain(WALLET);
  expect(exportedValues).not.toContain(PAYMENT_TX);
  expect(exportedValues).not.toContain('node-19-test-position');
});

test('Excel export preserves an empty ledger without substituting live earnings', async ({
  page,
}) => {
  await openFixture(page, { mode: 'empty' });

  const workbook = await downloadInvestmentWorkbook(page);

  expect(workbookSummaryValue(workbook, 'Recorded payout status')).toBe(
    'No distributions recorded for this wallet on this node.',
  );

  expect(
    workbook.getWorksheet('Live estimates').getCell('F2').value,
  ).toBe('3.600000');

  const distributions = workbook.getWorksheet(
    'Recorded distributions',
  );

  expect(distributions.getCell('A2').value).toContain(
    'No distributions recorded',
  );

  for (const column of ['B', 'C', 'D']) {
    expect(distributions.getCell(`${column}2`).value).toBeNull();
  }

  const payments = workbook.getWorksheet('Payment history');

  expect(payments.getCell('A2').value).toBe(
    'No payments recorded for this wallet on this node.',
  );
  expect(payments.getCell('C2').value).toBeNull();
});

test('Excel export marks unavailable payout reporting without zero balances', async ({
  page,
}) => {
  await openFixture(page, { mode: 'unavailable' });

  const workbook = await downloadInvestmentWorkbook(page);

  expect(workbookSummaryValue(workbook, 'Recorded payout status')).toBe(
    'Unavailable: no recorded payout balance can be confirmed.',
  );

  expect(workbookSummaryValue(workbook, 'Payout report message')).toBe(
    'Payout reporting is temporarily unavailable.',
  );

  // Available live estimates remain distinct from unavailable ledger data.
  expect(
    workbook.getWorksheet('Live estimates').getCell('F2').value,
  ).toBe('3.600000');

  const distributions = workbook.getWorksheet(
    'Recorded distributions',
  );

  expect(distributions.getCell('A2').value).toContain('Unavailable');

  for (const column of ['B', 'C', 'D']) {
    expect(distributions.getCell(`${column}2`).value).toBeNull();
  }

  const payments = workbook.getWorksheet('Payment history');

  expect(payments.getCell('A2').value).toContain('Unavailable');
  expect(payments.getCell('C2').value).toBeNull();
});