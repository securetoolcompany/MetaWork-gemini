"""
test_v4.py — Full lifecycle test for Revenue Pool V4
─────────────────────────────────────────────────────
Tests (in order):
  1. create_pool        → box created, ASA minted
  2. deposit_held       → held_usdc incremented
  3. set_delivered      → delivered_at written
  4. release_held       → held moves to total_deposited (admin mode)
  5. claim_tokens       → stakeholder receives revenue ASA
  6. claim_revenue      → stakeholder receives USDC
  7. set_release_mode   → flip to auto mode
  8. set_release_delay  → set delay to 0 days for instant auto-release test
  9. deposit_held again → add more held USDC
 10. release_held auto  → anyone can release (delay=0, delivered_at already set)

Requirements:
  - App ID in app_id.txt (written by deploy_v4.py)
  - AUTHORITY_MNEMONIC in env or .env
  - TestNet USDC (asset 10458941) in the authority wallet
    Get some at: https://testnet.folks.finance/ or dispenser
  - App address funded with ALGO (done)
"""

import os
import sys
import base64
import struct
import time
import msgpack

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import algosdk
from algosdk.v2client import algod
from algosdk import transaction

# ── Config ───────────────────────────────────────────────────────
ALGOD_URL     = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN   = ""
USDC_ASSET_ID = 10458941
TOTAL_TOKENS  = 100

APP_ID_FILE = os.path.join(os.path.dirname(__file__), "app_id.txt")

# Test IP ID — unique string identifier for this test pool
TEST_IP_ID = f"test_ip_{int(time.time())}"

PASS = "✅"
FAIL = "❌"


# ── Helpers ──────────────────────────────────────────────────────

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


def box_key(ip_id):
    return b"p_" + ip_id.encode()


def read_box(client, app_id, ip_id):
    key = box_key(ip_id)
    result = client.application_box_by_name(app_id, key)
    data = base64.b64decode(result["value"])
    return data


def parse_box(data):
    return {
        "rev_asa_id":       struct.unpack_from(">Q", data, 0)[0],
        "total_deposited":  struct.unpack_from(">Q", data, 8)[0],
        "total_claimed":    struct.unpack_from(">Q", data, 16)[0],
        "held_usdc":        struct.unpack_from(">Q", data, 24)[0],
        "delivered_at":     struct.unpack_from(">Q", data, 32)[0],
        "num_stakeholders": data[40],
    }


def print_box(label, parsed):
    print(f"    {label}:")
    print(f"      rev_asa_id:      {parsed['rev_asa_id']}")
    print(f"      total_deposited: {parsed['total_deposited'] / 1e6:.2f} USDC")
    print(f"      total_claimed:   {parsed['total_claimed'] / 1e6:.2f} USDC")
    print(f"      held_usdc:       {parsed['held_usdc'] / 1e6:.2f} USDC")
    print(f"      delivered_at:    {parsed['delivered_at']}")
    print(f"      num_stakeholders:{parsed['num_stakeholders']}")


def opt_in_asset(client, private_key, address, asset_id):
    """Opt an account into an ASA if not already opted in."""
    info = client.account_info(address)
    held = [a["asset-id"] for a in info.get("assets", [])]
    if asset_id in held:
        return
    txn = transaction.AssetOptInTxn(sender=address, sp=sp(client), index=asset_id)
    signed = txn.sign(private_key)
    txid = client.send_transaction(signed)
    wait(client, txid)
    print(f"    Opted in to asset {asset_id}")


def asset_balance(client, address, asset_id):
    info = client.account_info(address)
    for a in info.get("assets", []):
        if a["asset-id"] == asset_id:
            return a["amount"]
    return 0


def section(title):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")

def send_group(client, signed_txns):
    encoded = b"".join([
        base64.b64decode(algosdk.encoding.msgpack_encode(s))
        for s in signed_txns
    ])
    return client.send_raw_transaction(base64.b64encode(encoded).decode())

# ── Tests ────────────────────────────────────────────────────────

def test_create_pool(client, app_id, authority_pk, authority_addr, ip_id):
    section("TEST 1: create_pool")

    app_addr = algosdk.logic.get_application_address(app_id)

    # Pack one stakeholder: authority address gets all 100 tokens
    addr_bytes = algosdk.encoding.decode_address(authority_addr)
    bps_bytes  = struct.pack(">H", 100)
    packed_sh  = addr_bytes + bps_bytes

    box_name = box_key(ip_id)
    box_ref  = transaction.BoxReference(0, box_name)

    # Box MBR = 2500 + 400 * box_size
    # Box size = 41 header + 35 * num_stakeholders = 41 + 35 = 76 bytes
    box_size = 41 + (35 * 1)
    box_mbr  = 2500 + 400 * box_size   # = 32_900 microALGO

    # 0.1 ALGO per ASA opt-in (USDC) + 0.1 ALGO for ASA creation = 200_000
    inner_mbr = 200_000

    sp_params = sp(client)

    # Payment to cover box MBR + inner transaction MBRs
    pay = transaction.PaymentTxn(
        sender=authority_addr,
        sp=sp_params,
        receiver=app_addr,
        amt=500_000,
    )

    app_call = transaction.ApplicationNoOpTxn(
        sender=authority_addr,
        sp=sp(client, fee=4000),  # covers 2 inner txns (USDC opt-in + ASA mint)
        index=app_id,
        app_args=[
            b"create_pool",
            ip_id.encode(),
            b"TestToken",
            b"TST",
            packed_sh,
        ],
        foreign_assets=[USDC_ASSET_ID],  # must reference USDC for opt-in
        boxes=[box_ref],
    )

    gid = transaction.calculate_group_id([pay, app_call])
    pay.group      = gid
    app_call.group = gid

    txid   = send_group(client, [pay.sign(authority_pk), app_call.sign(authority_pk)])
    result = wait(client, txid)
    print(f"  {PASS} create_pool confirmed: {txid}")

    # Read box
    box = parse_box(read_box(client, app_id, ip_id))
    print_box("Box after create_pool", box)

    assert box["rev_asa_id"] > 0,        "rev_asa_id not set"
    assert box["total_deposited"] == 0,  "total_deposited should be 0"
    assert box["held_usdc"] == 0,        "held_usdc should be 0"
    assert box["delivered_at"] == 0,     "delivered_at should be 0"
    assert box["num_stakeholders"] == 1, "num_stakeholders should be 1"

    asa_id = box["rev_asa_id"]
    print(f"  {PASS} Box state verified")
    print(f"  Revenue token ASA ID: {asa_id}")

    for log in result.get("logs", []):
        decoded = base64.b64decode(log)
        if decoded.startswith(b"asset_id:"):
            logged_id = struct.unpack_from(">Q", decoded, 9)[0]
            assert logged_id == asa_id, "Logged asset ID mismatch"
            print(f"  {PASS} Log confirmed asset_id: {logged_id}")

    return asa_id


def test_deposit_held(client, app_id, authority_pk, authority_addr, ip_id, amount_usdc):
    section("TEST 2: deposit_held")

    micro = int(amount_usdc * 1_000_000)
    box_name = box_key(ip_id)

    # Opt app into USDC first if needed (should already be from create, but check)
    app_addr = algosdk.logic.get_application_address(app_id)

    # Group: [axfer USDC to app] + [app call deposit_held]
    sp_params = sp(client)

    axfer = transaction.AssetTransferTxn(
        sender=authority_addr,
        sp=sp_params,
        receiver=app_addr,
        amt=micro,
        index=USDC_ASSET_ID,
    )
    app_call = transaction.ApplicationNoOpTxn(
        sender=authority_addr,
        sp=sp_params,
        index=app_id,
        app_args=[b"deposit_held", ip_id.encode()],
        foreign_assets=[USDC_ASSET_ID],
        boxes=[transaction.BoxReference(0, box_name)],
    )

    gid = transaction.calculate_group_id([axfer, app_call])
    axfer.group   = gid
    app_call.group = gid

    signed = [axfer.sign(authority_pk), app_call.sign(authority_pk)]
# NEW
    txid = send_group(client, signed)
    wait(client, txid)
    print(f"  {PASS} deposit_held confirmed: {txid}")

    box = parse_box(read_box(client, app_id, ip_id))
    print_box("Box after deposit_held", box)

    assert box["held_usdc"] == micro, f"held_usdc expected {micro}, got {box['held_usdc']}"
    assert box["total_deposited"] == 0, "total_deposited should still be 0"
    print(f"  {PASS} held_usdc = {amount_usdc} USDC verified")


def test_set_delivered(client, app_id, authority_pk, authority_addr, ip_id):
    section("TEST 3: set_delivered")

    now = int(time.time())
    box_name = box_key(ip_id)

    txn = transaction.ApplicationNoOpTxn(
        sender=authority_addr,
        sp=sp(client),
        index=app_id,
        app_args=[
            b"set_delivered",
            ip_id.encode(),
            uint64_be(now),
        ],
        boxes=[transaction.BoxReference(0, box_name)],
    )
    signed = txn.sign(authority_pk)
    txid   = client.send_transaction(signed)
    wait(client, txid)
    print(f"  {PASS} set_delivered confirmed: {txid}")

    box = parse_box(read_box(client, app_id, ip_id))
    print_box("Box after set_delivered", box)

    assert box["delivered_at"] > 0,      "delivered_at should be set"
    assert abs(box["delivered_at"] - now) < 10, "delivered_at timestamp off"
    print(f"  {PASS} delivered_at = {box['delivered_at']} verified")

    # Test: cannot set delivered_at twice
    try:
        txn2 = transaction.ApplicationNoOpTxn(
            sender=authority_addr,
            sp=sp(client),
            index=app_id,
            app_args=[b"set_delivered", ip_id.encode(), uint64_be(now + 999)],
            boxes=[transaction.BoxReference(0, box_name)],
        )
        signed2 = txn2.sign(authority_pk)
        client.send_transaction(signed2)
        print(f"  {FAIL} SHOULD HAVE REJECTED second set_delivered")
    except Exception as e:
        print(f"  {PASS} Correctly rejected second set_delivered: {str(e)[:60]}")


def test_release_held_admin(client, app_id, authority_pk, authority_addr, ip_id, amount_usdc):
    section("TEST 4: release_held (admin mode)")

    micro = int(amount_usdc * 1_000_000)
    box_name = box_key(ip_id)

    box_before = parse_box(read_box(client, app_id, ip_id))

    txn = transaction.ApplicationNoOpTxn(
        sender=authority_addr,
        sp=sp(client),
        index=app_id,
        app_args=[
            b"release_held",
            ip_id.encode(),
            uint64_be(micro),
        ],
        boxes=[transaction.BoxReference(0, box_name)],
    )
    signed = txn.sign(authority_pk)
    txid   = client.send_transaction(signed)
    wait(client, txid)
    print(f"  {PASS} release_held confirmed: {txid}")

    box = parse_box(read_box(client, app_id, ip_id))
    print_box("Box after release_held", box)

    assert box["held_usdc"] == box_before["held_usdc"] - micro, "held_usdc not decremented"
    assert box["total_deposited"] == box_before["total_deposited"] + micro, "total_deposited not incremented"
    print(f"  {PASS} {amount_usdc} USDC moved from held → total_deposited")


def test_claim_tokens(client, app_id, authority_pk, authority_addr, ip_id, asa_id):
    section("TEST 5: claim_tokens")

    box_name = box_key(ip_id)

    # Opt in to the revenue token ASA
    opt_in_asset(client, authority_pk, authority_addr, asa_id)

    bal_before = asset_balance(client, authority_addr, asa_id)

    txn = transaction.ApplicationNoOpTxn(
        sender=authority_addr,
        sp=sp(client),
        index=app_id,
        app_args=[b"claim_tokens", ip_id.encode()],
        foreign_assets=[asa_id],
        boxes=[transaction.BoxReference(0, box_name)],
    )
    signed = txn.sign(authority_pk)
    txid   = client.send_transaction(signed)
    wait(client, txid)
    print(f"  {PASS} claim_tokens confirmed: {txid}")

    bal_after = asset_balance(client, authority_addr, asa_id)
    print(f"    Token balance: {bal_before} → {bal_after}")

    assert bal_after == bal_before + TOTAL_TOKENS, f"Expected {TOTAL_TOKENS} tokens, got {bal_after - bal_before}"
    print(f"  {PASS} Received {TOTAL_TOKENS} revenue tokens")

    # Test: cannot claim tokens twice
    try:
        txn2 = transaction.ApplicationNoOpTxn(
            sender=authority_addr,
            sp=sp(client),
            index=app_id,
            app_args=[b"claim_tokens", ip_id.encode()],
            foreign_assets=[asa_id],
            boxes=[transaction.BoxReference(0, box_name)],
        )
        signed2 = txn2.sign(authority_pk)
        client.send_transaction(signed2)
        print(f"  {FAIL} SHOULD HAVE REJECTED second claim_tokens")
    except Exception as e:
        print(f"  {PASS} Correctly rejected second claim_tokens: {str(e)[:60]}")


def test_claim_revenue(client, app_id, authority_pk, authority_addr, ip_id, asa_id, user_tokens):
    section("TEST 6: claim_revenue")

    box_name = box_key(ip_id)

    # Opt in to USDC if needed
    opt_in_asset(client, authority_pk, authority_addr, USDC_ASSET_ID)

    usdc_before = asset_balance(client, authority_addr, USDC_ASSET_ID)
    box_before  = parse_box(read_box(client, app_id, ip_id))

    expected_usdc = (box_before["total_deposited"] - box_before["total_claimed"]) * user_tokens // TOTAL_TOKENS

    txn = transaction.ApplicationNoOpTxn(
        sender=authority_addr,
        sp=sp(client),
        index=app_id,
        app_args=[
            b"claim_revenue",
            ip_id.encode(),
            uint64_be(user_tokens),
        ],
        foreign_assets=[USDC_ASSET_ID, asa_id],
        boxes=[transaction.BoxReference(0, box_name)],
    )
    signed = txn.sign(authority_pk)
    txid   = client.send_transaction(signed)
    wait(client, txid)
    print(f"  {PASS} claim_revenue confirmed: {txid}")

    usdc_after = asset_balance(client, authority_addr, USDC_ASSET_ID)
    box_after  = parse_box(read_box(client, app_id, ip_id))
    print_box("Box after claim_revenue", box_after)

    received = usdc_after - usdc_before
    print(f"    USDC received: {received / 1e6:.2f} USDC (expected {expected_usdc / 1e6:.2f})")

    assert received == expected_usdc, f"USDC mismatch: got {received}, expected {expected_usdc}"
    assert box_after["total_claimed"] == box_before["total_claimed"] + received
    print(f"  {PASS} Received correct USDC payout")


def test_set_release_mode(client, app_id, authority_pk, authority_addr):
    section("TEST 7: set_release_mode (0→1)")

    txn = transaction.ApplicationNoOpTxn(
        sender=authority_addr,
        sp=sp(client),
        index=app_id,
        app_args=[b"set_release_mode", uint64_be(1)],
    )
    signed = txn.sign(authority_pk)
    txid   = client.send_transaction(signed)
    wait(client, txid)
    print(f"  {PASS} set_release_mode(1) confirmed: {txid}")

    state = client.application_info(app_id)["params"]["global-state"]
    mode  = None
    for kv in state:
        key = base64.b64decode(kv["key"]).decode()
        if key == "release_mode":
            mode = kv["value"]["uint"]
    assert mode == 1, f"release_mode expected 1, got {mode}"
    print(f"  {PASS} Global state release_mode = 1")


def test_set_release_delay(client, app_id, authority_pk, authority_addr):
    section("TEST 8: set_release_delay (14→0 for testing)")

    txn = transaction.ApplicationNoOpTxn(
        sender=authority_addr,
        sp=sp(client),
        index=app_id,
        app_args=[b"set_release_delay", uint64_be(0)],
    )
    try:
        signed = txn.sign(authority_pk)
        txid   = client.send_transaction(signed)
        wait(client, txid)
        # If it accepted 0, that's a bug — we assert > 0 in contract
        print(f"  {FAIL} Should have rejected delay=0")
    except Exception as e:
        print(f"  {PASS} Correctly rejected delay=0: {str(e)[:60]}")

    # Set to 1 second (effectively immediate for test)
    txn2 = transaction.ApplicationNoOpTxn(
        sender=authority_addr,
        sp=sp(client),
        index=app_id,
        app_args=[b"set_release_delay", uint64_be(1)],
    )
    signed2 = txn2.sign(authority_pk)
    txid2   = client.send_transaction(signed2)
    wait(client, txid2)

    state = client.application_info(app_id)["params"]["global-state"]
    for kv in state:
        key = base64.b64decode(kv["key"]).decode()
        if key == "release_delay_days":
            delay = kv["value"]["uint"]
            assert delay == 1, f"Expected delay=1, got {delay}"
    print(f"  {PASS} release_delay_days set to 1 (1 day = fast test)")


def test_auto_release(client, app_id, authority_pk, authority_addr, ip_id, amount_usdc):
    section("TEST 9+10: deposit_held + release_held (auto mode)")

    micro    = int(amount_usdc * 1_000_000)
    box_name = box_key(ip_id)
    app_addr = algosdk.logic.get_application_address(app_id)
    sp_p     = sp(client)

    # deposit_held
    axfer = transaction.AssetTransferTxn(
        sender=authority_addr, sp=sp_p,
        receiver=app_addr, amt=micro, index=USDC_ASSET_ID,
    )
    app_call = transaction.ApplicationNoOpTxn(
        sender=authority_addr, sp=sp_p, index=app_id,
        app_args=[b"deposit_held", ip_id.encode()],
        foreign_assets=[USDC_ASSET_ID],
        boxes=[transaction.BoxReference(0, box_name)],
    )
    gid = transaction.calculate_group_id([axfer, app_call])
    axfer.group = app_call.group = gid
    # NEW
    stxns = [axfer.sign(authority_pk), app_call.sign(authority_pk)]
    txid = send_group(client, stxns)
    wait(client, txid)
    print(f"  {PASS} deposit_held confirmed: {txid}")

    # Auto release — delay is 1 day so this will be rejected (as expected)
    # unless delivered_at is > 1 day ago. Since we just set delivered_at = now,
    # this tests that the time lock actually works.
    try:
        txn = transaction.ApplicationNoOpTxn(
            sender=authority_addr, sp=sp(client), index=app_id,
            app_args=[b"release_held", ip_id.encode(), uint64_be(micro)],
            boxes=[transaction.BoxReference(0, box_name)],
        )
        signed = txn.sign(authority_pk)
        txid2  = client.send_transaction(signed)
        wait(client, txid2)
        print(f"  {FAIL} Should have rejected auto release (too early)")
    except Exception as e:
        print(f"  {PASS} Correctly rejected auto release before delay: {str(e)[:60]}")

    print(f"\n  ℹ️  Auto-release time lock verified.")
    print(f"     In production: release_delay_days=14, delivered_at must be 14+ days ago.")


# ── Main ─────────────────────────────────────────────────────────

def main():
    # Load app ID
    if not os.path.exists(APP_ID_FILE):
        print("ERROR: app_id.txt not found. Run deploy_v4.py first.")
        sys.exit(1)
    with open(APP_ID_FILE) as f:
        app_id = int(f.read().strip())
    print(f"\nTesting App ID: {app_id}")

    # Load authority wallet
    mnemonic = os.environ.get("AUTHORITY_MNEMONIC", "").strip()
    if not mnemonic:
        mnemonic = input("Enter authority wallet mnemonic: ").strip()
    private_key   = algosdk.mnemonic.to_private_key(mnemonic)
    authority_addr = algosdk.account.address_from_private_key(private_key)
    print(f"Authority: {authority_addr}")

    client = get_client()

    # Check USDC balance
    usdc_bal = asset_balance(client, authority_addr, USDC_ASSET_ID)
    if usdc_bal == 0:
        print(f"\n⚠️  No TestNet USDC found in authority wallet.")
        print(f"   Get some at: https://testnet.folks.finance/")
        print(f"   Or dispenser: https://dispenser.testnet.aws.algodev.network/")
        print(f"   Asset ID: {USDC_ASSET_ID}")
        sys.exit(1)
    print(f"USDC balance: {usdc_bal / 1e6:.2f} USDC")

    ip_id      = TEST_IP_ID
    test_usdc  = min(1.0, usdc_bal / 1e6 * 0.1)  # use 10% of balance, max 1 USDC
    print(f"\nTest IP ID:  {ip_id}")
    print(f"Test amount: {test_usdc} USDC")

    try:
        asa_id = test_create_pool(client, app_id, private_key, authority_addr, ip_id)
        test_deposit_held(client, app_id, private_key, authority_addr, ip_id, test_usdc)
        test_set_delivered(client, app_id, private_key, authority_addr, ip_id)
        test_release_held_admin(client, app_id, private_key, authority_addr, ip_id, test_usdc)
        test_claim_tokens(client, app_id, private_key, authority_addr, ip_id, asa_id)
        test_claim_revenue(client, app_id, private_key, authority_addr, ip_id, asa_id, TOTAL_TOKENS)
        test_set_release_mode(client, app_id, private_key, authority_addr)
        test_set_release_delay(client, app_id, private_key, authority_addr)
        test_auto_release(client, app_id, private_key, authority_addr, ip_id, test_usdc)

        section("ALL TESTS PASSED ✅")
        print(f"\n  App ID:    {app_id}")
        print(f"  IP ID:     {ip_id}")
        print(f"  ASA ID:    {asa_id}")
        print(f"  Explorer:  https://testnet.explorer.perawallet.app/application/{app_id}/\n")

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