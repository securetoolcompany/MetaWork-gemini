"""
Revenue Pool V5 - MetaWork
─────────────────────────────────────────────────────────────────
WHAT CHANGED FROM V4:
  - Replaced live-balance claim_revenue with snapshot payout rounds.
  - Removed delivered_at / set_delivered / release_mode / release_delay.
    (Delivery confirmation + release timing is handled off-chain by cron.)
  - Added per-IP holder registry (sync screen).
  - Added per-round entitlements blobs (snapshot-round model).
  - Holder at release time owns that round forever; trade tokens freely.

Global State:
  (none — all per-pool config now stored in pool box header)

Box layout — POOL BOX (key = "p_" + ipId):
  [0:8]    rev_asa_id          uint64
  [8:16]   total_deposited     uint64  cumulative USDC released into rounds
  [16:24]  total_claimed       uint64  cumulative USDC paid out
  [24:32]  held_usdc           uint64  locked, not yet in any round
  [32:40]  current_round_id    uint64  last created round (0 = no rounds yet)
  [40:41]  snapshot_freq       uint8   0=per-release 1=daily 2=manual
  [41:49]  last_snapshot_day   uint64  unix day of last snapshot (for daily mode)
  [49:50]  num_stakeholders    uint8
  [50..]   entries             [addr(32)|bps(2)|claimed_flag(1)] x N

Box layout — REGISTRY BOX (key = "reg_" + ipId):
  [0:2]    num_holders         uint16
  [2..]    addresses           [addr(32)] x N   (max MAX_HOLDERS)

Box layout — ROUND BOX (key = "rnd_" + ipId + uint64(roundId)):
  [0:8]    round_amount        uint64   USDC in this round (micro-USDC)
  [8:16]   round_created_at    uint64   unix timestamp
  [16:18]  num_entries         uint16
  [18..]   entries             [addr(32)|payout(8)|claimed(1)] x N

Methods:
  create_pool(ipId, tokenName, unitName, packed_stakeholders)
  deposit_usdc(ipId)               — grouped axfer, immediately to total_deposited
  deposit_held(ipId)               — grouped axfer, to held_usdc (authority only)
  release_held(ipId, amount)       — authority only; moves held→deposited + snapshot
  sync_holder(ipId)                — registers caller in holder registry
  set_snapshot_freq(ipId, mode)    — authority only (0/1/2)
  create_payout_round(ipId)        — authority only, manual snapshot (mode 2)
  claim_revenue_round(ipId, round_id)
  claim_revenue_all(ipId, from_round, max_rounds)
  claim_tokens(ipId)               — unchanged: one-time stakeholder token distribution
"""

from pyteal import *

USDC_ASSET_ID    = Int(10458941)   # Testnet USDC
TOTAL_TOKENS     = Int(100)
MAX_STAKEHOLDERS = Int(100)
MAX_HOLDERS      = Int(100)        # max addresses in the holder registry per IP
MAX_HOLDERS_PY   = 100
BOX_PREFIX       = Bytes("p_")
REG_PREFIX       = Bytes("reg_")
RND_PREFIX       = Bytes("rnd_")

# ── Pool box field offsets ───────────────────────────────────────
REV_ASA_OFFSET       = Int(0)    # 8 bytes
TOTAL_DEP_OFFSET     = Int(8)    # 8 bytes
TOTAL_CLM_OFFSET     = Int(16)   # 8 bytes
HELD_OFFSET          = Int(24)   # 8 bytes
CUR_ROUND_OFFSET     = Int(32)   # 8 bytes  (current_round_id)
SNAP_FREQ_OFFSET     = Int(40)   # 1 byte   (snapshot_freq)
LAST_SNAP_DAY_OFFSET = Int(41)   # 8 bytes  (last_snapshot_day)
NUM_SH_OFFSET        = Int(49)   # 1 byte
ENTRIES_OFFSET       = Int(50)   # start of stakeholder array

ENTRY_SIZE           = Int(35)   # 32 addr + 2 bps + 1 flag
ADDR_SIZE            = Int(32)
BPS_SIZE             = Int(2)

# ── Registry box offsets ─────────────────────────────────────────
REG_NUM_OFFSET  = Int(0)   # 2 bytes (uint16)
REG_ADDR_OFFSET = Int(2)   # 32 bytes per address

# ── Round box offsets ────────────────────────────────────────────
RND_AMOUNT_OFFSET    = Int(0)    # 8 bytes
RND_CREATED_OFFSET   = Int(8)    # 8 bytes
RND_NENTRIES_OFFSET  = Int(16)   # 2 bytes
RND_ENTRIES_OFFSET   = Int(18)   # [addr(32)|payout(8)|claimed(1)] x N

RND_ENTRY_SIZE       = Int(41)   # 32 + 8 + 1
RND_PAYOUT_OFF       = Int(32)   # offset within a round entry
RND_CLAIMED_OFF      = Int(40)   # offset within a round entry


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

@Subroutine(TealType.bytes)
def pool_key(ip_id: Expr) -> Expr:
    return Concat(BOX_PREFIX, ip_id)

@Subroutine(TealType.bytes)
def reg_key(ip_id: Expr) -> Expr:
    return Concat(REG_PREFIX, ip_id)

@Subroutine(TealType.bytes)
def round_key(ip_id: Expr, round_id: Expr) -> Expr:
    return Concat(RND_PREFIX, ip_id, Itob(round_id))

@Subroutine(TealType.uint64)
def entry_offset(index: Expr) -> Expr:
    return ENTRIES_OFFSET + (index * ENTRY_SIZE)

@Subroutine(TealType.uint64)
def read_uint64(data: Expr, offset: Expr) -> Expr:
    return Btoi(Extract(data, offset, Int(8)))

@Subroutine(TealType.uint64)
def read_uint16(data: Expr, offset: Expr) -> Expr:
    return Btoi(Extract(data, offset, Int(2)))


# ─────────────────────────────────────────────────────────────────
# Approval Program
# ─────────────────────────────────────────────────────────────────

def approval_program():

    ip_id    = Txn.application_args[1]
    bkey     = ScratchVar(TealType.bytes)
    box_data = ScratchVar(TealType.bytes)

    # ── ON CREATE ────────────────────────────────────────────────
    on_create = Seq(
        Approve()
    )


    # ── CREATE POOL ──────────────────────────────────────────────
    # Args: [0]="create_pool" [1]=ipId [2]=tokenName [3]=unitName
    #       [4]=packed stakeholders: [addr(32)|bps(2)] x N

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

        bkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, Assert(mv.hasValue() == Int(0))))(App.box_get(bkey.load())),

        # Opt app into USDC
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.xfer_asset:     USDC_ASSET_ID,
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.asset_amount:   Int(0),
            TxnField.fee:            Int(0),
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

        # Build pool box header (v5: added current_round_id, snap_freq, last_snap_day)
        box_content.store(
            Concat(
                Itob(created_id.load()),                      # [0:8]   rev_asa_id
                Itob(Int(0)),                                  # [8:16]  total_deposited
                Itob(Int(0)),                                  # [16:24] total_claimed
                Itob(Int(0)),                                  # [24:32] held_usdc
                Itob(Int(0)),                                  # [32:40] current_round_id
                Extract(Itob(Int(0)), Int(7), Int(1)),         # [40:41] snapshot_freq = 0
                Itob(Int(0)),                                  # [41:49] last_snapshot_day
                Extract(Itob(n_sh.load()), Int(7), Int(1)),   # [49:50] num_stakeholders
            )
        ),

        loop_i.store(Int(0)),
        While(loop_i.load() < n_sh.load()).Do(
            cur_addr.store(Extract(sh_bytes, loop_i.load() * Int(34), Int(32))),
            cur_bps_bytes.store(Extract(sh_bytes, loop_i.load() * Int(34) + Int(32), Int(2))),
            box_content.store(
                Concat(
                    box_content.load(),
                    cur_addr.load(),
                    cur_bps_bytes.load(),
                    Bytes("\x00"),
                )
            ),
            loop_i.store(loop_i.load() + Int(1)),
        ),

        App.box_put(bkey.load(), box_content.load()),

      App.box_put(
        reg_key(ip_id),
        Bytes(b"\x00" * (2 + 32 * 100)),
    ),

        Log(Concat(Bytes("asset_id:"), Itob(created_id.load()))),
        Approve()
    )


    # ── DEPOSIT USDC (immediately claimable / into next round) ───
    # Args: [0]="deposit_usdc" [1]=ipId
    # Group: Gtxn[index-1] is a USDC axfer to app address

    deposit_amount = ScratchVar(TealType.uint64)
    old_total_dep  = ScratchVar(TealType.uint64)

    on_deposit_usdc = Seq(
        Assert(Txn.group_index() > Int(0)),
        Assert(Gtxn[Txn.group_index() - Int(1)].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[Txn.group_index() - Int(1)].xfer_asset() == USDC_ASSET_ID),
        Assert(Gtxn[Txn.group_index() - Int(1)].asset_receiver() == Global.current_application_address()),
        deposit_amount.store(Gtxn[Txn.group_index() - Int(1)].asset_amount()),
        Assert(deposit_amount.load() > Int(0)),

        bkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        old_total_dep.store(read_uint64(box_data.load(), TOTAL_DEP_OFFSET)),
        App.box_replace(bkey.load(), TOTAL_DEP_OFFSET,
            Itob(old_total_dep.load() + deposit_amount.load())),

        Log(Concat(Bytes("deposited:"), Itob(deposit_amount.load()))),
        Approve()
    )


    # ── DEPOSIT HELD ─────────────────────────────────────────────
    # Args: [0]="deposit_held" [1]=ipId
    # Group: Gtxn[index-1] is a USDC axfer to app address
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

        bkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        old_held.store(read_uint64(box_data.load(), HELD_OFFSET)),
        App.box_replace(bkey.load(), HELD_OFFSET,
            Itob(old_held.load() + held_amount.load())),

        Log(Concat(Bytes("held:"), Itob(held_amount.load()))),
        Approve()
    )


    # ── SYNC HOLDER ───────────────────────────────────────────────
    # Args: [0]="sync_holder" [1]=ipId
    # Registers caller in the IP's holder registry.
    # Caller must hold > 0 revenue tokens for this IP.
    # Idempotent: calling twice is a no-op (still succeeds).

    reg_data     = ScratchVar(TealType.bytes)
    rkey         = ScratchVar(TealType.bytes)
    num_holders  = ScratchVar(TealType.uint64)
    sync_i       = ScratchVar(TealType.uint64)
    already_in   = ScratchVar(TealType.uint64)
    sync_asa_id  = ScratchVar(TealType.uint64)

    on_sync_holder = Seq(
        bkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),
        sync_asa_id.store(read_uint64(box_data.load(), REV_ASA_OFFSET)),

        # Verify caller holds tokens
        (lambda bal: Seq(
            bal,
            Assert(bal.hasValue()),
            Assert(bal.value() > Int(0)),
        ))(AssetHolding.balance(Txn.sender(), sync_asa_id.load())),

        rkey.store(reg_key(ip_id)),
        (lambda mv: Seq(mv, reg_data.store(mv.value())))(App.box_get(rkey.load())),

        num_holders.store(read_uint16(reg_data.load(), REG_NUM_OFFSET)),

        # Scan to see if already registered
        already_in.store(Int(0)),
        sync_i.store(Int(0)),
        While(And(sync_i.load() < num_holders.load(), already_in.load() == Int(0))).Do(
            If(
                Extract(reg_data.load(),
                    REG_ADDR_OFFSET + sync_i.load() * ADDR_SIZE,
                    ADDR_SIZE) == Txn.sender()
            ).Then(
                already_in.store(Int(1)),
            ),
            sync_i.store(sync_i.load() + Int(1)),
        ),

        If(already_in.load() == Int(0)).Then(
            # Enforce cap
            Assert(num_holders.load() < MAX_HOLDERS),
            # Append address
            App.box_replace(
                rkey.load(),
                REG_ADDR_OFFSET + num_holders.load() * ADDR_SIZE,
                Txn.sender(),
            ),
            # Increment num_holders (write as uint16: 2 bytes)
            App.box_replace(
                rkey.load(),
                REG_NUM_OFFSET,
                Extract(Itob(num_holders.load() + Int(1)), Int(6), Int(2)),
            ),
        ),

        Log(Bytes("synced")),
        Approve()
    )


    # ── SET SNAPSHOT FREQUENCY ───────────────────────────────────
    # Args: [0]="set_snapshot_freq" [1]=ipId [2]=mode (0/1/2)
    # Authority only.
    # 0 = per-release (default)
    # 1 = daily (one round per calendar day)
    # 2 = manual (only create_payout_round triggers a snapshot)

    snap_mode = ScratchVar(TealType.uint64)

    on_set_snapshot_freq = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        snap_mode.store(Btoi(Txn.application_args[2])),
        Assert(snap_mode.load() <= Int(2)),

        bkey.store(pool_key(ip_id)),
        App.box_replace(bkey.load(), SNAP_FREQ_OFFSET,
            Extract(Itob(snap_mode.load()), Int(7), Int(1))),

        Log(Concat(Bytes("snap_freq:"), Itob(snap_mode.load()))),
        Approve()
    )


    # ── INTERNAL: DO SNAPSHOT ────────────────────────────────────
    # Shared logic used by release_held and create_payout_round.
    # Takes: ip_id, amount to round, current box_data already loaded.
    # Returns round_id created.
    #
    # Because PyTeal subroutines can't easily share many scratch vars,
    # we inline the snapshot logic as a helper Seq block.
    # Called with snap_amount already set.

    snap_amount     = ScratchVar(TealType.uint64)
    snap_round_id   = ScratchVar(TealType.uint64)
    snap_reg_data   = ScratchVar(TealType.bytes)
    snap_n_holders  = ScratchVar(TealType.uint64)
    snap_i          = ScratchVar(TealType.uint64)
    snap_holder_addr= ScratchVar(TealType.bytes)
    snap_bal        = ScratchVar(TealType.uint64)
    snap_payout     = ScratchVar(TealType.uint64)
    snap_rnd_key    = ScratchVar(TealType.bytes)
    snap_rnd_content= ScratchVar(TealType.bytes)
    snap_entry_count= ScratchVar(TealType.uint64)
    snap_asa_id     = ScratchVar(TealType.uint64)
    snap_cur_round  = ScratchVar(TealType.uint64)

    def do_snapshot(ip_id_expr, amount_expr):
        return Seq(
            snap_amount.store(amount_expr),

            # Reload pool box (may have just been written by release_held)
            bkey.store(pool_key(ip_id_expr)),
            (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

            snap_asa_id.store(read_uint64(box_data.load(), REV_ASA_OFFSET)),
            snap_cur_round.store(read_uint64(box_data.load(), CUR_ROUND_OFFSET)),

            # Increment round_id
            snap_round_id.store(snap_cur_round.load() + Int(1)),
            App.box_replace(bkey.load(), CUR_ROUND_OFFSET, Itob(snap_round_id.load())),

            # Update last_snapshot_day
            App.box_replace(bkey.load(), LAST_SNAP_DAY_OFFSET,
                Itob(Global.latest_timestamp() / Int(86400))),

            # Load holder registry
            snap_reg_data.store(
                (lambda mv: Seq(mv, mv.value()))(App.box_get(reg_key(ip_id_expr)))
            ),
            snap_n_holders.store(read_uint16(snap_reg_data.load(), REG_NUM_OFFSET)),

            # Build round box content
            snap_rnd_key.store(round_key(ip_id_expr, snap_round_id.load())),
            # Header: round_amount(8) | created_at(8) | num_entries(2)
            snap_rnd_content.store(
                Concat(
                    Itob(snap_amount.load()),
                    Itob(Global.latest_timestamp()),
                    Bytes("\x00\x00"),  # num_entries placeholder (updated at end)
                )
            ),

            snap_entry_count.store(Int(0)),
            snap_i.store(Int(0)),
            While(snap_i.load() < snap_n_holders.load()).Do(
                snap_holder_addr.store(
                    Extract(snap_reg_data.load(),
                        REG_ADDR_OFFSET + snap_i.load() * ADDR_SIZE,
                        ADDR_SIZE)
                ),
                # Read their current token balance
                (lambda bal: Seq(
                    bal,
                    If(And(bal.hasValue(), bal.value() > Int(0))).Then(
                        snap_bal.store(bal.value()),
                        snap_payout.store(
                            (snap_amount.load() * snap_bal.load()) / TOTAL_TOKENS
                        ),
                        If(snap_payout.load() > Int(0)).Then(
                            snap_rnd_content.store(
                                Concat(
                                    snap_rnd_content.load(),
                                    snap_holder_addr.load(),
                                    Itob(snap_payout.load()),
                                    Bytes("\x00"),  # claimed = 0
                                )
                            ),
                            snap_entry_count.store(snap_entry_count.load() + Int(1)),
                        ),
                    ),
                ))(AssetHolding.balance(snap_holder_addr.load(), snap_asa_id.load())),

                snap_i.store(snap_i.load() + Int(1)),
            ),

            # Patch num_entries (bytes 16:18) in the round content
            # We replace the placeholder \x00\x00 at offset 16
            snap_rnd_content.store(
                Concat(
                    Extract(snap_rnd_content.load(), Int(0), Int(16)),
                    Extract(Itob(snap_entry_count.load()), Int(6), Int(2)),
                    Extract(snap_rnd_content.load(), Int(18),
                        Len(snap_rnd_content.load()) - Int(18)),
                )
            ),

            # Write the round box
            App.box_put(snap_rnd_key.load(), snap_rnd_content.load()),

            Log(Concat(Bytes("round_created:"), Itob(snap_round_id.load()))),
        )


    # ── RELEASE HELD ─────────────────────────────────────────────
    # Args: [0]="release_held" [1]=ipId [2]=amount (uint64)
    # Authority only. Moves held → total_deposited.
    # Triggers a snapshot round based on snapshot_freq:
    #   0 = per-release: always create a round
    #   1 = daily: create a round only if today > last_snapshot_day
    #   2 = manual: no auto-round (use create_payout_round instead)

    release_amount  = ScratchVar(TealType.uint64)
    cur_held        = ScratchVar(TealType.uint64)
    cur_total_dep   = ScratchVar(TealType.uint64)
    snap_freq_val   = ScratchVar(TealType.uint64)
    last_snap_day   = ScratchVar(TealType.uint64)
    today           = ScratchVar(TealType.uint64)

    on_release_held = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        release_amount.store(Btoi(Txn.application_args[2])),
        Assert(release_amount.load() > Int(0)),

        bkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        cur_held.store(read_uint64(box_data.load(), HELD_OFFSET)),
        cur_total_dep.store(read_uint64(box_data.load(), TOTAL_DEP_OFFSET)),
        snap_freq_val.store(Btoi(Extract(box_data.load(), SNAP_FREQ_OFFSET, Int(1)))),
        last_snap_day.store(read_uint64(box_data.load(), LAST_SNAP_DAY_OFFSET)),

        Assert(release_amount.load() <= cur_held.load()),

        # Move held → total_deposited
        App.box_replace(bkey.load(), HELD_OFFSET,
            Itob(cur_held.load() - release_amount.load())),
        App.box_replace(bkey.load(), TOTAL_DEP_OFFSET,
            Itob(cur_total_dep.load() + release_amount.load())),

        # Snapshot logic
        today.store(Global.latest_timestamp() / Int(86400)),
        If(snap_freq_val.load() == Int(0))
        .Then(
            # per-release: always snapshot
            do_snapshot(ip_id, release_amount.load()),
        )
        .ElseIf(snap_freq_val.load() == Int(1))
        .Then(
            # daily: only if a new day
            If(today.load() > last_snap_day.load()).Then(
                do_snapshot(ip_id, release_amount.load()),
            ),
        ),
        # mode 2 = manual: no auto snapshot

        Log(Concat(Bytes("released_v5:"), Itob(release_amount.load()))),
        Approve()
    )


    # ── CREATE PAYOUT ROUND (manual snapshot) ────────────────────
    # Args: [0]="create_payout_round" [1]=ipId [2]=amount (uint64)
    # Authority only. Triggers a snapshot for the given amount.
    # Intended for use when snapshot_freq = 2 (manual).
    # amount must be <= total_deposited (represents a batch to distribute).

    cpr_amount    = ScratchVar(TealType.uint64)
    cpr_total_dep = ScratchVar(TealType.uint64)

    on_create_payout_round = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        cpr_amount.store(Btoi(Txn.application_args[2])),
        Assert(cpr_amount.load() > Int(0)),

        bkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),
        cpr_total_dep.store(read_uint64(box_data.load(), TOTAL_DEP_OFFSET)),
        Assert(cpr_amount.load() <= cpr_total_dep.load()),

        do_snapshot(ip_id, cpr_amount.load()),

        Approve()
    )


    # ── CLAIM REVENUE ROUND ──────────────────────────────────────
    # Args: [0]="claim_revenue_round" [1]=ipId [2]=round_id (uint64)
    # Caller claims their entitlement from one specific payout round.
    # Wallet address is the key; no need to hold tokens at claim time.

    crr_round_id  = ScratchVar(TealType.uint64)
    crr_rnd_key   = ScratchVar(TealType.bytes)
    crr_rnd_data  = ScratchVar(TealType.bytes)
    crr_n_entries = ScratchVar(TealType.uint64)
    crr_i         = ScratchVar(TealType.uint64)
    crr_found     = ScratchVar(TealType.uint64)
    crr_payout    = ScratchVar(TealType.uint64)
    crr_entry_off = ScratchVar(TealType.uint64)
    crr_total_clm = ScratchVar(TealType.uint64)
    crr_asa_id    = ScratchVar(TealType.uint64)

    on_claim_revenue_round = Seq(
        crr_round_id.store(Btoi(Txn.application_args[2])),
        Assert(crr_round_id.load() > Int(0)),

        bkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),
        crr_asa_id.store(read_uint64(box_data.load(), REV_ASA_OFFSET)),
        crr_total_clm.store(read_uint64(box_data.load(), TOTAL_CLM_OFFSET)),

        # Validate round exists and is within range
        Assert(crr_round_id.load() <= read_uint64(box_data.load(), CUR_ROUND_OFFSET)),

        crr_rnd_key.store(round_key(ip_id, crr_round_id.load())),
        (lambda mv: Seq(mv, crr_rnd_data.store(mv.value())))(App.box_get(crr_rnd_key.load())),

        crr_n_entries.store(read_uint16(crr_rnd_data.load(), RND_NENTRIES_OFFSET)),

        # Scan round entries for caller
        crr_found.store(Int(0)),
        crr_payout.store(Int(0)),
        crr_entry_off.store(Int(0)),
        crr_i.store(Int(0)),
        While(And(crr_i.load() < crr_n_entries.load(), crr_found.load() == Int(0))).Do(
            crr_entry_off.store(RND_ENTRIES_OFFSET + crr_i.load() * RND_ENTRY_SIZE),
            If(Extract(crr_rnd_data.load(), crr_entry_off.load(), ADDR_SIZE) == Txn.sender()).Then(
                crr_found.store(Int(1)),
                crr_payout.store(
                    read_uint64(crr_rnd_data.load(), crr_entry_off.load() + RND_PAYOUT_OFF)
                ),
                # Check not already claimed
                Assert(
                    Btoi(Extract(crr_rnd_data.load(),
                        crr_entry_off.load() + RND_CLAIMED_OFF, Int(1))) == Int(0)
                ),
            ),
            crr_i.store(crr_i.load() + Int(1)),
        ),

        Assert(crr_found.load() == Int(1)),
        Assert(crr_payout.load() > Int(0)),

        # Send USDC
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.xfer_asset:     USDC_ASSET_ID,
            TxnField.asset_receiver: Txn.sender(),
            TxnField.asset_amount:   crr_payout.load(),
            TxnField.fee:            Int(0),
        }),
        InnerTxnBuilder.Submit(),

        # Mark claimed in round box
        App.box_replace(
            crr_rnd_key.load(),
            crr_entry_off.load() + RND_CLAIMED_OFF,
            Bytes("\x01"),
        ),

        # Update pool total_claimed
        App.box_replace(bkey.load(), TOTAL_CLM_OFFSET,
            Itob(crr_total_clm.load() + crr_payout.load())),

        Log(Concat(Bytes("claimed_round:"), Itob(crr_round_id.load()),
                   Bytes(":"), Itob(crr_payout.load()))),
        Approve()
    )


    # ── CLAIM REVENUE ALL ────────────────────────────────────────
    # Args: [0]="claim_revenue_all" [1]=ipId
    #       [2]=from_round (uint64, inclusive)
    #       [3]=max_rounds (uint64, how many to try, e.g. 10)
    # Iterates rounds from_round..from_round+max_rounds-1 and pays any
    # unclaimed entitlements for the caller.
    # Caller loops this method (incrementing from_round) until done.

    cra_from      = ScratchVar(TealType.uint64)
    cra_max       = ScratchVar(TealType.uint64)
    cra_cur_round = ScratchVar(TealType.uint64)
    cra_r         = ScratchVar(TealType.uint64)
    cra_rnd_key   = ScratchVar(TealType.bytes)
    cra_rnd_data  = ScratchVar(TealType.bytes)
    cra_n_entries = ScratchVar(TealType.uint64)
    cra_j         = ScratchVar(TealType.uint64)
    cra_found     = ScratchVar(TealType.uint64)
    cra_payout    = ScratchVar(TealType.uint64)
    cra_entry_off = ScratchVar(TealType.uint64)
    cra_total_clm = ScratchVar(TealType.uint64)
    cra_total_pay = ScratchVar(TealType.uint64)

    on_claim_revenue_all = Seq(
        cra_from.store(Btoi(Txn.application_args[2])),
        cra_max.store(Btoi(Txn.application_args[3])),
        Assert(cra_from.load() > Int(0)),
        Assert(cra_max.load() > Int(0)),
        Assert(cra_max.load() <= Int(20)),  # safety cap per call

        bkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),
        cra_cur_round.store(read_uint64(box_data.load(), CUR_ROUND_OFFSET)),
        cra_total_clm.store(read_uint64(box_data.load(), TOTAL_CLM_OFFSET)),

        cra_total_pay.store(Int(0)),
        cra_r.store(cra_from.load()),

        While(
            And(
                cra_r.load() <= cra_cur_round.load(),
                cra_r.load() < cra_from.load() + cra_max.load(),
            )
        ).Do(
            cra_rnd_key.store(round_key(ip_id, cra_r.load())),
            # Try to load round box; skip if it doesn't exist
            (lambda mv: Seq(
                mv,
                If(mv.hasValue()).Then(
                    cra_rnd_data.store(mv.value()),
                    cra_n_entries.store(read_uint16(cra_rnd_data.load(), RND_NENTRIES_OFFSET)),

                    cra_found.store(Int(0)),
                    cra_payout.store(Int(0)),
                    cra_entry_off.store(Int(0)),
                    cra_j.store(Int(0)),
                    While(And(cra_j.load() < cra_n_entries.load(), cra_found.load() == Int(0))).Do(
                        cra_entry_off.store(RND_ENTRIES_OFFSET + cra_j.load() * RND_ENTRY_SIZE),
                        If(Extract(cra_rnd_data.load(), cra_entry_off.load(), ADDR_SIZE) == Txn.sender()).Then(
                            cra_found.store(Int(1)),
                            cra_payout.store(
                                read_uint64(cra_rnd_data.load(), cra_entry_off.load() + RND_PAYOUT_OFF)
                            ),
                        ),
                        cra_j.store(cra_j.load() + Int(1)),
                    ),

                    # If found, unclaimed, and non-zero: pay
                    If(
                        And(
                            cra_found.load() == Int(1),
                            cra_payout.load() > Int(0),
                            Btoi(Extract(cra_rnd_data.load(),
                                cra_entry_off.load() + RND_CLAIMED_OFF, Int(1))) == Int(0),
                        )
                    ).Then(
                        InnerTxnBuilder.Begin(),
                        InnerTxnBuilder.SetFields({
                            TxnField.type_enum:      TxnType.AssetTransfer,
                            TxnField.xfer_asset:     USDC_ASSET_ID,
                            TxnField.asset_receiver: Txn.sender(),
                            TxnField.asset_amount:   cra_payout.load(),
                            TxnField.fee:            Int(0),
                        }),
                        InnerTxnBuilder.Submit(),

                        App.box_replace(
                            cra_rnd_key.load(),
                            cra_entry_off.load() + RND_CLAIMED_OFF,
                            Bytes("\x01"),
                        ),
                        cra_total_pay.store(cra_total_pay.load() + cra_payout.load()),
                    ),
                ),
            ))(App.box_get(cra_rnd_key.load())),

            cra_r.store(cra_r.load() + Int(1)),
        ),

        # Update pool total_claimed once at end
        If(cra_total_pay.load() > Int(0)).Then(
            App.box_replace(bkey.load(), TOTAL_CLM_OFFSET,
                Itob(cra_total_clm.load() + cra_total_pay.load())),
        ),

        Log(Concat(Bytes("claimed_all:"), Itob(cra_total_pay.load()))),
        Approve()
    )


    # ── CLAIM TOKENS ──────────────────────────────────────────────
    # Unchanged from v4. One-time stakeholder token distribution.

    num_stakeholders = ScratchVar(TealType.uint64)
    i                = ScratchVar(TealType.uint64)
    e_off            = ScratchVar(TealType.uint64)
    found            = ScratchVar(TealType.uint64)
    claimer_bps      = ScratchVar(TealType.uint64)
    tokens_to_send   = ScratchVar(TealType.uint64)
    token_asa_id     = ScratchVar(TealType.uint64)

    on_claim_tokens = Seq(
        bkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, box_data.store(mv.value())))(App.box_get(bkey.load())),

        token_asa_id.store(read_uint64(box_data.load(), REV_ASA_OFFSET)),
        num_stakeholders.store(Btoi(Extract(box_data.load(), NUM_SH_OFFSET, Int(1)))),

        found.store(Int(0)),
        claimer_bps.store(Int(0)),
        i.store(Int(0)),
        While(And(i.load() < num_stakeholders.load(), found.load() == Int(0))).Do(
            e_off.store(entry_offset(i.load())),
            If(Extract(box_data.load(), e_off.load(), ADDR_SIZE) == Txn.sender()).Then(
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

        e_off.store(entry_offset(i.load() - Int(1))),
        App.box_replace(bkey.load(),
            e_off.load() + ADDR_SIZE + BPS_SIZE,
            Bytes("\x01")),

        Log(Concat(Bytes("tokens_claimed:"), Itob(tokens_to_send.load()))),
        Approve()
    )

    # ── CLOSE ASSET (admin: destroy stale revenue ASAs created by app) ─
    # Args: [0]="close_asset" [1]=asset_id (uint64, 8 bytes big-endian)
    # Creator only. Destroys an ASA the app created (zeroes all manager roles).
    # The app must hold all outstanding supply for destroy to succeed.

    close_asset_id = ScratchVar(TealType.uint64)

    on_close_asset = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        close_asset_id.store(Btoi(Txn.application_args[1])),
        # Step 1: destroy the ASA (AssetConfig with all zero addresses)
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:            TxnType.AssetConfig,
            TxnField.config_asset:         close_asset_id.load(),
            TxnField.config_asset_manager: Global.zero_address(),
            TxnField.config_asset_reserve: Global.zero_address(),
            TxnField.config_asset_freeze:  Global.zero_address(),
            TxnField.config_asset_clawback:Global.zero_address(),
            TxnField.fee:                  Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Log(Concat(Bytes("asset_destroyed:"), Itob(close_asset_id.load()))),
        Approve()
    )

    # ── ROUTER ───────────────────────────────────────────────────
    action = Txn.application_args[0]

    program = Cond(
        [Txn.application_id() == Int(0),                 on_create],
        [action == Bytes("create_pool"),                 on_create_pool],
        [action == Bytes("deposit_usdc"),                on_deposit_usdc],
        [action == Bytes("deposit_held"),                on_deposit_held],
        [action == Bytes("sync_holder"),                 on_sync_holder],
        [action == Bytes("set_snapshot_freq"),           on_set_snapshot_freq],
        [action == Bytes("release_held"),                on_release_held],
        [action == Bytes("create_payout_round"),         on_create_payout_round],
        [action == Bytes("claim_revenue_round"),         on_claim_revenue_round],
        [action == Bytes("claim_revenue_all"),           on_claim_revenue_all],
        [action == Bytes("claim_tokens"),                on_claim_tokens],
         [action == Bytes("close_asset"),                 on_close_asset],
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

    with open(os.path.join(out_dir, "revenue_pool_v5_approval.teal"), "w") as f:
        f.write(approval)
    with open(os.path.join(out_dir, "revenue_pool_v5_clear.teal"), "w") as f:
        f.write(clear)

    print("Written: revenue_pool_v5_approval.teal")
    print("Written: revenue_pool_v5_clear.teal")