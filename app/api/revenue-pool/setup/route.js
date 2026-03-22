import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient, getTransactionParams, waitForConfirmation } from '@/lib/algorand';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

// USDC Asset ID on Algorand Testnet
const USDC_ASSET_ID = parseInt(process.env.USDC_ASSET_ID || '10458941');

// Read compiled TEAL files
function getCompiledPrograms() {
  const contractsDir = path.join(process.cwd(), 'contracts');
  const approvalTeal = fs.readFileSync(path.join(contractsDir, 'revenue_pool_approval.teal'), 'utf8');
  const clearTeal = fs.readFileSync(path.join(contractsDir, 'revenue_pool_clear.teal'), 'utf8');
  return { approvalTeal, clearTeal };
}

// Compile TEAL to bytecode
async function compileTeal(tealSource) {
  const algodClient = getAlgodClient();
  const compiled = await algodClient.compile(tealSource).do();
  return new Uint8Array(Buffer.from(compiled.result, 'base64'));
}

/**
 * POST /api/revenue-pool/setup
 * Creates transactions to:
 * 1. Deploy Revenue Pool contract
 * 2. Initialize the pool with IP and token IDs
 * 3. Pool opts-in to Revenue Token and USDC
 * 4. Creator transfers all 100 tokens to the pool
 * 5. Set stakeholder allocations
 * 
 * Returns grouped transactions for user to sign
 */
export async function POST(request) {
  try {
    // Auth check
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
    const { ipAssetId, creatorAddress } = body;

    if (!ipAssetId || !creatorAddress) {
      return NextResponse.json({ 
        error: 'ipAssetId and creatorAddress are required' 
      }, { status: 400 });
    }

    // Validate address
    if (!algosdk.isValidAddress(creatorAddress)) {
      return NextResponse.json({ error: 'Invalid Algorand address' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Get the IP asset
    const ipAsset = await db.collection('ip_assets').findOne({ 
      id: ipAssetId,
      ownerId: decoded.userId
    });

    if (!ipAsset) {
      return NextResponse.json({ error: 'IP asset not found' }, { status: 404 });
    }

    if (!ipAsset.revenueTokenAssetId) {
      return NextResponse.json({ 
        error: 'IP asset has no revenue token. Please mint first.' 
      }, { status: 400 });
    }

    if (ipAsset.revenuePoolAppId) {
      return NextResponse.json({ 
        error: 'Revenue pool already exists for this IP',
        revenuePoolAppId: ipAsset.revenuePoolAppId
      }, { status: 400 });
    }

    // Get compiled TEAL programs
    const { approvalTeal, clearTeal } = getCompiledPrograms();
    const [approvalProgram, clearProgram] = await Promise.all([
      compileTeal(approvalTeal),
      compileTeal(clearTeal)
    ]);

    const suggestedParams = await getTransactionParams();
    const revenueTokenId = ipAsset.revenueTokenAssetId;

    // Get stakeholders from IP asset or use defaults
    const stakeholders = ipAsset.stakeholders || [
      { address: creatorAddress, percentage: 80, name: 'Creator' },
      { address: process.env.METAWORK_PLATFORM_WALLET, percentage: 20, name: 'Platform' }
    ];

    console.log('Setting up Revenue Pool for IP:', ipAssetId);
    console.log('Revenue Token ID:', revenueTokenId);
    console.log('Stakeholders:', stakeholders);

    // Transaction 1: Deploy the Revenue Pool contract
    const deployTxn = algosdk.makeApplicationCreateTxnFromObject({
      sender: creatorAddress,
      suggestedParams: { ...suggestedParams, fee: 2000 }, // Higher fee for contract creation
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram,
      clearProgram,
      numGlobalByteSlices: 2,
      numGlobalInts: 4,
      numLocalByteSlices: 0,
      numLocalInts: 1,
      extraPages: 0
    });

    // We need to deploy first, get the app ID, then create the rest of the transactions
    // This requires a two-step process OR we use a predictable app address

    // For now, return just the deploy transaction
    // The frontend will call back with the app ID after deployment
    const txnBytes = algosdk.encodeUnsignedTransaction(deployTxn);
    const txnBase64 = Buffer.from(txnBytes).toString('base64');

    return NextResponse.json({
      success: true,
      step: 'deploy',
      transaction: txnBase64,
      txnId: deployTxn.txID(),
      revenueTokenId,
      stakeholders,
      message: 'Sign this transaction to deploy your Revenue Pool contract'
    });

  } catch (error) {
    console.error('Error setting up Revenue Pool:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to setup Revenue Pool'
    }, { status: 500 });
  }
}

/**
 * PUT /api/revenue-pool/setup
 * Complete the setup after deployment:
 * 1. Submit signed deploy transaction
 * 2. Initialize pool
 * 3. Pool opts-in to tokens
 * 4. Transfer tokens to pool
 * 5. Set stakeholder allocations
 */
export async function PUT(request) {
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
    const { 
      ipAssetId, 
      creatorAddress, 
      signedDeployTxn,
      step // 'deploy' or 'finalize'
    } = body;

    const { db } = await connectToDatabase();
    const algodClient = getAlgodClient();

    if (step === 'deploy') {
      // Submit the deploy transaction and get app ID
      const signedTxnBytes = new Uint8Array(Buffer.from(signedDeployTxn, 'base64'));
      const { txid } = await algodClient.sendRawTransaction(signedTxnBytes).do();
      
      console.log('Deploy transaction submitted:', txid);
      
      // Wait for confirmation
      const confirmedTxn = await waitForConfirmation(txid, 15);
      const appId = confirmedTxn['application-index'];
      
      if (!appId) {
        throw new Error('Failed to get application ID from deploy transaction');
      }

      console.log('Revenue Pool deployed with App ID:', appId);
      
      // Get app address
      const appAddress = algosdk.getApplicationAddress(appId);
      
      // Get the IP asset
      const ipAsset = await db.collection('ip_assets').findOne({ id: ipAssetId });
      if (!ipAsset) {
        throw new Error('IP asset not found');
      }

      const revenueTokenId = ipAsset.revenueTokenAssetId;
      const stakeholders = ipAsset.stakeholders || [
        { address: creatorAddress, percentage: 80 },
        { address: process.env.METAWORK_PLATFORM_WALLET, percentage: 20 }
      ];

      // Now create the finalization transactions
      const suggestedParams = await getTransactionParams();

      // Transaction 1: Fund the app account (minimum balance for opt-ins)
      const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: creatorAddress,
        receiver: appAddress,
        amount: 400000, // 0.4 ALGO for min balance (2 asset opt-ins + boxes)
        suggestedParams
      });

      // Transaction 2: Initialize the pool
      const initTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: creatorAddress,
        suggestedParams,
        appIndex: appId,
        appArgs: [
          new Uint8Array(Buffer.from('init')),
          new Uint8Array(Buffer.from(ipAssetId)),
          algosdk.encodeUint64(revenueTokenId)
        ]
      });

      // Transaction 3: Pool opts-in to assets
      const optInTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: creatorAddress,
        suggestedParams,
        appIndex: appId,
        appArgs: [
          new Uint8Array(Buffer.from('opt_in_assets'))
        ],
        foreignAssets: [revenueTokenId, USDC_ASSET_ID]
      });

      // Transaction 4: Transfer all 100 revenue tokens to the pool
      const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: creatorAddress,
        receiver: appAddress,
        amount: 100, // All 100 revenue tokens
        assetIndex: revenueTokenId,
        suggestedParams
      });

      // Transactions 5+: Set stakeholder allocations (one per stakeholder)
      const stakeholderTxns = stakeholders.map(stakeholder => {
        return algosdk.makeApplicationNoOpTxnFromObject({
          sender: creatorAddress,
          suggestedParams: { ...suggestedParams, fee: 2000 }, // Higher fee for box creation
          appIndex: appId,
          appArgs: [
            new Uint8Array(Buffer.from('set_stakeholder')),
            algosdk.decodeAddress(stakeholder.address).publicKey,
            algosdk.encodeUint64(stakeholder.percentage)
          ],
          boxes: [
            { appIndex: appId, name: Buffer.concat([Buffer.from('stk_'), algosdk.decodeAddress(stakeholder.address).publicKey]) }
          ]
        });
      });

      // Group all transactions
      const allTxns = [fundTxn, initTxn, optInTxn, transferTxn, ...stakeholderTxns];
      algosdk.assignGroupID(allTxns);

      // Encode for signing
      const txnsBase64 = allTxns.map(txn => 
        Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64')
      );

      // Save app ID to database (partial save)
      await db.collection('ip_assets').updateOne(
        { id: ipAssetId },
        { 
          $set: { 
            revenuePoolAppId: appId,
            revenuePoolAddress: appAddress,
            revenuePoolStatus: 'pending_finalization'
          }
        }
      );

      return NextResponse.json({
        success: true,
        step: 'finalize',
        appId,
        appAddress,
        transactions: txnsBase64,
        transactionCount: txnsBase64.length,
        message: `Sign ${txnsBase64.length} transactions to finalize your Revenue Pool`
      });
    }

    if (step === 'finalize') {
      // Submit the finalization transactions
      const { signedTxns, appId } = body;
      
      if (!signedTxns || !Array.isArray(signedTxns)) {
        return NextResponse.json({ error: 'signedTxns array required' }, { status: 400 });
      }

      const signedTxnBytes = signedTxns.map(txn => 
        new Uint8Array(Buffer.from(txn, 'base64'))
      );

      // Submit as atomic group
      const { txid } = await algodClient.sendRawTransaction(signedTxnBytes).do();
      console.log('Finalization transactions submitted:', txid);

      // Wait for confirmation
      await waitForConfirmation(txid, 15);

      // Update database
      await db.collection('ip_assets').updateOne(
        { id: ipAssetId },
        { 
          $set: { 
            revenuePoolStatus: 'active',
            revenuePoolFinalizedAt: new Date(),
            'revenueTokens.creatorHolding': 0,
            'revenueTokens.poolHolding': 100
          }
        }
      );

      return NextResponse.json({
        success: true,
        step: 'complete',
        appId,
        txId: txid,
        message: 'Revenue Pool setup complete! All tokens transferred to pool.'
      });
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });

  } catch (error) {
    console.error('Error completing Revenue Pool setup:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to complete Revenue Pool setup'
    }, { status: 500 });
  }
}
