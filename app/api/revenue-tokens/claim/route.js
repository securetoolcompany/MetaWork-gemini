import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { connectToDatabase } from '@/lib/mongodb';
import { safeJson } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * NODE ROTATION STRATEGY
 * Priority: 1. Tatum (Authorized) -> 2. Nodely Dev -> 3. Algonode
 */
async function getHealthyNode() {
  const configs = [
    { 
      name: 'Tatum Gateway',
      url: 'https://algorand-testnet-algod.gateway.tatum.io', 
      token: { 'x-api-key': process.env.TATUM_API_KEY } 
    },
    { 
      name: 'Nodely Dev',
      url: 'https://testnet-api.4160.nodely.dev', 
      token: '' 
    },
    { 
      name: 'Algonode',
      url: 'https://testnet-api.algonode.cloud', 
      token: '' 
    }
  ];

  for (const config of configs) {
    try {
      // Skip Tatum if key is missing
      if (config.url.includes('tatum') && (!config.token['x-api-key'] || config.token['x-api-key'].includes('YOUR_'))) {
        continue;
      }

      const client = new algosdk.Algodv2(config.token, config.url, '');

      // Fast status check
      const status = await client.status().do();
      const round = Number(status['last-round'] || 0);

      if (round > 0) {
        // Double-check params integrity
        const params = await client.getTransactionParams().do();
        console.log(`[NODE SELECTED] ${config.name} at Round ${round}`);
        return { client, params, round, url: config.url, token: config.token };
      }
      console.warn(`[NODE LAG] ${config.name} is at Round 0.`);
    } catch (e) {
      console.warn(`[NODE ERROR] ${config.name} (${config.url}): ${e.message}`);
    }
  }
  throw new Error("Critical: No synced Algorand nodes available. Testnet may be down.");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const userAddr = String(body.userAddress || body.accountAddress || "").trim();

    // 1. INPUT VALIDATION
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

    // 2. GET SYNCHRONIZED NODE
    const { params: raw, round: currentRound } = await getHealthyNode();

    // 3. ADDRESS DERIVATION
    const poolAddrStr = algosdk.encodeAddress(algosdk.getApplicationAddress(appId).publicKey);

    const txParams = {
      fee: 1000,
      flatFee: true,
      firstRound: currentRound,
      lastRound: currentRound + 1000,
      genesisHash: raw.genesisHash || "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
      genesisID: raw.genesisID || "testnet-v1.0"
    };

    // 4. TRANSACTION CONSTRUCTION (Positional Arguments)
    const txns = [];

    // Tx 0: Payment (0.2 ALGO for Box MBR)
    txns.push(algosdk.makePaymentTxnWithSuggestedParams(
      userAddr, poolAddrStr, 200000, undefined, undefined, txParams
    ));

    // Tx 1: Asset Opt-in (Refund method)
    txns.push(algosdk.makeAssetTransferTxnWithSuggestedParams(
      userAddr, userAddr, undefined, undefined, 0, undefined, tokenId, txParams
    ));

    // Tx 2: Application Call (Claim Logic)
    const decodedUser = algosdk.decodeAddress(userAddr);
    const boxName = new Uint8Array(Buffer.concat([Buffer.from('stk_'), decodedUser.publicKey]));

    txns.push(algosdk.makeApplicationNoOpTxn(
      userAddr, 
      { ...txParams, fee: 3000 }, // 3x fee for storage I/O
      appId, 
      [new Uint8Array(Buffer.from('claim_tokens'))], 
      undefined, undefined, [tokenId], 
      undefined, undefined, undefined, 
      [{ appIndex: appId, name: boxName }]
    ));

    algosdk.assignGroupID(txns);

    return NextResponse.json(safeJson({
      success: true,
      transactions: txns.map(t => Buffer.from(t.toByte()).toString('base64'))
    }));

  } catch (error) {
    console.error('ALGORAND ROUTE ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { signedTxns } = await request.json();
    const { client } = await getHealthyNode(); // Use same healthy node for broadcast

    const binaryTxns = signedTxns.map(t => new Uint8Array(Buffer.from(t, 'base64')));
    const { txId } = await client.sendRawTransaction(binaryTxns).do();

    console.log(`TRANSACTION SUBMITTED: https://testnet.explorer.perawallet.app/tx/${txId}`);

    await algosdk.waitForConfirmation(client, txId, 4);
    return NextResponse.json({ 
      success: true, 
      txId, 
      explorerUrl: `https://testnet.explorer.perawallet.app/tx/${txId}` 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}