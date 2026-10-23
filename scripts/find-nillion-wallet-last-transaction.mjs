// scripts/find-nillion-wallet-last-transaction.mjs

const WALLET =
  '0x39Bb4A10626B58430AbFa8284B0F001f49734F70';

async function main() {
  const url =
    `https://eth.blockscout.com/api/v2/addresses/${WALLET}/transactions` +
    '?filter=from';

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `Wallet transaction lookup failed: HTTP ${response.status}`,
    );
  }

  const body = await response.json();

  if (!Array.isArray(body.items)) {
    throw new Error('Explorer did not return a transaction list.');
  }

  const transactions = body.items
    .filter(
      (transaction) =>
        transaction.from?.hash?.toLowerCase() ===
          WALLET.toLowerCase() &&
        transaction.block_number !== null &&
        transaction.block_number !== undefined &&
        typeof transaction.timestamp === 'string' &&
        Number.isFinite(Date.parse(transaction.timestamp)),
    )
    .sort((a, b) => {
      const timeDifference =
        Date.parse(b.timestamp) - Date.parse(a.timestamp);

      if (timeDifference !== 0) return timeDifference;

      return Number(b.position ?? 0) - Number(a.position ?? 0);
    });

  if (transactions.length === 0) {
    throw new Error('No confirmed outgoing transactions were returned.');
  }

  function summarize(transaction) {
    return {
      transactionHash: transaction.hash,
      blockNumber: String(transaction.block_number),
      timestampUtc: transaction.timestamp,
      timestampUnix: String(
        Math.floor(Date.parse(transaction.timestamp) / 1000),
      ),
      status: transaction.status ?? null,
      method: transaction.method ?? null,
      decodedMethod:
        transaction.decoded_input?.method_call ?? null,
      relevantParameters:
        transaction.decoded_input?.parameters?.filter(
          (parameter) =>
            parameter.name === 'nodeId' ||
            parameter.name === 'stakeNil' ||
            parameter.name === 'operator',
        ) ?? [],
      to: transaction.to?.hash ?? null,
      explorerUrl: `https://etherscan.io/tx/${transaction.hash}`,
    };
  }

  console.log(
    JSON.stringify(
      {
        wallet: WALLET,
        latestOutgoingTransaction: summarize(transactions[0]),
        returnedTransactionCount: transactions.length,
        hasMoreHistory: Boolean(body.next_page_params),
        recentOutgoingTransactions: transactions.map(summarize),
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