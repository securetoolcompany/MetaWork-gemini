"""
Revenue Pool Smart Contract V2 - Pool Creates Tokens

This version has the pool CREATE the revenue tokens via inner transaction.
Tokens go directly to the pool - never touches creator's wallet!

Flow:
1. Deploy Revenue Pool contract
2. Call create_tokens() - pool creates ASA via inner txn, tokens go to pool
3. Set stakeholder allocations
4. Stakeholders opt-in to the token
5. Stakeholders call claim_tokens() to receive their allocation
6. Products sell - USDC deposited to pool
7. Stakeholders claim USDC based on token holdings
"""

from pyteal import *

# ============================================================================
# CONSTANTS
# ============================================================================

USDC_ASSET_ID = Int(10458941)  # Testnet USDC
TOTAL_REVENUE_TOKENS = Int(100000000)

# ============================================================================
# GLOBAL STATE KEYS
# ============================================================================

GLOBAL_IP_ID = Bytes("ip_id")
GLOBAL_REVENUE_TOKEN_ID = Bytes("rev_token_id")
GLOBAL_TOTAL_DEPOSITED = Bytes("total_deposited")
GLOBAL_TOTAL_CLAIMED = Bytes("total_claimed")
GLOBAL_CREATOR = Bytes("creator")
GLOBAL_INITIALIZED = Bytes("initialized")
GLOBAL_TOKENS_CREATED = Bytes("tokens_created")

# ============================================================================
# BOX STORAGE - Stakeholder allocations
# ============================================================================

def stakeholder_box_key(address: Expr) -> Expr:
    return Concat(Bytes("stk_"), address)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

@Subroutine(TealType.uint64)
def get_pool_usdc_balance() -> Expr:
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
    created_asset_id = ScratchVar(TealType.uint64)
    
    # ========================================================================
    # ON CREATE - Initialize the revenue pool
    # ========================================================================
    on_create = Seq(
        App.globalPut(GLOBAL_CREATOR, Txn.sender()),
        App.globalPut(GLOBAL_TOTAL_DEPOSITED, Int(0)),
        App.globalPut(GLOBAL_TOTAL_CLAIMED, Int(0)),
        App.globalPut(GLOBAL_INITIALIZED, Int(0)),
        App.globalPut(GLOBAL_TOKENS_CREATED, Int(0)),
        App.globalPut(GLOBAL_REVENUE_TOKEN_ID, Int(0)),
        Approve()
    )
    
    # ========================================================================
    # INITIALIZE - Set IP ID
    # ========================================================================
    # Args: ["init", ip_id(bytes)]
    
    init_ip_id = Txn.application_args[1]
    
    on_init = Seq(
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        Assert(App.globalGet(GLOBAL_INITIALIZED) == Int(0)),
        
        App.globalPut(GLOBAL_IP_ID, init_ip_id),
        App.globalPut(GLOBAL_INITIALIZED, Int(1)),
        
        Approve()
    )
    
    # ========================================================================
    # CREATE TOKENS - Pool creates the revenue token ASA via inner transaction
    # ========================================================================
    # Args: ["create_tokens", token_name(bytes), unit_name(bytes)]
    # This is the KEY innovation - pool creates tokens, so they go to pool!
    
    token_name = Txn.application_args[1]
    unit_name = Txn.application_args[2]
    
    on_create_tokens = Seq(
        # Only creator can create tokens
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        # Must be initialized
        Assert(App.globalGet(GLOBAL_INITIALIZED) == Int(1)),
        # Tokens not already created
        Assert(App.globalGet(GLOBAL_TOKENS_CREATED) == Int(0)),
        
        # Create the Revenue Token ASA via inner transaction
        # Since the app is the sender, all tokens go to the app!
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetConfig,
            TxnField.config_asset_total: TOTAL_REVENUE_TOKENS,
            TxnField.config_asset_decimals: Int(0),
            TxnField.config_asset_default_frozen: Int(0),
            TxnField.config_asset_manager: Global.current_application_address(),
            TxnField.config_asset_reserve: Global.current_application_address(),
            TxnField.config_asset_freeze: Global.current_application_address(),
            TxnField.config_asset_clawback: Global.current_application_address(),
            TxnField.config_asset_name: token_name,
            TxnField.config_asset_unit_name: unit_name,
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        # Store the created asset ID
        created_asset_id.store(InnerTxn.created_asset_id()),
        App.globalPut(GLOBAL_REVENUE_TOKEN_ID, created_asset_id.load()),
        App.globalPut(GLOBAL_TOKENS_CREATED, Int(1)),
        
        # Log the created asset ID for the frontend
        Log(Concat(Bytes("token_id:"), Itob(created_asset_id.load()))),
        
        Approve()
    )
    
    # ========================================================================
    # OPT-IN USDC - Allow pool to receive USDC
    # ========================================================================
    # Args: ["opt_in_usdc"]
    
    on_opt_in_usdc = Seq(
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        
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
    # Box stores: [percentage(8), tokens_claimed(8)]
    
    stakeholder_address = Txn.application_args[1]
    stakeholder_percentage = Btoi(Txn.application_args[2])
    
    on_set_stakeholder = Seq(
        Assert(Txn.sender() == App.globalGet(GLOBAL_CREATOR)),
        Assert(stakeholder_percentage <= Int(100)),
        Assert(stakeholder_percentage > Int(0)),
        
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
    
    claimer = Txn.sender()
    box_result = App.box_get(stakeholder_box_key(claimer))
    
    on_claim_tokens = Seq(
        # Must have tokens created
        Assert(App.globalGet(GLOBAL_TOKENS_CREATED) == Int(1)),
        
        # Load stakeholder's allocation from box
        box_result,
        Assert(box_result.hasValue()),
        box_data.store(box_result.value()),
        
        # Extract allocation and claimed amount
        allocation_percentage.store(Btoi(Extract(box_data.load(), Int(0), Int(8)))),
        tokens_already_claimed.store(Btoi(Extract(box_data.load(), Int(8), Int(8)))),
        
        # Calculate tokens to send
        tokens_to_send.store(allocation_percentage.load() - tokens_already_claimed.load()),
        Assert(tokens_to_send.load() > Int(0)),
        
        # Transfer tokens from pool to claimer
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: claimer,
            TxnField.asset_amount: tokens_to_send.load(),
            TxnField.xfer_asset: App.globalGet(GLOBAL_REVENUE_TOKEN_ID),
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        # Update box - mark tokens as claimed
        App.box_put(
            stakeholder_box_key(claimer),
            Concat(
                Itob(allocation_percentage.load()),
                Itob(allocation_percentage.load())  # All allocated tokens now claimed
            )
        ),
        
        Approve()
    )
    
    # ========================================================================
    # DEPOSIT USDC - Receive USDC into the pool
    # ========================================================================
    # Args: ["deposit"]
    # Must be accompanied by USDC payment transaction
    
    deposit_amount = Gtxn[Txn.group_index() - Int(1)].asset_amount()
    
    on_deposit = Seq(
        Assert(App.globalGet(GLOBAL_TOKENS_CREATED) == Int(1)),
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
    
    claim_amount = Btoi(Txn.application_args[1])
    user_token_balance = Btoi(Txn.application_args[2])
    usdc_claimer = Txn.sender()
    
    pool_balance = ScratchVar(TealType.uint64)
    user_share = ScratchVar(TealType.uint64)
    
    on_claim_usdc = Seq(
        Assert(App.globalGet(GLOBAL_TOKENS_CREATED) == Int(1)),
        
        pool_balance.store(get_pool_usdc_balance()),
        user_share.store(
            (pool_balance.load() * user_token_balance) / TOTAL_REVENUE_TOKENS
        ),
        
        Assert(claim_amount > Int(0)),
        Assert(claim_amount <= user_share.load()),
        Assert(claim_amount <= pool_balance.load()),
        
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: usdc_claimer,
            TxnField.asset_amount: claim_amount,
            TxnField.xfer_asset: USDC_ASSET_ID,
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        App.globalPut(
            GLOBAL_TOTAL_CLAIMED,
            App.globalGet(GLOBAL_TOTAL_CLAIMED) + claim_amount
        ),
        
        Approve()
    )
    
    # ========================================================================
    # GET TOKEN ID - Read-only call to get the token ID
    # ========================================================================
    on_get_token_id = Seq(
        Log(Itob(App.globalGet(GLOBAL_REVENUE_TOKEN_ID))),
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
        [Txn.application_args[0] == Bytes("create_tokens"), on_create_tokens],
        [Txn.application_args[0] == Bytes("opt_in_usdc"), on_opt_in_usdc],
        [Txn.application_args[0] == Bytes("set_stakeholder"), on_set_stakeholder],
        [Txn.application_args[0] == Bytes("claim_tokens"), on_claim_tokens],
        [Txn.application_args[0] == Bytes("deposit"), on_deposit],
        [Txn.application_args[0] == Bytes("claim_usdc"), on_claim_usdc],
        [Txn.application_args[0] == Bytes("get_token_id"), on_get_token_id],
    )
    
    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    approval_teal = compileTeal(approval_program(), mode=Mode.Application, version=8)
    with open("revenue_pool_v2_approval.teal", "w") as f:
        f.write(approval_teal)
    print("Approval program written to revenue_pool_v2_approval.teal")
    
    clear_teal = compileTeal(clear_state_program(), mode=Mode.Application, version=8)
    with open("revenue_pool_v2_clear.teal", "w") as f:
        f.write(clear_teal)
    print("Clear program written to revenue_pool_v2_clear.teal")
