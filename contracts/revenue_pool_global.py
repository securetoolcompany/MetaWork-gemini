"""
MetaWork Global Revenue Pool Smart Contract - Simplified Version

Single Application Architecture for managing multiple product pools.
Each product is stored in a box with its own revenue ASA.

Flow:
1. Platform deploys this app once
2. Creator calls create_pool with payment (~0.111 ALGO)
3. Stakeholders claim rev tokens via claim_rev_tokens
4. Users deposit USDC for products
5. Token holders claim revenue pro-rata
"""

from pyteal import *

# ============================================================================
# CONSTANTS
# ============================================================================

USDC_ASSET_ID = Int(10458941)  # Testnet USDC
TOTAL_TOKENS = Int(100)  # 100 tokens = 100%
METAWORK_SHARE = Int(20)  # 20%
MIN_FUNDING = Int(111000)  # ~0.111 ALGO

# Global state keys
KEY_MW_WALLET = Bytes("mw_wallet")
KEY_INIT = Bytes("init")

# Box field offsets (simplified structure)
# [0:8] rev_asa_id, [8:16] total_dep, [16:24] total_claimed, [24:32] creator offset in allocs
OFF_REV_ASA = Int(0)
OFF_TOTAL_DEP = Int(8)
OFF_TOTAL_CLAIMED = Int(16)


def approval_program():
    """Main approval program"""
    
    # ===================
    # ON CREATE
    # ===================
    handle_creation = Seq(
        App.globalPut(KEY_MW_WALLET, Txn.application_args[0]),
        App.globalPut(KEY_INIT, Int(1)),
        Return(Int(1))
    )
    
    # ===================
    # CREATE POOL
    # ===================
    # Group: [Payment to app, AppCall]
    # Args: ["create_pool", product_id, num_stakeholders]
    # Foreign assets, boxes configured by caller
    
    product_id = Txn.application_args[1]
    box_key = Concat(Bytes("p_"), product_id)
    
    handle_create_pool = Seq(
        # Verify group structure
        Assert(Global.group_size() == Int(2)),
        Assert(Gtxn[0].type_enum() == TxnType.Payment),
        Assert(Gtxn[0].receiver() == Global.current_application_address()),
        Assert(Gtxn[0].amount() >= MIN_FUNDING),
        Assert(Gtxn[0].sender() == Txn.sender()),
        
        # Create box for product
        Assert(App.box_create(box_key, Int(128))),
        
        # Create revenue ASA via inner txn
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetConfig,
            TxnField.config_asset_total: TOTAL_TOKENS,
            TxnField.config_asset_decimals: Int(0),
            TxnField.config_asset_default_frozen: Int(0),
            TxnField.config_asset_manager: Global.current_application_address(),
            TxnField.config_asset_reserve: Global.current_application_address(),
            TxnField.config_asset_name: Concat(Bytes("MWREV_"), product_id),
            TxnField.config_asset_unit_name: Bytes("MWREV"),
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        # Store revenue ASA ID in box
        App.box_put(box_key, Itob(InnerTxn.created_asset_id())),
        
        Log(Concat(Bytes("created:"), Itob(InnerTxn.created_asset_id()))),
        Return(Int(1))
    )
    
    # ===================
    # CLAIM REV TOKENS
    # ===================
    # Args: ["claim_rev_tokens", product_id, amount]
    # Caller must have opted into revenue ASA
    
    claim_product_id = Txn.application_args[1]
    claim_amount = Btoi(Txn.application_args[2])
    claim_box_key = Concat(Bytes("p_"), claim_product_id)
    
    handle_claim_tokens = Seq(
        # Get box and extract ASA ID
        Assert(App.box_get(claim_box_key).hasValue()),
        
        # Transfer tokens
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: Txn.sender(),
            TxnField.asset_amount: claim_amount,
            TxnField.xfer_asset: Btoi(Substring(App.box_get(claim_box_key).value(), Int(0), Int(8))),
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        Return(Int(1))
    )
    
    # ===================
    # OPT IN USDC
    # ===================
    handle_opt_in_usdc = Seq(
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.asset_amount: Int(0),
            TxnField.xfer_asset: USDC_ASSET_ID,
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        Return(Int(1))
    )
    
    # ===================
    # DEPOSIT USDC
    # ===================
    # Group: [USDC transfer to app, AppCall]
    # Args: ["deposit_usdc", product_id]
    
    dep_product_id = Txn.application_args[1]
    dep_box_key = Concat(Bytes("p_"), dep_product_id)
    dep_amount = Gtxn[Txn.group_index() - Int(1)].asset_amount()
    
    handle_deposit = Seq(
        Assert(Txn.group_index() > Int(0)),
        Assert(Gtxn[Txn.group_index() - Int(1)].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[Txn.group_index() - Int(1)].xfer_asset() == USDC_ASSET_ID),
        Assert(App.box_get(dep_box_key).hasValue()),
        
        # Update total deposited (stored at offset 8)
        App.box_replace(
            dep_box_key,
            OFF_TOTAL_DEP,
            Itob(Btoi(Substring(App.box_get(dep_box_key).value(), Int(8), Int(16))) + dep_amount)
        ),
        
        Log(Concat(Bytes("deposited:"), Itob(dep_amount))),
        Return(Int(1))
    )
    
    # ===================
    # CLAIM REVENUE
    # ===================
    # Args: ["claim_revenue", product_id, user_token_balance]
    
    rev_product_id = Txn.application_args[1]
    user_balance = Btoi(Txn.application_args[2])
    rev_box_key = Concat(Bytes("p_"), rev_product_id)
    
    handle_claim_revenue = Seq(
        Assert(App.box_get(rev_box_key).hasValue()),
        
        # Calculate claimable: (pool_balance * user_tokens) / total_tokens
        # pool_balance = total_deposited - total_claimed
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: Txn.sender(),
            TxnField.asset_amount: (
                (
                    Btoi(Substring(App.box_get(rev_box_key).value(), Int(8), Int(16))) -
                    Btoi(Substring(App.box_get(rev_box_key).value(), Int(16), Int(24)))
                ) * user_balance
            ) / TOTAL_TOKENS,
            TxnField.xfer_asset: USDC_ASSET_ID,
            TxnField.fee: Int(0)
        }),
        InnerTxnBuilder.Submit(),
        
        # Update total claimed
        App.box_replace(
            rev_box_key,
            OFF_TOTAL_CLAIMED,
            Itob(
                Btoi(Substring(App.box_get(rev_box_key).value(), Int(16), Int(24))) +
                InnerTxn.asset_amount()
            )
        ),
        
        Return(Int(1))
    )
    
    # ===================
    # GET INFO (read-only)
    # ===================
    info_product_id = Txn.application_args[1]
    info_box_key = Concat(Bytes("p_"), info_product_id)
    
    handle_get_info = Seq(
        Assert(App.box_get(info_box_key).hasValue()),
        Log(App.box_get(info_box_key).value()),
        Return(Int(1))
    )
    
    # ===================
    # ROUTER
    # ===================
    program = Cond(
        [Txn.application_id() == Int(0), handle_creation],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Int(0))],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Int(0))],
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.OptIn, Return(Int(1))],
        [Txn.application_args[0] == Bytes("create_pool"), handle_create_pool],
        [Txn.application_args[0] == Bytes("claim_rev_tokens"), handle_claim_tokens],
        [Txn.application_args[0] == Bytes("opt_in_usdc"), handle_opt_in_usdc],
        [Txn.application_args[0] == Bytes("deposit_usdc"), handle_deposit],
        [Txn.application_args[0] == Bytes("claim_revenue"), handle_claim_revenue],
        [Txn.application_args[0] == Bytes("get_info"), handle_get_info],
    )
    
    return program


def clear_state_program():
    return Return(Int(1))


if __name__ == "__main__":
    import os
    
    approval = compileTeal(approval_program(), mode=Mode.Application, version=8)
    with open("revenue_pool_global_approval.teal", "w") as f:
        f.write(approval)
    print("Wrote revenue_pool_global_approval.teal")
    
    clear = compileTeal(clear_state_program(), mode=Mode.Application, version=8)
    with open("revenue_pool_global_clear.teal", "w") as f:
        f.write(clear)
    print("Wrote revenue_pool_global_clear.teal")
