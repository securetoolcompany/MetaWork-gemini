#!/usr/bin/env python3
"""
deploy_v7.py  —  Deploy revenue_pool_v7.py to Algorand TestNet

Usage:
    CREATOR_MNEMONIC="word1 word2 ... word25" python contracts/deploy_v7.py

Requirements:
    pip install py-algorand-sdk pyteal

The script:
  1. Compiles the PyTeal source to TEAL (with scratch-slot optimisation)
  2. Writes revenue_pool_v7_approval.teal and revenue_pool_v7_clear.teal
     into contracts/ so the Next.js layer can read them if needed
  3. Compiles both TEAL files to bytecode via Algod
  4. Creates the application with the correct global/local schema for V7:
       global: 1 byte-slice  ("admin" key = 32-byte address)
       local:  none
  5. Funds the app address with a small ALGO buffer so inner-txn fees
     don't bounce on the very first call
  6. Writes the new App ID to contracts/app_id.txt

Notes:
  - V7 uses NO local state. All data lives in boxes.
  - extra_pages=3 is retained to match V6; V7's TEAL is larger due
    to the release_held loop, so the extra headroom is essential.
  - The deployer becomes the initial ADMIN_KEY (stored as a global
    byte-slice, not a global int).
"""

import os
import sys
import base64
from algosdk import account, mnemonic, logic
from algosdk.v2client import algod
from algosdk.transaction import (
    ApplicationCreateTxn,
    PaymentTxn,
    StateSchema,
    wait_for_confirmation,
)
from pyteal import compileTeal, Mode, OptimizeOptions

import revenue_pool_v7

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN   = ""  # AlgoNode public endpoint requires no token

CREATOR_MNEMONIC = os.getenv("CREATOR_MNEMONIC", "")
if not CREATOR_MNEMONIC:
    sys.exit(
        "ERROR: Set the CREATOR_MNEMONIC environment variable to your "
        "25-word mnemonic before running this script."
    )

CREATOR_PRIVATE_KEY = mnemonic.to_private_key(CREATOR_MNEMONIC)
CREATOR_ADDRESS     = account.address_from_private_key(CREATOR_PRIVATE_KEY)

# Amount of ALGO (in microAlgo) to seed the app address with after deploy.
# Covers the app's minimum balance requirement before the first inner txn fires.
APP_SEED_MICROALGO = 100_000  # 0.1 ALGO

# Output paths — script lives in contracts/, so __file__ resolves correctly
CONTRACTS_DIR     = os.path.dirname(os.path.abspath(__file__))
APPROVAL_TEAL_OUT = os.path.join(CONTRACTS_DIR, "revenue_pool_v7_approval.teal")
CLEAR_TEAL_OUT    = os.path.join(CONTRACTS_DIR, "revenue_pool_v7_clear.teal")
APP_ID_OUT        = os.path.join(CONTRACTS_DIR, "app_id.txt")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def compile_teal_to_bytecode(client: algod.AlgodClient, teal_source: str) -> bytes:
    """Compile TEAL source string to bytecode via Algod."""
    response = client.compile(teal_source)
    return base64.b64decode(response["result"])


def deploy_v7() -> int:
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

    # ------------------------------------------------------------------
    # Step 1 — PyTeal → TEAL
    # ------------------------------------------------------------------
    print("[1/5] Compiling PyTeal → TEAL (scratch-slot optimisation ON)...")

    approval_teal = compileTeal(
        revenue_pool_v7.approval_program(),
        mode=Mode.Application,
        version=10,
        optimize=OptimizeOptions(scratch_slots=True),
    )
    clear_teal = compileTeal(
        revenue_pool_v7.clear_program(),
        mode=Mode.Application,
        version=10,
        optimize=OptimizeOptions(scratch_slots=True),
    )

    with open(APPROVAL_TEAL_OUT, "w") as f:
        f.write(approval_teal)
    with open(CLEAR_TEAL_OUT, "w") as f:
        f.write(clear_teal)

    print(f"   Wrote {APPROVAL_TEAL_OUT}")
    print(f"   Wrote {CLEAR_TEAL_OUT}")

    # ------------------------------------------------------------------
    # Step 2 — TEAL → bytecode
    # ------------------------------------------------------------------
    print("[2/5] Compiling TEAL → bytecode via Algod...")
    approval_bytes = compile_teal_to_bytecode(client, approval_teal)
    clear_bytes    = compile_teal_to_bytecode(client, clear_teal)
    print(f"   Approval program: {len(approval_bytes)} bytes")
    print(f"   Clear program:    {len(clear_bytes)} bytes")

    # ------------------------------------------------------------------
    # Step 3 — Build ApplicationCreateTxn
    #
    # V7 schema:
    #   global byte-slices : 1  ("admin" → 32-byte public key)
    #   global ints        : 0  (all pool state lives in boxes)
    #   local              : 0  (no per-account local state)
    #
    # extra_pages=3 gives up to 8 192 bytes total program space.
    # V7 is larger than V6 due to the release_held loop + round-box
    # writes, so the extra headroom is essential.
    # ------------------------------------------------------------------
    print("[3/5] Building ApplicationCreateTxn...")

    sp = client.suggested_params()

    global_schema = StateSchema(num_uints=0, num_byte_slices=1)  # "admin" only
    local_schema  = StateSchema(num_uints=0, num_byte_slices=0)

    create_txn = ApplicationCreateTxn(
        sender=CREATOR_ADDRESS,
        sp=sp,
        on_complete=0,            # NoOp on create → on_create branch fires
        approval_program=approval_bytes,
        clear_program=clear_bytes,
        global_schema=global_schema,
        local_schema=local_schema,
        extra_pages=3,
    )

    # ------------------------------------------------------------------
    # Step 4 — Sign & submit
    # ------------------------------------------------------------------
    print("[4/5] Signing and submitting deploy transaction...")
    signed_create = create_txn.sign(CREATOR_PRIVATE_KEY)
    tx_id = client.send_transaction(signed_create)
    print(f"   TXID: {tx_id}")

    result      = wait_for_confirmation(client, tx_id, 6)
    app_id      = result["application-index"]
    app_address = logic.get_application_address(app_id)

    print(f"\n✅ Contract deployed!")
    print(f"   App ID:      {app_id}")
    print(f"   App Address: {app_address}")

    # ------------------------------------------------------------------
    # Step 5 — Seed the app address with ALGO
    #
    # The app must have a minimum ALGO balance before any inner
    # transaction can fire. 0.1 ALGO is sufficient; the companion MBR
    # payment on create_pool will top it up further on first use.
    # ------------------------------------------------------------------
    print(f"[5/5] Seeding app address with {APP_SEED_MICROALGO / 1e6:.3f} ALGO...")

    sp_seed = client.suggested_params()
    seed_txn = PaymentTxn(
        sender=CREATOR_ADDRESS,
        sp=sp_seed,
        receiver=app_address,
        amt=APP_SEED_MICROALGO,
    )
    signed_seed = seed_txn.sign(CREATOR_PRIVATE_KEY)
    seed_txid   = client.send_transaction(signed_seed)
    wait_for_confirmation(client, seed_txid, 6)
    print(f"   Seed TXID: {seed_txid}")

    # ------------------------------------------------------------------
    # Persist App ID
    # ------------------------------------------------------------------
    with open(APP_ID_OUT, "w") as f:
        f.write(str(app_id))
    print(f"\n   App ID written to {APP_ID_OUT}")

    # ------------------------------------------------------------------
    # Post-deploy checklist
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("POST-DEPLOY CHECKLIST")
    print("=" * 60)
    print(f"  GLOBAL_POOL_APP_ID={app_id}")
    print(f"  App address:       {app_address}")
    print()
    print("  Next steps:")
    print("  1. Set GLOBAL_POOL_APP_ID in your .env.local")
    print("  2. Fund the app address with testnet USDC (asset 10458941)")
    print("     so the USDC opt-in inner txn has a live asset to opt into.")
    print("  3. Run a create_pool smoke-test before touching the API layer.")
    print("  4. Verify box parsing: GET /api/pool/global?productId=<id>")
    print("=" * 60)

    return app_id


if __name__ == "__main__":
    deploy_v7()