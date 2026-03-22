"""
Revenue Pool Smart Contract - PyTeal Implementation

A unified on-chain pool that:
1. Holds Revenue Tokens (for stakeholder distribution)
2. Collects USDC when products are sold
3. Allows stakeholders to claim tokens (after opt-in)
4. Allows token holders to claim USDC based on holdings

Flow:
- IP Minted: Revenue Pool created, all 100 Revenue Tokens sent to pool
- Stakeholder opts-in to Revenue Token ASA
- Stakeholder claims tokens from pool (pool validates allocation)
- Products sell: USDC deposited to pool
- Token holders claim USDC based on their token balance
"""

from pyteal import *

# ============================================================================
# CONSTANTS
# ============================================================================

# USDC Asset ID on Algorand Testnet
USDC_ASSET_ID = Int(10458941)

# Total revenue tokens per IP (100 tokens = 100%)
TOTAL_REVENUE_TOKENS = Int(100)

# ============================================================================
# GLOBAL STATE KEYS
# ============================================================================

GLOBAL_IP_ID = Bytes("ip_id")
GLOBAL_REVENUE_TOKEN_ID = Bytes("rev_token_id")
GLOBAL_TOTAL_DEPOSITED = Bytes("total_deposited")
GLOBAL_TOTAL_CLAIMED = Bytes("total_claimed")
GLOBAL_CREATOR = Bytes("creator")
GLOBAL_INITIALIZED = Bytes("initialized")

# Stakeholder allocations stored as: "alloc_{address}" -> percentage (0-100)
# We'll use box storage for stakeholder allocations

# ============================================================================
# BOX STORAGE
# ============================================================================

def stakeholder_box_key(address: Expr) -> Expr:
    """Generate box key for stakeholder allocation"""
    return Concat(Bytes("stk_"), address)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

@Subroutine(TealType.uint64)
def get_pool_usdc_balance() -> Expr:
    """Get current USDC balance in the pool (deposited - claimed)"""
    return App.globalGet(GLOBAL_TOTAL_DEPOSITED) - App.globalGet(GLOBAL_TOTAL_CLAIMED)


# ============================================================================
# APPLICATION METHODS
# ============================================================================

def approval_program():
    # Scratch variables
    allocation_percentage = ScratchVar(TealType.uint64)
    tokens_to_send = ScratchVar(TealType.uint64)
    tokens_already_claimed = ScratchVar(TealType.uint64)
    box_data = ScratchVar(TealType.bytes)
    
    # ========================================================================
    # ON CREATE - Initialize the revenue pool
    # ========================================================================
    on_create = Seq(
        App.globalPut(GLOBAL_CREATOR, Txn.sender()),
        App.globalPut(GLOBAL_TOTAL_DEPOSITED, Int(0)),
        App.globalPut(GLOBAL_TOTAL_CLAIMED, Int(0)),
        App.globalPut(GLOBAL_INITIALIZED, Int(0)),
        Approve()
    )
    
    # ========================================================================
    # INITIALIZE - Set IP ID and Revenue Token ID after creation
    # ========================================================================
    # Args: ["init", ip_id(bytes), revenue_token_id(uint64)]
    
    init_ip_id = Txn.application_args[1]
    init_revenue_token_id = Btoi(Txn.application_args[2])
    
    on_init = Seq(
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        Assert(App.globalGet(GLOBAL_INITIALIZED) == Int(0)),
        
        App.globalPut(GLOBAL_IP_ID, init_ip_id),
        App.globalPut(GLOBAL_REVENUE_TOKEN_ID, init_revenue_token_id),
        App.globalPut(GLOBAL_INITIALIZED, Int(1)),
        
        Approve()
    )
    
    # ========================================================================
    # OPT-IN ASSETS - Allow pool to receive Revenue Token and USDC
    # ========================================================================
    # Args: ["opt_in_assets"]
    # Must be called after init, opts into both Revenue Token and USDC
    
    on_opt_in_assets = Seq(
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        Assert(App.globalGet(GLOBAL_INITIALIZED) == Int(1)),
        
        # Opt-in to Revenue Token
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.asset_amount: Int(0),
            TxnField.xfer_asset: App.globalGet(GLOBAL_REVENUE_TOKEN_ID),
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        # Opt-in to USDC
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.asset_amount: Int(0),
            TxnField.xfer_asset: USDC_ASSET_ID,
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        Approve()
    )
    
    # ========================================================================
    # SET STAKEHOLDER - Add/update stakeholder allocation
    # ========================================================================
    # Args: ["set_stakeholder", stakeholder_address(bytes), percentage(uint64)]
    # Only creator can set stakeholders
    # Box stores: [percentage(8), tokens_claimed(8)]
    
    stakeholder_address = Txn.application_args[1]
    stakeholder_percentage = Btoi(Txn.application_args[2])
    
    on_set_stakeholder = Seq(
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        Assert(stakeholder_percentage <= Int(100)),
        Assert(stakeholder_percentage > Int(0)),
        
        # Create or update box with allocation
        # Box format: [percentage(8 bytes), tokens_claimed(8 bytes)]
        App.box_put(
            stakeholder_box_key(stakeholder_address),
            Concat(
                Itob(stakeholder_percentage),
                Itob(Int(0))  # tokens claimed starts at 0
            )
        ),
        
        Approve()
    )
    
    # ========================================================================
    # CLAIM TOKENS - Stakeholder claims their revenue tokens from pool
    # ========================================================================
    # Args: ["claim_tokens"]
    # Stakeholder must have opted into the revenue token first
    # Pool sends their allocated tokens based on percentage
    
    claimer = Txn.sender()
    box_result = App.box_get(stakeholder_box_key(claimer))
    
    on_claim_tokens = Seq(
        Assert(App.globalGet(GLOBAL_INITIALIZED) == Int(1)),
        
        # Load stakeholder's box data
        box_result,
        Assert(box_result.hasValue()),
        box_data.store(box_result.value()),
        
        # Extract allocation percentage and tokens already claimed
        allocation_percentage.store(Btoi(Extract(box_data.load(), Int(0), Int(8)))),
        tokens_already_claimed.store(Btoi(Extract(box_data.load(), Int(8), Int(8)))),
        
        # Calculate tokens to send: (percentage * 100) / 100 = percentage tokens
        # Since we have 100 tokens total, percentage directly equals token amount
        tokens_to_send.store(allocation_percentage.load() - tokens_already_claimed.load()),
        
        # Must have tokens to claim
        Assert(tokens_to_send.load() > Int(0)),
        
        # Transfer revenue tokens from pool to claimer
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: claimer,
            TxnField.asset_amount: tokens_to_send.load(),
            TxnField.xfer_asset: App.globalGet(GLOBAL_REVENUE_TOKEN_ID),
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        # Update box: mark tokens as claimed
        App.box_put(
            stakeholder_box_key(claimer),
            Concat(
                Itob(allocation_percentage.load()),
                Itob(allocation_percentage.load())  # All tokens now claimed
            )
        ),
        
        Approve()
    )
    
    # ========================================================================
    # DEPOSIT USDC - Receive USDC into the pool (called when products sell)
    # ========================================================================
    # Args: ["deposit"]
    # Must be accompanied by USDC payment transaction
    
    deposit_amount = Gtxn[Txn.group_index() - Int(1)].asset_amount()
    
    on_deposit = Seq(
        Assert(App.globalGet(GLOBAL_INITIALIZED) == Int(1)),
        
        # Verify preceding transaction is USDC transfer to this app
        Assert(Txn.group_index() > Int(0)),
        Assert(Gtxn[Txn.group_index() - Int(1)].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[Txn.group_index() - Int(1)].xfer_asset() == USDC_ASSET_ID),
        Assert(Gtxn[Txn.group_index() - Int(1)].asset_receiver() == Global.current_application_address()),
        
        App.globalPut(
            GLOBAL_TOTAL_DEPOSITED,
            App.globalGet(GLOBAL_TOTAL_DEPOSITED) + deposit_amount
        ),
        
        Approve()
    )
    
    # ========================================================================
    # CLAIM USDC - Withdraw USDC based on revenue token holdings
    # ========================================================================
    # Args: ["claim_usdc", amount(uint64), user_token_balance(uint64)]
    # user_token_balance is passed and verified off-chain
    
    claim_amount = Btoi(Txn.application_args[1])
    user_token_balance = Btoi(Txn.application_args[2])
    usdc_claimer = Txn.sender()
    
    pool_balance = ScratchVar(TealType.uint64)
    user_share = ScratchVar(TealType.uint64)
    
    on_claim_usdc = Seq(
        Assert(App.globalGet(GLOBAL_INITIALIZED) == Int(1)),
        
        # Calculate pool balance
        pool_balance.store(get_pool_usdc_balance()),
        
        # Calculate user's share: (pool_balance * user_tokens) / 100
        user_share.store(
            (pool_balance.load() * user_token_balance) / TOTAL_REVENUE_TOKENS
        ),
        
        # Validate claim
        Assert(claim_amount > Int(0)),
        Assert(claim_amount <= user_share.load()),
        Assert(claim_amount <= pool_balance.load()),
        
        # Transfer USDC to claimer
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: usdc_claimer,
            TxnField.asset_amount: claim_amount,
            TxnField.xfer_asset: USDC_ASSET_ID,
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        # Update total claimed
        App.globalPut(
            GLOBAL_TOTAL_CLAIMED,
            App.globalGet(GLOBAL_TOTAL_CLAIMED) + claim_amount
        ),
        
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
        [Txn.application_args[0] == Bytes("init"), on_init],
        [Txn.application_args[0] == Bytes("opt_in_assets"), on_opt_in_assets],
        [Txn.application_args[0] == Bytes("set_stakeholder"), on_set_stakeholder],
        [Txn.application_args[0] == Bytes("claim_tokens"), on_claim_tokens],
        [Txn.application_args[0] == Bytes("deposit"), on_deposit],
        [Txn.application_args[0] == Bytes("claim_usdc"), on_claim_usdc],
    )
    
    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    # Compile and output TEAL
    approval_teal = compileTeal(approval_program(), mode=Mode.Application, version=8)
    with open("revenue_pool_approval.teal", "w") as f:
        f.write(approval_teal)
    print("Approval program written to revenue_pool_approval.teal")
    
    clear_teal = compileTeal(clear_state_program(), mode=Mode.Application, version=8)
    with open("revenue_pool_clear.teal", "w") as f:
        f.write(clear_teal)
    print("Clear program written to revenue_pool_clear.teal")
