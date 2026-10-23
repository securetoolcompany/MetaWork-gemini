// scripts/inspect-nillion-opening-events.mjs

import { decodeEventLog, parseAbi } from 'viem';

const EMISSIONS_ADDRESS =
  '0xeff51614B2ccB89264e75a1303A17878cEA59C62';

const abi = parseAbi([
  'event Enrolled(uint256 indexed nodeId, uint256 stake)',
]);

const transactions = [
  {
    description: 'Registration matching node #19 stake',
    hash: '0x0afb5210bacefa501d127837dc87df9aa3436d26f15fb4cf5d9d7157ed3ac77c',
    timestampUtc: '2026-10-06T16:09:23Z',
  },
  {
    description: 'Node #19 rejoin',
    hash: '0x0ee06daad55b9eceaac4414d12491211cd9d0096264e79bc88dc428b401e755e',
    timestampUtc: '2026-10-06T16:40:35Z',
  },
  {
    description: 'Registration matching node #20 stake',
    hash: '0x713bbaaf86c28e10c03cb7f317a0563b82c149402dae4cc7a7a791da6d815b0d',
    timestampUtc: '2026-10-06T18:27:35Z',
  },
  {
    description: 'Node #20 rejoin',
    hash: '0x9ed1df3dfd34f0c0806fc6ef64cef62605633459e6fbe8c34446fd7d4690a31c',
    timestampUtc: '2026-10-06T18:31:59Z',
  },
];

async function fetchAllLogs(hash) {
  const baseUrl =
    `https://eth.blockscout.com/api/v2/transactions/${hash}/logs`;

  const logs = [];
  const seenPages = new Set();
  let url = baseUrl;

  while (url) {
    if (seenPages.has(url)) {
      throw new Error('Explorer returned a repeated pagination cursor.');
    }

    seenPages.add(url);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(
        `Log lookup failed for ${hash}: HTTP ${response.status}`,
      );
    }

    const body = await response.json();

    if (!Array.isArray(body.items)) {
      throw new Error(`Invalid log response for ${hash}`);
    }

    logs.push(...body.items);

    if (body.next_page_params) {
      const nextUrl = new URL(baseUrl);

      for (const [key, value] of Object.entries(body.next_page_params)) {
        if (value !== null && value !== undefined) {
          nextUrl.searchParams.set(key, String(value));
        }
      }

      url = nextUrl.toString();
    } else {
      url = null;
    }
  }

  return logs;
}

async function main() {
  const output = [];

  for (const transaction of transactions) {
    const logs = await fetchAllLogs(transaction.hash);
    const enrollments = [];

    for (const log of logs) {
      if (
        log.address?.hash?.toLowerCase() !==
        EMISSIONS_ADDRESS.toLowerCase()
      ) {
        continue;
      }

      let decoded;

      try {
        decoded = decodeEventLog({
          abi,
          data: log.data,
          topics: log.topics.filter((topic) => topic !== null),
          strict: true,
        });
      } catch {
        // Other emissions events are not part of this inspection.
        continue;
      }

      enrollments.push({
        nodeId: decoded.args.nodeId.toString(),
        stakeBaseUnits: decoded.args.stake.toString(),
        blockNumber: String(log.block_number),
        logIndex: log.index,
      });
    }

    output.push({
      ...transaction,
      timestampSource: 'previously retrieved transaction history',
      enrollments,
    });
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});