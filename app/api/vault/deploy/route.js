import { NextResponse } from 'next/server';
import algosdk from 'algosdk';
import { getAlgodClient, getTransactionParams, waitForConfirmation } from '@/lib/algorand';
import fs from 'fs';
import path from 'path';

// Read compiled TEAL files
function getCompiledPrograms() {
  const contractsDir = path.join(process.cwd(), 'contracts');
  
  try {
    const approvalTeal = fs.readFileSync(path.join(contractsDir, 'ip_vault_approval.teal'), 'utf8');
    const clearTeal = fs.readFileSync(path.join(contractsDir, 'ip_vault_clear.teal'), 'utf8');
    return { approvalTeal, clearTeal };
  } catch (error) {
    console.error('Error reading TEAL files:', error);
    throw new Error('TEAL files not found. Please compile the contract first.');
  }
}

// Compile TEAL to bytecode
async function compileTeal(tealSource) {
  const algodClient = getAlgodClient();
  const compiled = await algodClient.compile(tealSource).do();
  return new Uint8Array(Buffer.from(compiled.result, 'base64'));
}

/**
 * GET /api/vault/deploy
 * Get deployment transaction for user to sign
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorAddress = searchParams.get('creatorAddress');

    if (!creatorAddress) {
      return NextResponse.json({ error: 'creatorAddress is required' }, { status: 400 });
    }

    // Validate address
    if (!algosdk.isValidAddress(creatorAddress)) {
      return NextResponse.json({ error: 'Invalid Algorand address' }, { status: 400 });
    }

    // Get compiled TEAL programs
    const { approvalTeal, clearTeal } = getCompiledPrograms();

    // Compile TEAL to bytecode
    const [approvalProgram, clearProgram] = await Promise.all([
      compileTeal(approvalTeal),
      compileTeal(clearTeal)
    ]);

    // Get suggested params
    const suggestedParams = await getTransactionParams();

    // Create application create transaction
    const txn = algosdk.makeApplicationCreateTxnFromObject({
      sender: creatorAddress,
      suggestedParams,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram,
      clearProgram,
      numGlobalByteSlices: 2,  // ip_id, creator
      numGlobalInts: 5,        // total_supply, asset_id, finalized, stk_count, platform_claimed
      numLocalByteSlices: 0,
      numLocalInts: 0,
      extraPages: 1            // For larger contract with boxes
    });

    // Encode transaction for signing
    const txnBytes = algosdk.encodeUnsignedTransaction(txn);
    const txnBase64 = Buffer.from(txnBytes).toString('base64');

    return NextResponse.json({
      success: true,
      transaction: txnBase64,
      txnId: txn.txID(),
      message: 'Sign this transaction with your wallet to deploy the IP Vault contract'
    });

  } catch (error) {
    console.error('Error creating deployment transaction:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create deployment transaction'
    }, { status: 500 });
  }
}

/**
 * POST /api/vault/deploy
 * Submit signed deployment transaction and get app ID
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { signedTxn, creatorAddress } = body;

    if (!signedTxn) {
      return NextResponse.json({ error: 'signedTxn is required' }, { status: 400 });
    }

    // Decode signed transaction
    const signedTxnBytes = new Uint8Array(Buffer.from(signedTxn, 'base64'));

    // Submit transaction
    const algodClient = getAlgodClient();
    const { txid } = await algodClient.sendRawTransaction(signedTxnBytes).do();
    
    console.log('Deployment transaction submitted:', txid);

    // Wait for confirmation
    const confirmedTxn = await waitForConfirmation(txid, 10);
    
    // Get application ID from confirmed transaction
    const appId = confirmedTxn['application-index'];

    if (!appId) {
      throw new Error('Application ID not found in confirmed transaction');
    }

    console.log('Vault contract deployed! App ID:', appId);

    // Get the application address (for receiving tokens)
    const appAddress = algosdk.getApplicationAddress(appId);

    return NextResponse.json({
      success: true,
      txId: txid,
      appId: Number(appId),
      appAddress,
      message: `IP Vault contract deployed successfully! App ID: ${appId}`
    });

  } catch (error) {
    console.error('Error deploying contract:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to deploy contract'
    }, { status: 500 });
  }
}
