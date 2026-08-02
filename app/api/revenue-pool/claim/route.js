import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient } from '@/lib/algorand';
import {
  getCachedAccountInfo,
  getCachedPoolBox,
  getCachedTxParams,
  withUserClaimLock,
  sleep,
  invalidatePoolBoxCache,
  invalidateAccountCache
} from '@/lib/algorand-rate-limit';

// USDC Asset ID on Algorand Testnet
const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941', 10);

// Helper: Safe Uint64 Encoding
function encodeUint64(num) {
  try {
    const n = BigInt(Math.floor(Number(num) || 0));
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(n);
    return new Uint8Array(buf);
  } catch (e) {
    console.error('Encoding Error:', e);
    return new Uint8Array(8);
  }
}

function encodePoolBoxName(ipId) {
  return new Uint8Array(Buffer.concat([Buffer.from('p_'), Buffer.from(ipId)]));
}

/**
 * GET /api/revenue-pool/claim
 * Get claim information for a user from the Global Pool Box
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId');
    const userAddress = searchParams.get('userAddress');
    const ipId = searchParams.get('ipId');

    if (!appId || !userAddress || !ipId) {
      return NextResponse.json(
        { error: 'appId, ipId, and userAddress are required' },
        { status: 400 }
      );
    }

    const algodClient = getAlgodClient();
    const appIndex = parseInt(appId, 10);
    const normalizedUser = String(userAddress).trim().toUpperCase();

    const boxName = encodePoolBoxName(ipId);

    let totalDeposited = 0;
    let totalClaimed = 0;
    let revenueTokenId = 0;

    try {
      const boxVal = await getCachedPoolBox(
        algodClient,
        appIndex,
        boxName,
        `usdc:${ipId}`
      );

      const rawValue =
        boxVal?.value instanceof Uint8Array
          ? boxVal.value
          : typeof boxVal?.value === 'string'
          ? new Uint8Array(Buffer.from(boxVal.value, 'base64'))
          : new Uint8Array(boxVal.value);

      const view = new DataView(rawValue.buffer, rawValue.byteOffset, rawValue.byteLength);

      revenueTokenId = Number(view.getBigUint64(0, false));
      totalDeposited = Number(view.getBigUint64(8, false));
      totalClaimed = Number(view.getBigUint64(16, false));
    } catch (e) {
      console.warn(`Box not found for IP ${ipId}:`, e.message);
      return NextResponse.json({ pool: null, error: 'Pool not initialized' });
    }

    const poolBalance = totalDeposited - totalClaimed;

    let userTokenBalance = 0;
    if (revenueTokenId > 0) {
      try {
        const accountInfo = await getCachedAccountInfo(algodClient, normalizedUser);
        const asset = accountInfo.assets?.find(
          (a) => Number(a['asset-id']) === revenueTokenId
        );
        if (asset) {
          userTokenBalance = Number(asset.amount || 0);
        }
      } catch (err) {
        console.log('Could not get user token balance:', err.message);
      }
    }

    const userShareAmount = Math.floor((poolBalance * userTokenBalance) / 100);

    return NextResponse.json({
      success: true,
      appId: appIndex,
      ipId,
      revenueTokenId,
      pool: {
        totalDeposited,
        totalClaimed,
        balance: poolBalance,
        totalDepositedFormatted: (totalDeposited / 1000000).toFixed(2),
        totalClaimedFormatted: (totalClaimed / 1000000).toFixed(2),
        balanceFormatted: (poolBalance / 1000000).toFixed(2)
      },
      user: {
        address: normalizedUser,
        tokenBalance: userTokenBalance,
        claimableAmount: userShareAmount,
        claimableFormatted: (userShareAmount / 1000000).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error getting claim info:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get claim info' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/revenue-pool/claim
 * Create claim transaction
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { claimerAddress, appId, amount, userTokenBalance, ipId } = body;

    if (!claimerAddress || !appId || !amount || userTokenBalance === undefined || !ipId) {
      return NextResponse.json(
        {
          error: 'Missing required fields (claimerAddress, appId, amount, userTokenBalance, ipId)'
        },
        { status: 400 }
      );
    }

    const algodClient = getAlgodClient();
    const suggestedParams = await getCachedTxParams(algodClient);
    const appIndex = parseInt(appId, 10);

    const boxName = encodePoolBoxName(ipId);

    const claimTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: claimerAddress,
      suggestedParams,
      appIndex,
      appArgs: [
        new Uint8Array(Buffer.from('claim_revenue')),
        new Uint8Array(Buffer.from(ipId)),
        encodeUint64(userTokenBalance)
      ],
      foreignAssets: [USDC_ASSET_ID],
      boxes: [{ appIndex, name: boxName }]
    });

    const txnBytes = algosdk.encodeUnsignedTransaction(claimTxn);
    const txnBase64 = Buffer.from(txnBytes).toString('base64');

    return NextResponse.json({
      success: true,
      transaction: txnBase64,
      txnId: claimTxn.txID(),
      message: 'Sign this transaction to claim your USDC'
    });
  } catch (error) {
    console.error('Error creating claim transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create claim transaction' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/revenue-pool/claim
 * Submit signed claim transaction
 */
export async function PUT(request) {
  let claimerAddress = '';

  try {
    const body = await request.json();
    const { signedTxn, userAddress, ipId, appId } = body;
    claimerAddress = String(userAddress || '').trim().toUpperCase();

    if (!signedTxn) {
      return NextResponse.json({ error: 'signedTxn is required' }, { status: 400 });
    }

    const runSubmit = async () => {
      await sleep(500);

      const algodClient = getAlgodClient();
      const signedTxnBytes = new Uint8Array(Buffer.from(signedTxn, 'base64'));
      const result = await algodClient.sendRawTransaction(signedTxnBytes).do();
      const txid = result.txid ?? result.txId;

      console.log('Claim transaction submitted:', txid);

      if (claimerAddress) {
        invalidateAccountCache(claimerAddress);
      }
      if (ipId && appId) {
        invalidatePoolBoxCache(appId, `usdc:${ipId}`);
      }

      await algosdk.waitForConfirmation(algodClient, txid, 10);

      return NextResponse.json({
        success: true,
        txId: txid,
        message: 'USDC claimed successfully!'
      });
    };

    if (claimerAddress) {
      return await withUserClaimLock(claimerAddress, runSubmit);
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

    console.error('Error claiming from Revenue Pool:', error);
    return NextResponse.json(
      { error: message || 'Failed to claim from Revenue Pool' },
      { status: 500 }
    );
  }
}