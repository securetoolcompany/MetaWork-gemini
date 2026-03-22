import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { getAlgodClient, getAssetIdFromTransaction } from '@/lib/algorand';
import { 
  createPlatformTokenTransferTransaction, 
  hasOptedInToAsset, 
  getPlatformWallet 
} from '@/lib/algorand-tokens';
import algosdk from 'algosdk';

// GET - Check platform transfer status and get transfer transaction if ready
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const token = authHeader?.substring(7) || cookieToken;
    
    if (!token) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const ipAssetId = searchParams.get('ipAssetId');
    
    if (!ipAssetId) {
      return NextResponse.json({ error: 'IP asset ID required' }, { status: 400 });
    }
    
    const { db } = await connectToDatabase();
    
    const ipAsset = await db.collection('ip_assets').findOne({
      id: ipAssetId,
      ownerId: decoded.userId
    });
    
    if (!ipAsset) {
      return NextResponse.json({ error: 'IP asset not found' }, { status: 404 });
    }
    
    if (!ipAsset.revenueTokenAssetId) {
      return NextResponse.json({ 
        error: 'Revenue token not minted yet',
        status: 'not_minted'
      }, { status: 400 });
    }
    
    // Check if transfer already completed
    if (ipAsset.revenueTokens?.platformTransferComplete) {
      return NextResponse.json({
        status: 'completed',
        message: 'Platform transfer already completed',
        platformWallet: getPlatformWallet(),
        transferTxId: ipAsset.revenueTokens.platformTransferTxId
      });
    }
    
    const platformWallet = getPlatformWallet();
    
    // Check if platform has opted-in to the asset
    const platformOptedIn = await hasOptedInToAsset(platformWallet, ipAsset.revenueTokenAssetId);
    
    if (!platformOptedIn) {
      return NextResponse.json({
        status: 'pending_opt_in',
        message: 'Platform wallet has not opted-in to this asset yet. Transfer is pending.',
        platformWallet,
        revenueTokenAssetId: ipAsset.revenueTokenAssetId
      });
    }
    
    // Platform is opted-in, create transfer transaction
    const { txnBytesBase64, amount } = await createPlatformTokenTransferTransaction(
      ipAsset.ownerWallet,
      ipAsset.revenueTokenAssetId
    );
    
    return NextResponse.json({
      status: 'ready',
      message: 'Platform is ready to receive tokens. Please sign the transfer.',
      platformWallet,
      revenueTokenAssetId: ipAsset.revenueTokenAssetId,
      transferAmount: amount,
      transaction: txnBytesBase64
    });
    
  } catch (error) {
    console.error('Get platform transfer status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get platform transfer status' },
      { status: 500 }
    );
  }
}

// POST - Submit signed platform transfer transaction
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const token = authHeader?.substring(7) || cookieToken;
    
    if (!token) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const body = await request.json();
    const { ipAssetId, signedTransaction } = body;
    
    if (!ipAssetId || !signedTransaction) {
      return NextResponse.json(
        { error: 'IP asset ID and signed transaction are required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    const ipAsset = await db.collection('ip_assets').findOne({
      id: ipAssetId,
      ownerId: decoded.userId
    });
    
    if (!ipAsset) {
      return NextResponse.json({ error: 'IP asset not found' }, { status: 404 });
    }
    
    if (ipAsset.revenueTokens?.platformTransferComplete) {
      return NextResponse.json({
        success: true,
        message: 'Platform transfer already completed',
        txId: ipAsset.revenueTokens.platformTransferTxId
      });
    }
    
    // Decode and submit the signed transaction
    const signedTxnBytes = new Uint8Array(Buffer.from(signedTransaction, 'base64'));
    
    const algodClient = getAlgodClient();
    
    let txId;
    try {
      const sendResult = await algodClient.sendRawTransaction(signedTxnBytes).do();
      txId = sendResult.txid || sendResult.txId || sendResult.txID;
      console.log('Platform transfer submitted, txId:', txId);
    } catch (submitError) {
      console.error('Platform transfer submission error:', submitError);
      
      const errorMsg = submitError.message || submitError.toString();
      
      if (errorMsg.includes('asset') && errorMsg.includes('not opted')) {
        return NextResponse.json(
          { error: 'Platform wallet has not opted-in to this asset. Please wait and try again later.' },
          { status: 400 }
        );
      }
      
      if (errorMsg.includes('underflow') || errorMsg.includes('below min')) {
        return NextResponse.json(
          { error: 'Insufficient balance for this transfer. Please check your wallet.' },
          { status: 400 }
        );
      }
      
      throw submitError;
    }
    
    // Wait for confirmation
    try {
      await algosdk.waitForConfirmation(algodClient, txId, 10);
      console.log('Platform transfer confirmed');
    } catch (confirmError) {
      console.error('Platform transfer confirmation error:', confirmError.message);
      // Continue anyway - transaction may still succeed
    }
    
    // Update the IP asset record
    await db.collection('ip_assets').updateOne(
      { id: ipAssetId },
      {
        $set: {
          'revenueTokens.platformTransferComplete': true,
          'revenueTokens.platformTransferTxId': txId,
          'revenueTokens.platformTransferDate': new Date(),
          'revenueTokens.creatorHolding': 80,
          'revenueTokens.platformHolding': 20,
          'revenueTokens.platformTransferPending': false,
          updatedAt: new Date()
        }
      }
    );
    
    // Log the transfer
    await db.collection('token_transfers').insertOne({
      ipAssetId,
      revenueTokenAssetId: ipAsset.revenueTokenAssetId,
      fromWallet: ipAsset.ownerWallet,
      toWallet: getPlatformWallet(),
      amount: 20,
      type: 'platform_fee',
      txId,
      timestamp: new Date()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Platform transfer completed successfully!',
      txId,
      explorerUrl: `https://testnet.explorer.perawallet.app/tx/${txId}`
    });
    
  } catch (error) {
    console.error('Platform transfer error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete platform transfer' },
      { status: 500 }
    );
  }
}
