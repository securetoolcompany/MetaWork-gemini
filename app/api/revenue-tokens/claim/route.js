import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { connectToDatabase } from '@/lib/mongodb';
import { safeJson } from '@/lib/utils';
import {
  withUserClaimLock,
  invalidateAccountCache,
  invalidatePoolBoxCache,
  sleep,
  getCachedTxParams,
  getCachedAccountInfo
} from '@/lib/algorand-rate-limit';

export const dynamic = 'force-dynamic';

function getAlgodClient() {
  const apiKey = process.env.TATUM_API_KEY;

  if (apiKey && !apiKey.startsWith('YOUR_')) {
    return new algosdk.Algodv2(
      { 'x-api-key': apiKey },
      'https://algorand-testnet-algod.gateway.tatum.io',
      ''
    );
  }

  return new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const userAddr = String(body.userAddress || body.accountAddress || '').trim().toUpperCase();

    if (!userAddr || !algosdk.isValidAddress(userAddr)) {
      throw new Error(`Invalid sender address: "${userAddr}"`);
    }

    if (!body.ipId) {
      return NextResponse.json({ error: 'ipId is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const ip = await db.collection('ip_assets').findOne({ id: body.ipId });

    if (!ip) {
      throw new Error(`IP Asset ${body.ipId} not found in DB.`);
    }

    const appId = Number(ip.revenuePoolAppId || ip.appId);
    const tokenId = Number(ip.revenueTokenAssetId || ip.revenueTokenId);

    if (!Number.isFinite(appId) || appId <= 0) {
      throw new Error(`Invalid App ID: ${appId}`);
    }

    if (!Number.isFinite(tokenId) || tokenId <= 0) {
      throw new Error(`Invalid Token ID: ${tokenId}`);
    }

    const algodClient = getAlgodClient();

    const suggestedParams = await getCachedTxParams(algodClient);

    const genesisHash = suggestedParams?.genesisHash ?? suggestedParams?.['genesis-hash'];
    const genesisID = suggestedParams?.genesisID ?? suggestedParams?.['genesis-id'];

    if (!genesisHash || !genesisID) {
      console.error('[CLAIM][POST] Bad tx params shape:', suggestedParams);
      throw new Error('Failed to fetch valid transaction params.');
    }

    const ipIdBytes = new Uint8Array(Buffer.from(body.ipId));
    const poolBoxName = new Uint8Array(
      Buffer.concat([Buffer.from('p_'), Buffer.from(body.ipId)])
    );

    console.log(`[CLAIM] appId=${appId} tokenId=${tokenId} ipId=${body.ipId}`);
    console.log(
      `[CLAIM] poolBoxName hex: ${Buffer.from(poolBoxName).toString('hex')}`
    );

    const accountInfo = await getCachedAccountInfo(algodClient, userAddr);
    const userAssets = accountInfo.assets || [];
    const existingHolding = userAssets.find(
      (a) => Number(a['asset-id']) === tokenId
    );
    const hasOptedIn = !!existingHolding;

    console.log(
      `[CLAIM] user=${userAddr} tokenId=${tokenId} hasOptedIn=${hasOptedIn} existingBalance=${Number(existingHolding?.amount || 0)}`
    );

    const txns = [];

    if (!hasOptedIn) {
      txns.push(
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: userAddr,
          receiver: userAddr,
          amount: 0,
          assetIndex: tokenId,
          suggestedParams: {
          ...suggestedParams,
          genesisHash,
          genesisID,
          flatFee: true,
          fee: 1000
        }
        })
      );
    }

    txns.push(
      algosdk.makeApplicationNoOpTxnFromObject({
        sender: userAddr,
        appIndex: appId,
        appArgs: [
          new Uint8Array(Buffer.from('claim_tokens')),
          ipIdBytes
        ],
        foreignAssets: [tokenId],
        boxes: [{ appIndex: appId, name: poolBoxName }],
        suggestedParams: {
        ...suggestedParams,
        genesisHash,
        genesisID,
        flatFee: true,
        fee: 3000
      }
      })
    );

    console.log(
      `[CLAIM] Prepared ${txns.length} txn(s) for ${body.ipId} (includedOptIn=${!hasOptedIn})`
    );

    algosdk.assignGroupID(txns);

    return NextResponse.json(
      safeJson({
        success: true,
        hasOptedIn,
        includedOptIn: !hasOptedIn,
        revenueTokenId: tokenId,
        appId,
        ipId: body.ipId,
        transactions: txns.map((t) =>
          Buffer.from(algosdk.encodeUnsignedTransaction(t)).toString('base64')
        )
      })
    );
  } catch (error) {
    console.error('[CLAIM][POST] ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  let userAddr = '';

  try {
    const body = await request.json();
    const { signedTxns, userAddress, ipId, appId } = body;
    userAddr = String(userAddress || '').trim().toUpperCase();

    if (!Array.isArray(signedTxns) || signedTxns.length === 0) {
      return NextResponse.json(
        { error: 'signedTxns is required' },
        { status: 400 }
      );
    }

    const runSubmit = async () => {
      await sleep(500);

      const client = getAlgodClient();
      console.log('[PUT] Using configured algod client');
      console.log(`[PUT] Signed txn count: ${signedTxns.length}`);

      const binaryTxns = signedTxns.map((t, i) => {
        const bytes = new Uint8Array(Buffer.from(t, 'base64'));
        console.log(`[PUT] Txn ${i} bytes: ${bytes.length}`);
        return bytes;
      });

      const result = await client.sendRawTransaction(binaryTxns).do();
      const txid = result.txid ?? result.txId;

      console.log(
        `[PUT] TRANSACTION SUBMITTED: https://testnet.explorer.perawallet.app/tx/${txid}`
      );

      if (userAddr) {
        invalidateAccountCache(userAddr);
      }

      if (ipId && appId) {
        invalidatePoolBoxCache(appId, `usdc:${ipId}`);
      }

      return NextResponse.json({
        success: true,
        submitted: true,
        txId: txid,
        explorerUrl: `https://testnet.explorer.perawallet.app/tx/${txid}`,
        message: 'Claim transaction submitted successfully.'
      });
    };

    if (userAddr) {
      return await withUserClaimLock(userAddr, runSubmit);
    }

    return await runSubmit();
  } catch (error) {
    const message = error?.message || '';

    if (error?.retryable) {
      return NextResponse.json(
        { error: message, retryable: true },
        { status: 429 }
      );
    }

    if (
      message.includes('429') ||
      message.toLowerCase().includes('too many requests')
    ) {
      return NextResponse.json(
        {
          error: 'Node throttled; please retry in a few seconds.',
          retryable: true
        },
        { status: 429 }
      );
    }

    console.error('[PUT] ERROR:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}