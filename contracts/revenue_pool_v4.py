"""
Revenue Pool V4 - MetaWork
─────────────────────────────────────────────────────────────────
Global State:
  release_mode        uint64  0 = admin_only, 1 = auto (time-locked)
  release_delay_days  uint64  default 14

Box layout per pool (key = "p_" + ipId):
  [0:8]   rev_asa_id          uint64  — revenue token ASA ID
  [8:16]  total_deposited     uint64  — cumulative USDC claimable (micro-USDC)
  [16:24] total_claimed       uint64  — cumulative USDC claimed
  [24:32] held_usdc           uint64  — locked pending delivery confirmation
  [32:40] delivered_at        uint64  — unix timestamp of delivery (0 = not delivered)
  [40:41] num_stakeholders    uint8   — number of stakeholders (max 100)
  [41..]  entries             [addr(32)|bps(2)|claimed_flag(1)] x N

Instructions:
  create_pool(ipId, tokenName, unitName, packed_stakeholders)
  deposit_usdc(ipId)              — grouped with USDC axfer, immediately claimable
  deposit_held(ipId)              — grouped with USDC axfer, locked until released
  set_delivered(ipId, timestamp)  — authority only, marks delivery time
  release_held(ipId, amount)      — admin_only mode: authority only
                                    auto mode: anyone, after delivered_at + delay
  claim_revenue(ipId, user_token_balance)
  claim_tokens(ipId)
  set_release_mode(mode)          — authority only (0 or 1)
  set_release_delay(days)         — authority only
"""

from pyteal import *

USDC_ASSET_ID    = Int(10458941)   # Testnet USDC
TOTAL_TOKENS     = Int(100)        # fixed token supply per pool
MAX_STAKEHOLDERS = Int(100)
BOX_PREFIX       = Bytes("p_")
SECONDS_PER_DAY  = Int(86400)

# ── Box field offsets ────────────────────────────────────────────
REV_ASA_OFFSET      = Int(0)   # 8 bytes
TOTAL_DEP_OFFSET    = Int(8)   # 8 bytes
TOTAL_CLM_OFFSET    = Int(16)  # 8 bytes
HELD_OFFSET         = Int(24)  # 8 bytes
DELIVERED_AT_OFFSET = Int(32)  # 8 bytes  ← NEW
NUM_SH_OFFSET       = Int(40)  # 1 byte   ← shifted
ENTRIES_OFFSET      = Int(41)  # start of stakeholder array ← shifted

ENTRY_SIZE          = Int(35)  # 32 addr + 2 bps + 1 flag
ADDR_SIZE           = Int(32)
BPS_SIZE            = Int(2)

# ── Global state keys ────────────────────────────────────────────
KEY_RELEASE_MODE  = Bytes("release_mode")
KEY_RELEASE_DELAY = Bytes("release_delay_days")

DEFAULT_RELEASE_DELAY = Int(14)


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

@Subroutine(TealType.bytes)
def box_key(ip_id: Expr) -> Expr:
    return Concat(BOX_PREFIX, ip_id)


@Subroutine(TealType.uint64)
def entry_offset(index: Expr) -> Expr:
    return ENTRIES_OFFSET + (index * ENTRY_SIZE)


@Subroutine(TealType.uint64)
def read_uint64(data: Expr, offset: Expr) -> Expr:
    return Btoi(Extract(data, offset, Int(8)))

# ─────────────────────────────────────────────────────────────────
# Approval Program
# ─────────────────────────────────────────────────────────────────

def approval_program():

    ip_id    = Txn.application_args[1]
    bkey     = ScratchVar(TealType.bytes)
    box_data = ScratchVar(TealType.bytes)

    # ── ON CREATE ────────────────────────────────────────────────
    on_create = Seq(
        App.globalPut(KEY_RELEASE_MODE,  Int(0)),           # admin_only by default
        App.globalPut(KEY_RELEASE_DELAY, DEFAULT_RELEASE_DELAY),
        Approve()
    )


    # ── CREATE POOL ──────────────────────────────────────────────
    # Args: [0]="create_pool" [1]=ipId [2]=tokenName [3]=unitName
    #       [4]=packed stakeholders: [addr(32)|bps(2)] x N  (max 100)

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
        Assert(sh_bytes_len % Int(34) == Int(0)),
        n_sh.store(sh_bytes_len / Int(34)),
        Assert(n_sh.load() > Int(0)),
        Assert(n_sh.load() <= MAX_STAKEHOLDERS),

        # Validate bps sums to exactly 100
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

        # Pool must not already exist
        bkey.store(box_key(ip_id)),
        (lambda mv: Seq(mv, Assert(mv.hasValue() == Int(0))))(App.box_get(bkey.load())),

        # Opt app into USDC
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:    TxnType.AssetTransfer,
            TxnField.xfer_asset:   USDC_ASSET_ID,
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.asset_amount: Int(0),
            TxnField.fee:          Int(0),
        }),
        InnerTxnBuilder.Submit(),

        # Mint revenue token ASA
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:                   TxnType.AssetConfig,
            TxnField.config_asset_total:          TOTAL_TOKENS,
            TxnField.config_asset_decimals:       Int(0),
            TxnField.config_asset_default_frozen: Int(0),
            TxnField.config_asset_manager:        Global.current_application_address(),
            TxnField.config_asset_reserve:        Global.current_application_address(),
            TxnField.config_asset_freeze:         Global.current_application_address(),
            TxnField.config_asset_clawback:       Global.current_application_address(),
            TxnField.config_asset_name:           Txn.application_args[2],
            TxnField.config_asset_unit_name:      Txn.application_args[3],
            TxnField.fee:                         Int(0),
        }),
        InnerTxnBuilder.Submit(),
        created_id.store(InnerTxn.created_asset_id()),

        # Build box header:
        # rev_asa_id(8) | total_dep(8)=0 | total_clm(8)=0 | held(8)=0
        # delivered_at(8)=0 | num_sh(1) | entries...
        box_content.store(
            Concat(
                Itob(created_id.load()),                      # [0:8]  ASA ID
                Itob(Int(0)),                                  # [8:16] total_deposited
                Itob(Int(0)),                                  # [16:24] total_claimed
                Itob(Int(0)),                                  # [24:32] held_usdc
                Itob(Int(0)),                                  # [32:40] delivered_at
                Extract(Itob(n_sh.load()), Int(7), Int(1)),   # [40:41] num_stakeholders
            )
        ),

        # Append stakeholder entries
        loop_i.store(Int(0)),
        While(loop_i.load() < n_sh.load()).Do(
            cur_addr.store(Extract(sh_bytes, loop_i.load() * Int(34), Int(32))),
            cur_bps_bytes.store(Extract(sh_bytes, loop_i.load() * Int(34) + Int(32), Int(2))),
            box_content.store(
                Concat(
                    box_content.load(),
                    cur_addr.load(),
                    cur_bps_bytes.load(),
                    Bytes("\x00"),   # claimed flag = 0
                )
            ),
            loop_i.store(loop_i.load() + Int(1)),
        ),

        App.box_put(bkey.load(), box_content.load()),
        Log(Concat(Bytes("asset_id:"), Itob(created_id.load()))),
        Approve()
    )


    # ── DEPOSIT USDC (immediately claimable) ─────────────────────
    # Args: [0]="deposit_usdc" [1]=ipId
    # Group: Gtxn[index-1] must be a USDC axfer to app address

    deposit_amount = ScratchVar(TealType.uint64)
    old_total_dep  = ScratchVar(TealType.uint64)

    on_deposit_usdc = Seq(
        Assert(Txn.group_index() > Int(0)),
        Assert(Gtxn[Txn.group_index() - Int(1)].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[Txn.group_index() - Int(1)].xfer_asset() == USDC_ASSET_ID),
        Assert(Gtxn[Txn.group_index() - Int(1)].asset_receiver() == Global.current_application_address()),
        deposit_amount.store(Gtxn[Txn.group_index() - Int(1)].asset_amount()),
        Assert(deposit_amount.load() > Int(0)),

        bkey.store(box_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        old_total_dep.store(read_uint64(box_data.load(), TOTAL_DEP_OFFSET)),
        App.box_replace(bkey.load(), TOTAL_DEP_OFFSET,
            Itob(old_total_dep.load() + deposit_amount.load())),

        Log(Concat(Bytes("deposited:"), Itob(deposit_amount.load()))),
        Approve()
    )


    # ── DEPOSIT HELD (locked until delivered + released) ─────────
    # Args: [0]="deposit_held" [1]=ipId
    # Group: Gtxn[index-1] must be a USDC axfer to app address
    # Authority only

    held_amount = ScratchVar(TealType.uint64)
    old_held    = ScratchVar(TealType.uint64)

    on_deposit_held = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        Assert(Txn.group_index() > Int(0)),
        Assert(Gtxn[Txn.group_index() - Int(1)].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[Txn.group_index() - Int(1)].xfer_asset() == USDC_ASSET_ID),
        Assert(Gtxn[Txn.group_index() - Int(1)].asset_receiver() == Global.current_application_address()),
        held_amount.store(Gtxn[Txn.group_index() - Int(1)].asset_amount()),
        Assert(held_amount.load() > Int(0)),

        bkey.store(box_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        old_held.store(read_uint64(box_data.load(), HELD_OFFSET)),
        App.box_replace(bkey.load(), HELD_OFFSET,
            Itob(old_held.load() + held_amount.load())),

        Log(Concat(Bytes("held:"), Itob(held_amount.load()))),
        Approve()
    )


    # ── SET DELIVERED ─────────────────────────────────────────────
    # Args: [0]="set_delivered" [1]=ipId [2]=unix_timestamp (uint64)
    # Authority only. Called by cron when Printful confirms delivered.
    # Can only be set once (delivered_at must be 0).

    ts = ScratchVar(TealType.uint64)

    on_set_delivered = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        ts.store(Btoi(Txn.application_args[2])),
        Assert(ts.load() > Int(0)),

        bkey.store(box_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        # Only set once
        Assert(read_uint64(box_data.load(), DELIVERED_AT_OFFSET) == Int(0)),

        App.box_replace(bkey.load(), DELIVERED_AT_OFFSET, Itob(ts.load())),

        Log(Concat(Bytes("delivered_at:"), Itob(ts.load()))),
        Approve()
    )


    # ── RELEASE HELD ─────────────────────────────────────────────
    # Args: [0]="release_held" [1]=ipId [2]=amount (uint64)
    #
    # release_mode == 0 (admin_only):
    #   - Only authority (creator) can call
    #   - No time check
    #
    # release_mode == 1 (auto):
    #   - Anyone can call
    #   - delivered_at must be set
    #   - now >= delivered_at + (release_delay_days * SECONDS_PER_DAY)

    release_amount = ScratchVar(TealType.uint64)
    cur_held       = ScratchVar(TealType.uint64)
    cur_total_dep  = ScratchVar(TealType.uint64)
    delivered_at   = ScratchVar(TealType.uint64)
    release_mode   = ScratchVar(TealType.uint64)
    delay_days     = ScratchVar(TealType.uint64)

    on_release_held = Seq(
        release_amount.store(Btoi(Txn.application_args[2])),
        Assert(release_amount.load() > Int(0)),

        release_mode.store(App.globalGet(KEY_RELEASE_MODE)),
        delay_days.store(App.globalGet(KEY_RELEASE_DELAY)),

        bkey.store(box_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        cur_held.store(read_uint64(box_data.load(), HELD_OFFSET)),
        cur_total_dep.store(read_uint64(box_data.load(), TOTAL_DEP_OFFSET)),
        delivered_at.store(read_uint64(box_data.load(), DELIVERED_AT_OFFSET)),

        Assert(release_amount.load() <= cur_held.load()),

        # Mode gate
        If(release_mode.load() == Int(0))
        .Then(
            # Admin only — must be authority
            Assert(Txn.sender() == Global.creator_address())
        )
        .Else(
            # Auto — delivered_at must be set and delay must have passed
            Assert(delivered_at.load() > Int(0)),
            Assert(
                Global.latest_timestamp() >=
                delivered_at.load() + (delay_days.load() * SECONDS_PER_DAY)
            )
        ),

        # Move held → total_deposited (now claimable)
        App.box_replace(bkey.load(), HELD_OFFSET,
            Itob(cur_held.load() - release_amount.load())),
        App.box_replace(bkey.load(), TOTAL_DEP_OFFSET,
            Itob(cur_total_dep.load() + release_amount.load())),

        Log(Concat(Bytes("released_v4:"), Itob(release_amount.load()))),
        Approve()
    )


    # ── CLAIM REVENUE ─────────────────────────────────────────────
    # Args: [0]="claim_revenue" [1]=ipId [2]=user_token_balance (uint64)
    # Proportional USDC payout: (pool_balance * user_tokens) / TOTAL_TOKENS

    claimer        = Txn.sender()
    user_tokens    = ScratchVar(TealType.uint64)
    pool_claimable = ScratchVar(TealType.uint64)
    total_dep      = ScratchVar(TealType.uint64)
    total_clm      = ScratchVar(TealType.uint64)
    usdc_to_send   = ScratchVar(TealType.uint64)
    rev_asa_id     = ScratchVar(TealType.uint64)

    on_claim_revenue = Seq(
        user_tokens.store(Btoi(Txn.application_args[2])),
        Assert(user_tokens.load() > Int(0)),
        Assert(user_tokens.load() <= TOTAL_TOKENS),

        bkey.store(box_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        rev_asa_id.store(read_uint64(box_data.load(), REV_ASA_OFFSET)),
        total_dep.store(read_uint64(box_data.load(), TOTAL_DEP_OFFSET)),
        total_clm.store(read_uint64(box_data.load(), TOTAL_CLM_OFFSET)),

        pool_claimable.store(total_dep.load() - total_clm.load()),
        Assert(pool_claimable.load() > Int(0)),

        usdc_to_send.store(
            (pool_claimable.load() * user_tokens.load()) / TOTAL_TOKENS
        ),
        Assert(usdc_to_send.load() > Int(0)),

        # Verify caller actually holds the tokens they claim
        (lambda bal: Seq(
            bal,
            Assert(bal.hasValue()),
            Assert(bal.value() >= user_tokens.load()),
        ))(AssetHolding.balance(claimer, rev_asa_id.load())),

        # Send USDC
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.xfer_asset:     USDC_ASSET_ID,
            TxnField.asset_receiver: claimer,
            TxnField.asset_amount:   usdc_to_send.load(),
            TxnField.fee:            Int(0),
        }),
        InnerTxnBuilder.Submit(),

        # Update total_claimed
        App.box_replace(bkey.load(), TOTAL_CLM_OFFSET,
            Itob(total_clm.load() + usdc_to_send.load())),

        Log(Concat(Bytes("claimed_usdc:"), Itob(usdc_to_send.load()))),
        Approve()
    )


    # ── CLAIM TOKENS ──────────────────────────────────────────────
    # Args: [0]="claim_tokens" [1]=ipId
    # Transfers caller's allocated revenue tokens from app to wallet.
    # Can only be claimed once per stakeholder (flag = 0 → 1).

    num_stakeholders = ScratchVar(TealType.uint64)
    i                = ScratchVar(TealType.uint64)
    e_off            = ScratchVar(TealType.uint64)
    found            = ScratchVar(TealType.uint64)
    claimer_bps      = ScratchVar(TealType.uint64)
    tokens_to_send   = ScratchVar(TealType.uint64)
    token_asa_id     = ScratchVar(TealType.uint64)

    on_claim_tokens = Seq(
        bkey.store(box_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        token_asa_id.store(read_uint64(box_data.load(), REV_ASA_OFFSET)),
        num_stakeholders.store(Btoi(Extract(box_data.load(), NUM_SH_OFFSET, Int(1)))),

        found.store(Int(0)),
        claimer_bps.store(Int(0)),
        i.store(Int(0)),
        While(And(i.load() < num_stakeholders.load(), found.load() == Int(0))).Do(
            e_off.store(entry_offset(i.load())),
            If(Extract(box_data.load(), e_off.load(), ADDR_SIZE) == Txn.sender()).Then(
                # Must not have claimed tokens yet
                Assert(
                    Btoi(Extract(box_data.load(),
                        e_off.load() + ADDR_SIZE + BPS_SIZE, Int(1))) == Int(0)
                ),
                claimer_bps.store(
                    Btoi(Extract(box_data.load(), e_off.load() + ADDR_SIZE, BPS_SIZE))
                ),
                found.store(Int(1)),
            ),
            i.store(i.load() + Int(1)),
        ),
        Assert(found.load() == Int(1)),
        Assert(claimer_bps.load() > Int(0)),

        tokens_to_send.store(claimer_bps.load()),

        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.asset_receiver: Txn.sender(),
            TxnField.asset_amount:   tokens_to_send.load(),
            TxnField.xfer_asset:     token_asa_id.load(),
            TxnField.fee:            Int(0),
        }),
        InnerTxnBuilder.Submit(),

        # Mark tokens as claimed for this stakeholder
        e_off.store(entry_offset(i.load() - Int(1))),
        App.box_replace(bkey.load(),
            e_off.load() + ADDR_SIZE + BPS_SIZE,
            Bytes("\x01")),

        Log(Concat(Bytes("tokens_claimed:"), Itob(tokens_to_send.load()))),
        Approve()
    )


    # ── SET RELEASE MODE ─────────────────────────────────────────
    # Args: [0]="set_release_mode" [1]=mode (0 or 1 as uint64)
    # Authority only. Flips between admin (0) and automated (1)
    # without redeploying the contract.

    new_mode = ScratchVar(TealType.uint64)

    on_set_release_mode = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        new_mode.store(Btoi(Txn.application_args[1])),
        Assert(Or(new_mode.load() == Int(0), new_mode.load() == Int(1))),
        App.globalPut(KEY_RELEASE_MODE, new_mode.load()),
        Log(Concat(Bytes("release_mode:"), Itob(new_mode.load()))),
        Approve()
    )


    # ── SET RELEASE DELAY ─────────────────────────────────────────
    # Args: [0]="set_release_delay" [1]=days (uint64)
    # Authority only.

    new_delay = ScratchVar(TealType.uint64)

    on_set_release_delay = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        new_delay.store(Btoi(Txn.application_args[1])),
        Assert(new_delay.load() > Int(0)),
        App.globalPut(KEY_RELEASE_DELAY, new_delay.load()),
        Log(Concat(Bytes("release_delay_days:"), Itob(new_delay.load()))),
        Approve()
    )


    # ── ROUTER ───────────────────────────────────────────────────
    action = Txn.application_args[0]

    program = Cond(
        [Txn.application_id() == Int(0),                 on_create],
        [action == Bytes("create_pool"),                 on_create_pool],
        [action == Bytes("deposit_usdc"),                on_deposit_usdc],
        [action == Bytes("deposit_held"),                on_deposit_held],
        [action == Bytes("set_delivered"),               on_set_delivered],
        [action == Bytes("release_held"),                on_release_held],
        [action == Bytes("claim_revenue"),               on_claim_revenue],
        [action == Bytes("claim_tokens"),                on_claim_tokens],
        [action == Bytes("set_release_mode"),            on_set_release_mode],
        [action == Bytes("set_release_delay"),           on_set_release_delay],
    )

    return program


def clear_program():
    return Approve()


# ─────────────────────────────────────────────────────────────────
# Compile
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os
    from pyteal import compileTeal, Mode

    approval = compileTeal(approval_program(), mode=Mode.Application, version=9)
    clear    = compileTeal(clear_program(),    mode=Mode.Application, version=9)

    out_dir = os.path.dirname(os.path.abspath(__file__))

    with open(os.path.join(out_dir, "revenue_pool_v4_approval.teal"), "w") as f:
        f.write(approval)
    with open(os.path.join(out_dir, "revenue_pool_v4_clear.teal"), "w") as f:
        f.write(clear)

    print("Written: revenue_pool_v4_approval.teal")
    print("Written: revenue_pool_v4_clear.teal")