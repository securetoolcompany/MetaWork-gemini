"""
test_v5.py — Revenue Pool V5 full lifecycle test
─────────────────────────────────────────────────────────────────
Two wallets: authority (80%) + metawork (20%)

Tests:
  1. create_pool  — 2 stakeholders, 80/20 split
  2. deposit_held — lock USDC into held
  3. sync_holder  — both wallets register in holder registry
  4. claim_tokens — both stakeholders receive revenue ASA tokens
  5. release_held — authority releases held → triggers snapshot round
  6. claim_revenue_round — each wallet claims round 1 individually
  7. double-claim rejected
  8. deposit_held + release_held → round 2
  9. claim_revenue_all  — batch claim all unclaimed rounds
 10. set_snapshot_freq  — change mode, verify stored
"""

import os
import sys
import base64
import struct
import time

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import algosdk
from algosdk.v2client import algod
from algosdk import transaction

ALGOD_URL     = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN   = ""
USDC_ASSET_ID = 10458941
TOTAL_TOKENS  = 100

APP_ID_FILE = os.path.join(os.path.dirname(__file__), "app_id.txt")
TEST_IP_ID  = f"v5_{int(time.time())}"

PASS = "✅"
FAIL = "❌"


# ── Client / helpers ──────────────────────────────────────────────

def get_client():
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL)

def wait(client, txid, rounds=10):
    last = client.status()["last-round"]
    for _ in range(rounds):
        try:
            r = client.pending_transaction_info(txid)
            if r.get("confirmed-round", 0) > 0:
                return r
        except Exception:
            pass
        client.status_after_block(last + 1)
        last += 1
    raise Exception(f"Timeout waiting for {txid}")

def sp(client, fee=2000):
    p = client.suggested_params()
    p.flat_fee = True
    p.fee = fee
    return p

def uint64_be(n):
    return struct.pack(">Q", int(n))

def uint16_be(n):
    return struct.pack(">H", int(n))

def pool_key(ip_id):
    return b"p_" + ip_id.encode()

def reg_key(ip_id):
    return b"reg_" + ip_id.encode()

def round_key(ip_id, round_id):
    return b"rnd_" + ip_id.encode() + struct.pack(">Q", round_id)

def read_box_raw(client, app_id, key_bytes):
    result = client.application_box_by_name(app_id, key_bytes)
    return base64.b64decode(result["value"])

def read_pool_box(client, app_id, ip_id):
    return read_box_raw(client, app_id, pool_key(ip_id))

def parse_pool_box(data):
    return {
        "rev_asa_id":        struct.unpack_from(">Q", data, 0)[0],
        "total_deposited":   struct.unpack_from(">Q", data, 8)[0],
        "total_claimed":     struct.unpack_from(">Q", data, 16)[0],
        "held_usdc":         struct.unpack_from(">Q", data, 24)[0],
        "current_round_id":  struct.unpack_from(">Q", data, 32)[0],
        "snapshot_freq":     data[40],
        "last_snapshot_day": struct.unpack_from(">Q", data, 41)[0],
        "num_stakeholders":  data[49],
    }

def parse_round_box(data):
    return {
        "round_amount":   struct.unpack_from(">Q", data, 0)[0],
        "round_created":  struct.unpack_from(">Q", data, 8)[0],
        "num_entries":    struct.unpack_from(">H", data, 16)[0],
    }

def print_pool_box(label, p):
    print(f"    {label}:")
    print(f"      rev_asa_id:        {p['rev_asa_id']}")
    print(f"      total_deposited:   {p['total_deposited']/1e6:.6f} USDC")
    print(f"      total_claimed:     {p['total_claimed']/1e6:.6f} USDC")
    print(f"      held_usdc:         {p['held_usdc']/1e6:.6f} USDC")
    print(f"      current_round_id:  {p['current_round_id']}")
    print(f"      snapshot_freq:     {p['snapshot_freq']}")
    print(f"      num_stakeholders:  {p['num_stakeholders']}")

def opt_in_asset(client, pk, addr, asset_id):
    info = client.account_info(addr)
    held = [a["asset-id"] for a in info.get("assets", [])]
    if asset_id in held:
        return
    txn = transaction.AssetOptInTxn(sender=addr, sp=sp(client), index=asset_id)
    txid = client.send_transaction(txn.sign(pk))
    wait(client, txid)
    print(f"    Opted in to {asset_id} for {addr[:8]}...")

def asset_balance(client, address, asset_id):
    info = client.account_info(address)
    for a in info.get("assets", []):
        if a["asset-id"] == asset_id:
            return a["amount"]
    return 0

def send_group(client, signed_txns):
    encoded = b"".join([
        base64.b64decode(algosdk.encoding.msgpack_encode(s))
        for s in signed_txns
    ])
    return client.send_raw_transaction(base64.b64encode(encoded).decode())

def section(title):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")


# ── Test 1: create_pool ───────────────────────────────────────────

def test_create_pool(client, app_id, auth_pk, auth_addr, mw_addr, ip_id):
    section("TEST 1: create_pool (2 stakeholders — 80/20 split)")

    app_addr = algosdk.logic.get_application_address(app_id)
    packed_sh = (
        algosdk.encoding.decode_address(auth_addr) + struct.pack(">H", 80) +
        algosdk.encoding.decode_address(mw_addr)   + struct.pack(">H", 20)
    )

    bkey = pool_key(ip_id)
    rkey = reg_key(ip_id)
    # Pool box: 50 header + 35*2 entries = 120 bytes
    # Reg box:  2 + 32*200 = 6402 bytes
    # MBR for boxes: pool=(2500+400*120)=50500, reg=(2500+400*6402)=2563300 → ~0.26 ALGO
    # Fund with 0.5 ALGO to be safe
    pay = transaction.PaymentTxn(
        sender=auth_addr, sp=sp(client),
        receiver=app_addr, amt=500_000,
    )
    app_call = transaction.ApplicationNoOpTxn(
        sender=auth_addr,
        sp=sp(client, fee=4000),
        index=app_id,
        app_args=[b"create_pool", ip_id.encode(), b"V5Test", b"V5T", packed_sh],
        foreign_assets=[USDC_ASSET_ID],
        boxes=[
            transaction.BoxReference(0, bkey),
            transaction.BoxReference(0, rkey),
        ],
    )
    gid = transaction.calculate_group_id([pay, app_call])
    pay.group = app_call.group = gid
    txid = send_group(client, [pay.sign(auth_pk), app_call.sign(auth_pk)])
    wait(client, txid)
    print(f"  {PASS} create_pool confirmed: {txid}")

    pool = parse_pool_box(read_pool_box(client, app_id, ip_id))
    print_pool_box("Pool box after create_pool", pool)
    assert pool["num_stakeholders"] == 2
    assert pool["rev_asa_id"] > 0
    assert pool["current_round_id"] == 0
    assert pool["snapshot_freq"] == 0  # default = per-release
    print(f"  {PASS} Pool created. ASA: {pool['rev_asa_id']}")
    return pool["rev_asa_id"]


# ── Test 2: deposit_held ──────────────────────────────────────────

def test_deposit_held(client, app_id, auth_pk, auth_addr, ip_id, micro):
    section("TEST 2: deposit_held")

    app_addr = algosdk.logic.get_application_address(app_id)
    bkey     = pool_key(ip_id)

    axfer = transaction.AssetTransferTxn(
        sender=auth_addr, sp=sp(client),
        receiver=app_addr, amt=micro, index=USDC_ASSET_ID,
    )
    app_call = transaction.ApplicationNoOpTxn(
        sender=auth_addr, sp=sp(client), index=app_id,
        app_args=[b"deposit_held", ip_id.encode()],
        foreign_assets=[USDC_ASSET_ID],
        boxes=[transaction.BoxReference(0, bkey)],
    )
    gid = transaction.calculate_group_id([axfer, app_call])
    axfer.group = app_call.group = gid
    txid = send_group(client, [axfer.sign(auth_pk), app_call.sign(auth_pk)])
    wait(client, txid)

    pool = parse_pool_box(read_pool_box(client, app_id, ip_id))
    assert pool["held_usdc"] == micro
    print(f"  {PASS} deposit_held: {micro/1e6:.6f} USDC locked")


# ── Test 3: sync_holder ───────────────────────────────────────────

def test_sync_holders(client, app_id, auth_pk, auth_addr,
                      mw_pk, mw_addr, ip_id, asa_id):
    section("TEST 3: sync_holder — register both wallets in holder registry")

    bkey = pool_key(ip_id)
    rkey = reg_key(ip_id)

    for label, pk, addr in [
        ("Authority", auth_pk, auth_addr),
        ("MetaWork",  mw_pk,   mw_addr),
    ]:
        txn = transaction.ApplicationNoOpTxn(
            sender=addr, sp=sp(client), index=app_id,
            app_args=[b"sync_holder", ip_id.encode()],
            foreign_assets=[asa_id],
            boxes=[
                transaction.BoxReference(0, bkey),
                transaction.BoxReference(0, rkey),
            ],
        )
        txid = client.send_transaction(txn.sign(pk))
        wait(client, txid)
        print(f"  {PASS} {label} synced into holder registry")

    # Verify registry has 2 holders
    reg_data = read_box_raw(client, app_id, rkey)
    num_holders = struct.unpack_from(">H", reg_data, 0)[0]
    assert num_holders == 2, f"Expected 2 holders, got {num_holders}"
    print(f"  {PASS} Registry shows {num_holders} holders")

    # Idempotent — re-sync should not duplicate
    txn = transaction.ApplicationNoOpTxn(
        sender=auth_addr, sp=sp(client), index=app_id,
        app_args=[b"sync_holder", ip_id.encode()],
        foreign_assets=[asa_id],
        boxes=[
            transaction.BoxReference(0, bkey),
            transaction.BoxReference(0, rkey),
        ],
    )
    txid = client.send_transaction(txn.sign(auth_pk))
    wait(client, txid)
    reg_data = read_box_raw(client, app_id, rkey)
    num_holders = struct.unpack_from(">H", reg_data, 0)[0]
    assert num_holders == 2, f"Duplicate entry after re-sync: {num_holders}"
    print(f"  {PASS} Re-sync is idempotent (still {num_holders} holders)")


# ── Test 4: claim_tokens ──────────────────────────────────────────

def test_claim_tokens(client, app_id, auth_pk, auth_addr,
                      mw_pk, mw_addr, ip_id, asa_id):
    section("TEST 4: claim_tokens — both stakeholders receive ASA tokens")

    bkey = pool_key(ip_id)

    for label, pk, addr, expected in [
        ("Authority (80%)", auth_pk, auth_addr, 80),
        ("MetaWork  (20%)", mw_pk,   mw_addr,   20),
    ]:
        opt_in_asset(client, pk, addr, asa_id)
        before = asset_balance(client, addr, asa_id)

        txn = transaction.ApplicationNoOpTxn(
            sender=addr, sp=sp(client, fee=2000), index=app_id,
            app_args=[b"claim_tokens", ip_id.encode()],
            foreign_assets=[asa_id],
            boxes=[transaction.BoxReference(0, bkey)],
        )
        txid = client.send_transaction(txn.sign(pk))
        wait(client, txid)

        received = asset_balance(client, addr, asa_id) - before
        assert received == expected, f"{label}: got {received}, expected {expected}"
        print(f"  {PASS} {label}: received {received} tokens")

    # Double-claim rejected
    for label, pk, addr in [("Authority", auth_pk, auth_addr), ("MetaWork", mw_pk, mw_addr)]:
        try:
            txn = transaction.ApplicationNoOpTxn(
                sender=addr, sp=sp(client), index=app_id,
                app_args=[b"claim_tokens", ip_id.encode()],
                foreign_assets=[asa_id],
                boxes=[transaction.BoxReference(0, bkey)],
            )
            client.send_transaction(txn.sign(pk))
            print(f"  {FAIL} {label} double-claim should have been rejected")
        except Exception:
            print(f"  {PASS} {label} double-claim correctly rejected")


# ── Test 5: release_held → snapshot round 1 ───────────────────────

def test_release_held(client, app_id, auth_pk, auth_addr,
                      mw_addr, ip_id, asa_id, micro):
    section("TEST 5: release_held → auto-snapshot creates round 1")

    bkey  = pool_key(ip_id)
    rkey  = reg_key(ip_id)
    r1key = round_key(ip_id, 1)

    # Fund app for round 1 box MBR
    app_addr = algosdk.logic.get_application_address(app_id)
    fund = transaction.PaymentTxn(
        sender=auth_addr, sp=sp(client),
        receiver=app_addr, amt=100_000,
    )
    txid = client.send_transaction(fund.sign(auth_pk))
    wait(client, txid)

    txn = transaction.ApplicationNoOpTxn(
        sender=auth_addr,
        sp=sp(client, fee=4000),
        index=app_id,
        app_args=[b"release_held", ip_id.encode(), uint64_be(micro)],
        foreign_assets=[USDC_ASSET_ID, asa_id],     # ← both assets required
        accounts=[auth_addr, mw_addr],               # ← all registered holders
        boxes=[
            transaction.BoxReference(0, bkey),
            transaction.BoxReference(0, rkey),
            transaction.BoxReference(0, r1key),
        ],
    )
    txid = client.send_transaction(txn.sign(auth_pk))
    wait(client, txid)

    pool = parse_pool_box(read_pool_box(client, app_id, ip_id))
    print_pool_box("Pool box after release_held", pool)
    assert pool["held_usdc"] == 0,        "held_usdc should be 0 after release"
    assert pool["total_deposited"] == micro, "total_deposited should equal micro"
    assert pool["current_round_id"] == 1, "round 1 should have been created"

    rnd_data = read_box_raw(client, app_id, r1key)
    rnd      = parse_round_box(rnd_data)
    print(f"    Round 1: amount={rnd['round_amount']/1e6:.6f} USDC, entries={rnd['num_entries']}")
    assert rnd["round_amount"] == micro
    assert rnd["num_entries"] == 2, f"Expected 2 entries in round, got {rnd['num_entries']}"
    print(f"  {PASS} Round 1 created with {rnd['num_entries']} entries")

# ── Test 6: test_claim_revenue_round ──────────────────────────
def test_claim_revenue_round(client, app_id, auth_pk, auth_addr,
                              mw_pk, mw_addr, ip_id, asa_id, total_micro):
    section("TEST 6: claim_revenue_round — each wallet claims round 1")

    bkey  = pool_key(ip_id)
    r1key = round_key(ip_id, 1)

    opt_in_asset(client, auth_pk, auth_addr, USDC_ASSET_ID)
    opt_in_asset(client, mw_pk,   mw_addr,   USDC_ASSET_ID)

    for label, pk, addr, bps in [
        ("Authority (80%)", auth_pk, auth_addr, 80),
        ("MetaWork  (20%)", mw_pk,   mw_addr,   20),
    ]:
        expected = total_micro * bps // 100
        before   = asset_balance(client, addr, USDC_ASSET_ID)

        txn = transaction.ApplicationNoOpTxn(
            sender=addr,
            sp=sp(client, fee=3000),
            index=app_id,
            app_args=[b"claim_revenue_round", ip_id.encode(), uint64_be(1)],
            foreign_assets=[USDC_ASSET_ID],
            boxes=[
                transaction.BoxReference(0, bkey),
                transaction.BoxReference(0, r1key),
            ],
        )
        txid = client.send_transaction(txn.sign(pk))
        wait(client, txid)

        received = asset_balance(client, addr, USDC_ASSET_ID) - before
        assert received == expected, \
            f"{label}: got {received/1e6:.6f}, expected {expected/1e6:.6f}"
        print(f"  {PASS} {label}: received {received/1e6:.6f} USDC")

    pool = parse_pool_box(read_pool_box(client, app_id, ip_id))
    assert pool["total_claimed"] == total_micro
    print(f"  {PASS} Pool total_claimed == total_deposited")

    # Double-claim rejected
    for label, pk, addr in [
        ("Authority", auth_pk, auth_addr),
        ("MetaWork",  mw_pk,   mw_addr),
    ]:
        try:
            txn = transaction.ApplicationNoOpTxn(
                sender=addr,
                sp=sp(client, fee=3000),
                index=app_id,
                app_args=[b"claim_revenue_round", ip_id.encode(), uint64_be(1)],
                foreign_assets=[USDC_ASSET_ID],
                boxes=[
                    transaction.BoxReference(0, bkey),
                    transaction.BoxReference(0, r1key),
                ],
            )
            client.send_transaction(txn.sign(pk))
            print(f"  {FAIL} {label} double-claim should have been rejected")
        except Exception:
            print(f"  {PASS} {label} round 1 double-claim correctly rejected")

# ── Test 7: round 2 + claim_revenue_all ──────────────────────────

def test_round2_claim_all(client, app_id, auth_pk, auth_addr,
                          mw_pk, mw_addr, ip_id, asa_id, total_micro):
    section("TEST 7: deposit_held + release_held → round 2, then claim_revenue_all")

    bkey  = pool_key(ip_id)
    rkey  = reg_key(ip_id)
    r2key = round_key(ip_id, 2)
    app_addr = algosdk.logic.get_application_address(app_id)

    # Fund app for round 2 box MBR
    fund = transaction.PaymentTxn(
        sender=auth_addr, sp=sp(client),
        receiver=app_addr, amt=100_000,
    )
    txid = client.send_transaction(fund.sign(auth_pk))
    wait(client, txid)

    # deposit_held round 2
    axfer = transaction.AssetTransferTxn(
        sender=auth_addr, sp=sp(client),
        receiver=app_addr, amt=total_micro, index=USDC_ASSET_ID,
    )
    app_call = transaction.ApplicationNoOpTxn(
        sender=auth_addr, sp=sp(client), index=app_id,
        app_args=[b"deposit_held", ip_id.encode()],
        foreign_assets=[USDC_ASSET_ID],
        boxes=[transaction.BoxReference(0, bkey)],
    )
    gid = transaction.calculate_group_id([axfer, app_call])
    axfer.group = app_call.group = gid
    txid = send_group(client, [axfer.sign(auth_pk), app_call.sign(auth_pk)])
    wait(client, txid)
    print(f"  {PASS} Round 2 deposit_held: {total_micro/1e6:.6f} USDC")

    # release_held → creates round 2
    txn = transaction.ApplicationNoOpTxn(
        sender=auth_addr,
        sp=sp(client, fee=4000),
        index=app_id,
        app_args=[b"release_held", ip_id.encode(), uint64_be(total_micro)],
        foreign_assets=[USDC_ASSET_ID, asa_id],   # ← add asa_id
        accounts=[auth_addr, mw_addr],             # ← add holder addresses
        boxes=[
            transaction.BoxReference(0, bkey),
            transaction.BoxReference(0, rkey),
            transaction.BoxReference(0, r2key),
        ],
    )
    txid = client.send_transaction(txn.sign(auth_pk))
    wait(client, txid)

    pool = parse_pool_box(read_pool_box(client, app_id, ip_id))
    assert pool["current_round_id"] == 2
    print(f"  {PASS} Round 2 created")

    # claim_revenue_all for both wallets (from_round=2, max=5)
    for label, pk, addr, bps in [
        ("Authority (80%)", auth_pk, auth_addr, 80),
        ("MetaWork  (20%)", mw_pk,   mw_addr,   20),
    ]:
        expected = total_micro * bps // 100
        before   = asset_balance(client, addr, USDC_ASSET_ID)

        txn = transaction.ApplicationNoOpTxn(
            sender=addr,
            sp=sp(client, fee=5000),
            index=app_id,
            app_args=[
                b"claim_revenue_all",
                ip_id.encode(),
                uint64_be(2),   # from_round
                uint64_be(5),   # max_rounds
            ],
            foreign_assets=[USDC_ASSET_ID],
            boxes=[
                transaction.BoxReference(0, bkey),
                transaction.BoxReference(0, r2key),
            ],
        )
        txid = client.send_transaction(txn.sign(pk))
        wait(client, txid)

        received = asset_balance(client, addr, USDC_ASSET_ID) - before
        assert received == expected, f"{label}: got {received/1e6:.6f}, expected {expected/1e6:.6f}"
        print(f"  {PASS} {label}: claim_revenue_all received {received/1e6:.6f} USDC")


# ── Test 8: set_snapshot_freq ─────────────────────────────────────

def test_set_snapshot_freq(client, app_id, auth_pk, auth_addr, ip_id):
    section("TEST 8: set_snapshot_freq — change mode to daily (1)")

    bkey = pool_key(ip_id)

    txn = transaction.ApplicationNoOpTxn(
        sender=auth_addr, sp=sp(client), index=app_id,
        app_args=[b"set_snapshot_freq", ip_id.encode(), bytes([1])],
        boxes=[transaction.BoxReference(0, bkey)],
    )
    txid = client.send_transaction(txn.sign(auth_pk))
    wait(client, txid)

    pool = parse_pool_box(read_pool_box(client, app_id, ip_id))
    assert pool["snapshot_freq"] == 1, f"Expected freq=1, got {pool['snapshot_freq']}"
    print(f"  {PASS} snapshot_freq set to 1 (daily)")

    # Reset to per-release (0) for clean state
    txn = transaction.ApplicationNoOpTxn(
        sender=auth_addr, sp=sp(client), index=app_id,
        app_args=[b"set_snapshot_freq", ip_id.encode(), bytes([0])],
        boxes=[transaction.BoxReference(0, bkey)],
    )
    txid = client.send_transaction(txn.sign(auth_pk))
    wait(client, txid)
    print(f"  {PASS} snapshot_freq reset to 0 (per-release)")


# ── Main ──────────────────────────────────────────────────────────

def main():
    if not os.path.exists(APP_ID_FILE):
        print("ERROR: app_id.txt not found. Run deploy_v5.py first.")
        sys.exit(1)
    with open(APP_ID_FILE) as f:
        app_id = int(f.read().strip())
    print(f"\nTesting App ID: {app_id}")

    auth_mnemonic = os.environ.get("AUTHORITY_MNEMONIC", "").strip()
    if not auth_mnemonic:
        auth_mnemonic = input("Enter AUTHORITY mnemonic: ").strip()
    auth_pk   = algosdk.mnemonic.to_private_key(auth_mnemonic)
    auth_addr = algosdk.account.address_from_private_key(auth_pk)
    print(f"Authority: {auth_addr}")

    mw_mnemonic = os.environ.get("METAWORK_MNEMONIC", "").strip()
    if not mw_mnemonic:
        mw_mnemonic = input("Enter METAWORK mnemonic (or press Enter to generate): ").strip()

    if not mw_mnemonic:
        mw_pk, mw_addr = algosdk.account.generate_account()
        print(f"\n  ⚠️  Generated fresh MetaWork wallet: {mw_addr}")
        print(f"  Fund with ~0.5 ALGO: https://bank.testnet.algorand.network/?account={mw_addr}")
        input("\n  Press Enter once funded...")
    else:
        mw_pk   = algosdk.mnemonic.to_private_key(mw_mnemonic)
        mw_addr = algosdk.account.address_from_private_key(mw_pk)
    print(f"MetaWork:  {mw_addr}")

    client    = get_client()

    # Pre-fund app address with enough ALGO for all MBR
    app_addr = algosdk.logic.get_application_address(app_id)
    app_info = client.account_info(app_addr)
    app_balance = app_info["amount"]
    if app_balance < 3_000_000:
        print(f"\n  Funding app address {app_addr[:16]}... with 3 ALGO for MBR")
        fund_txn = transaction.PaymentTxn(
            sender=auth_addr,
            sp=sp(client),
            receiver=app_addr,
            amt=3_000_000 - app_balance,
        )
        txid = client.send_transaction(fund_txn.sign(auth_pk))
        wait(client, txid)
        print(f"  {PASS} App funded: {3_000_000/1e6:.2f} ALGO")


    usdc_bal  = asset_balance(client, auth_addr, USDC_ASSET_ID)
    test_micro = min(1_000_000, int(usdc_bal * 0.1))  # 10% of balance, max 1 USDC
    print(f"USDC balance: {usdc_bal/1e6:.2f} USDC  →  testing with {test_micro/1e6:.6f} USDC")

    if test_micro < 100:
        print("ERROR: Not enough USDC to test. Need at least 0.0001 USDC.")
        sys.exit(1)

    try:
        asa_id = test_create_pool(client, app_id, auth_pk, auth_addr, mw_addr, TEST_IP_ID)
        test_deposit_held(client, app_id, auth_pk, auth_addr, TEST_IP_ID, test_micro)
        test_claim_tokens(client, app_id, auth_pk, auth_addr, mw_pk, mw_addr, TEST_IP_ID, asa_id)
        test_sync_holders(client, app_id, auth_pk, auth_addr, mw_pk, mw_addr, TEST_IP_ID, asa_id)
        test_release_held(client, app_id, auth_pk, auth_addr, mw_addr, TEST_IP_ID, asa_id, test_micro)
        test_claim_revenue_round(client, app_id, auth_pk, auth_addr, mw_pk, mw_addr, TEST_IP_ID, asa_id, test_micro)
        test_round2_claim_all(client, app_id, auth_pk, auth_addr, mw_pk, mw_addr, TEST_IP_ID, asa_id, test_micro)
        test_set_snapshot_freq(client, app_id, auth_pk, auth_addr, TEST_IP_ID)

        section("ALL V5 TESTS PASSED ✅")
        print(f"\n  App ID:   {app_id}")
        print(f"  IP ID:    {TEST_IP_ID}")
        print(f"  ASA ID:   {asa_id}")
        print(f"  Explorer: https://testnet.explorer.perawallet.app/application/{app_id}/\n")

    except AssertionError as e:
        section(f"TEST FAILED ❌: {e}")
        sys.exit(1)
    except Exception as e:
        section(f"ERROR ❌: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()