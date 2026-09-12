#!/usr/bin/env python3
"""
Deploy revenue_pool_v10.py as a new Algorand MainNet application.

Required environment variables:
  CREATOR_MNEMONIC
  ALGORAND_MAINNET_RPC=https://algod-api.metawork.tools
  ALGORAND_MAINNET_ALGOD_TOKEN=<Nginx gateway secret>

Optional:
  ALGORAND_MAINNET_ALGOD_TOKEN_HEADER=X-API-Key
  V10_MAINNET_APP_ID_OUT=contracts/app_id_v10_mainnet.local.txt

This script signs locally with CREATOR_MNEMONIC. Never place the mnemonic or
Algod gateway secret in source control, Vercel browser variables, logs, or chat.
"""

from __future__ import annotations

import base64
import os
import sys
from pathlib import Path

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

EXPECTED_GENESIS_ID = "mainnet-v1.0"
APP_SEED_MICROALGO = 300_000
EXTRA_PAGES = 3
CONFIRMATION_ROUNDS = 10

CONTRACTS_DIR = Path(__file__).resolve().parent
APPROVAL_TEAL_OUT = CONTRACTS_DIR / "revenue_pool_v10_mainnet_approval.teal"
CLEAR_TEAL_OUT = CONTRACTS_DIR / "revenue_pool_v10_mainnet_clear.teal"
APP_ID_OUT = Path(
    os.getenv(
        "V10_MAINNET_APP_ID_OUT",
        str(CONTRACTS_DIR / "app_id_v10_mainnet.local.txt"),
    )
)


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        sys.exit(f"ERROR: {name} must be set.")
    return value


def build_algod_client() -> algod.AlgodClient:
    server = required_env("ALGORAND_MAINNET_RPC").rstrip("/")
    token = required_env("ALGORAND_MAINNET_ALGOD_TOKEN")
    header = os.getenv(
        "ALGORAND_MAINNET_ALGOD_TOKEN_HEADER",
        "X-API-Key",
    ).strip()

    if not server.startswith("https://"):
        sys.exit("ERROR: ALGORAND_MAINNET_RPC must be an HTTPS URL.")

    if "localhost" in server or "127.0.0.1" in server:
        sys.exit("ERROR: Refusing localhost/loopback Algod endpoint.")

    if not header:
        sys.exit(
            "ERROR: ALGORAND_MAINNET_ALGOD_TOKEN_HEADER must not be empty."
        )

    return algod.AlgodClient(token, server, headers={header: token})


def assert_mainnet(client: algod.AlgodClient) -> None:
    params = client.suggested_params()

    genesis_id = getattr(params, "gen", None)
    current_round = getattr(params, "first", None)

    if genesis_id != EXPECTED_GENESIS_ID:
        sys.exit(
            "ERROR: Refusing deployment because suggested transaction parameters "
            f"report genesis ID {genesis_id!r}, expected {EXPECTED_GENESIS_ID!r}."
        )

    print(f"Connected network: {genesis_id}")
    print(f"Current round: {current_round}")


def compile_teal_to_bytecode(
    client: algod.AlgodClient,
    teal_source: str,
) -> bytes:
    response = client.compile(teal_source)
    return base64.b64decode(response["result"])


def main() -> int:
    creator_mnemonic = required_env("CREATOR_MNEMONIC")

    try:
        creator_private_key = mnemonic.to_private_key(creator_mnemonic)
    except (ValueError, KeyError):
        sys.exit(
            "ERROR: CREATOR_MNEMONIC is not a valid Algorand 25-word mnemonic. "
            "No Algod request or transaction was made."
        )

    creator_address = account.address_from_private_key(creator_private_key)
    client = build_algod_client()
    assert_mainnet(client)

    print(f"Creator address: {creator_address}")
    print("\n[1/5] Compiling V10 PyTeal to TEAL...")

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

    APPROVAL_TEAL_OUT.write_text(approval_teal, encoding="utf-8")
    CLEAR_TEAL_OUT.write_text(clear_teal, encoding="utf-8")

    print(f"  Wrote {APPROVAL_TEAL_OUT.name}")
    print(f"  Wrote {CLEAR_TEAL_OUT.name}")
    print("\n[2/5] Compiling TEAL to bytecode through MainNet Algod...")

    approval_bytes = compile_teal_to_bytecode(client, approval_teal)
    clear_bytes = compile_teal_to_bytecode(client, clear_teal)

    print(f"  Approval program: {len(approval_bytes)} bytes")
    print(f"  Clear program:    {len(clear_bytes)} bytes")
    print("\n[3/5] Building MainNet application-create transaction...")

    create_txn = ApplicationCreateTxn(
        sender=creator_address,
        sp=client.suggested_params(),
        on_complete=0,
        approval_program=approval_bytes,
        clear_program=clear_bytes,
        global_schema=StateSchema(num_uints=0, num_byte_slices=1),
        local_schema=StateSchema(num_uints=0, num_byte_slices=0),
        extra_pages=EXTRA_PAGES,
    )

    print("\n[4/5] Signing and submitting application-create transaction...")
    create_txid = client.send_transaction(create_txn.sign(creator_private_key))
    print(f"  Create TXID: {create_txid}")

    create_result = wait_for_confirmation(
        client,
        create_txid,
        CONFIRMATION_ROUNDS,
    )
    app_id = create_result.get("application-index")

    if not app_id:
        sys.exit(
            "ERROR: Create transaction confirmed without an application index. "
            f"Inspect MainNet transaction {create_txid}."
        )

    app_address = logic.get_application_address(app_id)
    print("\nV10 MainNet application deployed.")
    print(f"  App ID: {app_id}")
    print(f"  App address: {app_address}")
    print(
        f"\n[5/5] Seeding app account with "
        f"{APP_SEED_MICROALGO / 1_000_000:.3f} ALGO..."
    )

    seed_txn = PaymentTxn(
        sender=creator_address,
        sp=client.suggested_params(),
        receiver=app_address,
        amt=APP_SEED_MICROALGO,
    )
    seed_txid = client.send_transaction(seed_txn.sign(creator_private_key))
    wait_for_confirmation(client, seed_txid, CONFIRMATION_ROUNDS)
    print(f"  Seed TXID: {seed_txid}")

    APP_ID_OUT.write_text(f"{app_id}\n", encoding="utf-8")

    print("\n" + "=" * 64)
    print("V10 MAINNET DEPLOYMENT COMPLETE")
    print("=" * 64)
    print(f"Network:                 {EXPECTED_GENESIS_ID}")
    print(f"Application ID:          {app_id}")
    print(f"Application address:     {app_address}")
    print(f"Create transaction ID:   {create_txid}")
    print(f"Seed transaction ID:     {seed_txid}")
    print(f"Local app-ID artifact:   {APP_ID_OUT}")
    print("=" * 64)

    return app_id


if __name__ == "__main__":
    main()