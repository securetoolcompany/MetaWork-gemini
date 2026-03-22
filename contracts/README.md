# IP Vault Smart Contract Documentation

## Overview

The IP Vault is a stateful Algorand smart contract that manages ownership token allocations for IP assets. It implements a **fixed-allocation, platform-reserved** model where SECURE MetaWork always receives 20% of tokens.

## Compilation

```bash
cd /app/contracts
python ip_vault.py
```

This generates:
- `ip_vault_approval.teal` - Main approval program
- `ip_vault_clear.teal` - Clear state program

## Key Features

1. **Fixed Platform Allocation**: SECURE MetaWork receives exactly 20% of all tokens - this is hard-coded and immutable
2. **Two-Phase Flow**: Propose → Finalize workflow allows review before locking allocations
3. **On-Chain Entitlements**: All stakeholder allocations are stored on-chain in boxes
4. **Claim Mechanism**: Stakeholders can only withdraw up to their allocated share

## Contract Architecture

### Global State

| Key | Type | Description |
|-----|------|-------------|
| `ip_id` | bytes | Identifier for the IP asset |
| `total_supply` | uint64 | Total ownership token supply (e.g., 100) |
| `asset_id` | uint64 | ASA ID of the ownership token |
| `finalized` | uint64 | 0 = propose phase, 1 = finalized (immutable) |
| `creator` | bytes | Address of vault creator/admin |
| `stk_count` | uint64 | Number of stakeholders (excluding platform) |
| `platform_claimed` | uint64 | Tokens already claimed by platform |

### Box Storage

Each stakeholder has a box with key `prop_{address}` containing:
- Bytes 0-7: `allocation_type` (1 = fixed amount, 2 = percentage)
- Bytes 8-15: `allocation_value` (amount or basis points)
- Bytes 16-23: `claimed_amount` (tokens withdrawn)

## Contract Methods

### 1. proposeSplits

```
Args: ["propose", ip_id, total_supply, asset_id, stakeholder_entries...]
```

- Only callable when `finalized == false`
- Only the creator can call
- Each stakeholder entry is 48 bytes: `address(32) + type(8) + value(8)`
- Validates: allocations ≤ 80% (platform gets 20%)
- No duplicate addresses allowed

### 2. finalizeSplits

```
Args: ["finalize"]
```

- Only callable when `finalized == false`
- Only the creator can call
- Sets `finalized = true`
- After this, no modifications possible

### 3. claim

```
Args: ["claim", amount_requested]
```

- Only callable when `finalized == true`
- Caller must be a configured stakeholder (or SECURE MetaWork)
- Validates: `amount_requested <= remaining_entitlement`
- Executes inner ASA transfer from vault to claimer
- Updates claimed amount

### 4. opt_in

```
Args: ["opt_in", asset_id]
```

- Allows vault to receive tokens
- Only creator can call

## Platform Allocation Enforcement

The platform allocation is enforced at multiple levels:

1. **Hard-coded Address**: `SECURE_METAWORK_ADDRESS` is a constant in the contract
2. **Fixed 20%**: `PLATFORM_ALLOCATION_BPS = 2000` (20.00% in basis points)
3. **Automatic Inclusion**: Platform is automatically added during propose
4. **Separate Tracking**: Platform claims use global state, not boxes
5. **No Override**: No transaction can modify the 20% allocation

## Example Transaction Groups

### Propose Splits

```javascript
const stakeholders = [
  { address: 'CREATOR...', allocationType: 2, allocationValue: 6000 }, // 60%
  { address: 'PARTNER...', allocationType: 2, allocationValue: 2000 }  // 20%
];
// Platform (20%) is automatic, so total = 100%

const txn = await createProposeSplitsTransaction(
  creatorAddress,
  appId,
  'ip-uuid-123',
  100,        // total supply
  assetId,
  stakeholders
);
```

### Finalize Splits

```javascript
const txn = await createFinalizeSplitsTransaction(creatorAddress, appId);
// After signing, allocations become immutable
```

### Claim Tokens

```javascript
// Stakeholder claiming 10 tokens
const txn = await createClaimTransaction(
  stakeholderAddress,
  appId,
  assetId,
  10  // amount to claim
);
```

## Security Considerations

1. **Immutability**: Once finalized, allocations cannot change
2. **Access Control**: Only creator can propose/finalize
3. **Claim Limits**: Cannot claim more than entitlement
4. **Platform Protection**: Platform allocation is constant
5. **No Deletion**: Contract cannot be deleted

## Frontend Integration

The frontend provides:

1. **StakeholderConfigForm**: UI for configuring allocations
2. **VaultReviewModal**: Review screen before propose/finalize
3. **VaultStatusDisplay**: Shows current vault state
4. **StakeholderClaimDashboard**: Claim interface for stakeholders

All screens read from on-chain state, not just the database, ensuring stakeholders always see their true allocation before signing.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vault` | GET | List vaults or get by ID/ipAssetId |
| `/api/vault` | POST | Propose new configuration |
| `/api/vault` | PUT | Update proposed configuration |
| `/api/vault/finalize` | POST | Finalize vault |
| `/api/vault/claim` | GET | Get claim status for address |
| `/api/vault/claim` | POST | Record a claim |
| `/api/vault/stakeholder` | GET | Get all vaults for an address |

## Database Schema

### vaults collection

```javascript
{
  id: string,           // UUID
  ipAssetId: string,    // Reference to IP asset
  ipAssetName: string,
  totalSupply: number,
  assetId: number,      // Algorand ASA ID
  creatorId: string,
  creatorWallet: string,
  finalized: boolean,
  stakeholders: [{
    address: string,
    allocationType: number,
    allocationValue: number,
    tokenAmount: number,
    percentage: number,
    claimed: number,
    isPlatform: boolean
  }],
  platformAllocation: number,
  otherAllocations: number,
  unallocated: number,
  appId: number,        // Smart contract app ID
  proposedAt: Date,
  finalizedAt: Date
}
```

### vault_claims collection

```javascript
{
  vaultId: string,
  ipAssetId: string,
  claimerAddress: string,
  amount: number,
  txId: string,
  isPlatform: boolean,
  timestamp: Date
}
```
