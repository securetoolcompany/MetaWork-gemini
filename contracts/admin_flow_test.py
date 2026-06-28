#!/usr/bin/env python3
"""
admin_flow_test.py  —  End-to-end admin revenue flow test

Tests deposit_held → release_held → read round box via API

Usage:
    CREATOR_MNEMONIC="..." python admin_flow_test.py

Requires the Next.js dev server running on localhost:3000
"""

import os
import sys
import json
import base64
import struct
import urllib.request
import urllib.error
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk.transaction import assign_group_id, wait_for_confirmation

ALGOD_ADDRESS    = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN      = ""
APP_ID           = 765208294
PRODUCT_ID       = "smoke-test-001"
API_BASE         = "http://localhost:3000"

# 1 USDC = 1,000,000 base units
DEPOSIT_AMOUNT   = 10_000_000  # 10 USDC

CREATOR_MNEMONIC = os.getenv("CREATOR_MNEMONIC", "")
if not CREATOR_MNEMONIC:
    sys.exit("ERROR: Set CREATOR_MNEMONIC before running.")

PRIVATE_KEY    = mnemonic.to_private_key(CREATOR_MNEMONIC)
SENDER_ADDRESS = account.address_from_private_key(PRIVATE_KEY)

client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def api_get(path):
    url = f"{API_BASE}{path}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read())

def api_post(path, body):
    url  = f"{API_BASE}{path}"
    data = json.dumps(body).encode()
    req  = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def sign_and_submit(txns_base64):
    import algosdk
    txns = [algosdk.encoding.msgpack_decode(t) for t in txns_base64]
    signed = [t.sign(PRIVATE_KEY) for t in txns]
    tx_id  = client.send_transactions(signed)
    print(f"      TXID: {tx_id}")
    result = wait_for_confirmation(client, tx_id, 8)
    print(f"      Confirmed in round {result['confirmed-round']}")
    return tx_id

def api_post(path, body):
    url  = f"{API_BASE}{path}"
    data = json.dumps(body).encode()
    req  = urllib.request.Request(url, data=data, headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer dev-bypass",
    }, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read()
        print(f"      HTTP {e.code} from {path}: {body.decode()}")
        try:
            return json.loads(body)
        except Exception:
            return {"error": f"HTTP {e.code}: {body.decode()}"}

# ---------------------------------------------------------------------------
# Step 1 — Verify baseline state
# ---------------------------------------------------------------------------
print("\n[1/4] Checking baseline pool state...")
pool = api_get(f"/api/pool/global?productId={PRODUCT_ID}")
info = pool["productInfo"]
print(f"      held:      {info['held']}")
print(f"      curRound:  {info['curRound']}")
assert info["held"] == 0,      f"Expected held=0, got {info['held']}"
assert info["curRound"] == 0,  f"Expected curRound=0, got {info['curRound']}"
print("      ✓ Baseline confirmed")


# ---------------------------------------------------------------------------
# Step 2 — deposit_held
# ---------------------------------------------------------------------------
print(f"\n[2/4] Calling deposit_held ({DEPOSIT_AMOUNT / 1e6:.2f} USDC)...")
resp = api_post("/api/revenue-pool/deposit-held", {
    "productId":  PRODUCT_ID,
    "amountUsdc": DEPOSIT_AMOUNT,
})
if "error" in resp:
    sys.exit(f"deposit_held API error: {resp['error']}")

print(f"      MBR/fee: {resp.get('amountFormatted')}")
sign_and_submit(resp["transactions"])

# Verify held updated
pool = api_get(f"/api/pool/global?productId={PRODUCT_ID}")
info = pool["productInfo"]
print(f"      held after deposit: {info['held']}")
assert info["held"] == DEPOSIT_AMOUNT, f"held mismatch: expected {DEPOSIT_AMOUNT}, got {info['held']}"
print("      ✓ deposit_held confirmed")


# ---------------------------------------------------------------------------
# Step 3 — release_held
# ---------------------------------------------------------------------------
print(f"\n[3/4] Calling release_held...")
resp = api_post("/api/revenue-pool/release-held", {
    "productId": PRODUCT_ID,
})
if "error" in resp:
    sys.exit(f"release_held API error: {resp['error']}")

print(f"      Round MBR: {resp.get('roundBoxMbrFormatted')}")
print(f"      Next round: {resp.get('nextRound')}")
sign_and_submit(resp["transactions"])

# Verify round incremented and held zeroed
pool = api_get(f"/api/pool/global?productId={PRODUCT_ID}")
info = pool["productInfo"]
print(f"      held after release:     {info['held']}")
print(f"      curRound after release: {info['curRound']}")
assert info["held"] == 0,     f"held should be 0 after release, got {info['held']}"
assert info["curRound"] == 1, f"curRound should be 1, got {info['curRound']}"
print("      ✓ release_held confirmed")


# ---------------------------------------------------------------------------
# Step 4 — read round box
# ---------------------------------------------------------------------------
print(f"\n[4/4] Reading round 1 box...")
resp = api_get(f"/api/revenue-pool/rounds/1?productId={PRODUCT_ID}")
if not resp.get("success"):
    sys.exit(f"Round read error: {resp.get('error')}")

rnd = resp["round"]
print(f"      amount:     {rnd['amountFormatted']}")
print(f"      createdAt:  {rnd['createdAtIso']}")
print(f"      entries:    {rnd['numEntries']}")
print(f"      settled:    {rnd['fullySettled']}")
print()
for e in rnd["entries"]:
    print(f"      {e['address']}  {e['amountFormatted']}  {'CLAIMED' if e['claimed'] else 'UNCLAIMED'}")

assert rnd["amount"] == DEPOSIT_AMOUNT,   f"Round amount mismatch"
assert rnd["numEntries"] == 2,            f"Expected 2 entries, got {rnd['numEntries']}"
assert not rnd["fullySettled"],           f"Round should not be settled yet"

total_entries = sum(e["amount"] for e in rnd["entries"])
dust = DEPOSIT_AMOUNT - total_entries
print(f"\n      Dust (stays in unallocated): {dust} microUSDC")
assert total_entries <= DEPOSIT_AMOUNT,   f"Entry amounts exceed deposit"

print(f"\n✅ Full admin flow verified. Round 1 is live and ready for claims.")