/**
 * IP Vault Contract Client Library
 * 
 * This module provides JavaScript/TypeScript functions to interact with
 * the IP Vault smart contract on Algorand.
 */

import algosdk from 'algosdk';
import { getAlgodClient, getTransactionParams } from './algorand';

// SECURE MetaWork platform address - must match contract
export const SECURE_METAWORK_ADDRESS = 'WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI';

// Platform allocation: 20% = 2000 basis points
export const PLATFORM_ALLOCATION_BPS = 2000;
export const BPS_DENOMINATOR = 10000;

// Allocation types
export const ALLOCATION_TYPE_FIXED = 1;
export const ALLOCATION_TYPE_PERCENTAGE = 2;

// Box key prefixes
const STAKEHOLDER_PREFIX = 'stk_';
const PROPOSED_PREFIX = 'prop_';

/**
 * Calculate platform's 20% allocation
 */
export function calculatePlatformAllocation(totalSupply) {
  return Math.floor((totalSupply * PLATFORM_ALLOCATION_BPS) / BPS_DENOMINATOR);
}

/**
 * Convert percentage (in basis points) to token amount
 */
export function percentageToTokens(percentageBps, totalSupply) {
  return Math.floor((totalSupply * percentageBps) / BPS_DENOMINATOR);
}

/**
 * Convert percentage (0-100) to basis points (0-10000)
 */
export function percentageToBps(percentage) {
  return Math.floor(percentage * 100);
}

/**
 * Validate stakeholder allocations
 * @param {Array} stakeholders - Array of {address, allocationType, allocationValue}
 * @param {number} totalSupply - Total token supply
 * @returns {{valid: boolean, error?: string, totalAllocated: number, unallocated: number}}
 */
export function validateAllocations(stakeholders, totalSupply) {
  const platformAllocation = calculatePlatformAllocation(totalSupply);
  const maxOtherAllocation = totalSupply - platformAllocation;
  
  let totalOtherAllocation = 0;
  const addresses = new Set();
  
  for (const stk of stakeholders) {
    // Check for duplicates
    if (addresses.has(stk.address)) {
      return {
        valid: false,
        error: `Duplicate address: ${stk.address}`,
        totalAllocated: 0,
        unallocated: 0
      };
    }
    addresses.add(stk.address);
    
    // Check for platform address (not allowed in stakeholder list)
    if (stk.address === SECURE_METAWORK_ADDRESS) {
      return {
        valid: false,
        error: 'SECURE MetaWork address cannot be manually added as stakeholder (it\'s automatic)',
        totalAllocated: 0,
        unallocated: 0
      };
    }
    
    // Calculate allocation
    let allocation;
    if (stk.allocationType === ALLOCATION_TYPE_FIXED) {
      allocation = stk.allocationValue;
    } else if (stk.allocationType === ALLOCATION_TYPE_PERCENTAGE) {
      allocation = percentageToTokens(stk.allocationValue, totalSupply);
    } else {
      return {
        valid: false,
        error: `Invalid allocation type for ${stk.address}`,
        totalAllocated: 0,
        unallocated: 0
      };
    }
    
    totalOtherAllocation += allocation;
  }
  
  if (totalOtherAllocation > maxOtherAllocation) {
    return {
      valid: false,
      error: `Total allocations (${totalOtherAllocation}) exceed maximum allowed (${maxOtherAllocation}, which is 80% of ${totalSupply})`,
      totalAllocated: totalOtherAllocation + platformAllocation,
      unallocated: 0
    };
  }
  
  return {
    valid: true,
    totalAllocated: totalOtherAllocation + platformAllocation,
    unallocated: totalSupply - (totalOtherAllocation + platformAllocation),
    platformAllocation,
    otherAllocations: totalOtherAllocation
  };
}

/**
 * Create a vault deployment transaction
 * @param {string} creatorAddress - Address of the vault creator
 * @returns {Promise<{txn: Transaction, txnBytesBase64: string}>}
 */
export async function createVaultDeploymentTransaction(creatorAddress) {
  const algodClient = getAlgodClient();
  const suggestedParams = await getTransactionParams();
  
  // Approval and clear TEAL programs (compiled)
  // These would normally be loaded from compiled files
  // For now, we'll use a placeholder - actual deployment requires compiled TEAL
  
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: creatorAddress,
    suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: new Uint8Array(), // Placeholder - needs compiled TEAL
    clearProgram: new Uint8Array(),    // Placeholder - needs compiled TEAL
    numGlobalByteSlices: 2,  // ip_id, creator
    numGlobalInts: 5,        // total_supply, asset_id, finalized, stk_count, platform_claimed
    numLocalByteSlices: 0,
    numLocalInts: 0,
    extraPages: 1            // For larger contract
  });
  
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  return {
    txn,
    txnBytesBase64: Buffer.from(txnBytes).toString('base64')
  };
}

/**
 * Create propose splits transaction
 * @param {string} creatorAddress - Vault creator address
 * @param {number} appId - Application ID of the vault
 * @param {string} ipId - IP identifier
 * @param {number} totalSupply - Total token supply
 * @param {number} assetId - ASA ID of ownership token
 * @param {Array} stakeholders - Array of {address, allocationType, allocationValue}
 * @returns {Promise<{txn: Transaction, txnBytesBase64: string}>}
 */
export async function createProposeSplitsTransaction(
  creatorAddress,
  appId,
  ipId,
  totalSupply,
  assetId,
  stakeholders
) {
  const suggestedParams = await getTransactionParams();
  
  // Validate allocations first
  const validation = validateAllocations(stakeholders, totalSupply);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  // Build application args
  const appArgs = [
    new Uint8Array(Buffer.from('propose')),
    new Uint8Array(Buffer.from(ipId)),
    algosdk.encodeUint64(totalSupply),
    algosdk.encodeUint64(assetId)
  ];
  
  // Add stakeholder entries
  // Each entry: address(32) + alloc_type(8) + alloc_value(8) = 48 bytes
  for (const stk of stakeholders) {
    const addressBytes = algosdk.decodeAddress(stk.address).publicKey;
    const typeBytes = algosdk.encodeUint64(stk.allocationType);
    const valueBytes = algosdk.encodeUint64(stk.allocationValue);
    
    const entry = new Uint8Array(48);
    entry.set(addressBytes, 0);
    entry.set(typeBytes, 32);
    entry.set(valueBytes, 40);
    
    appArgs.push(entry);
  }
  
  // Box references for each stakeholder
  const boxes = stakeholders.map(stk => ({
    appIndex: appId,
    name: new Uint8Array(Buffer.from(PROPOSED_PREFIX + stk.address))
  }));
  
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: creatorAddress,
    suggestedParams,
    appIndex: appId,
    appArgs,
    boxes
  });
  
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  return {
    txn,
    txnBytesBase64: Buffer.from(txnBytes).toString('base64'),
    validation
  };
}

/**
 * Create finalize splits transaction
 * @param {string} creatorAddress - Vault creator address
 * @param {number} appId - Application ID of the vault
 * @returns {Promise<{txn: Transaction, txnBytesBase64: string}>}
 */
export async function createFinalizeSplitsTransaction(creatorAddress, appId) {
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: creatorAddress,
    suggestedParams,
    appIndex: appId,
    appArgs: [
      new Uint8Array(Buffer.from('finalize'))
    ]
  });
  
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  return {
    txn,
    txnBytesBase64: Buffer.from(txnBytes).toString('base64')
  };
}

/**
 * Create claim transaction
 * @param {string} claimerAddress - Address claiming tokens
 * @param {number} appId - Application ID of the vault
 * @param {number} assetId - ASA ID of ownership token
 * @param {number} amount - Amount to claim
 * @returns {Promise<{txn: Transaction, txnBytesBase64: string}>}
 */
export async function createClaimTransaction(claimerAddress, appId, assetId, amount) {
  const suggestedParams = await getTransactionParams();
  
  // Box reference for the claimer (if not platform)
  const boxes = [];
  if (claimerAddress !== SECURE_METAWORK_ADDRESS) {
    boxes.push({
      appIndex: appId,
      name: new Uint8Array(Buffer.from(PROPOSED_PREFIX + claimerAddress))
    });
  }
  
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: claimerAddress,
    suggestedParams,
    appIndex: appId,
    appArgs: [
      new Uint8Array(Buffer.from('claim')),
      algosdk.encodeUint64(amount)
    ],
    foreignAssets: [assetId],
    boxes
  });
  
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  return {
    txn,
    txnBytesBase64: Buffer.from(txnBytes).toString('base64')
  };
}

/**
 * Create vault opt-in transaction (for receiving tokens)
 * @param {string} creatorAddress - Vault creator address
 * @param {number} appId - Application ID of the vault
 * @param {number} assetId - ASA ID to opt into
 * @returns {Promise<{txn: Transaction, txnBytesBase64: string}>}
 */
export async function createVaultOptInTransaction(creatorAddress, appId, assetId) {
  const suggestedParams = await getTransactionParams();
  
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: creatorAddress,
    suggestedParams,
    appIndex: appId,
    appArgs: [
      new Uint8Array(Buffer.from('opt_in')),
      algosdk.encodeUint64(assetId)
    ],
    foreignAssets: [assetId]
  });
  
  const txnBytes = algosdk.encodeUnsignedTransaction(txn);
  return {
    txn,
    txnBytesBase64: Buffer.from(txnBytes).toString('base64')
  };
}

/**
 * Read vault global state
 * @param {number} appId - Application ID
 * @returns {Promise<Object>}
 */
export async function readVaultState(appId) {
  const algodClient = getAlgodClient();
  
  try {
    const appInfo = await algodClient.getApplicationByID(appId).do();
    const globalState = appInfo.params['global-state'] || [];
    
    const state = {};
    for (const item of globalState) {
      const key = Buffer.from(item.key, 'base64').toString();
      const value = item.value;
      
      if (value.type === 1) {
        // Bytes
        state[key] = Buffer.from(value.bytes, 'base64').toString();
      } else {
        // Uint
        state[key] = value.uint;
      }
    }
    
    return {
      ipId: state.ip_id || '',
      totalSupply: state.total_supply || 0,
      assetId: state.asset_id || 0,
      finalized: state.finalized === 1,
      creator: state.creator || '',
      stakeholderCount: state.stk_count || 0,
      platformClaimed: state.platform_claimed || 0,
      platformAllocation: calculatePlatformAllocation(state.total_supply || 0),
      platformRemaining: calculatePlatformAllocation(state.total_supply || 0) - (state.platform_claimed || 0)
    };
  } catch (error) {
    console.error('Error reading vault state:', error);
    throw error;
  }
}

/**
 * Read stakeholder allocation from box
 * @param {number} appId - Application ID
 * @param {string} address - Stakeholder address
 * @returns {Promise<Object|null>}
 */
export async function readStakeholderAllocation(appId, address) {
  const algodClient = getAlgodClient();
  
  try {
    const boxName = new Uint8Array(Buffer.from(PROPOSED_PREFIX + address));
    const boxResponse = await algodClient.getApplicationBoxByName(appId, boxName).do();
    
    if (!boxResponse || !boxResponse.value) {
      return null;
    }
    
    const data = boxResponse.value;
    
    // Parse box data: type(8) + value(8) + claimed(8) = 24 bytes
    const allocationType = algosdk.decodeUint64(data.slice(0, 8), 'safe');
    const allocationValue = algosdk.decodeUint64(data.slice(8, 16), 'safe');
    const claimedAmount = algosdk.decodeUint64(data.slice(16, 24), 'safe');
    
    return {
      address,
      allocationType: Number(allocationType),
      allocationValue: Number(allocationValue),
      claimedAmount: Number(claimedAmount)
    };
  } catch (error) {
    // Box doesn't exist
    if (error.message?.includes('box not found')) {
      return null;
    }
    console.error('Error reading stakeholder allocation:', error);
    throw error;
  }
}

/**
 * Get stakeholder's entitlement details
 * @param {number} appId - Application ID
 * @param {string} address - Stakeholder address
 * @returns {Promise<Object>}
 */
export async function getStakeholderEntitlement(appId, address) {
  // Check if this is the platform address
  if (address === SECURE_METAWORK_ADDRESS) {
    const vaultState = await readVaultState(appId);
    const entitlement = calculatePlatformAllocation(vaultState.totalSupply);
    
    return {
      address,
      isPlatform: true,
      allocationType: ALLOCATION_TYPE_FIXED,
      allocationValue: entitlement,
      allocationPercentage: 20,
      totalEntitlement: entitlement,
      claimedAmount: vaultState.platformClaimed,
      remainingAmount: entitlement - vaultState.platformClaimed,
      isFinalized: vaultState.finalized
    };
  }
  
  // Regular stakeholder
  const [vaultState, allocation] = await Promise.all([
    readVaultState(appId),
    readStakeholderAllocation(appId, address)
  ]);
  
  if (!allocation) {
    return {
      address,
      isPlatform: false,
      isStakeholder: false,
      totalEntitlement: 0,
      claimedAmount: 0,
      remainingAmount: 0,
      isFinalized: vaultState.finalized
    };
  }
  
  let totalEntitlement;
  let allocationPercentage;
  
  if (allocation.allocationType === ALLOCATION_TYPE_FIXED) {
    totalEntitlement = allocation.allocationValue;
    allocationPercentage = (allocation.allocationValue / vaultState.totalSupply) * 100;
  } else {
    totalEntitlement = percentageToTokens(allocation.allocationValue, vaultState.totalSupply);
    allocationPercentage = allocation.allocationValue / 100; // BPS to percentage
  }
  
  return {
    address,
    isPlatform: false,
    isStakeholder: true,
    allocationType: allocation.allocationType,
    allocationValue: allocation.allocationValue,
    allocationPercentage,
    totalEntitlement,
    claimedAmount: allocation.claimedAmount,
    remainingAmount: totalEntitlement - allocation.claimedAmount,
    isFinalized: vaultState.finalized
  };
}
