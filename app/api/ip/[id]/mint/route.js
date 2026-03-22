import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { createIPMintingTransactionGroup } from '@/lib/algorand-tokens';
import crypto from 'crypto';

// Create minting transactions for an existing unminted IP
export async function POST(request, { params }) {
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
    
    const { id } = params;
    const { db } = await connectToDatabase();
    
    // Get the IP asset
    const ipAsset = await db.collection('ip_assets').findOne({
      id,
      ownerId: decoded.userId
    });
    
    if (!ipAsset) {
      return NextResponse.json({ error: 'IP asset not found' }, { status: 404 });
    }
    
    // Check if already minted
    if (ipAsset.status === 'minted' || ipAsset.nftAssetId) {
      return NextResponse.json({ error: 'IP is already minted' }, { status: 400 });
    }
    
    // Get user's wallet address
    const user = await db.collection('users').findOne({ id: decoded.userId });
    
    if (!user?.walletAddress) {
      return NextResponse.json(
        { error: 'Please connect your wallet first' },
        { status: 400 }
      );
    }
    
    console.log('Creating minting transactions for existing IP:', {
      ipId: id,
      name: ipAsset.name,
      wallet: user.walletAddress,
      systemCategory: ipAsset.systemCategory || ipAsset.category,
      userTags: ipAsset.userTags || ipAsset.tags
    });

    // Prepare metadata with category and tags
    const metadata = {
      name: ipAsset.name,
      description: ipAsset.description || '',
      systemCategory: ipAsset.systemCategory || ipAsset.category || 'uncategorized',
      userTags: ipAsset.userTags || ipAsset.tags || [],
      image: ipAsset.imageUrl,
      properties: {
        category: ipAsset.systemCategory || ipAsset.category || 'uncategorized',
        tags: (ipAsset.userTags || ipAsset.tags || []).join(','),
        licensingFee: ipAsset.licensingFee || ipAsset.licenseFeeUsd || 0,
        sourceType: ipAsset.sourceType || 'upload'
      }
    };

    // Create the atomic transaction group (NFT + Revenue Tokens)
    const unitName = ipAsset.name.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const { txnBytesBase64, nftTxnIndex, revTokenTxnIndex } =
      await createIPMintingTransactionGroup(
        user.walletAddress,
        {
          name: ipAsset.name,
          unitName: unitName || 'IPNFT',
          metadataUrl: ipAsset.metadataUrl,
          metadataHash: ipAsset.metadataHash,
          ipAssetId: id,
          // NEW: embed structured metadata for downstream use
          metadata
        }
      );
    
    console.log('Created minting transaction group with', txnBytesBase64.length, 'transactions');
    
    // Update owner wallet if different
    if (ipAsset.ownerWallet !== user.walletAddress) {
      await db.collection('ip_assets').updateOne(
        { id },
        { $set: { ownerWallet: user.walletAddress, updatedAt: new Date() } }
      );
    }
    
    return NextResponse.json({
      success: true,
      ipAsset,
      minting: {
        transactions: txnBytesBase64,
        nftTxnIndex,
        revTokenTxnIndex,
        message: 'Sign these transactions in Pera Wallet to mint your IP NFT and Revenue Tokens'
      }
    });
  } catch (error) {
    console.error('Mint IP error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to prepare minting transactions' },
      { status: 500 }
    );
  }
}
