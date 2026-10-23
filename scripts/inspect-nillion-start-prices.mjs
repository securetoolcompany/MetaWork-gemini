// scripts/inspect-nillion-start-prices.mjs

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

// Import after loading the environment.
const {
  NILLION_CONTRACTS,
  NILLION_NODES,
} = await import('../lib/tokenized-funds/nillion/config.js');

const API_BASE = 'https://api.coingecko.com/api/v3';
const MAX_SAMPLE_AGE_SECONDS = 7200;

async function main() {
  const starts = NILLION_NODES.map((node) => {
    const timestamp = Number(node.startTimestamp);

    if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
      throw new Error(`Missing or invalid start time for node #${node.id}.`);
    }

    return {
      node,
      timestamp,
    };
  });

  const from =
    Math.min(...starts.map((entry) => entry.timestamp)) -
    MAX_SAMPLE_AGE_SECONDS;

  const to =
    Math.max(...starts.map((entry) => entry.timestamp)) + 3600;

  const url = new URL(
    `${API_BASE}/coins/ethereum/contract/` +
      `${NILLION_CONTRACTS.nilToken}/market_chart/range`,
  );

  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('from', String(from));
  url.searchParams.set('to', String(to));

  const headers = {
    Accept: 'application/json',
  };

  const apiKey = process.env.COINGECKO_DEMO_API_KEY?.trim();

  if (apiKey) {
    headers['x-cg-demo-api-key'] = apiKey;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 1000);

    throw new Error(
      `CoinGecko returned HTTP ${response.status}: ${details}`,
    );
  }

  const body = await response.json();

  if (!Array.isArray(body.prices) || body.prices.length === 0) {
    throw new Error('CoinGecko returned no historical price samples.');
  }

  const samples = body.prices
    .filter(
      (entry) =>
        Array.isArray(entry) &&
        Number.isFinite(entry[0]) &&
        Number.isFinite(entry[1]) &&
        entry[1] > 0,
    )
    .sort((a, b) => a[0] - b[0]);

  const baselines = starts.map(({ node, timestamp }) => {
    let selected = null;

    for (const sample of samples) {
      if (sample[0] <= timestamp * 1000) {
        selected = sample;
      } else {
        break;
      }
    }

    if (!selected) {
      throw new Error(
        `No price sample at or before node #${node.id}'s start.`,
      );
    }

    const sampleAgeSeconds =
      timestamp - selected[0] / 1000;

    if (sampleAgeSeconds > MAX_SAMPLE_AGE_SECONDS) {
      throw new Error(
        `Historical price sample for node #${node.id} is too old.`,
      );
    }

    return {
      nodeId: node.id,
      nodeStartTimeUtc: node.startTimeUtc,
      nodeStartTimestamp: node.startTimestamp,

      baselinePriceUsd: String(selected[1]),
      baselinePriceTimeUtc: new Date(selected[0]).toISOString(),
      baselinePriceTimestampMs: String(selected[0]),
      sampleAgeSeconds,

      selectionMethod: 'latest_sample_at_or_before_node_start',
      source: 'coingecko',
      currency: 'usd',
      tokenContract: NILLION_CONTRACTS.nilToken,
    };
  });

  console.log(
    JSON.stringify(
      {
        retrievedAt: new Date().toISOString(),
        sourceUrl: url.toString(),
        sampleCount: samples.length,
        baselines,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});