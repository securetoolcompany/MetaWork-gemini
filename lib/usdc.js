/**
 * lib/usdc.js
 * USDC.algo helpers — balance checks and payment polling
 *
 * ENV VARS REQUIRED:
 *   USDC_ALGO_ASSET_ID   — 10458941 (testnet) or 31566704 (mainnet)
 *   ALGORAND_TESTNET_RPC — defaults to https://testnet-api.algonode.cloud
 */

import { getAlgodClient } from '@/lib/algorand';

export const USDC_DECIMALS = 6;
export const USDC_ASSET_ID = Number(process.env.USDC_ALGO_ASSET_ID || 10458941);

export async function getUSDCBalance(address) {
  try {
    const algod = getAlgodClient();
    const info = await algod.accountInformation(address).do();
    const assets = info.assets || [];
    const usdc = assets.find((a) => Number(a['asset-id']) === USDC_ASSET_ID);
    if (!usdc) return 0;
    return Number(usdc.amount) / Math.pow(10, USDC_DECIMALS);
  } catch {
    return 0;
  }
}

export async function getUSDCBalanceMicro(address) {
  try {
    const algod = getAlgodClient();
    const info = await algod.accountInformation(address).do();
    const assets = info.assets || [];
    const usdc = assets.find((a) => Number(a['asset-id']) === USDC_ASSET_ID);
    if (!usdc) return 0;
    return Number(usdc.amount);
  } catch {
    return 0;
  }
}

export function dollarToMicro(dollars) {
  return Math.round(dollars * Math.pow(10, USDC_DECIMALS));
}

export function microToDollar(micro) {
  return micro / Math.pow(10, USDC_DECIMALS);
}

export function buildUSDCPaymentURI(toAddress, microAmount, note) {
  const encodedNote = encodeURIComponent(note);
  return `algorand://${toAddress}?asset=${USDC_ASSET_ID}&amount=${microAmount}&note=${encodedNote}`;
}

export async function pollForUSDCPayment(
  toAddress,
  microAmount,
  note,
  timeoutMs = 600000,
  intervalMs = 5000
) {
  const INDEXER_URL =
    process.env.ALGORAND_TESTNET_INDEXER || 'https://testnet-idx.algonode.cloud';

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const url =
        `${INDEXER_URL}/v2/accounts/${toAddress}/transactions` +
        `?asset-id=${USDC_ASSET_ID}&limit=10`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const txns = data.transactions || [];

        for (const txn of txns) {
          const transfer = txn['asset-transfer-transaction'];
          if (!transfer) continue;
          if (Number(transfer['asset-id']) !== USDC_ASSET_ID) continue;
          if (Number(transfer.amount) !== microAmount) continue;

          const rawNote = txn.note
            ? Buffer.from(txn.note, 'base64').toString('utf8')
            : '';
          if (rawNote !== note) continue;

          return txn;
        }
      }
    } catch (err) {
      console.warn('[pollForUSDCPayment] indexer error:', err.message);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('Payment not detected within timeout period');
}