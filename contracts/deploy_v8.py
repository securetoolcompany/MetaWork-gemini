#!/usr/bin/env python3
"""
deploy_v8.py — Deploy revenue_pool_v8.py as a new Algorand TestNet application.

Usage:
    CREATOR_MNEMONIC="word1 word2 ... word25" python contracts/deploy_v8.py

Requirements:
    pip install py-algorand-sdk pyteal

The script:
  1. Compiles the V8 PyTeal source to TEAL with scratch-slot optimisation.
  2. Writes revenue_pool_v8_approval.teal and revenue_pool_v8_clear.teal
     to contracts/ for inspection or application-layer use.
  3. Compiles both TEAL programs to bytecode through the TestNet Algod endpoint.
  4. Creates a new V8 application with this state schema:
       global: 1 byte-slice ("admin" = 32-byte administrator address)
       local:  none
  5. Seeds the new application account with ALGO minimum-balance capacity
     required before create_pool performs the USDC opt-in and REV ASA creation.
  6. Writes the new V8 application ID to contracts/app_id_v8.txt.

Important:
  - This script creates a new TestNet application. It does not update,
    replace, or redeploy the existing V7 application.
  - V8 uses no local state. Pool state and immutable payout-round snapshots
    are stored in application boxes.
  - V8 preserves the seven-paid-round limit in claim_revenue_all.
  - V8 revenue eligibility is snapshot-based: a recorded wallet can claim an
    unclaimed historic allocation even after transferring all REV tokens.
  - Historic V7 references are intentionally preserved: this script writes
    V8 artifacts and app_id_v8.txt rather than overwriting V7 artifacts or
    contracts/app_id.txt.
  - extra_pages=3 provides up to 8,192 bytes of approval-program space.
  - The deployer becomes the initial ADMIN_KEY, stored as the application's
    sole global byte-slice value.

Minimum-balance funding:
  - 0.1 ALGO base application-account minimum balance.
  - 0.1 ALGO for the TestNet USDC ASA holding created by create_pool.
  - 0.1 ALGO for the REV ASA created and held by create_pool.
  - Pool and payout-round box minimum-balance requirements are supplied by
    the companion ALGO payments required by create_pool, release_held, and
    create_payout_round.

Transaction-fee note:
  - Application call builders must provide pooled fee budget for every inner
    transaction because the contract explicitly sets inner transaction fees
    to zero. The seed balance is minimum-balance funding; it is not a
    replacement for transaction fees.
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

from revenue_pool_v8 import approval_program, clear_program

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
APP_SEED_MICROALGO = 300_000  # 0.3 ALGO, before any box MBR

# Output paths — script lives in contracts/, so __file__ resolves correctly
CONTRACTS_DIR     = os.path.dirname(os.path.abspath(__file__))
APPROVAL_TEAL_OUT = os.path.join(CONTRACTS_DIR, "revenue_pool_v8_approval.teal")
CLEAR_TEAL_OUT    = os.path.join(CONTRACTS_DIR, "revenue_pool_v8_clear.teal")
APP_ID_OUT        = os.path.join(CONTRACTS_DIR, "app_id_v8.txt")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def compile_teal_to_bytecode(client: algod.AlgodClient, teal_source: str) -> bytes:
    """Compile TEAL source string to bytecode via Algod."""
    response = client.compile(teal_source)
    return base64.b64decode(response["result"])


def deploy_v8() -> int:
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

    # ------------------------------------------------------------------
    # Step 1 — PyTeal → TEAL
    # ------------------------------------------------------------------
    print("[1/5] Compiling PyTeal → TEAL (scratch-slot optimisation ON)...")

    approval_teal = compileTeal(
        approval_program(),
        mode=Mode.Application,
        version=10,
        optimize=OptimizeOptions(scratch_slots=True),
    )
    clear_teal = compileTeal(
        clear_program(),
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
    # V8 schema:
    #   global byte-slices : 1 ("admin" → 32-byte public key)
    #   global ints        : 0 (all pool state lives in boxes)
    #   local              : 0 (no per-account local state)
    #
    # extra_pages=3 provides up to 8,192 bytes of approval-program space.
    # V8 retains the V7 storage model and adds the snapshot-only
    # revenue-claim eligibility policy.
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
    # The V8 app account needs minimum-balance capacity for:
    #   0.1 ALGO base account balance
    #   0.1 ALGO testnet USDC ASA opt-in during create_pool
    #   0.1 ALGO REV ASA creation during create_pool
    #
    # Pool and round box MBR are supplied separately by each required
    # companion payment in create_pool/create_payout_round/release_held.
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
    print(f"  NEXT_PUBLIC_REVENUE_POOL_APP_ID={app_id}")
    print(f"  App address:       {app_address}")
    print()
    print("  Next steps:")
    print("  1. Set NEXT_PUBLIC_REVENUE_POOL_APP_ID in staging/.env.local")
    print("  2. Run create_pool first; it performs the app's zero-amount USDC opt-in.")
    print("  3. Then transfer testnet USDC (asset 10458941) to the app through")
    print("     the contract's deposit_usdc or deposit_held flow.")
    print("  4. Run a create_pool smoke-test before touching the API layer.")
    print("  5. Verify box parsing: GET /api/pool/global?productId=<id>")
    print("=" * 60)

    return app_id


if __name__ == "__main__":
    deploy_v8()