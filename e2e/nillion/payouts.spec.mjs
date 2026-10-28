// e2e/nillion/payouts.spec.mjs

import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { NILLION_FEE_DISCLOSURE } from '../../lib/tokenized-funds/nillion/fee-policy.js';

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
    'ETH estimates',
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

// ---------------------------------------------------------------------
// Distribution approval screen
// ---------------------------------------------------------------------

const DIST_API =
  '**/api/admin/tokenized-funds/nillion/distribution-proposals';
const PROPOSAL_ID = `${'0'.repeat(58)}a1b2c3`;
const CLAIM_TX_19 = `0x${'c'.repeat(64)}`;
const CLAIM_TX_20 = `0x${'d'.repeat(64)}`;
const BIG_AMOUNT = '123456789012345678901234';

function proposalFixture({
  status = 'pending',
  expiresInMs = 10 * 60 * 1000,
  bigTransfer = false,
} = {}) {
  const transferAmount = bigTransfer ? BIG_AMOUNT : '50000000';

  return {
    _id: PROPOSAL_ID,
    status,
    active: status === 'pending' || status === 'approved',
    executionEnabled: false,
    preparedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    review: {
      proposal: {
        proposalSha256: PROPOSAL_ID,
        accounting: {
          grossClaimedBaseUnits: '200000000',
          recordedManagementFeeBaseUnits: '100000000',
          alreadyPaidBaseUnits: '0',
          operatorOwnershipUnpaidBaseUnits: '40000000',
          proposedInvestorTransfersBaseUnits: transferAmount,
          walletPendingUnpaidBaseUnits: '9000000',
          roundingRemainderBaseUnits: '1000000',
          requiredOutstandingReserveBaseUnits: '100000000',
        },
        transfers: [
          {
            from: OWNER,
            to: WALLET,
            amountBaseUnits: transferAmount,
            allocations: [
              {
                batchId: 'batch-19',
                nodeId: '19',
                positionId: 'investor-position',
                amountBaseUnits: transferAmount,
              },
            ],
          },
        ],
        operatorRetentionCandidates: [
          {
            batchId: 'batch-19',
            nodeId: '19',
            positionId: 'operator-position',
            amountBaseUnits: '40000000',
          },
        ],
        walletPending: [
          {
            batchId: 'batch-20',
            nodeId: '20',
            positionId: 'pending-position',
            amountBaseUnits: '9000000',
          },
        ],
        batches: [
          {
            batchId: 'batch-19',
            nodeId: '19',
            allocationVersion: 3,
            claims: [
              {
                eventId: 'event-19',
                transactionHash: CLAIM_TX_19,
                logIndex: '1',
                blockNumber: '26266000',
                amountBaseUnits: '120000000',
              },
            ],
          },
          {
            batchId: 'batch-20',
            nodeId: '20',
            allocationVersion: 3,
            claims: [
              {
                eventId: 'event-20',
                transactionHash: CLAIM_TX_20,
                logIndex: '2',
                blockNumber: '26266500',
                amountBaseUnits: '80000000',
              },
            ],
          },
        ],
        sources: {
          ledgerSha256: '9'.repeat(64),
          allocationSha256:
            'f4bdc3372ccf191f69e8d8b5324eb8713c916d91777fa325dbff55c06cf827bd',
          allocationVersion: 3,
        },
      },
      verification: {
        finalizedBlockNumber: '26266934',
        verifiedClaimCount: 2,
        verifiedPaymentCount: 0,
        ownerNilBalanceBaseUnits: '150000000',
        requiredOutstandingReserveBaseUnits: '100000000',
      },
    },
  };
}

const okReply = (extra) => ({
  status: 200,
  body: { success: true, executionEnabled: false, ...extra },
});

const errReply = (status, error) => ({
  status,
  body: { success: false, error },
});

async function openDistributions(page, { get, post } = {}) {
  const state = { posts: [] };
  const getReply = get ?? okReply({ proposal: null });

  await page.route(DIST_API, async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      await route.fulfill({
        status: getReply.status,
        contentType: 'application/json',
        body: JSON.stringify(getReply.body),
      });
      return;
    }

    const body = request.postDataJSON();
    state.posts.push(body);

    const reply = await post(body);

    await route.fulfill({
      status: reply.status,
      contentType: 'application/json',
      body: JSON.stringify(reply.body),
    });
  });

  await page.goto('/admin/nillion/distributions');

  await expect(
    page.getByRole('heading', { name: 'Distribution approval', exact: true }),
  ).toBeVisible();

  return state;
}

function accountingRow(page, label) {
  return page
    .getByText(label, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"py-3")][1]');
}

const pageMain = (page) => page.locator('main.bg-slate-950');
const pageAlert = (page) => pageMain(page).getByRole('alert');

async function confirmApprove(page) {
  await page.getByRole('checkbox').check();
  await page.locator('#approve-suffix').fill('a1b2c3');
}

const approveButton = (page) =>
  page.getByRole('button', { name: 'Approve proposal', exact: true });

test('distributions: disabled flag shows the not-enabled message', async ({ page }) => {
  await openDistributions(page, {
    get: errReply(503, 'Distribution proposal storage is not enabled.'),
  });

  await expect(
    page.getByText('Distribution proposals are not enabled.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Prepare proposal' }),
  ).toHaveCount(0);
});

test('distributions: internal 503 is not reported as disabled', async ({ page }) => {
  await openDistributions(page, {
    get: errReply(
      503,
      'The distribution proposal request could not be completed. No payment was performed.',
    ),
  });

  await expect(pageAlert(page)).toContainText(
    'Unable to load the distribution proposal.',
  );
  await expect(
    page.getByText('Distribution proposals are not enabled.'),
  ).toHaveCount(0);
});

test('distributions: non-admin sees the admin-required state', async ({ page }) => {
  await openDistributions(page, {
    get: errReply(403, 'Administrator authorization is required.'),
  });

  await expect(pageAlert(page)).toContainText(
    'Admin access is required',
  );
  await expect(
    page.getByRole('button', { name: 'Prepare proposal' }),
  ).toHaveCount(0);
});

test('distributions: nothing_to_review shows an empty state with no approve button', async ({ page }) => {
  const state = await openDistributions(page, {
    post: async () => okReply({ status: 'nothing_to_review', stored: false }),
  });

  await page.getByRole('button', { name: 'Prepare proposal' }).click();

  await expect(
    page.getByText('No finalized claims available for distribution.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(approveButton(page)).toHaveCount(0);
  expect(state.posts).toEqual([{ action: 'prepare' }]);
});

test('distributions: prepare in flight disables the button and sends one request', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const state = await openDistributions(page, {
    post: async () => {
      await gate;
      return okReply({ status: 'nothing_to_review', stored: false });
    },
  });

  const button = page.getByRole('button', { name: /Prepare proposal|Scanning/ });

  await button.dblclick();

  await expect(button).toBeDisabled();
  await expect(page.getByText('Scanning finalized on-chain claims.')).toBeVisible();

  release();

  await expect(
    page.getByText('No finalized claims available for distribution.'),
  ).toBeVisible();
  expect(state.posts).toHaveLength(1);
});

test('distributions: existing_pending shows the existing proposal', async ({ page }) => {
  await openDistributions(page, {
    post: async () =>
      okReply({
        status: 'existing_pending',
        stored: false,
        proposal: proposalFixture(),
      }),
  });

  await page.getByRole('button', { name: 'Prepare proposal' }).click();

  await expect(
    page.getByText('A pending proposal already exists.'),
  ).toBeVisible();
  await expect(approveButton(page)).toBeVisible();
});

test('distributions: pending proposal renders every required section', async ({ page }) => {
  await openDistributions(page, {
    get: okReply({ proposal: proposalFixture() }),
  });

  await expect(page.getByTitle(PROPOSAL_ID)).toBeVisible();
  await expect(page.getByText(/^(9:\d\d|10:00)$/)).toBeVisible();

  // Claims and Etherscan links
  const claims = page.getByRole('table', {
    name: 'Finalized claims included in this proposal',
  });
  await expect(claims.getByText('Node #19')).toBeVisible();
  await expect(claims.getByText('Node #20')).toBeVisible();
  await expect(claims.getByText('120.000000 NIL')).toBeVisible();
  await expect(claims.getByText('26266000')).toBeVisible();

  const link19 = claims.getByRole('link').first();
  await expect(link19).toHaveAttribute(
    'href',
    `https://etherscan.io/tx/${CLAIM_TX_19}`,
  );
  await expect(link19).toHaveAttribute('rel', 'noopener noreferrer');

  // Accounting categories
  await expect(accountingRow(page, 'Gross claimed')).toContainText('200.000000 NIL');
  await expect(accountingRow(page, 'Management fee')).toContainText('100.000000 NIL');
  await expect(accountingRow(page, 'Operator ownership share')).toContainText('40.000000 NIL');
  await expect(accountingRow(page, 'Investor transfers')).toContainText('50.000000 NIL');
  await expect(accountingRow(page, 'Wallet-pending (held)')).toContainText('9.000000 NIL');
  await expect(accountingRow(page, 'Rounding remainder')).toContainText('1.000000 NIL');
  await expect(accountingRow(page, 'Already paid')).toContainText('0.000000 NIL');

  // Fee and operator share are not transfers
  const transfers = page.getByRole('table', {
    name: 'Proposed outgoing NIL transfers',
  });
  await expect(transfers.locator('tbody tr')).toHaveCount(1);
  await expect(transfers.getByText(WALLET)).toBeVisible();
  await expect(transfers.getByText('50.000000 NIL')).toBeVisible();
  await expect(transfers).not.toContainText('operator-position');
  await expect(transfers).not.toContainText('100.000000');
  await expect(transfers).not.toContainText('40.000000');

  // Held and retained
  const held = page.getByRole('table', {
    name: 'Amounts held because no receiving wallet is set',
  });
  await expect(held).toContainText('pending-position');
  await expect(held).toContainText('9.000000 NIL');

  const retained = page.getByRole('table', {
    name: 'Operator ownership entitlements retained in the owner wallet',
  });
  await expect(retained).toContainText('operator-position');

  // Verification
  await expect(page.getByText('Finalized block 26266934')).toBeVisible();
  await expect(page.getByText('150.000000')).toBeVisible();
  await expect(page.getByText('f4bdc3372c…6cf827bd')).toBeVisible();

  // Disclosure, plain statements, warnings
  await expect(page.getByText(NILLION_FEE_DISCLOSURE)).toBeVisible();
  await expect(
    page.getByText('Approving does not send any payment.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Execution is not enabled.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('ETH gas balance is not checked.')).toBeVisible();
  await expect(
    page.getByText('Incoming NIL transfers are not reconciled.'),
  ).toBeVisible();
  await expect(
    page.getByText('Allocation history is an owner assertion.'),
  ).toBeVisible();

  // NIL only
  await expect(pageMain(page)).not.toContainText('$');
});

test('distributions: approve needs confirmation and sends exactly action and id', async ({ page }) => {
  const state = await openDistributions(page, {
    get: okReply({ proposal: proposalFixture() }),
    post: async () =>
      okReply({
        status: 'approved',
        proposal: proposalFixture({ status: 'approved' }),
      }),
  });

  await expect(approveButton(page)).toBeDisabled();

  await page.getByRole('checkbox').check();
  await expect(approveButton(page)).toBeDisabled();

  await page.locator('#approve-suffix').fill('wrong1');
  await expect(approveButton(page)).toBeDisabled();

  await page.locator('#approve-suffix').fill('a1b2c3');
  await expect(approveButton(page)).toBeEnabled();

  await approveButton(page).click();

  await expect(
    page.getByText('Approved - execution not enabled.', { exact: true }),
  ).toBeVisible();

  expect(state.posts).toEqual([{ action: 'approve', id: PROPOSAL_ID }]);

  await expect(approveButton(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prepare proposal' })).toHaveCount(0);
});

test('distributions: double-clicking approve sends one request and locks both buttons', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const state = await openDistributions(page, {
    get: okReply({ proposal: proposalFixture() }),
    post: async () => {
      await gate;
      return okReply({
        status: 'approved',
        proposal: proposalFixture({ status: 'approved' }),
      });
    },
  });

  await confirmApprove(page);
  await approveButton(page).dblclick();

  await expect(
    page.getByRole('button', { name: 'Approving…' }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reject' })).toBeDisabled();

  release();

  await expect(
    page.getByText('Approved - execution not enabled.'),
  ).toBeVisible();
  expect(state.posts).toHaveLength(1);
});

test('distributions: reject needs a second click and leaves a read-only rejected state', async ({ page }) => {
  const state = await openDistributions(page, {
    get: okReply({ proposal: proposalFixture() }),
    post: async () =>
      okReply({
        status: 'rejected',
        proposal: proposalFixture({ status: 'rejected' }),
      }),
  });

  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  expect(state.posts).toHaveLength(0);

  await page.getByRole('button', { name: 'Confirm reject' }).click();

  await expect(page.getByText(/^Rejected\./)).toBeVisible();
  expect(state.posts).toEqual([{ action: 'reject', id: PROPOSAL_ID }]);

  await expect(approveButton(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm reject' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prepare proposal' })).toBeVisible();
});

test('distributions: expired proposal cannot be approved and offers prepare', async ({ page }) => {
  await openDistributions(page, {
    get: okReply({ proposal: proposalFixture({ expiresInMs: -1000 }) }),
  });

  await expect(page.getByText('Expired', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Prepare a new proposal to continue/)).toBeVisible();
  await expect(approveButton(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prepare proposal' })).toBeVisible();
});

test('distributions: 409 on approve explains staleness and does not retry', async ({ page }) => {
  const state = await openDistributions(page, {
    get: okReply({ proposal: proposalFixture() }),
    post: async () => errReply(409, 'Review no longer matches.'),
  });

  await confirmApprove(page);
  await approveButton(page).click();

  await expect(pageAlert(page)).toContainText('This proposal is stale');
  await expect(approveButton(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare proposal' })).toHaveCount(0);

  await page.waitForTimeout(500);
  expect(state.posts).toHaveLength(1);
});

test('distributions: approved proposal loaded from the server is read-only', async ({ page }) => {
  await openDistributions(page, {
    get: okReply({ proposal: proposalFixture({ status: 'approved' }) }),
  });

  await expect(
    page.getByText('Approved - execution not enabled.'),
  ).toBeVisible();
  await expect(approveButton(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reject' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prepare proposal' })).toHaveCount(0);
});

test('distributions: very large base-unit values format exactly', async ({ page }) => {
  await openDistributions(page, {
    get: okReply({ proposal: proposalFixture({ bigTransfer: true }) }),
  });

  const transfers = page.getByRole('table', {
    name: 'Proposed outgoing NIL transfers',
  });

  await expect(
    transfers.getByText('123,456,789,012,345,678.901234 NIL', { exact: true }),
  ).toBeVisible();
});

test('distributions: mobile tables scroll inside an overflow-x-auto wrapper', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await openDistributions(page, {
    get: okReply({ proposal: proposalFixture() }),
  });

  const table = page.getByRole('table', {
    name: 'Proposed outgoing NIL transfers',
  });

  await table.scrollIntoViewIfNeeded();

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