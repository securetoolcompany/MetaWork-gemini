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
      // v3 fix: status keys are now camelCase
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

    const poolAddrStr = algosdk.encodeAddress(algosdk.getApplicationAddress(appId).publicKey);

    // v3 fix: firstRound/lastRound renamed to firstValid/lastValid, fees are BigInt
    const txParams = {
      fee: 1000n,
      flatFee: true,
      firstValid: BigInt(currentRound),
      lastValid: BigInt(currentRound + 1000),
      genesisHash: raw.genesisHash || "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      genesisID: raw.genesisID || "testnet-v1.0",
      minFee: 1000n
    };

    const txns = [];

    // v3 fix: all make*Txn positional fns replaced with make*FromObject
    txns.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: userAddr,
      receiver: poolAddrStr,
      amount: 200000,
      suggestedParams: txParams
    }));

    txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: userAddr,
      receiver: userAddr,
      amount: 0,
      assetIndex: tokenId,
      suggestedParams: txParams
    }));

    const decodedUser = algosdk.decodeAddress(userAddr);
    const boxName = new Uint8Array(Buffer.concat([Buffer.from('stk_'), decodedUser.publicKey]));

    txns.push(algosdk.makeApplicationNoOpTxnFromObject({
      sender: userAddr,
      appIndex: appId,
      appArgs: [new Uint8Array(Buffer.from('claim_tokens'))],
      foreignAssets: [tokenId],
      boxes: [{ appIndex: appId, name: boxName }],
      suggestedParams: { ...txParams, fee: 3000n }
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
    //const { client } = await getHealthyNode();
    const client = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

    const binaryTxns = signedTxns.map(t => new Uint8Array(Buffer.from(t, 'base64')));
    const result = await client.sendRawTransaction(binaryTxns).do();

    // v3 returns txid lowercase — handle both just in case
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