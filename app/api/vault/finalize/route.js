import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';

// POST - Finalize vault configuration
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
    const { vaultId, appId, finalizeTxId } = body;
    
    if (!vaultId) {
      return NextResponse.json(
        { error: 'vaultId is required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    const vault = await db.collection('vaults').findOne({
      id: vaultId,
      creatorId: decoded.userId
    });
    
    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }
    
    if (vault.finalized) {
      return NextResponse.json(
        { error: 'Vault is already finalized' },
        { status: 400 }
      );
    }
    
    // Validate that we have at least the platform stakeholder
    if (!vault.stakeholders || vault.stakeholders.length === 0) {
      return NextResponse.json(
        { error: 'No stakeholders configured' },
        { status: 400 }
      );
    }
    
    // Verify platform is included
    const hasPlatform = vault.stakeholders.some(s => s.isPlatform);
    if (!hasPlatform) {
      return NextResponse.json(
        { error: 'Platform stakeholder is missing' },
        { status: 400 }
      );
    }
    
    // Update vault to finalized
    await db.collection('vaults').updateOne(
      { id: vaultId },
      {
        $set: {
          finalized: true,
          appId: appId || null,
          finalizeTxId: finalizeTxId || null,
          finalizedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    // Also update the IP asset to reference this vault
    await db.collection('ip_assets').updateOne(
      { id: vault.ipAssetId },
      {
        $set: {
          vaultId: vaultId,
          vaultFinalized: true,
          updatedAt: new Date()
        }
      }
    );
    
    const updatedVault = await db.collection('vaults').findOne({ id: vaultId });
    
    return NextResponse.json({
      success: true,
      vault: updatedVault,
      message: 'Vault finalized! Stakeholder allocations are now locked and immutable.'
    });
    
  } catch (error) {
    console.error('Finalize vault error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to finalize vault' },
      { status: 500 }
    );
  }
}
