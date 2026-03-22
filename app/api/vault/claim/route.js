import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { getAlgodClient } from '@/lib/algorand';
import { SECURE_METAWORK_ADDRESS } from '@/lib/vault-contract';
import algosdk from 'algosdk';

// GET - Get claim status for a stakeholder
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const vaultId = searchParams.get('vaultId');
    const address = searchParams.get('address');
    
    if (!vaultId || !address) {
      return NextResponse.json(
        { error: 'vaultId and address are required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    const vault = await db.collection('vaults').findOne({ id: vaultId });
    
    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }
    
    // Find stakeholder
    const stakeholder = vault.stakeholders.find(
      s => s.address.toLowerCase() === address.toLowerCase()
    );
    
    if (!stakeholder) {
      return NextResponse.json({
        isStakeholder: false,
        message: 'This address is not a stakeholder in this vault'
      });
    }
    
    const remaining = stakeholder.tokenAmount - stakeholder.claimed;
    
    return NextResponse.json({
      isStakeholder: true,
      isPlatform: stakeholder.isPlatform || false,
      address: stakeholder.address,
      allocationType: stakeholder.allocationType,
      allocationValue: stakeholder.allocationValue,
      tokenAmount: stakeholder.tokenAmount,
      percentage: stakeholder.percentage,
      claimed: stakeholder.claimed,
      remaining,
      canClaim: vault.finalized && remaining > 0,
      vaultFinalized: vault.finalized,
      totalSupply: vault.totalSupply,
      assetId: vault.assetId
    });
    
  } catch (error) {
    console.error('Get claim status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get claim status' },
      { status: 500 }
    );
  }
}

// POST - Record a claim (after on-chain transaction)
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
    const { vaultId, claimerAddress, amount, txId } = body;
    
    if (!vaultId || !claimerAddress || !amount) {
      return NextResponse.json(
        { error: 'vaultId, claimerAddress, and amount are required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    const vault = await db.collection('vaults').findOne({ id: vaultId });
    
    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }
    
    if (!vault.finalized) {
      return NextResponse.json(
        { error: 'Vault must be finalized before claims can be made' },
        { status: 400 }
      );
    }
    
    // Find stakeholder
    const stakeholderIndex = vault.stakeholders.findIndex(
      s => s.address.toLowerCase() === claimerAddress.toLowerCase()
    );
    
    if (stakeholderIndex === -1) {
      return NextResponse.json(
        { error: 'Address is not a stakeholder in this vault' },
        { status: 400 }
      );
    }
    
    const stakeholder = vault.stakeholders[stakeholderIndex];
    const remaining = stakeholder.tokenAmount - stakeholder.claimed;
    
    if (amount > remaining) {
      return NextResponse.json(
        { error: `Cannot claim ${amount} tokens. Only ${remaining} remaining.` },
        { status: 400 }
      );
    }
    
    // Update claimed amount
    const updatePath = `stakeholders.${stakeholderIndex}.claimed`;
    
    await db.collection('vaults').updateOne(
      { id: vaultId },
      {
        $set: {
          [updatePath]: stakeholder.claimed + amount,
          updatedAt: new Date()
        }
      }
    );
    
    // Record claim in history
    await db.collection('vault_claims').insertOne({
      vaultId,
      ipAssetId: vault.ipAssetId,
      claimerAddress,
      amount,
      txId,
      isPlatform: stakeholder.isPlatform || false,
      timestamp: new Date()
    });
    
    const updatedVault = await db.collection('vaults').findOne({ id: vaultId });
    const updatedStakeholder = updatedVault.stakeholders[stakeholderIndex];
    
    return NextResponse.json({
      success: true,
      claimed: amount,
      totalClaimed: updatedStakeholder.claimed,
      remaining: updatedStakeholder.tokenAmount - updatedStakeholder.claimed,
      txId
    });
    
  } catch (error) {
    console.error('Record claim error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record claim' },
      { status: 500 }
    );
  }
}
