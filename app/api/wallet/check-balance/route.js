import { NextResponse } from 'next/server';
import { getAlgodClient } from '@/lib/algorand';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/wallet/check-balance
 * Check if wallet has enough balance for minting operations
 * 
 * Query params:
 * - address: wallet address to check
 * - operation: type of operation ('mint', 'opt-in', 'transfer')
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const operation = searchParams.get('operation') || 'mint';
    
    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }
    
    const algodClient = getAlgodClient();
    
    // Debug: Log which endpoint we're using
    console.log('=== Balance Check Debug ===');
    console.log('Address:', address);
    console.log('Algod URL:', process.env.ALGORAND_TESTNET_RPC || 'https://testnet-api.algonode.cloud');
    
    // Get account information
    let accountInfo;
    try {
      accountInfo = await algodClient.accountInformation(address).do();
      console.log('Raw account info amount:', accountInfo.amount);
      console.log('Raw account info min-balance:', accountInfo['min-balance']);
    } catch (error) {
      console.log('Account fetch error:', error.message);
      // Account doesn't exist (never funded)
      return NextResponse.json({
        success: true,
        hasBalance: false,
        balance: 0,
        balanceFormatted: '0.000000',
        minBalance: 0,
        minBalanceFormatted: '0.000000',
        available: 0,
        availableFormatted: '0.000000',
        requiredForOperation: getRequiredBalance(operation),
        requiredFormatted: (getRequiredBalance(operation) / 1000000).toFixed(6),
        isEnough: false,
        shortfall: getRequiredBalance(operation),
        shortfallFormatted: (getRequiredBalance(operation) / 1000000).toFixed(6),
        message: 'Wallet has never been funded. Please add ALGO to your wallet.',
        recommendation: getRecommendation(operation, 0)
      });
    }
    
    // Convert BigInt values to numbers (Algorand SDK may return BigInt)
    const balance = Number(accountInfo.amount || 0);
    const minBalance = Number(accountInfo['min-balance'] || 100000); // 0.1 ALGO default
    const available = Math.max(0, balance - minBalance);
    
    console.log('Converted balance:', balance);
    console.log('Converted minBalance:', minBalance);
    console.log('Calculated available:', available);
    
    // Calculate required balance based on operation
    const requiredForOperation = getRequiredBalance(operation);
    const isEnough = available >= requiredForOperation;
    const shortfall = Math.max(0, requiredForOperation - available);
    
    return NextResponse.json({
      success: true,
      hasBalance: balance > 0,
      balance,
      balanceFormatted: (balance / 1000000).toFixed(6),
      minBalance,
      minBalanceFormatted: (minBalance / 1000000).toFixed(6),
      available,
      availableFormatted: (available / 1000000).toFixed(6),
      requiredForOperation,
      requiredFormatted: (requiredForOperation / 1000000).toFixed(6),
      isEnough,
      shortfall,
      shortfallFormatted: (shortfall / 1000000).toFixed(6),
      message: isEnough 
        ? 'Wallet has sufficient balance for this operation.'
        : `Insufficient balance. You need ${(shortfall / 1000000).toFixed(4)} more ALGO.`,
      recommendation: isEnough ? null : getRecommendation(operation, shortfall)
    });
    
  } catch (error) {
    console.error('Balance check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check balance' },
      { status: 500 }
    );
  }
}

/**
 * Get required balance for different operations (in microAlgos)
 */
function getRequiredBalance(operation) {
  switch (operation) {
    case 'mint':
      // Minting requires:
      // - Pool deploy transaction fee (~0.002 ALGO)
      // - Pool funding (~0.5 ALGO for min balance)
      // - Init + create tokens + stakeholder txns (~0.01 ALGO in fees)
      // - NFT creation fee (~0.002 ALGO)
      // - Buffer for safety
      return 800000; // 0.8 ALGO recommended
      
    case 'opt-in':
      // Opt-in requires:
      // - Transaction fee (0.001 ALGO)
      // - Min balance increase for asset (0.1 ALGO)
      return 150000; // 0.15 ALGO recommended
      
    case 'transfer':
      // Asset transfer requires:
      // - Transaction fee (0.001 ALGO)
      return 5000; // 0.005 ALGO
      
    case 'claim':
      // Claim from pool requires:
      // - Transaction fee (~0.002 ALGO for app call)
      return 10000; // 0.01 ALGO
      
    default:
      return 100000; // 0.1 ALGO default
  }
}

/**
 * Get actionable recommendation based on operation and shortfall
 */
function getRecommendation(operation, shortfall) {
  const shortfallAlgo = (shortfall / 1000000).toFixed(4);
  
  const baseRecommendation = {
    action: 'Add ALGO to your wallet',
    steps: [
      'Open Pera Wallet on your mobile device',
      'Go to "Receive" to see your wallet address',
      'Purchase ALGO from an exchange (Coinbase, Binance, etc.)',
      'Send ALGO to your Pera Wallet address',
      'For Algorand Testnet, use the Algorand Testnet Dispenser to get free test ALGO'
    ],
    testnetFaucet: 'https://bank.testnet.algorand.network/',
    minimumRecommended: '1.0 ALGO for minting operations'
  };
  
  switch (operation) {
    case 'mint':
      return {
        ...baseRecommendation,
        message: `You need at least ${shortfallAlgo} more ALGO to mint your IP. We recommend having at least 1 ALGO in your wallet.`,
        operationCost: 'Minting costs approximately 0.5-0.8 ALGO (pool funding + transaction fees)'
      };
      
    case 'opt-in':
      return {
        ...baseRecommendation,
        message: `You need at least ${shortfallAlgo} more ALGO to opt-in to this asset. The opt-in increases your minimum balance.`,
        operationCost: 'Opt-in costs approximately 0.1 ALGO (min balance) + 0.001 ALGO (fee)'
      };
      
    default:
      return {
        ...baseRecommendation,
        message: `You need at least ${shortfallAlgo} more ALGO for this operation.`
      };
  }
}
