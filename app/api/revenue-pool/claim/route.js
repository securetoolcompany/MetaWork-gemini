import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient, getTransactionParams, waitForConfirmation } from '@/lib/algorand';

// USDC Asset ID on Algorand Testnet
const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941');

// Helper: Safe Uint64 Encoding
function encodeUint64(num) {
  try {
    const n = BigInt(Math.floor(Number(num) || 0));
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(n);
    return new Uint8Array(buf);
  } catch (e) {
    console.error("Encoding Error:", e);
    return new Uint8Array(8); 
  }
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
    const ipId = searchParams.get('ipId'); // REQUIRED for Global Pool

    if (!appId || !userAddress || !ipId) {
      return NextResponse.json({ 
        error: 'appId, ipId, and userAddress are required' 
      }, { status: 400 });
    }

    const algodClient = getAlgodClient();
    const appIndex = parseInt(appId);

    // 1. Read Box State (Global Pool Architecture)
    // Box Key: "p_" + ipId
    const boxName = new Uint8Array(Buffer.concat([Buffer.from("p_"), Buffer.from(ipId)]));

    let totalDeposited = 0;
    let totalClaimed = 0;
    let revenueTokenId = 0;

    try {
        const boxVal = await algodClient.getApplicationBoxByName(appIndex, boxName).do();
        const view = new DataView(boxVal.value.buffer);

        // Parse Box Data (BigEndian)
        // [0:8] rev_asa_id, [8:16] total_dep, [16:24] total_claimed
        revenueTokenId = Number(BigInt(view.getBigUint64(0, false)));
        totalDeposited = Number(BigInt(view.getBigUint64(8, false)));
        totalClaimed = Number(BigInt(view.getBigUint64(16, false)));
    } catch (e) {
        // If box doesn't exist, pool isn't initialized
        console.warn(`Box not found for IP ${ipId}:`, e.message);
        return NextResponse.json({ pool: null, error: "Pool not initialized" });
    }

    const poolBalance = totalDeposited - totalClaimed;

    // 2. Get User's Token Balance
    let userTokenBalance = 0;
    if (revenueTokenId > 0) {
      try {
        const accountInfo = await algodClient.accountInformation(userAddress).do();
        const asset = accountInfo.assets?.find(a => a['asset-id'] === revenueTokenId);
        if (asset) {
          userTokenBalance = asset.amount || 0;
        }
      } catch (err) {
        console.log('Could not get user token balance:', err.message);
      }
    }

    // 3. Calculate Share
    // Total Supply is fixed at 100 in Global Pool
    // Formula: (PoolBalance * UserTokens) / 100
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
        address: userAddress,
        tokenBalance: userTokenBalance,
        claimableAmount: userShareAmount,
        claimableFormatted: (userShareAmount / 1000000).toFixed(2)
      }
    });

  } catch (error) {
    console.error('Error getting claim info:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get claim info'
    }, { status: 500 });
  }
}

/**
 * POST /api/revenue-pool/claim
 * Create claim transaction
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { claimerAddress, appId, amount, userTokenBalance, ipId } = body; // ipId required

    if (!claimerAddress || !appId || !amount || userTokenBalance === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields (claimerAddress, appId, amount, userTokenBalance)' 
      }, { status: 400 });
    }

    // Try to find ipId if missing (fallback logic, though frontend should send it)
    let productId = ipId; 
    if (!productId) {
        // In Global Pool, we absolutely need the IP ID to find the box
        return NextResponse.json({ error: "ipId is required for Global Pool claims" }, { status: 400 });
    }

    const suggestedParams = await getTransactionParams();
    const appIndex = parseInt(appId);

    // Box Key: "p_" + ipId
    const boxName = new Uint8Array(Buffer.concat([Buffer.from("p_"), Buffer.from(productId)]));

    // Create claim_revenue transaction
    // Args: ["claim_revenue", product_id, user_token_balance]
    const claimTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: claimerAddress,
      suggestedParams,
      appIndex: appIndex,
      appArgs: [
        new Uint8Array(Buffer.from('claim_revenue')),
        new Uint8Array(Buffer.from(productId)),
        encodeUint64(userTokenBalance)
      ],
      foreignAssets: [USDC_ASSET_ID],
      boxes: [{ appIndex: appIndex, name: boxName }]
    });

    // Encode transaction for signing
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
    return NextResponse.json({ 
      error: error.message || 'Failed to create claim transaction'
    }, { status: 500 });
  }
}

/**
 * PUT /api/revenue-pool/claim
 * Submit signed claim transaction
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { signedTxn } = body;

    if (!signedTxn) {
      return NextResponse.json({ error: 'signedTxn is required' }, { status: 400 });
    }

    const signedTxnBytes = new Uint8Array(Buffer.from(signedTxn, 'base64'));
    const algodClient = getAlgodClient();
    const { txid } = await algodClient.sendRawTransaction(signedTxnBytes).do();

    console.log('Claim transaction submitted:', txid);
    await waitForConfirmation(txid, 10);

    return NextResponse.json({
      success: true,
      txId: txid,
      message: 'USDC claimed successfully!'
    });

  } catch (error) {
    console.error('Error claiming from Revenue Pool:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to claim from Revenue Pool'
    }, { status: 500 });
  }
}