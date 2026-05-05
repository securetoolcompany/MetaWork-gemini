import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { connectToDatabase } from '@/lib/mongodb';
import { safeJson } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function getHealthyNode() {
  const configs = [
    { 
      name: 'Tatum Gateway',
      url: 'https://algorand-testnet-algod.gateway.tatum.io', 
      token: { 'x-api-key': process.env.TATUM_API_KEY } 
    },
    { name: 'Nodely Dev', url: 'https://testnet-api.4160.nodely.dev', token: '' },
    { name: 'Algonode', url: 'https://testnet-api.algonode.cloud', token: '' }
  ];

  for (const config of configs) {
    try {
      if (config.url.includes('tatum') && (!config.token['x-api-key'] || config.token['x-api-key'].includes('YOUR_'))) {
        continue;
      }
      const client = new algosdk.Algodv2(config.token, config.url, '');
      const status = await client.status().do();
      const round = Number(status['last-round'] ?? status['lastRound'] ?? 0);
      console.log(`[NODE STATUS KEYS] ${config.name}:`, Object.keys(status));
      console.log(`[NODE ROUND] ${config.name}: ${round}`);
      if (round > 0) {
        const params = await client.getTransactionParams().do();
        console.log(`[NODE SELECTED] ${config.name} at Round ${round}`);
        return { client, params, round, url: config.url, token: config.token };
      }
      console.warn(`[NODE LAG] ${config.name} is at Round 0.`);
    } catch (e) {
      console.warn(`[NODE ERROR] ${config.name}: ${e.message}`);
    }
  }
  throw new Error("Critical: No synced Algorand nodes available. Testnet may be down.");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const userAddr = String(body.userAddress || body.accountAddress || "").trim();

    if (!userAddr || !algosdk.isValidAddress(userAddr)) {
      throw new Error(`Invalid sender address: "${userAddr}"`);
    }

    const { db } = await connectToDatabase();
    const ip = await db.collection('ip_assets').findOne({ id: body.ipId });
    if (!ip) throw new Error(`IP Asset ${body.ipId} not found in DB.`);

    const appId = Number(ip.revenuePoolAppId || ip.appId);
    const tokenId = Number(ip.revenueTokenAssetId || ip.revenueTokenId);

    if (!Number.isFinite(appId) || appId <= 0) throw new Error(`Invalid App ID: ${appId}`);
    if (!Number.isFinite(tokenId) || tokenId <= 0) throw new Error(`Invalid Token ID: ${tokenId}`);

    const { params: raw, round: currentRound } = await getHealthyNode();

    const txParams = {
      fee: 1000n,
      flatFee: true,
      firstValid: BigInt(currentRound),
      lastValid: BigInt(currentRound + 1000),
      genesisHash: raw.genesisHash || "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      genesisID: raw.genesisID || "testnet-v1.0",
      minFee: 1000n
    };

    // FIX #1: Box key is "p_" + ipId — matches BOX_PREFIX in revenue_pool_v5.py
    // Old code used "stk_" + pubkey which doesn't exist anywhere in v5
    const ipIdBytes = new Uint8Array(Buffer.from(body.ipId));
    const poolBoxName = new Uint8Array(Buffer.concat([
      Buffer.from('p_'),
      Buffer.from(body.ipId)
    ]));

    console.log(`[CLAIM] appId=${appId} tokenId=${tokenId} ipId=${body.ipId}`);
    console.log(`[CLAIM] poolBoxName hex: ${Buffer.from(poolBoxName).toString('hex')}`);

    const txns = [];

    // FIX #2: Removed the 0.2 ALGO payment txn — v5 claim_tokens has no group check,
    // does not require a payment, and the contract never reads Gtxn at all.

    // Txn 1: Opt-in to revenue token ASA
    txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: userAddr,
      receiver: userAddr,
      amount: 0,
      assetIndex: tokenId,
      suggestedParams: txParams
    }));

    // Txn 2: App call to claim_tokens
    // FIX #3: Added ipIdBytes as appArgs[1] — contract reads Txn.application_args[1]
    // Old code only passed args[0] so the contract had no ip_id to look up the box
    txns.push(algosdk.makeApplicationNoOpTxnFromObject({
      sender: userAddr,
      appIndex: appId,
      appArgs: [
        new Uint8Array(Buffer.from('claim_tokens')),  // args[0]: method selector
        ipIdBytes                                      // args[1]: ip_id (REQUIRED by v5)
      ],
      foreignAssets: [tokenId],
      boxes: [{ appIndex: appId, name: poolBoxName }],  // FIX #1: correct box key
      suggestedParams: { ...txParams, fee: 3000n }       // outer + 1 inner ASA transfer
    }));

    algosdk.assignGroupID(txns);

    return NextResponse.json(safeJson({
      success: true,
      transactions: txns.map(t => Buffer.from(algosdk.encodeUnsignedTransaction(t)).toString('base64'))
    }));

  } catch (error) {
    console.error('ALGORAND ROUTE ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { signedTxns } = await request.json();
    const client = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

    const binaryTxns = signedTxns.map(t => new Uint8Array(Buffer.from(t, 'base64')));
    const result = await client.sendRawTransaction(binaryTxns).do();

    const txid = result.txid ?? result.txId;

    console.log(`TRANSACTION SUBMITTED: https://testnet.explorer.perawallet.app/tx/${txid}`);
    await algosdk.waitForConfirmation(client, txid, 4);
    return NextResponse.json({ 
      success: true,
      txId: txid,
      explorerUrl: `https://testnet.explorer.perawallet.app/tx/${txid}` 
    });
  } catch (error) {
    console.error('PUT ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}