from pyteal import *

USDC_ASSET_ID    = Int(10458941)   # testnet; change to Int(31566704) for mainnet
TOTAL_TOKENS     = Int(10000)
MAX_STAKEHOLDERS = Int(100)
MAX_IP_ID_LEN    = Int(50)

BOX_PREFIX = Bytes("p_")
RND_PREFIX = Bytes("rnd_")

# Pool box offsets
REV_ASA_OFFSET      = Int(0)
UNALLOCATED_OFFSET  = Int(8)
TOTAL_CLM_OFFSET    = Int(16)
HELD_OFFSET         = Int(24)
CUR_ROUND_OFFSET    = Int(32)
NUM_SH_OFFSET       = Int(40)
PROXY_ADDR_OFFSET   = Int(41)
POOL_ENTRIES_OFFSET = Int(73)

# Round box offsets
RND_AMOUNT_OFFSET   = Int(0)
RND_CREATED_OFFSET  = Int(8)
RND_NENTRIES_OFFSET = Int(16)
RND_ENTRIES_OFFSET  = Int(18)

ADDR_SIZE      = Int(32)
BPS_SIZE       = Int(2)
SH_ENTRY_SIZE  = Int(35)
RND_ENTRY_SIZE = Int(41)
RND_FLAG_OFFSET= Int(40)

FLAG_UNCLAIMED = Bytes("base16", "00")
FLAG_CLAIMED   = Bytes("base16", "01")
ZERO_ADDRESS   = BytesZero(Int(32))
ADMIN_KEY      = Bytes("admin")

@Subroutine(TealType.bytes)
def pool_key(ip_id: Expr) -> Expr:
    return Concat(BOX_PREFIX, ip_id)


@Subroutine(TealType.bytes)
def round_key(ip_id: Expr, round_id: Expr) -> Expr:
    return Concat(RND_PREFIX, ip_id, Itob(round_id))


@Subroutine(TealType.uint64)
def stakeholder_offset(index: Expr) -> Expr:
    return POOL_ENTRIES_OFFSET + index * SH_ENTRY_SIZE


@Subroutine(TealType.uint64)
def read_u64(data: Expr, offset: Expr) -> Expr:
    return Btoi(Extract(data, offset, Int(8)))


@Subroutine(TealType.uint64)
def read_u16(data: Expr, offset: Expr) -> Expr:
    return Btoi(Extract(data, offset, Int(2)))


def approval_program():
    action = Txn.application_args[0]
    ip_id  = Txn.application_args[1]

    # Revenue-round eligibility is snapshot-based:
    # a sender must appear in the round’s unclaimed ledger entry.
    # Current REV ASA ownership is intentionally not required for historic claims.

    # ----------------------------------------------------------------
    # CREATE (deploy) — initialise admin global key
    # ----------------------------------------------------------------
    on_create = Seq(
        App.globalPut(ADMIN_KEY, Txn.sender()),
        Approve(),
    )

    # ----------------------------------------------------------------
    # ROTATE ADMIN  (NEW in V7 — T13)
    # ----------------------------------------------------------------
    on_rotate_admin = Seq(
        Assert(Txn.application_args.length() == Int(2)),
        Assert(Len(Txn.application_args[1]) == Int(32)),
        Assert(Txn.sender() == App.globalGet(ADMIN_KEY)),
        App.globalPut(ADMIN_KEY, Txn.application_args[1]),
        Approve(),
    )

    # ----------------------------------------------------------------
    # CREATE POOL
    # ----------------------------------------------------------------
    sh_bytes           = Txn.application_args[4]
    sh_len             = Len(sh_bytes)
    sh_count           = ScratchVar(TealType.uint64)
    sh_i               = ScratchVar(TealType.uint64)
    total_bps          = ScratchVar(TealType.uint64)
    entry_bps          = ScratchVar(TealType.uint64)
    created_asa_id     = ScratchVar(TealType.uint64)
    pool_content       = ScratchVar(TealType.bytes)
    cur_addr           = ScratchVar(TealType.bytes)
    cur_bps_bytes      = ScratchVar(TealType.bytes)
    box_mbr            = ScratchVar(TealType.uint64)
    pool_companion_idx = ScratchVar(TealType.uint64)
    cp_pkey            = ScratchVar(TealType.bytes)

    on_create_pool = Seq(
        Assert(Len(ip_id) > Int(0)),
        Assert(Len(ip_id) <= MAX_IP_ID_LEN),
        Assert(Txn.application_args.length() == Int(6)),
        Assert(sh_len % Int(34) == Int(0)),
        sh_count.store(sh_len / Int(34)),
        Assert(sh_count.load() > Int(0)),
        Assert(sh_count.load() <= MAX_STAKEHOLDERS),

        box_mbr.store(
            Int(2500) + Int(400) * (
                Int(75) + Len(ip_id) + (sh_count.load() * Int(35))
            )
        ),

        pool_companion_idx.store(
            Btoi(Txn.application_args[Txn.application_args.length() - Int(1)])
        ),
        Assert(Gtxn[pool_companion_idx.load()].type_enum() == TxnType.Payment),
        Assert(Gtxn[pool_companion_idx.load()].receiver() == Global.current_application_address()),
        Assert(Gtxn[pool_companion_idx.load()].amount() == box_mbr.load()),

        total_bps.store(Int(0)),
        sh_i.store(Int(0)),
        While(sh_i.load() < sh_count.load()).Do(
            entry_bps.store(
                Btoi(Extract(sh_bytes, sh_i.load() * Int(34) + Int(32), Int(2)))
            ),
            Assert(entry_bps.load() > Int(0)),
            total_bps.store(total_bps.load() + entry_bps.load()),
            sh_i.store(sh_i.load() + Int(1)),
        ),
        Assert(total_bps.load() == TOTAL_TOKENS),

        cp_pkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, Assert(Not(mv.hasValue()))))(App.box_get(cp_pkey.load())),

        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.xfer_asset:     USDC_ASSET_ID,
            TxnField.asset_receiver: Global.current_application_address(),
            TxnField.asset_amount:   Int(0),
            TxnField.fee:            Int(0),
        }),
        InnerTxnBuilder.Submit(),

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
        created_asa_id.store(InnerTxn.created_asset_id()),

        pool_content.store(
            Concat(
                Itob(created_asa_id.load()),
                Itob(Int(0)),
                Itob(Int(0)),
                Itob(Int(0)),
                Itob(Int(0)),
                Extract(Itob(sh_count.load()), Int(7), Int(1)),
                ZERO_ADDRESS,
            )
        ),
        sh_i.store(Int(0)),
        While(sh_i.load() < sh_count.load()).Do(
            cur_addr.store(Extract(sh_bytes, sh_i.load() * Int(34), Int(32))),
            cur_bps_bytes.store(
                Extract(sh_bytes, sh_i.load() * Int(34) + Int(32), Int(2))
            ),
            pool_content.store(
                Concat(
                    pool_content.load(),
                    cur_addr.load(),
                    cur_bps_bytes.load(),
                    FLAG_UNCLAIMED,
                )
            ),
            sh_i.store(sh_i.load() + Int(1)),
        ),
        App.box_put(cp_pkey.load(), pool_content.load()),
        Log(Concat(Bytes("asset_id:"), Itob(created_asa_id.load()))),
        Approve(),
    )

    # ----------------------------------------------------------------
    # SET PROXY
    # ----------------------------------------------------------------
    sp_pkey = ScratchVar(TealType.bytes)

    on_set_proxy = Seq(
        Assert(Txn.application_args.length() == Int(3)),
        Assert(Txn.sender() == App.globalGet(ADMIN_KEY)),
        Assert(Len(Txn.application_args[2]) == Int(32)),
        sp_pkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, Assert(mv.hasValue())))(App.box_get(sp_pkey.load())),
        App.box_replace(sp_pkey.load(), PROXY_ADDR_OFFSET, Txn.application_args[2]),
        Approve(),
    )

    # ----------------------------------------------------------------
    # DEPOSIT USDC
    # ----------------------------------------------------------------
    du_pkey           = ScratchVar(TealType.bytes)
    du_pbox           = ScratchVar(TealType.bytes)
    dep_amt           = ScratchVar(TealType.uint64)
    unalloc_old       = ScratchVar(TealType.uint64)
    dep_companion_idx = ScratchVar(TealType.uint64)
    pool_proxy_addr   = ScratchVar(TealType.bytes)

    on_deposit_usdc = Seq(
        Assert(Txn.application_args.length() == Int(3)),
        du_pkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, Assert(mv.hasValue()), du_pbox.store(mv.value())))(
            App.box_get(du_pkey.load())
        ),
        pool_proxy_addr.store(Extract(du_pbox.load(), PROXY_ADDR_OFFSET, Int(32))),
        Assert(
            Or(
                Txn.sender() == App.globalGet(ADMIN_KEY),
                And(
                    pool_proxy_addr.load() != ZERO_ADDRESS,
                    Txn.sender() == pool_proxy_addr.load(),
                )
            )
        ),
        dep_companion_idx.store(
            Btoi(Txn.application_args[Txn.application_args.length() - Int(1)])
        ),
        Assert(Gtxn[dep_companion_idx.load()].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[dep_companion_idx.load()].xfer_asset() == USDC_ASSET_ID),
        Assert(
            Gtxn[dep_companion_idx.load()].asset_receiver()
            == Global.current_application_address()
        ),
        dep_amt.store(Gtxn[dep_companion_idx.load()].asset_amount()),
        Assert(dep_amt.load() > Int(0)),
        unalloc_old.store(read_u64(du_pbox.load(), UNALLOCATED_OFFSET)),
        App.box_replace(
            du_pkey.load(), UNALLOCATED_OFFSET,
            Itob(unalloc_old.load() + dep_amt.load())
        ),
        Approve(),
    )

    # ----------------------------------------------------------------
    # DEPOSIT HELD
    # ----------------------------------------------------------------
    dh_pkey            = ScratchVar(TealType.bytes)
    dh_pbox            = ScratchVar(TealType.bytes)
    held_amt           = ScratchVar(TealType.uint64)
    held_old           = ScratchVar(TealType.uint64)
    held_companion_idx = ScratchVar(TealType.uint64)

    on_deposit_held = Seq(
        Assert(Txn.application_args.length() == Int(3)),
        Assert(Txn.sender() == App.globalGet(ADMIN_KEY)),
        held_companion_idx.store(
            Btoi(Txn.application_args[Txn.application_args.length() - Int(1)])
        ),
        Assert(Gtxn[held_companion_idx.load()].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[held_companion_idx.load()].xfer_asset() == USDC_ASSET_ID),
        Assert(
            Gtxn[held_companion_idx.load()].asset_receiver()
            == Global.current_application_address()
        ),
        held_amt.store(Gtxn[held_companion_idx.load()].asset_amount()),
        Assert(held_amt.load() > Int(0)),
        dh_pkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, Assert(mv.hasValue()), dh_pbox.store(mv.value())))(
            App.box_get(dh_pkey.load())
        ),
        held_old.store(read_u64(dh_pbox.load(), HELD_OFFSET)),
        App.box_replace(
            dh_pkey.load(), HELD_OFFSET,
            Itob(held_old.load() + held_amt.load())
        ),
        Approve(),
    )

    # ----------------------------------------------------------------
    # RELEASE HELD  (REWRITTEN in V7 — T04/T05)
    #
    # Atomically:
    #   1. Zero out heldUsdc in pool box
    #   2. Add held amount to unallocated
    #   3. Increment cur_round
    #   4. Create round box sized for sh_count entries
    #   5. Write round header (amount, timestamp, nentries)
    #   6. Write one entry per stakeholder: addr + floor(held*bps/10000) + FLAG_UNCLAIMED
    #
    # Companion payment (last arg index) must cover round box MBR.
    # Dust from integer BPS division accumulates in unallocated (never lost).
    # ----------------------------------------------------------------
    rh_pkey       = ScratchVar(TealType.bytes)
    rh_pbox       = ScratchVar(TealType.bytes)
    rh_held       = ScratchVar(TealType.uint64)
    rh_unalloc    = ScratchVar(TealType.uint64)
    rh_sh_count   = ScratchVar(TealType.uint64)
    rh_cur_round  = ScratchVar(TealType.uint64)
    rh_next_round = ScratchVar(TealType.uint64)
    rh_rkey       = ScratchVar(TealType.bytes)
    rh_round_size = ScratchVar(TealType.uint64)
    rh_mbr        = ScratchVar(TealType.uint64)
    rh_comp_idx   = ScratchVar(TealType.uint64)
    rh_i          = ScratchVar(TealType.uint64)
    rh_entry_off  = ScratchVar(TealType.uint64)
    rh_sh_addr    = ScratchVar(TealType.bytes)
    rh_sh_bps     = ScratchVar(TealType.uint64)
    rh_sh_amt     = ScratchVar(TealType.uint64)
    rh_dust       = ScratchVar(TealType.uint64)
    rh_paid_total = ScratchVar(TealType.uint64)

    on_release_held = Seq(
        Assert(Txn.application_args.length() == Int(3)),
        Assert(Txn.sender() == App.globalGet(ADMIN_KEY)),

        rh_pkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, Assert(mv.hasValue()), rh_pbox.store(mv.value())))(
            App.box_get(rh_pkey.load())
        ),
        rh_held.store(read_u64(rh_pbox.load(), HELD_OFFSET)),
        Assert(rh_held.load() > Int(0)),

        rh_sh_count.store(Btoi(Extract(rh_pbox.load(), NUM_SH_OFFSET, Int(1)))),
        rh_round_size.store(RND_ENTRIES_OFFSET + rh_sh_count.load() * RND_ENTRY_SIZE),
        rh_mbr.store(
            Int(2500) + Int(400) * (Int(12) + Len(ip_id) + rh_round_size.load())
        ),

        rh_comp_idx.store(
            Btoi(Txn.application_args[Txn.application_args.length() - Int(1)])
        ),
        Assert(Gtxn[rh_comp_idx.load()].type_enum() == TxnType.Payment),
        Assert(Gtxn[rh_comp_idx.load()].receiver() == Global.current_application_address()),
        Assert(Gtxn[rh_comp_idx.load()].amount() == rh_mbr.load()),

        # Zero held, add to unallocated
        rh_unalloc.store(read_u64(rh_pbox.load(), UNALLOCATED_OFFSET)),
        App.box_replace(rh_pkey.load(), HELD_OFFSET, Itob(Int(0))),
        App.box_replace(
            rh_pkey.load(), UNALLOCATED_OFFSET,
            Itob(rh_unalloc.load() + rh_held.load())
        ),

        # Increment round
        rh_cur_round.store(read_u64(rh_pbox.load(), CUR_ROUND_OFFSET)),
        rh_next_round.store(rh_cur_round.load() + Int(1)),
        App.box_replace(rh_pkey.load(), CUR_ROUND_OFFSET, Itob(rh_next_round.load())),

        # Create round box
        rh_rkey.store(round_key(ip_id, rh_next_round.load())),
        Assert(App.box_create(rh_rkey.load(), rh_round_size.load())),

        # Write round header
        App.box_replace(rh_rkey.load(), RND_AMOUNT_OFFSET,   Itob(rh_held.load())),
        App.box_replace(rh_rkey.load(), RND_CREATED_OFFSET,  Itob(Global.latest_timestamp())),
        App.box_replace(
            rh_rkey.load(), RND_NENTRIES_OFFSET,
            Extract(Itob(rh_sh_count.load()), Int(6), Int(2))
        ),

        # Write per-stakeholder entries: addr(32) + amount(8) + flag(1)
        rh_i.store(Int(0)),
        rh_entry_off.store(RND_ENTRIES_OFFSET),
        rh_paid_total.store(Int(0)),
        While(rh_i.load() < rh_sh_count.load()).Do(
            rh_sh_addr.store(
                Extract(rh_pbox.load(), stakeholder_offset(rh_i.load()), Int(32))
            ),
            rh_sh_bps.store(
                Btoi(Extract(rh_pbox.load(), stakeholder_offset(rh_i.load()) + Int(32), Int(2)))
            ),
            # floor(held * bps / 10000)
            rh_sh_amt.store((rh_held.load() * rh_sh_bps.load()) / TOTAL_TOKENS),
            App.box_replace(rh_rkey.load(), rh_entry_off.load(),          rh_sh_addr.load()),
            App.box_replace(rh_rkey.load(), rh_entry_off.load() + Int(32), Itob(rh_sh_amt.load())),
            App.box_replace(rh_rkey.load(), rh_entry_off.load() + Int(40), FLAG_UNCLAIMED),
            rh_paid_total.store(rh_paid_total.load() + rh_sh_amt.load()),
            rh_entry_off.store(rh_entry_off.load() + RND_ENTRY_SIZE),
            rh_i.store(rh_i.load() + Int(1)),
        ),

        # Any dust from integer division stays in unallocated — deduct paid total
        rh_dust.store(rh_held.load() - rh_paid_total.load()),
        # unallocated was just set to old_unalloc + held; subtract paid_total from it
        App.box_replace(
            rh_pkey.load(), UNALLOCATED_OFFSET,
            Itob(rh_unalloc.load() + rh_dust.load())
        ),

        Approve(),
    )

    # ----------------------------------------------------------------
    # CREATE PAYOUT ROUND
    # ----------------------------------------------------------------
    cpr_pkey          = ScratchVar(TealType.bytes)
    cpr_pbox          = ScratchVar(TealType.bytes)
    round_total       = ScratchVar(TealType.uint64)
    all_payees        = ScratchVar(TealType.bytes)
    arg_i             = ScratchVar(TealType.uint64)
    sum_i             = ScratchVar(TealType.uint64)
    running_sum       = ScratchVar(TealType.uint64)
    num_entries       = ScratchVar(TealType.uint64)
    cur_round         = ScratchVar(TealType.uint64)
    next_round        = ScratchVar(TealType.uint64)
    rkey              = ScratchVar(TealType.bytes)
    unallocated       = ScratchVar(TealType.uint64)
    rnd_off           = ScratchVar(TealType.uint64)
    chunk_addr        = ScratchVar(TealType.bytes)
    chunk_amt         = ScratchVar(TealType.bytes)
    round_size        = ScratchVar(TealType.uint64)
    rnd_mbr           = ScratchVar(TealType.uint64)
    rnd_companion_idx = ScratchVar(TealType.uint64)

    on_create_payout_round = Seq(
        Assert(Txn.sender() == App.globalGet(ADMIN_KEY)),
        Assert(Txn.application_args.length() >= Int(5)),
        round_total.store(Btoi(Txn.application_args[2])),
        Assert(round_total.load() > Int(0)),

        all_payees.store(Txn.application_args[3]),
        arg_i.store(Int(4)),
        While(arg_i.load() < Txn.application_args.length() - Int(1)).Do(
            all_payees.store(
                Concat(all_payees.load(), Txn.application_args[arg_i.load()])
            ),
            arg_i.store(arg_i.load() + Int(1)),
        ),
        Assert(Len(all_payees.load()) > Int(0)),
        Assert(Len(all_payees.load()) % Int(40) == Int(0)),

        running_sum.store(Int(0)),
        sum_i.store(Int(0)),
        While(sum_i.load() < Len(all_payees.load())).Do(
            running_sum.store(
                running_sum.load()
                + Btoi(Extract(all_payees.load(), sum_i.load() + Int(32), Int(8)))
            ),
            sum_i.store(sum_i.load() + Int(40)),
        ),
        Assert(running_sum.load() == round_total.load()),

        num_entries.store(Len(all_payees.load()) / Int(40)),
        round_size.store(RND_ENTRIES_OFFSET + num_entries.load() * RND_ENTRY_SIZE),
        rnd_mbr.store(
            Int(2500) + Int(400) * (Int(12) + Len(ip_id) + round_size.load())
        ),

        cpr_pkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, Assert(mv.hasValue()), cpr_pbox.store(mv.value())))(
            App.box_get(cpr_pkey.load())
        ),
        unallocated.store(read_u64(cpr_pbox.load(), UNALLOCATED_OFFSET)),
        Assert(round_total.load() <= unallocated.load()),

        rnd_companion_idx.store(
            Btoi(Txn.application_args[Txn.application_args.length() - Int(1)])
        ),
        Assert(Gtxn[rnd_companion_idx.load()].type_enum() == TxnType.Payment),
        Assert(
            Gtxn[rnd_companion_idx.load()].receiver()
            == Global.current_application_address()
        ),
        Assert(Gtxn[rnd_companion_idx.load()].amount() == rnd_mbr.load()),

        App.box_replace(
            cpr_pkey.load(), UNALLOCATED_OFFSET,
            Itob(unallocated.load() - round_total.load())
        ),
        cur_round.store(read_u64(cpr_pbox.load(), CUR_ROUND_OFFSET)),
        next_round.store(cur_round.load() + Int(1)),
        App.box_replace(
            cpr_pkey.load(), CUR_ROUND_OFFSET, Itob(next_round.load())
        ),

        rkey.store(round_key(ip_id, next_round.load())),
        Assert(App.box_create(rkey.load(), round_size.load())),
        App.box_replace(rkey.load(), RND_AMOUNT_OFFSET, Itob(round_total.load())),
        App.box_replace(
            rkey.load(), RND_CREATED_OFFSET, Itob(Global.latest_timestamp())
        ),
        App.box_replace(
            rkey.load(),
            RND_NENTRIES_OFFSET,
            Extract(Itob(num_entries.load()), Int(6), Int(2)),
        ),

        sum_i.store(Int(0)),
        rnd_off.store(RND_ENTRIES_OFFSET),
        While(sum_i.load() < Len(all_payees.load())).Do(
            chunk_addr.store(Extract(all_payees.load(), sum_i.load(), Int(32))),
            chunk_amt.store(
                Extract(all_payees.load(), sum_i.load() + Int(32), Int(8))
            ),
            App.box_replace(rkey.load(), rnd_off.load(), chunk_addr.load()),
            App.box_replace(
                rkey.load(), rnd_off.load() + Int(32), chunk_amt.load()
            ),
            App.box_replace(rkey.load(), rnd_off.load() + Int(40), FLAG_UNCLAIMED),
            sum_i.store(sum_i.load() + Int(40)),
            rnd_off.store(rnd_off.load() + RND_ENTRY_SIZE),
        ),
        Approve(),
    )

    # ----------------------------------------------------------------
    # CLAIM REVENUE ROUND
    # ----------------------------------------------------------------
    crr_pkey       = ScratchVar(TealType.bytes)
    crr_pbox       = ScratchVar(TealType.bytes)
    claim_round_id = ScratchVar(TealType.uint64)
    claim_rkey     = ScratchVar(TealType.bytes)
    claim_rbox     = ScratchVar(TealType.bytes)
    claim_n        = ScratchVar(TealType.uint64)
    claim_i        = ScratchVar(TealType.uint64)
    claim_found    = ScratchVar(TealType.uint64)
    claim_amt      = ScratchVar(TealType.uint64)
    claim_off      = ScratchVar(TealType.uint64)
    target_off     = ScratchVar(TealType.uint64)
    total_claimed  = ScratchVar(TealType.uint64)

    on_claim_revenue_round = Seq(
        Assert(Txn.application_args.length() == Int(3)),
        claim_round_id.store(Btoi(Txn.application_args[2])),
        Assert(claim_round_id.load() > Int(0)),

        crr_pkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, Assert(mv.hasValue()), crr_pbox.store(mv.value())))(
            App.box_get(crr_pkey.load())
        ),
        Assert(claim_round_id.load() <= read_u64(crr_pbox.load(), CUR_ROUND_OFFSET)),
        total_claimed.store(read_u64(crr_pbox.load(), TOTAL_CLM_OFFSET)),

        claim_rkey.store(round_key(ip_id, claim_round_id.load())),
        (lambda mv: Seq(mv, Assert(mv.hasValue()), claim_rbox.store(mv.value())))(
            App.box_get(claim_rkey.load())
        ),

        claim_n.store(read_u16(claim_rbox.load(), RND_NENTRIES_OFFSET)),
        claim_found.store(Int(0)),
        claim_amt.store(Int(0)),
        claim_i.store(Int(0)),
        claim_off.store(Int(0)),
        target_off.store(Int(0)),

        While(
            And(claim_i.load() < claim_n.load(), claim_found.load() == Int(0))
        ).Do(
            claim_off.store(RND_ENTRIES_OFFSET + claim_i.load() * RND_ENTRY_SIZE),
            If(
                Extract(claim_rbox.load(), claim_off.load(), Int(32)) == Txn.sender()
            ).Then(
                target_off.store(claim_off.load()),
                claim_found.store(Int(1)),
                claim_amt.store(
                    Btoi(Extract(claim_rbox.load(), claim_off.load() + Int(32), Int(8)))
                ),
                Assert(
                    Extract(claim_rbox.load(), claim_off.load() + Int(40), Int(1))
                    == FLAG_UNCLAIMED
                ),
            ),
            claim_i.store(claim_i.load() + Int(1)),
        ),

        Assert(claim_found.load() == Int(1)),
        Assert(claim_amt.load() > Int(0)),

        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.xfer_asset:     USDC_ASSET_ID,
            TxnField.asset_receiver: Txn.sender(),
            TxnField.asset_amount:   claim_amt.load(),
            TxnField.fee:            Int(0),
        }),
        InnerTxnBuilder.Submit(),


        App.box_replace(claim_rkey.load(), target_off.load() + Int(40), FLAG_CLAIMED),
        App.box_replace(
            crr_pkey.load(), TOTAL_CLM_OFFSET,
            Itob(total_claimed.load() + claim_amt.load())
        ),
        Approve(),
    )

    # ----------------------------------------------------------------
    # CLEANUP ROUND
    # ----------------------------------------------------------------
    cleanup_round_id = ScratchVar(TealType.uint64)
    cleanup_rkey     = ScratchVar(TealType.bytes)
    cleanup_rbox     = ScratchVar(TealType.bytes)
    cleanup_n        = ScratchVar(TealType.uint64)
    cleanup_i        = ScratchVar(TealType.uint64)
    cleanup_off      = ScratchVar(TealType.uint64)
    cleanup_mbr      = ScratchVar(TealType.uint64)

    on_cleanup_round = Seq(
        Assert(Txn.application_args.length() == Int(3)),
        Assert(Txn.sender() == App.globalGet(ADMIN_KEY)),
        cleanup_round_id.store(Btoi(Txn.application_args[2])),

        cleanup_rkey.store(round_key(ip_id, cleanup_round_id.load())),
        (lambda mv: Seq(mv, Assert(mv.hasValue()), cleanup_rbox.store(mv.value())))(
            App.box_get(cleanup_rkey.load())
        ),

        cleanup_n.store(read_u16(cleanup_rbox.load(), RND_NENTRIES_OFFSET)),

        cleanup_i.store(Int(0)),
        While(cleanup_i.load() < cleanup_n.load()).Do(
            cleanup_off.store(
                RND_ENTRIES_OFFSET
                + (cleanup_i.load() * RND_ENTRY_SIZE)
                + RND_FLAG_OFFSET
            ),
            Assert(
                Extract(cleanup_rbox.load(), cleanup_off.load(), Int(1))
                == FLAG_CLAIMED
            ),
            cleanup_i.store(cleanup_i.load() + Int(1)),
        ),

        cleanup_mbr.store(
            Int(2500) + Int(400) * (
                Int(12) + Len(ip_id)
                + Int(18) + (cleanup_n.load() * RND_ENTRY_SIZE)
            )
        ),

        Pop(App.box_delete(cleanup_rkey.load())),

        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver:  Txn.sender(),
            TxnField.amount:    cleanup_mbr.load(),
            TxnField.fee:       Int(0),
        }),
        InnerTxnBuilder.Submit(),
        Approve(),
    )

    # ----------------------------------------------------------------
    # CLAIM TOKENS
    # ----------------------------------------------------------------
    ct_pkey      = ScratchVar(TealType.bytes)
    ct_pbox      = ScratchVar(TealType.bytes)
    token_asa_id = ScratchVar(TealType.uint64)
    num_sh       = ScratchVar(TealType.uint64)
    ct_i         = ScratchVar(TealType.uint64)
    ct_off       = ScratchVar(TealType.uint64)
    ct_match_off = ScratchVar(TealType.uint64)
    ct_found     = ScratchVar(TealType.uint64)
    ct_bps       = ScratchVar(TealType.uint64)

    on_claim_tokens = Seq(
        Assert(Txn.application_args.length() == Int(2)),
        ct_pkey.store(pool_key(ip_id)),
        (lambda mv: Seq(mv, Assert(mv.hasValue()), ct_pbox.store(mv.value())))(
            App.box_get(ct_pkey.load())
        ),
        token_asa_id.store(read_u64(ct_pbox.load(), REV_ASA_OFFSET)),
        num_sh.store(Btoi(Extract(ct_pbox.load(), NUM_SH_OFFSET, Int(1)))),

        ct_found.store(Int(0)),
        ct_bps.store(Int(0)),
        ct_i.store(Int(0)),
        ct_match_off.store(Int(0)),

        While(
            And(ct_i.load() < num_sh.load(), ct_found.load() == Int(0))
        ).Do(
            ct_off.store(stakeholder_offset(ct_i.load())),
            If(
                Extract(ct_pbox.load(), ct_off.load(), Int(32)) == Txn.sender()
            ).Then(
                ct_match_off.store(ct_off.load()),
                Assert(
                    Extract(ct_pbox.load(), ct_off.load() + Int(34), Int(1))
                    == FLAG_UNCLAIMED
                ),
                ct_bps.store(
                    Btoi(Extract(ct_pbox.load(), ct_off.load() + Int(32), Int(2)))
                ),
                ct_found.store(Int(1)),
            ),
            ct_i.store(ct_i.load() + Int(1)),
        ),

        Assert(ct_found.load() == Int(1)),
        Assert(ct_bps.load() > Int(0)),

        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum:      TxnType.AssetTransfer,
            TxnField.asset_receiver: Txn.sender(),
            TxnField.asset_amount:   ct_bps.load(),
            TxnField.xfer_asset:     token_asa_id.load(),
            TxnField.fee:            Int(0),
        }),
        InnerTxnBuilder.Submit(),

        App.box_replace(ct_pkey.load(), ct_match_off.load() + Int(34), FLAG_CLAIMED),
        Approve(),
    )

    return Cond(
        [Txn.application_id() == Int(0),         on_create],
        [action == Bytes("rotate_admin"),         on_rotate_admin],
        [action == Bytes("create_pool"),          on_create_pool],
        [action == Bytes("set_proxy"),            on_set_proxy],
        [action == Bytes("deposit_usdc"),         on_deposit_usdc],
        [action == Bytes("deposit_held"),         on_deposit_held],
        [action == Bytes("release_held"),         on_release_held],
        [action == Bytes("create_payout_round"),  on_create_payout_round],
        [action == Bytes("claim_revenue_round"),  on_claim_revenue_round],
        [action == Bytes("cleanup_round"),        on_cleanup_round],
        [action == Bytes("claim_tokens"),         on_claim_tokens],
    )


def clear_program():
    return Reject()


if __name__ == "__main__":
    raise RuntimeError(
        "Do not compile directly. Use deploy_v10.py with the Algorand Python SDK."
    )