// app/api/tokenized-funds/nillion/dashboard/route.js

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import {
  NILLION_CONTRACTS,
  NILLION_NODES,
} from '../../../../../lib/tokenized-funds/nillion/config.js';

import {
  readNillionNode,
} from '../../../../../lib/tokenized-funds/nillion/read-node.js';

import {
  calculateNillionRewards,
} from '../../../../../lib/tokenized-funds/nillion/rewards.js';

import {
  readNillionPrice,
} from '../../../../../lib/tokenized-funds/nillion/read-price.js';

import {
  calculateNillionPrincipalPerformance,
} from '../../../../../lib/tokenized-funds/nillion/principal-performance.js';

import {
  buildNillionPayoutReports,
} from '../../../../../lib/tokenized-funds/nillion/payout-report.js';

import {
  NILLION_FEE_DISCLOSURE,
  validateNillionFeePolicy,
} from '../../../../../lib/tokenized-funds/nillion/fee-policy.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
};

function jsonResponse(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: RESPONSE_HEADERS,
  });
}

async function readDataFile(filename) {
  const filePath = path.join(
    process.cwd(),
    'data',
    'tokenized-funds',
    'nillion',
    filename,
  );

  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function loadAllocations() {
  const config = await readDataFile('stakers.json');

  if (
    !Number.isInteger(config.version) ||
    config.version < 1 ||
    !Number.isInteger(config.managementFeeBps) ||
    config.managementFeeBps < 0 ||
    config.managementFeeBps > 10_000 ||
    !config.nodes ||
    typeof config.nodes !== 'object' ||
    Array.isArray(config.nodes)
  ) {
    throw new Error('Invalid Nillion allocation configuration.');
  }

  validateNillionFeePolicy(config);

  for (const node of NILLION_NODES) {
    if (!Array.isArray(config.nodes[node.id]?.stakers)) {
      throw new Error(
        `Missing staker configuration for node ${node.id}.`,
      );
    }
  }

  return config;
}

async function loadValuationContext() {
  const [baselines, quote] = await Promise.all([
    readDataFile('price-baselines.json'),
    readNillionPrice(),
  ]);

  if (
    baselines.currency !== 'usd' ||
    baselines.source !== quote.source ||
    typeof baselines.tokenContract !== 'string' ||
    baselines.tokenContract.toLowerCase() !==
      NILLION_CONTRACTS.nilToken.toLowerCase()
  ) {
    throw new Error('Price baseline does not match the quote source or asset.');
  }

  return {
    baselines,
    quote,
  };
}

function buildPrincipalPerformance(node, rewards, context) {
  const baseline = context.baselines.nodes?.[node.id];

  if (
    !baseline ||
    baseline.nodeStartTimestamp !== node.startTimestamp ||
    baseline.originalStakeBaseUnits !== node.originalStakeBaseUnits
  ) {
    throw new Error(
      `Missing or inconsistent price baseline for node ${node.id}.`,
    );
  }

  const calculate = (originalStakeBaseUnits) =>
    calculateNillionPrincipalPerformance({
      originalStakeBaseUnits,
      baselinePriceUsd: baseline.baselinePriceUsd,
      currentPriceUsd: context.quote.priceUsd,
    });

  // Current allocations can stand in for original allocations only
  // while this fixed-node configuration still reconciles to the
  // recorded original principal. Future ownership/stake changes
  // require explicit historical principal records.
  const positionValuesAvailable =
    rewards.canShowInvestorEstimates &&
    rewards.recordedStakeBaseUnits === node.originalStakeBaseUnits;

  return {
    available: true,
    nodeStartTimeUtc: node.startTimeUtc,

    baseline: {
      priceUsd: baseline.baselinePriceUsd,
      priceTimeUtc: baseline.baselinePriceTimeUtc,
      sampleAgeSeconds: baseline.sampleAgeSeconds,
      selectionMethod: context.baselines.selectionMethod,
      source: context.baselines.source,
    },

    quote: context.quote,

    node: calculate(node.originalStakeBaseUnits),

    positionValuesAvailable,

    positions: positionValuesAvailable
      ? rewards.positions.map((position) => ({
          id: position.id,
          wallet: position.wallet,
          ...calculate(position.stakeBaseUnits),
        }))
      : [],

    warnings: positionValuesAvailable
      ? []
      : [
          'Position-level principal performance is unavailable until allocations reconcile to original principal.',
        ],
  };
}

export async function GET() {
  let allocations;

  try {
    allocations = await loadAllocations();
  } catch (error) {
    console.error('[nillion/dashboard] Configuration error:', error);

    return jsonResponse(
      {
        error: 'Nillion dashboard configuration is unavailable.',
      },
      500,
    );
  }

    const [payoutResult, valuationResult, results] = await Promise.all([
    readDataFile('payout-ledger.json')
      .then((ledger) => ({
        ok: true,
        value: buildNillionPayoutReports(
          ledger,
          NILLION_NODES.map((node) => node.id),
        ),
      }))
      .catch((error) => {
        console.error('[nillion/dashboard] Payout ledger error:', error);

        return { ok: false, value: null };
      }),

    loadValuationContext().then(
      (value) => ({ ok: true, value }),
      (error) => {
        console.error('[nillion/dashboard] Price lookup error:', error);

        return { ok: false, value: null };
      },
    ),

    Promise.allSettled(
      NILLION_NODES.map(async (node) => {
        const snapshot = await readNillionNode(node.id);
        const rewards = calculateNillionRewards(
          snapshot,
          allocations,
        );

        return {
          ...snapshot,
          rewards,

          history: {
            available: false,
            trackingStartBlock: node.rewardsStartBlock,
            grossClaimedBaseUnits: null,
            totalPaidBaseUnits: null,
          },
        };
      }),
    ),
  ]);

  const nodes = [];
  const errors = [];

  results.forEach((result, index) => {
    const nodeConfig = NILLION_NODES[index];

    if (result.status === 'rejected') {
      console.error(
        `[nillion/dashboard] Failed to load node ${nodeConfig.id}:`,
        result.reason,
      );

      errors.push({
        nodeId: nodeConfig.id,
        name: nodeConfig.name,
        message: 'Unable to load this node. Please try again shortly.',
      });

      return;
    }

    const node = result.value;

    let principalPerformance = {
      available: false,
      message: 'Principal price performance is temporarily unavailable.',
    };

    if (valuationResult.ok) {
      try {
        principalPerformance = buildPrincipalPerformance(
          nodeConfig,
          node.rewards,
          valuationResult.value,
        );
      } catch (error) {
        console.error(
          `[nillion/dashboard] Principal valuation error for node ${nodeConfig.id}:`,
          error,
        );
      }
    }

    nodes.push({
      ...node,
      principalPerformance,

      payouts: payoutResult.ok
        ? payoutResult.value[nodeConfig.id]
        : {
            available: false,
            status: 'unavailable',
            message: 'Payout reporting is temporarily unavailable.',
          },
    });
  });

  return jsonResponse(
    {
      fundId: 'nillion',
      generatedAt: new Date().toISOString(),

      allocationVersion: allocations.version,
      managementFeeBps: allocations.managementFeeBps,
      managementFeeBasis: allocations.managementFeeBasis,

      earningsScope: 'nil_emissions_only',
      operatingCostsIncluded: false,
      operatingCostsCoveredByManagementFee: true,
      investorOperatingCostDeductionBaseUnits: '0',
      feeDisclosure: NILLION_FEE_DISCLOSURE,

      priceStatus: valuationResult.ok ? 'ok' : 'unavailable',
			payoutStatus: payoutResult.ok ? 'ok' : 'unavailable',

      status:
        nodes.length === 0
          ? 'unavailable'
          : errors.length > 0
            ? 'partial'
            : 'ok',

      nodes,
      errors,
    },
    nodes.length === 0 ? 502 : 200,
  );
}