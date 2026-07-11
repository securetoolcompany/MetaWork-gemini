#!/usr/bin/env python3
"""
smoke_test_v7.py  —  create_pool smoke test for Revenue Pool V7

Tests:
  1. Packs two stakeholder entries (addr + bps, 34 bytes each)
  2. Calculates exact MBR for the pool box
  3. Builds a 3-txn atomic group:
       [0] Payment  → app address (MBR companion)
       [1] NoOp     → create_pool call (companion_idx = 0)
  4. Submits, waits for confirmation
  5. Reads back the pool box and validates the header

Usage:
    CREATOR_MNEMONIC="..." python smoke_test_v7.py
"""

import os
import sys
import base64
import struct
from algosdk import account, mnemonic, encoding
from algosdk.v2client import algod
from algosdk.transaction import (
    ApplicationNoOpTxn,
    PaymentTxn,
    assign_group_id,
    wait_for_confirmation,
)

# ---------------------------------------------------------------------------
# Config — matches your live deploy
# ---------------------------------------------------------------------------
ALGOD_ADDRESS     = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN       = ""
APP_ID            = 765208294
APP_ADDRESS       = "O3NVHXTEBBICZRRSCY5QWPF3FRNQPFVGLBAXAGHOF5F2WOVLT5A6V6WYHQ"
USDC_ASSET_ID     = 10458941

CREATOR_MNEMONIC  = os.getenv("CREATOR_MNEMONIC", "")
if not CREATOR_MNEMONIC:
    sys.exit("ERROR: Set CREATOR_MNEMONIC before running.")

CREATOR_PRIVATE_KEY = mnemonic.to_private_key(CREATOR_MNEMONIC)
CREATOR_ADDRESS     = account.address_from_private_key(CREATOR_PRIVATE_KEY)

# ---------------------------------------------------------------------------
# Pool parameters
# ---------------------------------------------------------------------------
IP_ID       = b"smoke-test-001"          # must be <= 50 bytes
TOKEN_NAME  = b"SmokeToken"
TOKEN_UNIT  = b"SMK"

# Two stakeholders — creator gets 7000 bps, second wallet gets 3000 bps.
# For a smoke test both can be the same address.
STAKEHOLDERS = [
    (CREATOR_ADDRESS, 7000),
    ("COYJN7VFKE4FJO4BSUSYQA56GIE6CL6MUJLA5YY2HR47Z5RX2GH27TUOTE", 3000),   # replace with a second address if available
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def pack_stakeholders(stakeholders):
    """Pack list of (address_str, bps_int) into 34-byte-per-entry bytes."""
    buf = b""
    for addr, bps in stakeholders:
        raw = encoding.decode_address(addr)   # 32 bytes
        raw += struct.pack(">H", bps)         # 2 bytes big-endian uint16
        buf += raw
    return buf

def calc_pool_mbr(ip_id_bytes, sh_count):
    """2500 + 400 * (75 + len(ip_id) + sh_count * 35)"""
    return 2500 + 400 * (75 + len(ip_id_bytes) + sh_count * 35)

def pool_box_key(ip_id_bytes):
    return b"p_" + ip_id_bytes

# ---------------------------------------------------------------------------
# Pool box offsets for validation
# ---------------------------------------------------------------------------
REV_ASA_OFFSET      = 0
UNALLOCATED_OFFSET  = 8
TOTAL_CLM_OFFSET    = 16
HELD_OFFSET         = 24
CUR_ROUND_OFFSET    = 32
NUM_SH_OFFSET       = 40
PROXY_ADDR_OFFSET   = 41
POOL_ENTRIES_OFFSET = 73
SH_ENTRY_SIZE       = 35

def read_u64(data, offset):
    return struct.unpack_from(">Q", data, offset)[0]

def read_u8(data, offset):
    return data[offset]

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run():
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)
    sp     = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 3000   # outer txn covers 3 inner txn fees (opt-in + ASA create + 1 spare)

    sh_bytes  = pack_stakeholders(STAKEHOLDERS)
    sh_count  = len(STAKEHOLDERS)
    mbr       = calc_pool_mbr(IP_ID, sh_count)

    print(f"Creator:      {CREATOR_ADDRESS}")
    print(f"App ID:       {APP_ID}")
    print(f"ip_id:        {IP_ID.decode()}")
    print(f"Stakeholders: {sh_count}")
    print(f"Pool box MBR: {mbr} microAlgo ({mbr/1e6:.6f} ALGO)")
    print(f"sh_bytes len: {len(sh_bytes)} bytes (expect {sh_count * 34})")
    print()

    # Build companion Payment (index 0 in group)
    pay_txn = PaymentTxn(
        sender=CREATOR_ADDRESS,
        sp=sp,
        receiver=APP_ADDRESS,
        amt=mbr,
    )

    # Build create_pool NoOp (index 1 in group)
    # Args: [method, ip_id, token_name, token_unit, sh_bytes, companion_idx]
    # companion_idx = 0  (the Payment above is at group index 0)
    app_txn = ApplicationNoOpTxn(
        sender=CREATOR_ADDRESS,
        sp=sp,
        index=APP_ID,
        app_args=[
            b"create_pool",
            IP_ID,
            TOKEN_NAME,
            TOKEN_UNIT,
            sh_bytes,
            (0).to_bytes(8, "big"),   # companion_idx = 0
        ],
        boxes=[(APP_ID, pool_box_key(IP_ID))],
        foreign_assets=[USDC_ASSET_ID],
    )

    # Assign group ID
    assign_group_id([pay_txn, app_txn])

    # Sign both
    signed_pay = pay_txn.sign(CREATOR_PRIVATE_KEY)
    signed_app = app_txn.sign(CREATOR_PRIVATE_KEY)

    print("[1/3] Submitting atomic group (Payment + create_pool)...")
    tx_id = client.send_transactions([signed_pay, signed_app])
    print(f"      TXID: {tx_id}")

    result = wait_for_confirmation(client, tx_id, 8)
    print(f"      Confirmed in round {result['confirmed-round']}")

    # Pull asset_id from logs
    logs = result.get("logs", [])
    for log in logs:
        decoded = base64.b64decode(log)
        if decoded.startswith(b"asset_id:"):
            asa_id = struct.unpack(">Q", decoded[9:])[0]
            print(f"      Revenue token ASA ID: {asa_id}")

    # ------------------------------------------------------------------
    # Step 2 — Read back and validate pool box
    # ------------------------------------------------------------------
    print("\n[2/3] Reading pool box...")
    box_key_b64 = base64.b64encode(pool_box_key(IP_ID)).decode()
    box_resp    = client.application_box_by_name(APP_ID, pool_box_key(IP_ID))
    box_data    = base64.b64decode(box_resp["value"])

    print(f"      Box size: {len(box_data)} bytes")
    print(f"      Expected: {73 + sh_count * 35} bytes")

    rev_asa     = read_u64(box_data, REV_ASA_OFFSET)
    unallocated = read_u64(box_data, UNALLOCATED_OFFSET)
    total_clm   = read_u64(box_data, TOTAL_CLM_OFFSET)
    held        = read_u64(box_data, HELD_OFFSET)
    cur_round   = read_u64(box_data, CUR_ROUND_OFFSET)
    num_sh      = read_u8(box_data,  NUM_SH_OFFSET)

    print(f"\n      --- Pool Box Header ---")
    print(f"      rev_asa_id:   {rev_asa}")
    print(f"      unallocated:  {unallocated}")
    print(f"      total_claimed:{total_clm}")
    print(f"      held:         {held}")
    print(f"      cur_round:    {cur_round}")
    print(f"      num_sh:       {num_sh}")

    # Validate stakeholder entries
    print(f"\n      --- Stakeholder Entries ---")
    for i in range(num_sh):
        off  = POOL_ENTRIES_OFFSET + i * SH_ENTRY_SIZE
        addr = encoding.encode_address(box_data[off:off+32])
        bps  = struct.unpack_from(">H", box_data, off+32)[0]
        flag = box_data[off+34]
        print(f"      [{i}] {addr}  bps={bps}  flag={'UNCLAIMED' if flag == 0 else 'CLAIMED'}")

    # Assertions
    assert num_sh == sh_count,       f"num_sh mismatch: got {num_sh}, expected {sh_count}"
    assert cur_round == 0,           f"cur_round should be 0 at init, got {cur_round}"
    assert unallocated == 0,         f"unallocated should be 0 at init, got {unallocated}"
    assert held == 0,                f"held should be 0 at init, got {held}"
    assert rev_asa > 0,              f"rev_asa_id should be > 0, got {rev_asa}"
    assert len(box_data) == 73 + sh_count * 35, "box size wrong"

    print(f"\n[3/3] ✅ All assertions passed. Box parser is correctly aligned.")
    print(f"      App ID {APP_ID} is live and ready for API layer work.")

if __name__ == "__main__":
    run()