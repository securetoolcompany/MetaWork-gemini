"""
IP Vault Smart Contract - PyTeal Implementation

This contract manages ownership token allocations for IP assets.
Key features:
- Fixed 20% allocation for SECURE MetaWork (immutable)
- Two-phase propose → finalize flow
- Box storage for stakeholder entitlements
- Claim function for stakeholders to withdraw their allocation
"""

from pyteal import *
from typing import Literal

# ============================================================================
# CONSTANTS
# ============================================================================

# SECURE MetaWork platform wallet - receives fixed 20% of all IP tokens
# This is HARD-CODED and cannot be changed by any transaction
SECURE_METAWORK_ADDRESS = Addr("WNXGR6DCD4FWCK62JHWNI6OE37XMJGZFHO42FYFEGW5P3G4MYO4AJYJGTI")

# Fixed platform allocation (20% = 20 out of 100 tokens, or 2000 basis points)
PLATFORM_ALLOCATION_BPS = Int(2000)  # 20.00% in basis points
BPS_DENOMINATOR = Int(10000)  # 100.00% in basis points

# Box key prefixes
STAKEHOLDER_PREFIX = Bytes("stk_")  # Prefix for stakeholder boxes
PROPOSED_PREFIX = Bytes("prop_")   # Prefix for proposed config boxes

# Allocation types
ALLOCATION_TYPE_FIXED = Int(1)
ALLOCATION_TYPE_PERCENTAGE = Int(2)

# ============================================================================
# GLOBAL STATE KEYS
# ============================================================================

# IP identifier (bytes)
GLOBAL_IP_ID = Bytes("ip_id")

# Total supply of ownership tokens for this IP
GLOBAL_TOTAL_SUPPLY = Bytes("total_supply")

# ASA ID of the ownership token
GLOBAL_ASSET_ID = Bytes("asset_id")

# Whether splits have been finalized (0 = false, 1 = true)
GLOBAL_FINALIZED = Bytes("finalized")

# Creator/admin address who can propose and finalize
GLOBAL_CREATOR = Bytes("creator")

# Number of stakeholders (excluding platform)
GLOBAL_STAKEHOLDER_COUNT = Bytes("stk_count")

# Platform claimed amount
GLOBAL_PLATFORM_CLAIMED = Bytes("platform_claimed")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

@Subroutine(TealType.uint64)
def calculate_platform_allocation(total_supply: Expr) -> Expr:
    """Calculate the platform's fixed 20% allocation"""
    return (total_supply * PLATFORM_ALLOCATION_BPS) / BPS_DENOMINATOR


@Subroutine(TealType.uint64)
def percentage_to_tokens(percentage_bps: Expr, total_supply: Expr) -> Expr:
    """Convert percentage (in basis points) to token amount"""
    return (total_supply * percentage_bps) / BPS_DENOMINATOR


@Subroutine(TealType.bytes)
def stakeholder_box_key(address: Expr) -> Expr:
    """Generate box key for a stakeholder"""
    return Concat(STAKEHOLDER_PREFIX, address)


@Subroutine(TealType.bytes)
def proposed_box_key(address: Expr) -> Expr:
    """Generate box key for proposed stakeholder config"""
    return Concat(PROPOSED_PREFIX, address)


# Box data format for stakeholders:
# bytes 0-7: allocation_type (uint64)
# bytes 8-15: allocation_value (uint64, either fixed amount or percentage in BPS)
# bytes 16-23: claimed_amount (uint64)
STAKEHOLDER_BOX_SIZE = Int(24)


@Subroutine(TealType.none)
def write_stakeholder_box(address: Expr, alloc_type: Expr, alloc_value: Expr, claimed: Expr) -> Expr:
    """Write stakeholder data to a box"""
    return Seq(
        App.box_put(
            stakeholder_box_key(address),
            Concat(
                Itob(alloc_type),
                Itob(alloc_value),
                Itob(claimed)
            )
        )
    )


@Subroutine(TealType.uint64)
def get_stakeholder_allocation_type(address: Expr) -> Expr:
    """Get stakeholder's allocation type from box"""
    return Btoi(Extract(App.box_get(stakeholder_box_key(address)).value(), Int(0), Int(8)))


@Subroutine(TealType.uint64)
def get_stakeholder_allocation_value(address: Expr) -> Expr:
    """Get stakeholder's allocation value from box"""
    return Btoi(Extract(App.box_get(stakeholder_box_key(address)).value(), Int(8), Int(8)))


@Subroutine(TealType.uint64)
def get_stakeholder_claimed(address: Expr) -> Expr:
    """Get stakeholder's claimed amount from box"""
    return Btoi(Extract(App.box_get(stakeholder_box_key(address)).value(), Int(16), Int(8)))


@Subroutine(TealType.uint64)
def calculate_entitlement(address: Expr, total_supply: Expr) -> Expr:
    """Calculate a stakeholder's total token entitlement"""
    alloc_type = get_stakeholder_allocation_type(address)
    alloc_value = get_stakeholder_allocation_value(address)
    
    return If(
        alloc_type == ALLOCATION_TYPE_FIXED,
        alloc_value,
        percentage_to_tokens(alloc_value, total_supply)
    )


# ============================================================================
# APPLICATION METHODS
# ============================================================================

def approval_program():
    # ========================================================================
    # ON CREATE - Initialize the vault
    # ========================================================================
    on_create = Seq(
        # Store creator address
        App.globalPut(GLOBAL_CREATOR, Txn.sender()),
        # Initialize as not finalized
        App.globalPut(GLOBAL_FINALIZED, Int(0)),
        # Initialize stakeholder count
        App.globalPut(GLOBAL_STAKEHOLDER_COUNT, Int(0)),
        # Initialize platform claimed
        App.globalPut(GLOBAL_PLATFORM_CLAIMED, Int(0)),
        Approve()
    )
    
    # ========================================================================
    # PROPOSE SPLITS - Set up stakeholder allocations (before finalization)
    # ========================================================================
    # Args:
    # 0: "propose"
    # 1: ip_id (bytes)
    # 2: total_supply (uint64)
    # 3: asset_id (uint64)
    # 4+: stakeholder entries as: address(32) + alloc_type(8) + alloc_value(8)
    
    propose_ip_id = Txn.application_args[1]
    propose_total_supply = Btoi(Txn.application_args[2])
    propose_asset_id = Btoi(Txn.application_args[3])
    
    # Calculate platform's fixed 20% allocation
    platform_allocation = calculate_platform_allocation(propose_total_supply)
    
    # Maximum allocation for non-platform stakeholders (80%)
    max_other_allocation = propose_total_supply - platform_allocation
    
    # Scratch variables for loop
    i = ScratchVar(TealType.uint64)
    total_other_allocation = ScratchVar(TealType.uint64)
    stakeholder_count = ScratchVar(TealType.uint64)
    current_arg_idx = ScratchVar(TealType.uint64)
    
    # Each stakeholder entry is 48 bytes: address(32) + type(8) + value(8)
    ENTRY_SIZE = Int(48)
    
    on_propose = Seq(
        # Only callable when not finalized
        Assert(App.globalGet(GLOBAL_FINALIZED) == Int(0)),
        # Only creator can propose
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        
        # Store global config
        App.globalPut(GLOBAL_IP_ID, propose_ip_id),
        App.globalPut(GLOBAL_TOTAL_SUPPLY, propose_total_supply),
        App.globalPut(GLOBAL_ASSET_ID, propose_asset_id),
        
        # Process stakeholder entries (starting from arg 4)
        total_other_allocation.store(Int(0)),
        stakeholder_count.store(Int(0)),
        
        # Number of stakeholder entries = (num_args - 4)
        For(
            i.store(Int(4)),
            i.load() < Txn.application_args.length(),
            i.store(i.load() + Int(1))
        ).Do(
            Seq(
                # Extract stakeholder data from argument
                # Format: address(32 bytes) + alloc_type(8 bytes) + alloc_value(8 bytes)
                App.box_put(
                    proposed_box_key(Extract(Txn.application_args[i.load()], Int(0), Int(32))),
                    Concat(
                        Extract(Txn.application_args[i.load()], Int(32), Int(8)),  # alloc_type
                        Extract(Txn.application_args[i.load()], Int(40), Int(8)),  # alloc_value
                        Itob(Int(0))  # claimed = 0
                    )
                ),
                # Add to total allocation (need to handle percentage vs fixed)
                If(
                    Btoi(Extract(Txn.application_args[i.load()], Int(32), Int(8))) == ALLOCATION_TYPE_FIXED,
                    total_other_allocation.store(
                        total_other_allocation.load() + 
                        Btoi(Extract(Txn.application_args[i.load()], Int(40), Int(8)))
                    ),
                    total_other_allocation.store(
                        total_other_allocation.load() + 
                        percentage_to_tokens(
                            Btoi(Extract(Txn.application_args[i.load()], Int(40), Int(8))),
                            propose_total_supply
                        )
                    )
                ),
                stakeholder_count.store(stakeholder_count.load() + Int(1))
            )
        ),
        
        # Validate: total other allocations <= 80% (max_other_allocation)
        Assert(total_other_allocation.load() <= max_other_allocation),
        
        # Store stakeholder count
        App.globalPut(GLOBAL_STAKEHOLDER_COUNT, stakeholder_count.load()),
        
        Approve()
    )
    
    # ========================================================================
    # FINALIZE SPLITS - Lock in the configuration permanently
    # ========================================================================
    # Args: ["finalize"]
    
    on_finalize = Seq(
        # Only callable when not finalized
        Assert(App.globalGet(GLOBAL_FINALIZED) == Int(0)),
        # Only creator can finalize
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        # Ensure configuration exists
        Assert(App.globalGet(GLOBAL_TOTAL_SUPPLY) > Int(0)),
        Assert(App.globalGet(GLOBAL_ASSET_ID) > Int(0)),
        
        # Copy proposed boxes to active boxes
        # (In practice, we just use the proposed boxes as active after finalization)
        
        # Set finalized flag
        App.globalPut(GLOBAL_FINALIZED, Int(1)),
        
        Approve()
    )
    
    # ========================================================================
    # CLAIM - Withdraw tokens from the vault
    # ========================================================================
    # Args: ["claim", amount_requested(uint64)]
    
    claim_amount = Btoi(Txn.application_args[1])
    claimer = Txn.sender()
    
    # Scratch variables for claim
    entitlement = ScratchVar(TealType.uint64)
    claimed_so_far = ScratchVar(TealType.uint64)
    remaining = ScratchVar(TealType.uint64)
    box_data = ScratchVar(TealType.bytes)
    alloc_type_val = ScratchVar(TealType.uint64)
    alloc_value_val = ScratchVar(TealType.uint64)
    
    # Platform claim handler
    on_claim_platform = Seq(
        # Must be finalized
        Assert(App.globalGet(GLOBAL_FINALIZED) == Int(1)),
        
        # Calculate platform entitlement (fixed 20%)
        entitlement.store(calculate_platform_allocation(App.globalGet(GLOBAL_TOTAL_SUPPLY))),
        claimed_so_far.store(App.globalGet(GLOBAL_PLATFORM_CLAIMED)),
        
        # Calculate remaining
        remaining.store(entitlement.load() - claimed_so_far.load()),
        
        # Validate claim amount
        Assert(claim_amount > Int(0)),
        Assert(claim_amount <= remaining.load()),
        
        # Execute inner transaction to transfer tokens
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: claimer,
            TxnField.asset_amount: claim_amount,
            TxnField.xfer_asset: App.globalGet(GLOBAL_ASSET_ID),
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        # Update platform claimed amount
        App.globalPut(GLOBAL_PLATFORM_CLAIMED, claimed_so_far.load() + claim_amount),
        
        Approve()
    )
    
    # Stakeholder claim handler
    box_result = App.box_get(proposed_box_key(claimer))
    
    on_claim_stakeholder = Seq(
        # Must be finalized
        Assert(App.globalGet(GLOBAL_FINALIZED) == Int(1)),
        
        # Load box data - use MaybeValue properly
        box_result,
        Assert(box_result.hasValue()),
        box_data.store(box_result.value()),
        
        # Extract allocation data from box
        alloc_type_val.store(Btoi(Extract(box_data.load(), Int(0), Int(8)))),
        alloc_value_val.store(Btoi(Extract(box_data.load(), Int(8), Int(8)))),
        claimed_so_far.store(Btoi(Extract(box_data.load(), Int(16), Int(8)))),
        
        # Calculate entitlement based on allocation type
        If(
            alloc_type_val.load() == ALLOCATION_TYPE_FIXED,
            entitlement.store(alloc_value_val.load()),
            entitlement.store(
                percentage_to_tokens(
                    alloc_value_val.load(),
                    App.globalGet(GLOBAL_TOTAL_SUPPLY)
                )
            )
        ),
        
        # Calculate remaining
        remaining.store(entitlement.load() - claimed_so_far.load()),
        
        # Validate claim amount
        Assert(claim_amount > Int(0)),
        Assert(claim_amount <= remaining.load()),
        
        # Execute inner transaction to transfer tokens
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: claimer,
            TxnField.asset_amount: claim_amount,
            TxnField.xfer_asset: App.globalGet(GLOBAL_ASSET_ID),
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        # Update claimed amount in box
        App.box_put(
            proposed_box_key(claimer),
            Concat(
                Itob(alloc_type_val.load()),
                Itob(alloc_value_val.load()),
                Itob(claimed_so_far.load() + claim_amount)
            )
        ),
        
        Approve()
    )
    
    # Route to appropriate claim handler
    on_claim = If(
        claimer == SECURE_METAWORK_ADDRESS,
        on_claim_platform,
        on_claim_stakeholder
    )
    
    # ========================================================================
    # OPT-IN TO ASSET - Allow vault to receive tokens
    # ========================================================================
    # Args: ["opt_in", asset_id(uint64)]
    
    opt_in_asset_id = Btoi(Txn.application_args[1])
    
    on_opt_in = Seq(
        # Only creator can opt-in the vault to assets
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        
        # Execute inner transaction to opt-in
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.asset_amount: Int(0),
            TxnField.xfer_asset: opt_in_asset_id,
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        Approve()
    )
    
    # ========================================================================
    # READ STATE - For debugging/verification
    # ========================================================================
    # Args: ["get_stakeholder", address(32 bytes)]
    
    query_address = Txn.application_args[1]
    
    on_get_stakeholder = Seq(
        # Just approve - actual data read happens off-chain via box_get
        Approve()
    )
    
    # ========================================================================
    # ROUTER
    # ========================================================================
    
    program = Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.DeleteApplication, Reject()],
        [Txn.on_completion() == OnComplete.UpdateApplication, Reject()],
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        [Txn.application_args[0] == Bytes("propose"), on_propose],
        [Txn.application_args[0] == Bytes("finalize"), on_finalize],
        [Txn.application_args[0] == Bytes("claim"), on_claim],
        [Txn.application_args[0] == Bytes("opt_in"), on_opt_in],
        [Txn.application_args[0] == Bytes("get_stakeholder"), on_get_stakeholder],
    )
    
    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    # Compile and output TEAL
    import os
    
    # Approval program
    approval_teal = compileTeal(approval_program(), mode=Mode.Application, version=8)
    with open("ip_vault_approval.teal", "w") as f:
        f.write(approval_teal)
    print("Approval program written to ip_vault_approval.teal")
    
    # Clear state program  
    clear_teal = compileTeal(clear_state_program(), mode=Mode.Application, version=8)
    with open("ip_vault_clear.teal", "w") as f:
        f.write(clear_teal)
    print("Clear program written to ip_vault_clear.teal")
