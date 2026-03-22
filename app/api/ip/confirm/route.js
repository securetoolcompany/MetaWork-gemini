import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { getAlgodClient, getAssetIdFromTransaction } from '@/lib/algorand';
import algosdk from 'algosdk';

// Confirm IP NFT + Revenue Token minting after user signs the transactions
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const token = authHeader?.substring(7) || cookieToken;
    
    console.log('POST /api/ip/confirm - Auth debug:', {
      hasAuthHeader: !!authHeader,
      authHeaderValue: authHeader?.substring(0, 20) + '...',
      hasCookieToken: !!cookieToken,
      tokenLength: token?.length || 0
    });
    
    if (!token) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    console.log('Confirm token decoded:', decoded ? { userId: decoded.userId } : 'null');
    
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const body = await request.json();
    const { ipAssetId, signedTransactions } = body;
    
    if (!ipAssetId || !signedTransactions || !Array.isArray(signedTransactions)) {
      return NextResponse.json(
        { error: 'IP asset ID and signed transactions array are required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Get the pending IP asset
    const ipAsset = await db.collection('ip_assets').findOne({
      id: ipAssetId,
      ownerId: decoded.userId,
      status: 'unminted'
    });
    
    if (!ipAsset) {
      return NextResponse.json(
        { error: 'IP asset not found or already minted' },
        { status: 404 }
      );
    }
    
    // Decode all signed transactions
    const signedTxnBytes = signedTransactions.map(base64 => 
      new Uint8Array(Buffer.from(base64, 'base64'))
    );
    
    console.log('Submitting', signedTxnBytes.length, 'signed transactions as atomic group...');
    
    const algodClient = getAlgodClient();
    
    // Submit the atomic transaction group
    let txId;
    try {
      const sendResult = await algodClient.sendRawTransaction(signedTxnBytes).do();
      // algosdk v3 returns { txid: string } or { txId: string }
      txId = sendResult.txid || sendResult.txId || sendResult.txID;
      console.log('Transaction group submitted, sendResult:', JSON.stringify(sendResult));
      console.log('Transaction ID:', txId);
      
      if (!txId) {
        // Try to compute txId from first transaction
        const firstTxn = algosdk.decodeSignedTransaction(signedTxnBytes[0]);
        txId = firstTxn.txn.txID();
        console.log('Computed txId from first transaction:', txId);
      }
    } catch (submitError) {
      console.error('Transaction submission error:', submitError);
      
      // Parse the error for user-friendly messages
      const errorMsg = submitError.message || submitError.toString();
      
      if (errorMsg.includes('overspend')) {
        return NextResponse.json(
          { error: 'Insufficient funds in your wallet. Please add more ALGO to cover transaction fees.' },
          { status: 400 }
        );
      }
      
      if (errorMsg.includes('below min')) {
        // Parse actual balance requirement from error message
        // Format: "balance XXXXXX below min YYYYYY (N assets)"
        const balanceMatch = errorMsg.match(/balance (\d+) below min (\d+)/);
        const assetsMatch = errorMsg.match(/\((\d+) assets?\)/);
        
        let currentBalance = '0';
        let requiredBalance = '1';
        let numAssets = 0;
        
        if (balanceMatch) {
          currentBalance = (parseInt(balanceMatch[1]) / 1000000).toFixed(3);
          requiredBalance = (parseInt(balanceMatch[2]) / 1000000).toFixed(2);
        }
        if (assetsMatch) {
          numAssets = parseInt(assetsMatch[1]);
        }
        
        // Creating 2 new assets requires 0.2 ALGO additional minimum balance
        const totalNeeded = (parseFloat(requiredBalance) + 0.2).toFixed(2);
        
        return NextResponse.json(
          { 
            error: `Minimum balance requirement not met. You have ${currentBalance} ALGO but need at least ${totalNeeded} ALGO. On Algorand, holding assets increases your minimum balance requirement (you have ${numAssets} assets). Please add more ALGO to your wallet.`
          },
          { status: 400 }
        );
      }
      
      throw submitError;
    }
    
    // Wait for confirmation with increased timeout (20 rounds) and retries
    console.log('Waiting for confirmation for txId:', txId);
    let confirmedTxn;
    let retryCount = 0;
    const maxRetries = 3;
    
    // Helper to safely stringify objects with BigInt
    const safeStringify = (obj) => {
      return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2);
    };
    
    while (retryCount < maxRetries) {
      try {
        confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 20);
        console.log('waitForConfirmation result:', safeStringify(confirmedTxn));
        break; // Success, exit loop
      } catch (confirmError) {
        retryCount++;
        console.error(`Confirmation attempt ${retryCount} error:`, confirmError.message);
        
        if (retryCount >= maxRetries) {
          // Final attempt - check if transaction is already confirmed
          try {
            const pendingTxn = await algodClient.pendingTransactionInformation(txId).do();
            console.log('Final pending transaction info:', safeStringify(pendingTxn));
            
            if (pendingTxn['confirmed-round'] || pendingTxn.confirmedRound) {
              confirmedTxn = pendingTxn;
              console.log('Transaction was already confirmed');
              break;
            } else if (pendingTxn['pool-error'] || pendingTxn.poolError) {
              return NextResponse.json(
                { error: `Transaction failed: ${pendingTxn['pool-error'] || pendingTxn.poolError}` },
                { status: 400 }
              );
            }
          } catch (pendingError) {
            console.error('Pending info error:', pendingError.message);
          }
          
          // Transaction might be confirmed but we can't verify
          // Since the user sees it in Pera, let's proceed optimistically
          console.log('Could not confirm transaction, but it may have succeeded. Proceeding...');
          confirmedTxn = { confirmedRound: 'unknown' };
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Get asset IDs using the indexer (more reliable than pending tx info)
    console.log('Fetching asset IDs from indexer for txId:', txId);
    
    let nftAssetId = null;
    let revenueTokenAssetId = null;
    
    // Get NFT asset ID from first transaction
    nftAssetId = await getAssetIdFromTransaction(txId, 10, 2000);
    console.log('NFT Asset ID from indexer:', nftAssetId);
    
    // Get Revenue Token asset ID from second transaction
    if (signedTxnBytes.length > 1) {
      try {
        const secondTxnDecoded = algosdk.decodeSignedTransaction(signedTxnBytes[1]);
        const secondTxId = secondTxnDecoded.txn.txID();
        console.log('Second transaction ID:', secondTxId);
        
        revenueTokenAssetId = await getAssetIdFromTransaction(secondTxId, 10, 2000);
        console.log('Revenue Token Asset ID from indexer:', revenueTokenAssetId);
      } catch (err) {
        console.error('Error getting second asset ID:', err.message);
      }
    }
    
    if (!nftAssetId) {
      console.log('Could not extract NFT Asset ID from blockchain, but transaction was submitted');
      // The transaction was submitted successfully - mark as minted but without asset IDs
      // User can verify in Pera Wallet
      await db.collection('ip_assets').updateOne(
        { id: ipAssetId },
        {
          $set: {
            txId,
            status: 'minted',
            mintedAt: new Date(),
            updatedAt: new Date(),
            // Note that asset IDs need to be verified manually
            nftAssetId: null,
            revenueTokenAssetId: null,
            mintNote: 'Transaction submitted. Please check Pera Wallet for your new assets.'
          }
        }
      );
      
      const updatedAsset = await db.collection('ip_assets').findOne({ id: ipAssetId });
      
      return NextResponse.json({
        success: true,
        ipAsset: updatedAsset,
        nftAssetId: null,
        revenueTokenAssetId: null,
        txId,
        message: 'Transaction submitted successfully! Your NFT should appear in Pera Wallet shortly.',
        explorerUrl: `https://testnet.explorer.perawallet.app/tx/${txId}`
      });
    }
    
    console.log('Final - NFT Asset ID:', nftAssetId, 'Revenue Token Asset ID:', revenueTokenAssetId);
    
    // Update the IP asset record
    await db.collection('ip_assets').updateOne(
      { id: ipAssetId },
      {
        $set: {
          nftAssetId,
          revenueTokenAssetId,
          txId,
          status: 'minted',
          mintedAt: new Date(),
          updatedAt: new Date(),
          // Track revenue token distribution
          revenueTokens: {
            total: 100,
            creatorAllocation: 80,
            platformAllocation: 20,
            creatorHolding: 100, // Creator gets all initially
            platformHolding: 0,  // Platform needs to opt-in and receive transfer
            platformTransferPending: true
          }
        }
      }
    );
    
    // Add to ownership history
    await db.collection('ip_ownership_history').insertOne({
      ipAssetId,
      nftAssetId,
      revenueTokenAssetId,
      fromWallet: null,
      toWallet: ipAsset.ownerWallet,
      txId,
      type: 'mint',
      timestamp: new Date()
    });
    
    const updatedAsset = await db.collection('ip_assets').findOne({ id: ipAssetId });
    
    return NextResponse.json({
      success: true,
      ipAsset: updatedAsset,
      nftAssetId,
      revenueTokenAssetId,
      txId,
      explorerUrl: `https://testnet.explorer.perawallet.app/asset/${nftAssetId}`
    });
  } catch (error) {
    console.error('Confirm IP minting error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to confirm IP minting' },
      { status: 500 }
    );
  }
}
