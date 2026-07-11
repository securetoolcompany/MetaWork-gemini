#!/usr/bin/env python3
"""
admin_flow_test.py — Full admin + claim flow test for Revenue Pool V7
Handles re-runs correctly by reading current chain state first.
"""

import os
import sys
import json
import base64
import urllib.request
import urllib.error
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk.transaction import wait_for_confirmation

ALGOD_ADDRESS  = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN    = ""
APP_ID         = 765208294
PRODUCT_ID     = "smoke-test-001"
API_BASE       = "http://localhost:3000"
DEPOSIT_AMOUNT = 10_000_000  # 10 USDC

CREATOR_MNEMONIC = os.getenv("CREATOR_MNEMONIC", "")
if not CREATOR_MNEMONIC:
    sys.exit("ERROR: Set CREATOR_MNEMONIC before running.")

PRIVATE_KEY    = mnemonic.to_private_key(CREATOR_MNEMONIC)
SENDER_ADDRESS = account.address_from_private_key(PRIVATE_KEY)
client         = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)


def api_get(path):
    url = f"{API_BASE}{path}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read())

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
        raw = e.read()
        print(f"      HTTP {e.code} from {path}: {raw.decode()}")
        try:
            return json.loads(raw)
        except Exception:
            return {"error": f"HTTP {e.code}: {raw.decode()}"}

def sign_and_submit(txns_base64):
    import algosdk
    txns   = [algosdk.encoding.msgpack_decode(t) for t in txns_base64]
    signed = [t.sign(PRIVATE_KEY) for t in txns]
    tx_id  = client.send_transactions(signed)
    print(f"      TXID: {tx_id}")
    result = wait_for_confirmation(client, tx_id, 8)
    print(f"      Confirmed in round {result['confirmed-round']}")
    return tx_id


# ---------------------------------------------------------------------------
# Step 1 — Read current chain state
# ---------------------------------------------------------------------------
print("\n[1/5] Reading current pool state...")
pool         = api_get(f"/api/pool/global?productId={PRODUCT_ID}")
info         = pool["productInfo"]
start_held   = info["held"]
start_round  = info["curRound"]
print(f"      held:      {start_held}")
print(f"      curRound:  {start_round}")
print("      ✓ Baseline read")


# ---------------------------------------------------------------------------
# Step 2 — deposit_held
# ---------------------------------------------------------------------------
print(f"\n[2/5] Calling deposit_held ({DEPOSIT_AMOUNT / 1e6:.2f} USDC)...")
resp = api_post("/api/revenue-pool/deposit-held", {
    "productId":  PRODUCT_ID,
    "amountUsdc": DEPOSIT_AMOUNT,
})
if "error" in resp:
    sys.exit(f"deposit_held error: {resp['error']}")

sign_and_submit(resp["transactions"])

pool = api_get(f"/api/pool/global?productId={PRODUCT_ID}")
info = pool["productInfo"]
print(f"      held after deposit: {info['held']}")
assert info["held"] == DEPOSIT_AMOUNT, f"held mismatch: expected {DEPOSIT_AMOUNT}, got {info['held']}"
print("      ✓ deposit_held confirmed")


# ---------------------------------------------------------------------------
# Step 3 — release_held
# ---------------------------------------------------------------------------
print(f"\n[3/5] Calling release_held...")
resp = api_post("/api/revenue-pool/release-held", {"productId": PRODUCT_ID})
if "error" in resp:
    sys.exit(f"release_held error: {resp['error']}")

expected_round = start_round + 1
print(f"      Round MBR:  {resp.get('roundBoxMbrFormatted')}")
print(f"      Next round: {resp.get('nextRound')} (expecting {expected_round})")
sign_and_submit(resp["transactions"])

pool = api_get(f"/api/pool/global?productId={PRODUCT_ID}")
info = pool["productInfo"]
print(f"      held after release:     {info['held']}")
print(f"      curRound after release: {info['curRound']}")
assert info["held"] == 0,                f"held should be 0, got {info['held']}"
assert info["curRound"] == expected_round, f"curRound should be {expected_round}, got {info['curRound']}"
print("      ✓ release_held confirmed")


# ---------------------------------------------------------------------------
# Step 4 — read round box
# ---------------------------------------------------------------------------
print(f"\n[4/5] Reading round {expected_round} box...")
resp = api_get(f"/api/revenue-pool/rounds/{expected_round}?productId={PRODUCT_ID}")
if not resp.get("success"):
    sys.exit(f"Round read error: {resp.get('error')}")

rnd = resp["round"]
print(f"      amount:    {rnd['amountFormatted']}")
print(f"      createdAt: {rnd['createdAtIso']}")
print(f"      entries:   {rnd['numEntries']}")
print()
for e in rnd["entries"]:
    print(f"      {e['address']}  {e['amountFormatted']}  {'CLAIMED' if e['claimed'] else 'UNCLAIMED'}")

assert rnd["amount"] == DEPOSIT_AMOUNT
assert rnd["numEntries"] == 2
assert not rnd["fullySettled"]
print("      ✓ Round box confirmed")


# ---------------------------------------------------------------------------
# Step 5 — claim-all
# ---------------------------------------------------------------------------
print(f"\n[5/5] Calling claim-all...")
resp = api_post("/api/revenue-pool/claim-all", {"productId": PRODUCT_ID})
if "error" in resp:
    sys.exit(f"claim-all error: {resp['error']}")

if resp.get("totalClaimable", 0) == 0:
    print(f"      Nothing to claim: {resp.get('message')}")
else:
    print(f"      Claimable: {resp.get('totalClaimableFormatted')} across rounds {resp.get('claimableRounds')}")
    for txn_b64 in resp["transactions"]:
        sign_and_submit([txn_b64])

    # Verify round is now settled
    resp = api_get(f"/api/revenue-pool/rounds/{expected_round}?productId={PRODUCT_ID}")
    rnd  = resp["round"]
    print()
    for e in rnd["entries"]:
        print(f"      {e['address']}  {e['amountFormatted']}  {'CLAIMED' if e['claimed'] else 'UNCLAIMED'}")
    assert rnd["fullySettled"], "Round should be fully settled after claim-all"
    print("      ✓ claim-all confirmed — round fully settled")

print(f"\n✅ Full pipeline verified through round {expected_round}.")