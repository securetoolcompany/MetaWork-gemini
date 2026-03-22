import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient, getTransactionParams, waitForConfirmation } from '@/lib/algorand';

// USDC Asset ID on Algorand Testnet
const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941');

/**
 * POST /api/revenue-pool/init
 * Initialize the revenue pool with IP ID and revenue token ID
 * Returns transaction for user to sign
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { creatorAddress, appId, ipId, revenueTokenId } = body;

    if (!creatorAddress || !appId || !ipId || !revenueTokenId) {
      return NextResponse.json({ 
        error: 'creatorAddress, appId, ipId, and revenueTokenId are required' 
      }, { status: 400 });
    }

    // Validate address
    if (!algosdk.isValidAddress(creatorAddress)) {
      return NextResponse.json({ error: 'Invalid Algorand address' }, { status: 400 });
    }

    const suggestedParams = await getTransactionParams();

    // Create init transaction
    const initTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: creatorAddress,
      suggestedParams,
      appIndex: appId,
      appArgs: [
        new Uint8Array(Buffer.from('init')),
        new Uint8Array(Buffer.from(ipId)),
        algosdk.encodeUint64(revenueTokenId)
      ]
    });

    // Encode transaction for signing
    const txnBytes = algosdk.encodeUnsignedTransaction(initTxn);
    const txnBase64 = Buffer.from(txnBytes).toString('base64');

    return NextResponse.json({
      success: true,
      transaction: txnBase64,
      txnId: initTxn.txID(),
      message: 'Sign this transaction to initialize your Revenue Pool'
    });

  } catch (error) {
    console.error('Error creating init transaction:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create init transaction'
    }, { status: 500 });
  }
}

/**
 * PUT /api/revenue-pool/init
 * Submit signed init transaction
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { signedTxn } = body;

    if (!signedTxn) {
      return NextResponse.json({ error: 'signedTxn is required' }, { status: 400 });
    }

    // Decode signed transaction
    const signedTxnBytes = new Uint8Array(Buffer.from(signedTxn, 'base64'));

    // Submit transaction
    const algodClient = getAlgodClient();
    const { txid } = await algodClient.sendRawTransaction(signedTxnBytes).do();
    
    console.log('Revenue Pool init transaction submitted:', txid);

    // Wait for confirmation
    await waitForConfirmation(txid, 10);

    return NextResponse.json({
      success: true,
      txId: txid,
      message: 'Revenue Pool initialized successfully!'
    });

  } catch (error) {
    console.error('Error initializing Revenue Pool:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to initialize Revenue Pool'
    }, { status: 500 });
  }
}
