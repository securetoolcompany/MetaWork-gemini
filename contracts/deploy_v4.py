"""
deploy_v4.py — Deploy Revenue Pool V4 to Algorand TestNet
─────────────────────────────────────────────────────────
Usage:
    python deploy_v4.py

Reads:
    revenue_pool_v4_approval.teal
    revenue_pool_v4_clear.teal

Requires env var (or .env file):
    AUTHORITY_MNEMONIC   — 25-word mnemonic of the deployer/authority wallet

Outputs:
    App ID printed to console
    Saves app ID to app_id.txt for use by test script
"""

import os
import sys
import base64

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # .env optional

import algosdk
from algosdk.v2client import algod
from algosdk import transaction

# ── Config ───────────────────────────────────────────────────────
ALGOD_URL   = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""

APPROVAL_TEAL = os.path.join(os.path.dirname(__file__), "revenue_pool_v4_approval.teal")
CLEAR_TEAL    = os.path.join(os.path.dirname(__file__), "revenue_pool_v4_clear.teal")
APP_ID_FILE   = os.path.join(os.path.dirname(__file__), "app_id.txt")

# Global state: release_mode (uint) + release_delay_days (uint)
GLOBAL_INTS  = 2
GLOBAL_BYTES = 0

# No local state needed
LOCAL_INTS  = 0
LOCAL_BYTES = 0


# ── Helpers ──────────────────────────────────────────────────────

def get_algod_client():
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL)


def compile_program(client, source_path):
    with open(source_path, "r") as f:
        source = f.read()
    result = client.compile(source)
    return base64.b64decode(result["result"])


def wait_for_confirmation(client, txid, max_rounds=10):
    last_round = client.status()["last-round"]
    for _ in range(max_rounds):
        try:
            result = client.pending_transaction_info(txid)
            if result.get("confirmed-round", 0) > 0:
                return result
        except Exception:
            pass
        client.status_after_block(last_round + 1)
        last_round += 1
    raise Exception(f"Transaction {txid} not confirmed after {max_rounds} rounds")


# ── Main ─────────────────────────────────────────────────────────

def main():
    mnemonic = os.environ.get("AUTHORITY_MNEMONIC", "").strip()
    if not mnemonic:
        # Prompt interactively if not in env
        mnemonic = input("Enter authority wallet mnemonic (25 words): ").strip()
    if not mnemonic:
        print("ERROR: No mnemonic provided.")
        sys.exit(1)

    private_key = algosdk.mnemonic.to_private_key(mnemonic)
    address     = algosdk.account.address_from_private_key(private_key)
    print(f"\nAuthority address: {address}")

    client = get_algod_client()

    # Check balance
    info = client.account_info(address)
    balance_algo = info["amount"] / 1_000_000
    print(f"Balance: {balance_algo:.4f} ALGO")
    if info["amount"] < 1_000_000:
        print("WARNING: Balance low. Fund at https://bank.testnet.algorand.network")
        sys.exit(1)

    # Compile TEAL
    print("\nCompiling approval program...")
    approval_bytecode = compile_program(client, APPROVAL_TEAL)
    print(f"  Approval: {len(approval_bytecode)} bytes")

    print("Compiling clear program...")
    clear_bytecode = compile_program(client, CLEAR_TEAL)
    print(f"  Clear:    {len(clear_bytecode)} bytes")

    # Build app-create transaction
    sp = client.suggested_params()

    txn = transaction.ApplicationCreateTxn(
        sender=address,
        sp=sp,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_bytecode,
        clear_program=clear_bytecode,
        global_schema=transaction.StateSchema(
            num_uints=GLOBAL_INTS,
            num_byte_slices=GLOBAL_BYTES,
        ),
        local_schema=transaction.StateSchema(
            num_uints=LOCAL_INTS,
            num_byte_slices=LOCAL_BYTES,
        ),
    )

    # Sign and submit
    signed_txn = txn.sign(private_key)
    txid = client.send_transaction(signed_txn)
    print(f"\nTransaction submitted: {txid}")
    print("Waiting for confirmation...")

    result      = wait_for_confirmation(client, txid)
    app_id      = result["application-index"]
    app_address = algosdk.logic.get_application_address(app_id)

    print(f"\n✅ Deployed successfully!")
    print(f"   App ID:      {app_id}")
    print(f"   App Address: {app_address}")
    print(f"   Confirmed:   round {result['confirmed-round']}")
    print(f"\n   Explorer: https://testnet.explorer.perawallet.app/application/{app_id}/")

    # Save app ID for test script
    with open(APP_ID_FILE, "w") as f:
        f.write(str(app_id))
    print(f"\n   App ID saved to: app_id.txt")

    # Reminder: fund app address with ALGO for inner txn fees
    print(f"\n⚠️  Fund the app address with at least 1 ALGO for inner transaction fees:")
    print(f"   {app_address}")
    print(f"   https://bank.testnet.algorand.network\n")


if __name__ == "__main__":
    main()