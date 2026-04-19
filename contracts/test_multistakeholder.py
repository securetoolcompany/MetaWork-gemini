"""
test_multistakeholder.py — Multi-stakeholder lifecycle test
────────────────────────────────────────────────────────────
Two wallets: authority (80%) + metawork (20%)
Tests:
  1. create_pool with 2 stakeholders
  2. deposit_held + release
  3. Both stakeholders claim tokens
  4. Both stakeholders claim proportional USDC
  5. Double-claim rejected for both
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
TEST_IP_ID  = f"multi_{int(time.time())}"

PASS = "✅"
FAIL = "❌"

# ── Copy helpers from test_v4.py ──────────────────────────────────

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
    return base64.b64decode(result["value"])

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
    print(f"      total_deposited: {parsed['total_deposited'] / 1e6:.6f} USDC")
    print(f"      total_claimed:   {parsed['total_claimed'] / 1e6:.6f} USDC")
    print(f"      held_usdc:       {parsed['held_usdc'] / 1e6:.6f} USDC")
    print(f"      num_stakeholders:{parsed['num_stakeholders']}")

def opt_in_asset(client, pk, addr, asset_id):
    info = client.account_info(addr)
    held = [a["asset-id"] for a in info.get("assets", [])]
    if asset_id in held:
        return
    txn = transaction.AssetOptInTxn(sender=addr, sp=sp(client), index=asset_id)
    txid = client.send_transaction(txn.sign(pk))
    wait(client, txid)
    print(f"    Opted in to asset {asset_id} for {addr[:8]}...")

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

# ── Tests ─────────────────────────────────────────────────────────

def test_create_pool_2sh(client, app_id, auth_pk, auth_addr, mw_addr, ip_id):
    section("TEST 1: create_pool (2 stakeholders — 80/20 split)")

    app_addr = algosdk.logic.get_application_address(app_id)

    # Pack 2 stakeholders: auth=80 bps, metawork=20 bps
    packed_sh = (
        algosdk.encoding.decode_address(auth_addr) + struct.pack(">H", 80) +
        algosdk.encoding.decode_address(mw_addr)   + struct.pack(">H", 20)
    )

    box_name = box_key(ip_id)
    box_size = 41 + (35 * 2)   # 2 stakeholders

    pay = transaction.PaymentTxn(
        sender=auth_addr,
        sp=sp(client),
        receiver=app_addr,
        amt=500_000,
    )
    app_call = transaction.ApplicationNoOpTxn(
        sender=auth_addr,
        sp=sp(client, fee=4000),
        index=app_id,
        app_args=[b"create_pool", ip_id.encode(), b"MultiTest", b"MLT", packed_sh],
        foreign_assets=[USDC_ASSET_ID],
        boxes=[transaction.BoxReference(0, box_name)],
    )

    gid = transaction.calculate_group_id([pay, app_call])
    pay.group = app_call.group = gid
    txid = send_group(client, [pay.sign(auth_pk), app_call.sign(auth_pk)])
    wait(client, txid)
    print(f"  {PASS} create_pool confirmed: {txid}")

    box = parse_box(read_box(client, app_id, ip_id))
    print_box("Box after create_pool", box)

    assert box["num_stakeholders"] == 2, "Expected 2 stakeholders"
    assert box["rev_asa_id"] > 0
    print(f"  {PASS} 2 stakeholders confirmed")
    print(f"  Revenue ASA: {box['rev_asa_id']}")
    return box["rev_asa_id"]


def test_deposit_and_release(client, app_id, auth_pk, auth_addr, ip_id, usdc_amount):
    section("TEST 2: deposit_held + set_delivered + release_held")

    micro    = int(usdc_amount * 1_000_000)
    app_addr = algosdk.logic.get_application_address(app_id)
    box_name = box_key(ip_id)

    # deposit_held
    axfer = transaction.AssetTransferTxn(
        sender=auth_addr, sp=sp(client),
        receiver=app_addr, amt=micro, index=USDC_ASSET_ID,
    )
    app_call = transaction.ApplicationNoOpTxn(
        sender=auth_addr, sp=sp(client), index=app_id,
        app_args=[b"deposit_held", ip_id.encode()],
        foreign_assets=[USDC_ASSET_ID],
        boxes=[transaction.BoxReference(0, box_name)],
    )
    gid = transaction.calculate_group_id([axfer, app_call])
    axfer.group = app_call.group = gid
    txid = send_group(client, [axfer.sign(auth_pk), app_call.sign(auth_pk)])
    wait(client, txid)
    print(f"  {PASS} deposit_held: {usdc_amount} USDC")

    # set_delivered
    now = int(time.time())
    txn = transaction.ApplicationNoOpTxn(
        sender=auth_addr, sp=sp(client), index=app_id,
        app_args=[b"set_delivered", ip_id.encode(), uint64_be(now)],
        boxes=[transaction.BoxReference(0, box_name)],
    )
    txid = client.send_transaction(txn.sign(auth_pk))
    wait(client, txid)
    print(f"  {PASS} set_delivered: {now}")

    # release_held (admin mode)
    txn = transaction.ApplicationNoOpTxn(
        sender=auth_addr, sp=sp(client, fee=3000), index=app_id,
        app_args=[b"release_held", ip_id.encode(), uint64_be(micro)],
        boxes=[transaction.BoxReference(0, box_name)],
    )
    txid = client.send_transaction(txn.sign(auth_pk))
    wait(client, txid)

    box = parse_box(read_box(client, app_id, ip_id))
    print_box("Box after release", box)
    assert box["total_deposited"] == micro
    assert box["held_usdc"] == 0
    print(f"  {PASS} {usdc_amount} USDC released and claimable")


def test_claim_tokens_both(client, app_id, auth_pk, auth_addr,
                            mw_pk, mw_addr, ip_id, asa_id):
    section("TEST 3: claim_tokens — both stakeholders")

    box_name = box_key(ip_id)

    for label, pk, addr, expected_tokens in [
        ("Authority (80%)", auth_pk, auth_addr, 80),
        ("MetaWork  (20%)", mw_pk,   mw_addr,   20),
    ]:
        opt_in_asset(client, pk, addr, asa_id)
        bal_before = asset_balance(client, addr, asa_id)

        txn = transaction.ApplicationNoOpTxn(
            sender=addr, sp=sp(client, fee=2000), index=app_id,
            app_args=[b"claim_tokens", ip_id.encode()],
            foreign_assets=[asa_id],
            boxes=[transaction.BoxReference(0, box_name)],
        )
        txid = client.send_transaction(txn.sign(pk))
        wait(client, txid)

        bal_after = asset_balance(client, addr, asa_id)
        received  = bal_after - bal_before
        print(f"  {PASS} {label}: received {received} tokens (expected {expected_tokens})")
        assert received == expected_tokens, f"Token mismatch: got {received}, expected {expected_tokens}"

    # Verify double-claim rejected for both
    for label, pk, addr in [("Authority", auth_pk, auth_addr), ("MetaWork", mw_pk, mw_addr)]:
        try:
            txn = transaction.ApplicationNoOpTxn(
                sender=addr, sp=sp(client), index=app_id,
                app_args=[b"claim_tokens", ip_id.encode()],
                foreign_assets=[asa_id],
                boxes=[transaction.BoxReference(0, box_name)],
            )
            client.send_transaction(txn.sign(pk))
            print(f"  {FAIL} {label} double-claim should have been rejected")
        except Exception as e:
            print(f"  {PASS} {label} double-claim correctly rejected")


def test_claim_revenue_both(client, app_id, auth_pk, auth_addr,
                             mw_pk, mw_addr, ip_id, asa_id, total_usdc):
    section("TEST 4: claim_revenue — both stakeholders get correct split")

    box_name   = box_key(ip_id)
    total_micro = int(total_usdc * 1_000_000)

    opt_in_asset(client, auth_pk, auth_addr, USDC_ASSET_ID)
    opt_in_asset(client, mw_pk,   mw_addr,   USDC_ASSET_ID)

    for label, pk, addr, tokens, bps in [
        ("Authority (80%)", auth_pk, auth_addr, 80, 80),
        ("MetaWork  (20%)", mw_pk,   mw_addr,   20, 20),
    ]:
        usdc_before = asset_balance(client, addr, USDC_ASSET_ID)
        expected    = total_micro * bps // 100

        txn = transaction.ApplicationNoOpTxn(
            sender=addr, sp=sp(client, fee=2000), index=app_id,
            app_args=[b"claim_revenue", ip_id.encode(), uint64_be(tokens)],
            foreign_assets=[USDC_ASSET_ID, asa_id],
            boxes=[transaction.BoxReference(0, box_name)],
        )
        txid = client.send_transaction(txn.sign(pk))
        wait(client, txid)

        usdc_after = asset_balance(client, addr, USDC_ASSET_ID)
        received   = usdc_after - usdc_before

        print(f"  {PASS} {label}: received {received/1e6:.4f} USDC (expected {expected/1e6:.4f})")
        assert received == expected, f"USDC mismatch: got {received}, expected {expected}"

    box = parse_box(read_box(client, app_id, ip_id))
    print_box("Final box state", box)
    assert box["total_claimed"] == total_micro, "total_claimed should equal total_deposited"
    print(f"  {PASS} Pool fully claimed — total_claimed == total_deposited")


# ── Main ──────────────────────────────────────────────────────────

def main():
    if not os.path.exists(APP_ID_FILE):
        print("ERROR: app_id.txt not found.")
        sys.exit(1)
    with open(APP_ID_FILE) as f:
        app_id = int(f.read().strip())
    print(f"\nTesting App ID: {app_id}")

    # Authority wallet
    auth_mnemonic = os.environ.get("AUTHORITY_MNEMONIC", "").strip()
    if not auth_mnemonic:
        auth_mnemonic = input("Enter AUTHORITY mnemonic: ").strip()
    auth_pk   = algosdk.mnemonic.to_private_key(auth_mnemonic)
    auth_addr = algosdk.account.address_from_private_key(auth_pk)
    print(f"Authority: {auth_addr}")

    # MetaWork wallet (second wallet — generate a fresh one for testing)
    mw_mnemonic = os.environ.get("METAWORK_MNEMONIC", "").strip()
    if not mw_mnemonic:
        mw_mnemonic = input("Enter METAWORK mnemonic (or press Enter to generate): ").strip()

    if not mw_mnemonic:
        mw_pk, mw_addr = algosdk.account.generate_account()
        print(f"\n  ⚠️  Generated fresh MetaWork wallet: {mw_addr}")
        print(f"  Fund it with ALGO before continuing (needs ~0.3 ALGO for opt-ins)")
        print(f"  https://bank.testnet.algorand.network/?account={mw_addr}")
        input("\n  Press Enter once funded...")
    else:
        mw_pk   = algosdk.mnemonic.to_private_key(mw_mnemonic)
        mw_addr = algosdk.account.address_from_private_key(mw_pk)
    print(f"MetaWork:  {mw_addr}")

    client     = get_client()
    usdc_bal   = asset_balance(client, auth_addr, USDC_ASSET_ID)
    test_usdc  = min(1.0, usdc_bal / 1e6 * 0.1)
    print(f"USDC balance: {usdc_bal / 1e6:.2f} USDC  →  testing with {test_usdc} USDC")

    try:
        asa_id = test_create_pool_2sh(client, app_id, auth_pk, auth_addr, mw_addr, TEST_IP_ID)
        test_deposit_and_release(client, app_id, auth_pk, auth_addr, TEST_IP_ID, test_usdc)
        test_claim_tokens_both(client, app_id, auth_pk, auth_addr, mw_pk, mw_addr, TEST_IP_ID, asa_id)
        test_claim_revenue_both(client, app_id, auth_pk, auth_addr, mw_pk, mw_addr, TEST_IP_ID, asa_id, test_usdc)

        section("ALL MULTI-STAKEHOLDER TESTS PASSED ✅")
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