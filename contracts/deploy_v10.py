#!/usr/bin/env python3
"""
deploy_v10.py — Deploy revenue_pool_v10.py as a new Algorand TestNet application.

Usage:
    CREATOR_MNEMONIC="word1 word2 ... word25" python contracts/deploy_v10.py

Requirements:
    pip install py-algorand-sdk pyteal

The script:
  1. Compiles the V10 PyTeal source to TEAL with scratch-slot optimisation.
  2. Writes revenue_pool_v10_approval.teal and revenue_pool_v10_clear.teal
     to contracts/ for inspection or application-layer use.
  3. Compiles both TEAL programs to bytecode through the TestNet Algod endpoint.
  4. Creates a new V10 application with this state schema:
       global: 1 byte-slice ("admin" = 32-byte administrator address)
       local:  none
  5. Seeds the new application account with ALGO minimum-balance capacity
     required before create_pool performs the USDC opt-in and REV ASA creation.
  6. Writes the new V10 application ID to contracts/app_id_v10.txt.

Important:
  - This script creates a new TestNet application. It does not update,
    replace, or redeploy V7, V8, or V9 applications.
  - V10 uses no local state. Pool state and payout-round snapshots are stored
    in application boxes.
  - V10 supports claim_revenue_round(ip_id, round_id) only.
  - V10 deliberately has no claim_revenue_all method.
  - A payout-round recipient list is supplied by the application/backend.
    For transferable REV revenue, the backend must query current REV ASA
    holders through an Indexer, calculate allocations, then call
    create_payout_round.
  - Historic app references are preserved: this script writes V10 artifacts
    and app_id_v10.txt rather than overwriting prior-version artifacts.
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
  - Application-call builders must provide pooled fee budget for every inner
    transaction because the contract explicitly sets inner transaction fees
    to zero.
  - A claim_revenue_round call produces one inner USDC transfer, so its
    outer app call should use a flat 2,000 microAlgo fee.
  - The seed balance is minimum-balance funding; it is not a replacement for
    transaction fees.
"""

import base64
import os
import sys

from algosdk import account, logic, mnemonic
from algosdk.transaction import (
    ApplicationCreateTxn,
    PaymentTxn,
    StateSchema,
    wait_for_confirmation,
)
from algosdk.v2client import algod
from pyteal import Mode, OptimizeOptions, compileTeal

from revenue_pool_v10 import approval_program, clear_program


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN = ""

CREATOR_MNEMONIC = os.getenv("CREATOR_MNEMONIC", "")
if not CREATOR_MNEMONIC:
    sys.exit(
        "ERROR: Set the CREATOR_MNEMONIC environment variable to your "
        "25-word mnemonic before running this script."
    )

CREATOR_PRIVATE_KEY = mnemonic.to_private_key(CREATOR_MNEMONIC)
CREATOR_ADDRESS = account.address_from_private_key(CREATOR_PRIVATE_KEY)

# Base account MBR + USDC opt-in MBR + REV ASA creator/holding MBR.
APP_SEED_MICROALGO = 300_000

CONTRACTS_DIR = os.path.dirname(os.path.abspath(__file__))
APPROVAL_TEAL_OUT = os.path.join(
    CONTRACTS_DIR,
    "revenue_pool_v10_approval.teal",
)
CLEAR_TEAL_OUT = os.path.join(
    CONTRACTS_DIR,
    "revenue_pool_v10_clear.teal",
)
APP_ID_OUT = os.path.join(CONTRACTS_DIR, "app_id_v10.txt")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def compile_teal_to_bytecode(
    client: algod.AlgodClient,
    teal_source: str,
) -> bytes:
    """Compile TEAL source to bytecode through Algod."""
    response = client.compile(teal_source)
    return base64.b64decode(response["result"])


def deploy_v10() -> int:
    client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

    # ------------------------------------------------------------------------
    # Step 1 — PyTeal → TEAL
    # ------------------------------------------------------------------------
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

    with open(APPROVAL_TEAL_OUT, "w", encoding="utf-8") as file:
        file.write(approval_teal)

    with open(CLEAR_TEAL_OUT, "w", encoding="utf-8") as file:
        file.write(clear_teal)

    print(f"   Wrote {APPROVAL_TEAL_OUT}")
    print(f"   Wrote {CLEAR_TEAL_OUT}")

    # ------------------------------------------------------------------------
    # Step 2 — TEAL → bytecode
    # ------------------------------------------------------------------------
    print("[2/5] Compiling TEAL → bytecode via Algod...")

    approval_bytes = compile_teal_to_bytecode(client, approval_teal)
    clear_bytes = compile_teal_to_bytecode(client, clear_teal)

    print(f"   Approval program: {len(approval_bytes)} bytes")
    print(f"   Clear program:    {len(clear_bytes)} bytes")

    # ------------------------------------------------------------------------
    # Step 3 — Build ApplicationCreateTxn
    #
    # V10 schema:
    #   global byte-slices : 1 ("admin" → 32-byte public key)
    #   global ints        : 0
    #   local              : 0
    # ------------------------------------------------------------------------
    print("[3/5] Building ApplicationCreateTxn...")

    suggested_params = client.suggested_params()

    global_schema = StateSchema(num_uints=0, num_byte_slices=1)
    local_schema = StateSchema(num_uints=0, num_byte_slices=0)

    create_txn = ApplicationCreateTxn(
        sender=CREATOR_ADDRESS,
        sp=suggested_params,
        on_complete=0,
        approval_program=approval_bytes,
        clear_program=clear_bytes,
        global_schema=global_schema,
        local_schema=local_schema,
        extra_pages=3,
    )

    # ------------------------------------------------------------------------
    # Step 4 — Sign and submit application creation
    # ------------------------------------------------------------------------
    print("[4/5] Signing and submitting deploy transaction...")

    signed_create = create_txn.sign(CREATOR_PRIVATE_KEY)
    tx_id = client.send_transaction(signed_create)

    print(f"   TXID: {tx_id}")

    result = wait_for_confirmation(client, tx_id, 6)
    app_id = result["application-index"]
    app_address = logic.get_application_address(app_id)

    print("\n✅ V10 contract deployed!")
    print(f"   App ID:      {app_id}")
    print(f"   App Address: {app_address}")

    # ------------------------------------------------------------------------
    # Step 5 — Seed application account
    # ------------------------------------------------------------------------
    print(
        f"[5/5] Seeding app address with "
        f"{APP_SEED_MICROALGO / 1e6:.3f} ALGO..."
    )

    seed_params = client.suggested_params()

    seed_txn = PaymentTxn(
        sender=CREATOR_ADDRESS,
        sp=seed_params,
        receiver=app_address,
        amt=APP_SEED_MICROALGO,
    )

    signed_seed = seed_txn.sign(CREATOR_PRIVATE_KEY)
    seed_tx_id = client.send_transaction(signed_seed)

    wait_for_confirmation(client, seed_tx_id, 6)

    print(f"   Seed TXID: {seed_tx_id}")

    # ------------------------------------------------------------------------
    # Persist V10 app ID without touching prior-version references
    # ------------------------------------------------------------------------
    with open(APP_ID_OUT, "w", encoding="utf-8") as file:
        file.write(str(app_id))

    print(f"\n   App ID written to {APP_ID_OUT}")

    # ------------------------------------------------------------------------
    # Post-deploy instructions
    # ------------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("V10 POST-DEPLOY CHECKLIST")
    print("=" * 60)
    print(f"  NEXT_PUBLIC_REVENUE_POOL_APP_ID={app_id}")
    print(f"  App address: {app_address}")
    print()
    print("  Next steps:")
    print("  1. Set NEXT_PUBLIC_REVENUE_POOL_APP_ID in staging/.env.local.")
    print("  2. Run create_pool; it performs the zero-amount USDC opt-in")
    print("     and creates the pool REV ASA.")
    print("  3. Use only:")
    print("       claim_revenue_round(ip_id, round_id)")
    print("  4. Do not call claim_revenue_all; V10 does not expose it.")
    print("  5. For transferable REV payouts, have the backend:")
    print("       - query current REV ASA holders through an Indexer,")
    print("       - calculate current-holder allocations, then")
    print("       - call create_payout_round with the packed payee list.")
    print("  6. Stress-test recipient counts before adopting a production cap.")
    print("=" * 60)

    return app_id


if __name__ == "__main__":
    deploy_v10()