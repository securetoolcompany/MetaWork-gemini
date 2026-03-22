import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import {
  SECURE_METAWORK_ADDRESS,
  validateAllocations,
  calculatePlatformAllocation,
  ALLOCATION_TYPE_FIXED,
  ALLOCATION_TYPE_PERCENTAGE,
  percentageToTokens
} from '@/lib/vault-contract';
import { getVaultEscrowAddress } from '@/lib/algorand-tokens';

// GET - List revenue pools or get specific revenue pool
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const token = authHeader?.substring(7) || cookieToken;
    
    const { searchParams } = new URL(request.url);
    const ipAssetId = searchParams.get('ipAssetId');
    
    const { db } = await connectToDatabase();
    
    // Handle ipAssetId lookup (for revenue pools)
    if (ipAssetId) {
      // Get revenue pool by IP asset ID
      const revenuePool = await db.collection('revenue_pools').findOne({ 
        ipAssetId: ipAssetId 
      });
      
      if (!revenuePool) {
        // Return empty data instead of 404 to prevent page errors
        return NextResponse.json({ 
          revenuePool: {
            claimableAmount: 0,
            accumulatedRevenue: 0,
            totalDeposited: 0,
            totalClaimed: 0,
            appId: null
          }
        }, { status: 200 });
      }
      
      const platformAllocation = calculatePlatformAllocation(revenuePool.totalSupply || 1000);
      
      return NextResponse.json({
        revenuePool: {
          ...revenuePool,
          id: revenuePool._id?.toString()
        },
        platformAllocation,
        platformAddress: SECURE_METAWORK_ADDRESS
      });
    }
    
    // List user's revenue pools (requires auth)
    if (!token) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Get all IP assets for this user, then their revenue pools
    const ipAssets = await db.collection('ip_assets')
      .find({ ownerId: decoded.userId })
      .toArray();
    
    const ipAssetIds = ipAssets.map(ip => ip.id);
    
    const revenuePools = await db.collection('revenue_pools')
      .find({ ipAssetId: { $in: ipAssetIds } })
      .sort({ createdAt: -1 })
      .toArray();
    
    return NextResponse.json({ revenuePools });
    
  } catch (error) {
    console.error('Get vault error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get revenue pool' },
      { status: 500 }
    );
  }
}



// POST - Create a new vault configuration (propose phase)
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
    const {
      ipAssetId,
      totalSupply,
      assetId,
      stakeholders // Array of {address, allocationType, allocationValue}
    } = body;
    
    if (!ipAssetId || !totalSupply || !assetId) {
      return NextResponse.json(
        { error: 'ipAssetId, totalSupply, and assetId are required' },
        { status: 400 }
      );
    }
    
    // Validate allocations
    const validation = validateAllocations(stakeholders || [], totalSupply);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Check if vault already exists for this IP
    const existingVault = await db.collection('vaults').findOne({ ipAssetId });
    if (existingVault && existingVault.finalized) {
      return NextResponse.json(
        { error: 'A finalized vault already exists for this IP' },
        { status: 400 }
      );
    }
    
    // Get IP asset info
    const ipAsset = await db.collection('ip_assets').findOne({ id: ipAssetId });
    if (!ipAsset) {
      return NextResponse.json(
        { error: 'IP asset not found' },
        { status: 404 }
      );
    }
    
    // Calculate platform allocation
    const platformAllocation = calculatePlatformAllocation(totalSupply);
    
    // Build stakeholder list with calculated values
    const stakeholderEntries = (stakeholders || []).map(stk => {
      let tokenAmount;
      if (stk.allocationType === ALLOCATION_TYPE_FIXED) {
        tokenAmount = stk.allocationValue;
      } else {
        tokenAmount = percentageToTokens(stk.allocationValue, totalSupply);
      }
      
      return {
        address: stk.address,
        allocationType: stk.allocationType,
        allocationValue: stk.allocationValue,
        tokenAmount,
        percentage: (tokenAmount / totalSupply) * 100,
        claimed: 0
      };
    });
    
    // Add SECURE MetaWork as automatic stakeholder
    const platformEntry = {
      address: SECURE_METAWORK_ADDRESS,
      allocationType: ALLOCATION_TYPE_FIXED,
      allocationValue: platformAllocation,
      tokenAmount: platformAllocation,
      percentage: 20,
      claimed: 0,
      isPlatform: true
    };
    
    const vaultId = existingVault?.id || uuidv4();
    
    const vaultData = {
      id: vaultId,
      ipAssetId,
      ipAssetName: ipAsset.name,
      totalSupply,
      assetId,
      creatorId: decoded.userId,
      creatorWallet: ipAsset.ownerWallet,
      finalized: false,
      stakeholders: [platformEntry, ...stakeholderEntries],
      platformAllocation,
      otherAllocations: validation.otherAllocations,
      unallocated: validation.unallocated,
      appId: null, // Set when contract is deployed
      proposedAt: new Date(),
      finalizedAt: null,
      createdAt: existingVault?.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    if (existingVault) {
      await db.collection('vaults').updateOne(
        { id: vaultId },
        { $set: vaultData }
      );
    } else {
      await db.collection('vaults').insertOne(vaultData);
    }
    
    return NextResponse.json({
      success: true,
      vault: vaultData,
      validation,
      message: 'Vault configuration proposed. Review and finalize to lock the splits.'
    });
    
  } catch (error) {
    console.error('Create vault error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create vault' },
      { status: 500 }
    );
  }
}

// PUT - Update vault (only before finalization)
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
    const { vaultId, stakeholders } = body;
    
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
        { error: 'Cannot modify a finalized vault' },
        { status: 400 }
      );
    }
    
    // Validate new allocations
    const validation = validateAllocations(stakeholders || [], vault.totalSupply);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    
    // Rebuild stakeholder list
    const stakeholderEntries = (stakeholders || []).map(stk => {
      let tokenAmount;
      if (stk.allocationType === ALLOCATION_TYPE_FIXED) {
        tokenAmount = stk.allocationValue;
      } else {
        tokenAmount = percentageToTokens(stk.allocationValue, vault.totalSupply);
      }
      
      return {
        address: stk.address,
        allocationType: stk.allocationType,
        allocationValue: stk.allocationValue,
        tokenAmount,
        percentage: (tokenAmount / vault.totalSupply) * 100,
        claimed: 0
      };
    });
    
    // Platform entry stays the same
    const platformEntry = vault.stakeholders.find(s => s.isPlatform);
    
    await db.collection('vaults').updateOne(
      { id: vaultId },
      {
        $set: {
          stakeholders: [platformEntry, ...stakeholderEntries],
          otherAllocations: validation.otherAllocations,
          unallocated: validation.unallocated,
          proposedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    const updatedVault = await db.collection('vaults').findOne({ id: vaultId });
    
    return NextResponse.json({
      success: true,
      vault: updatedVault,
      validation
    });
    
  } catch (error) {
    console.error('Update vault error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update vault' },
      { status: 500 }
    );
  }
}
