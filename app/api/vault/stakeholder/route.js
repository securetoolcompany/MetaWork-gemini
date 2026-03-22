import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SECURE_METAWORK_ADDRESS, calculatePlatformAllocation } from '@/lib/vault-contract';

// GET - Get all vaults where an address is a stakeholder
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (!address) {
      return NextResponse.json(
        { error: 'address is required' },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Find all vaults where this address is a stakeholder
    const vaults = await db.collection('vaults').find({
      'stakeholders.address': { $regex: new RegExp(`^${address}$`, 'i') }
    }).toArray();
    
    // Build response with stakeholder details for each vault
    const stakeholderVaults = vaults.map(vault => {
      const stakeholder = vault.stakeholders.find(
        s => s.address.toLowerCase() === address.toLowerCase()
      );
      
      const remaining = stakeholder.tokenAmount - stakeholder.claimed;
      
      return {
        vaultId: vault.id,
        ipAssetId: vault.ipAssetId,
        ipAssetName: vault.ipAssetName,
        totalSupply: vault.totalSupply,
        assetId: vault.assetId,
        finalized: vault.finalized,
        stakeholder: {
          address: stakeholder.address,
          isPlatform: stakeholder.isPlatform || false,
          allocationType: stakeholder.allocationType,
          allocationValue: stakeholder.allocationValue,
          tokenAmount: stakeholder.tokenAmount,
          percentage: stakeholder.percentage,
          claimed: stakeholder.claimed,
          remaining,
          canClaim: vault.finalized && remaining > 0
        }
      };
    });
    
    // Summary stats
    const totalAllocated = stakeholderVaults.reduce(
      (sum, v) => sum + v.stakeholder.tokenAmount, 0
    );
    const totalClaimed = stakeholderVaults.reduce(
      (sum, v) => sum + v.stakeholder.claimed, 0
    );
    const totalRemaining = totalAllocated - totalClaimed;
    
    return NextResponse.json({
      address,
      isPlatformAddress: address.toLowerCase() === SECURE_METAWORK_ADDRESS.toLowerCase(),
      vaultCount: stakeholderVaults.length,
      vaults: stakeholderVaults,
      summary: {
        totalAllocated,
        totalClaimed,
        totalRemaining
      }
    });
    
  } catch (error) {
    console.error('Get stakeholder vaults error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get stakeholder vaults' },
      { status: 500 }
    );
  }
}
