import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient, getTransactionParams, waitForConfirmation } from '@/lib/algorand';
import { GLOBAL_POOL_APP_ID, getProductBoxKey } from '@/lib/revenue-pool-utils';

// USDC Asset ID on Algorand Testnet
const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941');

export async function POST(request) {
  try {
    const body = await request.json();
    // productId is now required instead of appId, though we support appId for legacy if needed
    const { senderAddress, productId, amount } = body; 

    if (!senderAddress || !productId || !amount) {
      return NextResponse.json({ 
        error: 'senderAddress, productId, and amount are required' 
      }, { status: 400 });
    }

    if (!algosdk.isValidAddress(senderAddress)) {
      return NextResponse.json({ error: 'Invalid Algorand address' }, { status: 400 });
    }

    const suggestedParams = await getTransactionParams();
    const appAddress = algosdk.getApplicationAddress(GLOBAL_POOL_APP_ID);

    // Transaction 1: USDC transfer to Global App
    const usdcTransferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: senderAddress,
      receiver: appAddress,
      amount: amount, // Amount in micro-USDC (6 decimals)
      assetIndex: USDC_ASSET_ID,
      suggestedParams
    });

    // Transaction 2: App call to 'deposit_usdc' with Box Reference
    const depositAppCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: senderAddress,
      suggestedParams,
      appIndex: GLOBAL_POOL_APP_ID,
      appArgs: [
        new Uint8Array(Buffer.from('deposit_usdc')),
        new Uint8Array(Buffer.from(productId))
      ],
      foreignAssets: [USDC_ASSET_ID],
      boxes: [{ appIndex: GLOBAL_POOL_APP_ID, name: getProductBoxKey(productId) }]
    });

    // Group the transactions
    algosdk.assignGroupID([usdcTransferTxn, depositAppCallTxn]);

    const txn1Bytes = algosdk.encodeUnsignedTransaction(usdcTransferTxn);
    const txn2Bytes = algosdk.encodeUnsignedTransaction(depositAppCallTxn);

    return NextResponse.json({
      success: true,
      transactions: [
        Buffer.from(txn1Bytes).toString('base64'),
        Buffer.from(txn2Bytes).toString('base64')
      ],
      groupId: Buffer.from(usdcTransferTxn.group).toString('base64'),
      message: 'Sign both transactions to deposit USDC to the Revenue Pool'
    });

  } catch (error) {
    console.error('Error creating deposit transaction:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create deposit transaction'
    }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { signedTxns } = body;

    if (!signedTxns || signedTxns.length !== 2) {
      return NextResponse.json({ 
        error: 'signedTxns array with 2 transactions is required' 
      }, { status: 400 });
    }

    const signedTxnBytes = signedTxns.map(txn => 
      new Uint8Array(Buffer.from(txn, 'base64'))
    );

    const algodClient = getAlgodClient();
    const { txid } = await algodClient.sendRawTransaction(signedTxnBytes).do();

    console.log('Deposit transaction submitted:', txid);
    await waitForConfirmation(txid, 10);

    return NextResponse.json({
      success: true,
      txId: txid,
      message: 'USDC deposited to Revenue Pool successfully!'
    });

  } catch (error) {
    console.error('Error depositing to Revenue Pool:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to deposit to Revenue Pool'
    }, { status: 500 });
  }
}