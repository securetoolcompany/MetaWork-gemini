"""
Revenue Pool V3 - MetaWork
- 10,000 token supply (basis points: 1 token = 0.01%)
- Box storage: [assetId(8) | numStakeholders(1) | [addr(32)|bps(2)|claimed(1)] x N]
- Max 100 stakeholders per pool
- Stakeholders must opt-in to ASA before calling claim_tokens
- USDC claim is proportional to token holdings
"""

from pyteal import *

USDC_ASSET_ID      = Int(10458941)   # Testnet USDC
TOTAL_TOKENS       = Int(10000)
MAX_STAKEHOLDERS   = Int(100)

# Box key prefix
BOX_PREFIX         = Bytes("p_")

# Box layout offsets
ASSET_ID_OFFSET    = Int(0)   # 8 bytes  — uint64 asset ID
NUM_SH_OFFSET      = Int(8)   # 1 byte   — number of stakeholders
ENTRIES_OFFSET     = Int(9)   # start of stakeholder entries

# Per-entry layout (35 bytes each)
ENTRY_SIZE         = Int(35)
ADDR_SIZE          = Int(32)
BPS_SIZE           = Int(2)
CLAIMED_SIZE       = Int(1)

# Offsets within an entry
ENTRY_ADDR_OFF     = Int(0)
ENTRY_BPS_OFF      = Int(32)
ENTRY_CLAIMED_OFF  = Int(34)


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

@Subroutine(TealType.uint64)
def entry_offset(index: Expr) -> Expr:
    return ENTRIES_OFFSET + (index * ENTRY_SIZE)


@Subroutine(TealType.bytes)
def box_key(ip_id: Expr) -> Expr:
    return Concat(BOX_PREFIX, ip_id)


# ─────────────────────────────────────────────
# Approval Program
# ─────────────────────────────────────────────

def approval_program():

    ip_id              = Txn.application_args[1]
    bkey               = ScratchVar(TealType.bytes)
    num_stakeholders   = ScratchVar(TealType.uint64)
    i                  = ScratchVar(TealType.uint64)
    entry_off          = ScratchVar(TealType.uint64)
    found              = ScratchVar(TealType.uint64)
    claimer_bps        = ScratchVar(TealType.uint64)
    tokens_to_send     = ScratchVar(TealType.uint64)
    pool_usdc_balance  = ScratchVar(TealType.uint64)
    user_token_balance = ScratchVar(TealType.uint64)
    claimable          = ScratchVar(TealType.uint64)
    asset_id           = ScratchVar(TealType.uint64)
    box_data           = ScratchVar(TealType.bytes)


    # ── CREATE APP ───────────────────────────
    on_create = Seq(
        Approve()
    )


        # ── CREATE POOL ──────────────────────────
    # Args:  [0]="create_pool" [1]=ipId [2]=tokenName [3]=unitName
    #        [4]=packed stakeholders: [addr(32)|bps(2)] x N  (max 100)
    # Accounts: none required beyond sender

    sh_bytes      = Txn.application_args[4]
    sh_bytes_len  = Len(sh_bytes)
    n_sh          = ScratchVar(TealType.uint64)
    total_bps     = ScratchVar(TealType.uint64)
    loop_i        = ScratchVar(TealType.uint64)
    entry_bps     = ScratchVar(TealType.uint64)
    created_id    = ScratchVar(TealType.uint64)
    box_content   = ScratchVar(TealType.bytes)
    cur_addr      = ScratchVar(TealType.bytes)
    cur_bps_bytes = ScratchVar(TealType.bytes)

    on_create_pool = Seq(
        # Each input entry is 34 bytes (32 addr + 2 bps)
        Assert(sh_bytes_len % Int(34) == Int(0)),
        n_sh.store(sh_bytes_len / Int(34)),
        Assert(n_sh.load() > Int(0)),
        Assert(n_sh.load() <= MAX_STAKEHOLDERS),

        # Validate bps sum == 10000
        total_bps.store(Int(0)),
        loop_i.store(Int(0)),
        While(loop_i.load() < n_sh.load()).Do(
            entry_bps.store(
                Btoi(Extract(sh_bytes, loop_i.load() * Int(34) + Int(32), Int(2)))
            ),
            Assert(entry_bps.load() > Int(0)),
            total_bps.store(total_bps.load() + entry_bps.load()),
            loop_i.store(loop_i.load() + Int(1)),
        ),
        Assert(total_bps.load() == TOTAL_TOKENS),

        # Pool must not already exist for this ipId
        bkey.store(box_key(ip_id)),
        # Evaluate MaybeValue first so its scratch stores happen
        (lambda mv: Seq(
            mv,
            Assert(mv.hasValue() == Int(0)),
        ))(App.box_get(bkey.load())),

        # Create the revenue token ASA (pool is creator → holds all tokens)
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:                 TxnType.AssetConfig,
            TxnField.config_asset_total:        TOTAL_TOKENS,
            TxnField.config_asset_decimals:     Int(0),
            TxnField.config_asset_default_frozen: Int(0),
            TxnField.config_asset_manager:      Global.current_application_address(),
            TxnField.config_asset_reserve:      Global.current_application_address(),
            TxnField.config_asset_freeze:       Global.current_application_address(),
            TxnField.config_asset_clawback:     Global.current_application_address(),
            TxnField.config_asset_name:         Txn.application_args[2],
            TxnField.config_asset_unit_name:    Txn.application_args[3],
            TxnField.fee:                       Int(0),
        }),
        InnerTxnBuilder.Submit(),
        created_id.store(InnerTxn.created_asset_id()),

        # Build box content:
        # [assetId(8)] + [numStakeholders(1)] + [addr(32)|bps(2)|claimed(1)] x N
        box_content.store(
            Concat(
                Itob(created_id.load()),                       # 8 bytes: asset ID
                Extract(Itob(n_sh.load()), Int(7), Int(1)),    # 1 byte: count
            )
        ),
        loop_i.store(Int(0)),
        While(loop_i.load() < n_sh.load()).Do(
            cur_addr.store(
                Extract(sh_bytes, loop_i.load() * Int(34), Int(32))
            ),
            cur_bps_bytes.store(
                Extract(sh_bytes, loop_i.load() * Int(34) + Int(32), Int(2))
            ),
            box_content.store(
                Concat(
                    box_content.load(),
                    cur_addr.load(),        # 32 bytes: address
                    cur_bps_bytes.load(),   # 2 bytes: bps allocation
                    Bytes("\x00"),          # 1 byte: claimed flag = 0
                )
            ),
            loop_i.store(loop_i.load() + Int(1)),
        ),

        # Write box
        App.box_put(bkey.load(), box_content.load()),

        # Log the new asset ID for the backend
        Log(Concat(Bytes("asset_id:"), Itob(created_id.load()))),

        Approve()
    )


        # ── CLAIM TOKENS ─────────────────────────
    # Args: [0]="claim_tokens" [1]=ipId
    # Caller must have already opted in to the revenue token ASA.

    claimer = Txn.sender()

    on_claim_tokens = Seq(
        bkey.store(box_key(ip_id)),

        # Box must exist – evaluate MaybeValue then take .value()
        (lambda mv: Seq(
            mv,
            box_data.store(mv.value()),
        ))(App.box_get(bkey.load())),

        # Read asset ID and stakeholder count
        asset_id.store(Btoi(Extract(box_data.load(), ASSET_ID_OFFSET, Int(8)))),
        num_stakeholders.store(
            Btoi(Extract(box_data.load(), NUM_SH_OFFSET, Int(1)))
        ),

        # Find caller in stakeholder list
        found.store(Int(0)),
        claimer_bps.store(Int(0)),
        i.store(Int(0)),
        While(And(i.load() < num_stakeholders.load(), found.load() == Int(0))).Do(
            entry_off.store(entry_offset(i.load())),
            If(
                Extract(box_data.load(), entry_off.load(), ADDR_SIZE) == claimer
            ).Then(
                # Check not already claimed (claimed byte == 0)
                Assert(
                    Btoi(
                        Extract(
                            box_data.load(),
                            entry_off.load() + ADDR_SIZE + BPS_SIZE,
                            Int(1),
                        )
                    ) == Int(0)
                ),
                claimer_bps.store(
                    Btoi(
                        Extract(
                            box_data.load(),
                            entry_off.load() + ADDR_SIZE,
                            BPS_SIZE,
                        )
                    )
                ),
                found.store(Int(1)),
            ),
            i.store(i.load() + Int(1)),
        ),
        Assert(found.load() == Int(1)),
        Assert(claimer_bps.load() > Int(0)),

        tokens_to_send.store(claimer_bps.load()),  # 1 bps = 1 token

        # Transfer tokens from pool to claimer
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.asset_receiver: claimer,
            TxnField.asset_amount:   tokens_to_send.load(),
            TxnField.xfer_asset:     asset_id.load(),
            TxnField.fee:            Int(0),
        }),
        InnerTxnBuilder.Submit(),

        # Mark claimed in box — flip the claimed byte to 1
        # i was incremented past the match; backtrack one
        entry_off.store(entry_offset(i.load() - Int(1))),
        App.box_replace(
            bkey.load(),
            entry_off.load() + ADDR_SIZE + BPS_SIZE,
            Bytes("\x01"),
        ),

        Log(Concat(Bytes("claimed:"), Itob(tokens_to_send.load()))),
        Approve()
    )


    # ── DEPOSIT USDC ─────────────────────────
    # Args: [0]="deposit" [1]=ipId
    # Must be grouped with a USDC asset transfer to the pool address.
    # No state update needed — pool USDC balance is read directly from algod.

    on_deposit = Seq(
        Assert(Txn.group_index() > Int(0)),
        Assert(Gtxn[Txn.group_index() - Int(1)].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[Txn.group_index() - Int(1)].xfer_asset() == USDC_ASSET_ID),
        Assert(
            Gtxn[Txn.group_index() - Int(1)].asset_receiver()
            == Global.current_application_address()
        ),
        Assert(Gtxn[Txn.group_index() - Int(1)].asset_amount() > Int(0)),
        Approve()
    )


        # ── CLAIM USDC ───────────────────────────
    # Args: [0]="claim_usdc" [1]=ipId [2]=amount(uint64, microUSDC)
    # Assets: [0]=USDC asset ID  [1]=revenue token asset ID

    claim_amount = Btoi(Txn.application_args[2])

    on_claim_usdc = Seq(
        bkey.store(box_key(ip_id)),

        # Load box and extract revenue token ASA ID
        (lambda mv: Seq(
            mv,
            box_data.store(mv.value()),
        ))(App.box_get(bkey.load())),
        asset_id.store(Btoi(Extract(box_data.load(), ASSET_ID_OFFSET, Int(8)))),

        # Get caller's revenue token balance
        (lambda mv: Seq(
            mv,
            Assert(mv.hasValue()),
            user_token_balance.store(mv.value()),
        ))(AssetHolding.balance(Txn.sender(), asset_id.load())),
        Assert(user_token_balance.load() > Int(0)),

        # Get pool's USDC balance
        (lambda mv: Seq(
            mv,
            Assert(mv.hasValue()),
            pool_usdc_balance.store(mv.value()),
        ))(AssetHolding.balance(
            Global.current_application_address(), USDC_ASSET_ID
        )),
        Assert(pool_usdc_balance.load() > Int(0)),

        # Claimable = (userTokens / 10000) * poolUSDCBalance
        claimable.store(
            (pool_usdc_balance.load() * user_token_balance.load()) / TOTAL_TOKENS
        ),

        Assert(claim_amount > Int(0)),
        Assert(claim_amount <= claimable.load()),

        # Send USDC to caller
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.asset_receiver: Txn.sender(),
            TxnField.asset_amount:   claim_amount,
            TxnField.xfer_asset:     USDC_ASSET_ID,
            TxnField.fee:            Int(0),
        }),
        InnerTxnBuilder.Submit(),

        Log(Concat(Bytes("usdc_claimed:"), Itob(claim_amount))),
        Approve()
    )


    # ── OPT IN USDC ──────────────────────────
    # Args: [0]="opt_in_usdc"
    # Called once after deployment so pool can receive USDC.

    on_opt_in_usdc = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.asset_amount:   Int(0),
            TxnField.xfer_asset:     USDC_ASSET_ID,
            TxnField.fee:            Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve()
    )


    # ── DELETE ───────────────────────────────
    on_delete = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        Approve()
    )


    # ── ROUTER ───────────────────────────────
    program = Cond(
        [Txn.application_id() == Int(0),                          on_create],
        [Txn.on_completion() == OnComplete.DeleteApplication,     on_delete],
        [Txn.on_completion() == OnComplete.UpdateApplication,     Reject()],
        [Txn.on_completion() == OnComplete.CloseOut,              Approve()],
        [Txn.on_completion() == OnComplete.OptIn,                 Approve()],
        [Txn.application_args[0] == Bytes("create_pool"),         on_create_pool],
        [Txn.application_args[0] == Bytes("claim_tokens"),        on_claim_tokens],
        [Txn.application_args[0] == Bytes("deposit"),             on_deposit],
        [Txn.application_args[0] == Bytes("claim_usdc"),          on_claim_usdc],
        [Txn.application_args[0] == Bytes("opt_in_usdc"),         on_opt_in_usdc],
    )

    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    approval = compileTeal(approval_program(), mode=Mode.Application, version=8)
    with open("revenue_pool_v3_approval.teal", "w") as f:
        f.write(approval)
    print("Written: revenue_pool_v3_approval.teal")

    clear = compileTeal(clear_state_program(), mode=Mode.Application, version=8)
    with open("revenue_pool_v3_clear.teal", "w") as f:
        f.write(clear)
    print("Written: revenue_pool_v3_clear.teal")