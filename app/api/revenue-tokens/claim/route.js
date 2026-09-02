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
  getCachedAccountInfo,
} from '@/lib/algorand-rate-limit';

export const dynamic = 'force-dynamic';

const CLAIM_FEE = 3000;

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

function normalizeAddress(addr) {
  return String(addr || '').trim().toUpperCase();
}

function normalizeIpId(value) {
  return String(value || '').trim();
}

function resolveIpQuery(ipId) {
  return {
    $or: [
      { id: ipId },
      { ipId },
      { tokenizedIpId: ipId },
      { assetId: ipId },
      { _id: ipId },
    ],
  };
}

function resolveIpId(ip) {
  return normalizeIpId(
    ip?.ipId ||
      ip?.tokenizedIpId ||
      ip?.assetId ||
      ip?.id ||
      ip?._id ||
      ''
  );
}

function findAssetHolding(userAssets, assetId) {
  if (!Array.isArray(userAssets) || !Number.isFinite(assetId) || assetId <= 0) {
    return null;
  }

  const target = BigInt(assetId);

  for (const asset of userAssets) {
    const candidate = asset?.['asset-id'] ?? asset?.assetId ?? 0;

    try {
      if (BigInt(candidate) === target) {
        return asset;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function getGenesisFields(params) {
  const genesisHash = params?.genesisHash ?? params?.['genesis-hash'];
  const genesisID = params?.genesisID ?? params?.['genesis-id'];

  if (!genesisHash || !genesisID) {
    throw new Error('Failed to fetch valid transaction params.');
  }

  return { genesisHash, genesisID };
}

function buildPoolBoxName(ipId) {
  return new Uint8Array(Buffer.concat([Buffer.from('p_'), Buffer.from(ipId)]));
}

function encodeUnsignedTxn(txn) {
  return Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64');
}

function decodeSignedBase64Txn(base64) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function getSingleSignedTxn(body) {
  if (typeof body?.signedTxn === 'string' && body.signedTxn.length > 0) {
    return body.signedTxn;
  }

  if (Array.isArray(body?.signedTxns) && body.signedTxns.length > 0) {
    return body.signedTxns[0];
  }

  return null;
}

function buildStructuredError(error, fallback) {
  const message = error?.message || fallback;

  if (error?.retryable) {
    return {
      status: 429,
      body: { error: message, retryable: true },
    };
  }

  if (
    message.includes('429') ||
    message.toLowerCase().includes('too many requests')
  ) {
    return {
      status: 429,
      body: {
        error: 'Node throttled; please retry in a few seconds.',
        retryable: true,
      },
    };
  }

  return {
    status: 500,
    body: { error: message || fallback },
  };
}

async function findIpRecord(db, rawIpId) {
  const ipId = normalizeIpId(rawIpId);

  if (!ipId) {
    throw new Error('ipId is required');
  }

  const ip = await db.collection('ip_assets').findOne(resolveIpQuery(ipId));

  if (ip) {
    return ip;
  }

  const product = await db.collection('products').findOne({
    'productRevenuePool.tokenizationStatus': 'active',
    'productRevenuePool.poolKey': ipId,
    'productRevenuePool.revenuePoolAppId': { $gt: 0 },
    'productRevenuePool.revenueTokenAssetId': { $gt: 0 },
  });

  if (!product?.productRevenuePool) {
    throw new Error(`Revenue token pool ${ipId} not found in DB.`);
  }

  return {
    id: product.productRevenuePool.poolKey,
    ipId: product.productRevenuePool.poolKey,
    tokenizedIpId: product.productRevenuePool.poolKey,
    revenuePoolAppId: product.productRevenuePool.revenuePoolAppId,
    revenueTokenAssetId: product.productRevenuePool.revenueTokenAssetId,
    stakeholders: product.productRevenuePool.stakeholders || [],
    sourceType: 'product',
  };
}

function extractPoolConfig(ip) {
  const resolvedIpId = resolveIpId(ip);
  const appId = Number(ip?.revenuePoolAppId || ip?.appId);
  const tokenId = Number(ip?.revenueTokenAssetId || ip?.revenueTokenId);

  if (!resolvedIpId) {
    throw new Error('Unable to resolve IP identifier.');
  }

  if (!Number.isFinite(appId) || appId <= 0) {
    throw new Error(`Invalid App ID: ${appId}`);
  }

  if (!Number.isFinite(tokenId) || tokenId <= 0) {
    throw new Error(`Invalid Token ID: ${tokenId}`);
  }

  return { resolvedIpId, appId, tokenId };
}

/**
 * POST
 * Prepare ONE unsigned claim transaction only.
 * Safest UX: wallet opt-in is handled separately in its own route/flow.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const userAddr = normalizeAddress(body?.userAddress || body?.accountAddress);
    const requestedIpId = normalizeIpId(body?.poolKey || body?.ipId);

    if (!userAddr || !algosdk.isValidAddress(userAddr)) {
      return NextResponse.json(
        { error: `Invalid sender address: "${userAddr}"` },
        { status: 400 }
      );
    }

    if (!requestedIpId) {
      return NextResponse.json({ error: 'ipId is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const ip = await findIpRecord(db, requestedIpId);
    const { resolvedIpId, appId, tokenId } = extractPoolConfig(ip);

    const algodClient = getAlgodClient();
    const suggestedParams = await getCachedTxParams(algodClient);
    const { genesisHash, genesisID } = getGenesisFields(suggestedParams);

    const accountInfo = await getCachedAccountInfo(algodClient, userAddr);
    const userAssets = Array.isArray(accountInfo?.assets) ? accountInfo.assets : [];
    const existingHolding = findAssetHolding(userAssets, tokenId);
    const hasOptedIn = Boolean(existingHolding);

    if (!hasOptedIn) {
      return NextResponse.json(
        {
          error: 'Wallet must opt in to the revenue token before claiming.',
          code: 'TOKEN_OPT_IN_REQUIRED',
          revenueTokenId: tokenId,
          appId,
          ipId: resolvedIpId,
        },
        { status: 409 }
      );
    }

    const poolBoxName = buildPoolBoxName(resolvedIpId);
    const ipIdBytes = new Uint8Array(Buffer.from(resolvedIpId));

    const claimTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: userAddr,
      appIndex: appId,
      appArgs: [new Uint8Array(Buffer.from('claim_tokens')), ipIdBytes],
      foreignAssets: [tokenId],
      boxes: [{ appIndex: appId, name: poolBoxName }],
      suggestedParams: {
        ...suggestedParams,
        genesisHash,
        genesisID,
        flatFee: true,
        fee: CLAIM_FEE,
      },
    });

    console.log(
      `[CLAIM][POST] Prepared claim txn ipId=${resolvedIpId} appId=${appId} tokenId=${tokenId} user=${userAddr} hasOptedIn=${hasOptedIn}`
    );

    return NextResponse.json(
      safeJson({
        success: true,
        hasOptedIn,
        includedOptIn: false,
        revenueTokenId: tokenId,
        appId,
        ipId: resolvedIpId,
        transaction: encodeUnsignedTxn(claimTxn),
        transactions: [encodeUnsignedTxn(claimTxn)],
        indexesToSign: [0],
      })
    );
  } catch (error) {
    const { status, body } = buildStructuredError(
      error,
      'Failed to prepare claim transaction'
    );
    console.error('[CLAIM][POST] ERROR:', error?.message || error);
    return NextResponse.json(body, { status });
  }
}

/**
 * PUT
 * Submit ONE signed claim transaction only.
 * Safer UX than grouped opt-in + claim; avoids mixed group signing/order issues.
 */
export async function PUT(request) {
  let userAddr = '';
  let ipIdForInvalidation = '';
  let appIdForInvalidation = 0;

  try {
    const body = await request.json();
    userAddr = normalizeAddress(body?.userAddress);
    const requestedIpId = normalizeIpId(body?.poolKey || body?.ipId);
    const signedTxnBase64 = getSingleSignedTxn(body);

    if (!userAddr || !algosdk.isValidAddress(userAddr)) {
      return NextResponse.json(
        { error: `Invalid sender address: "${userAddr}"` },
        { status: 400 }
      );
    }

    if (!requestedIpId) {
      return NextResponse.json({ error: 'ipId is required' }, { status: 400 });
    }

    if (!signedTxnBase64) {
      return NextResponse.json(
        { error: 'signedTxn or signedTxns[0] is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const ip = await findIpRecord(db, requestedIpId);
    const { resolvedIpId, appId, tokenId } = extractPoolConfig(ip);

    ipIdForInvalidation = resolvedIpId;
    appIdForInvalidation = appId;

    const runSubmit = async () => {
      await sleep(500);

      const client = getAlgodClient();

      const signedBytes = decodeSignedBase64Txn(signedTxnBase64);
      const stxn = algosdk.decodeSignedTransaction(signedBytes);
      const decodedSender = stxn?.txn?.sender
        ? algosdk.encodeAddress(stxn.txn.sender.publicKey)
        : null;

      console.log('[CLAIM][PUT] decoded', {
        txid: stxn?.txn?.txID?.(),
        sender: decodedSender,
        appId,
        tokenId,
        ipId: resolvedIpId,
      });

      const result = await client.sendRawTransaction(signedBytes).do();
      const txid = result?.txid ?? result?.txId;

      if (!txid) {
        throw new Error('Claim transaction submitted but no txId was returned.');
      }

      invalidateAccountCache(userAddr);
      invalidatePoolBoxCache(appId, `rev:${resolvedIpId}`);

      return NextResponse.json({
        success: true,
        submitted: true,
        txId: txid,
        explorerUrl: `https://testnet.explorer.perawallet.app/tx/${txid}`,
        message: 'Claim transaction submitted successfully.',
      });
    };

    return await withUserClaimLock(userAddr, runSubmit);
  } catch (error) {
    const { status, body } = buildStructuredError(
      error,
      'Failed to submit claim transaction'
    );
    console.error('[CLAIM][PUT] ERROR:', error?.message || error, {
      userAddr,
      ipId: ipIdForInvalidation,
      appId: appIdForInvalidation,
    });
    return NextResponse.json(body, { status });
  }
}