"""Prepare persistent disposable proof keys inside a dedicated LocalNet KMD wallet."""

import argparse
import getpass
import json
import uuid
import warnings
from pathlib import Path

from algosdk.kmd import KMDClient

from inspect_kmd_storage import docker_executable, run_public_command
from localnet_safety import (
    LOCALNET_TOKEN,
    LocalNetContext,
    require_disposable_address,
)


ROOT = Path(__file__).resolve().parent
RECORD = ROOT / "artifacts" / "account_control" / "kmd-proof-wallet.json"
CONTAINER = "algokit_sandbox_algod"
WALLET_DIRECTORY = "/algod/data/kmd-v0.5/sqlite_wallets"
ROLES = ("operator", "staking", "recipient", "outsider")


def hidden_password(prompt):
    # Refuse getpass's echoed-input fallback.
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        return getpass.getpass(prompt)


def wallet_files(docker):
    output = run_public_command(
        [
            docker,
            "exec",
            CONTAINER,
            "find",
            WALLET_DIRECTORY,
            "-maxdepth",
            "1",
            "-type",
            "f",
            "-print",
        ]
    )
    return {
        line.strip()
        for line in output.splitlines()
        if line.strip().startswith(WALLET_DIRECTORY + "/")
    }


def save(record):
    RECORD.parent.mkdir(parents=True, exist_ok=True)
    RECORD.write_text(
        json.dumps(record, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--network", required=True, choices=["localnet"])
    parser.add_argument(
        "--algod-url",
        required=True,
        choices=["http://127.0.0.1:4001", "http://localhost:4001"],
    )
    parser.add_argument("--expected-genesis-id", required=True)
    parser.add_argument("--expected-genesis-hash", required=True)
    parser.add_argument("--create", required=True, action="store_true")
    args = parser.parse_args()

    if RECORD.exists():
        raise RuntimeError(
            "Preparation record already exists. Reopen the recorded wallet; "
            "do not generate replacement accounts or delete the record."
        )

    context = LocalNetContext(
        network=args.network,
        algod_url=args.algod_url,
        expected_genesis_id=args.expected_genesis_id,
        expected_genesis_hash=args.expected_genesis_hash,
    )

    docker = docker_executable()
    files_before = wallet_files(docker)

    password = hidden_password("New dedicated proof-wallet password: ")
    if not password:
        raise ValueError("The dedicated wallet password must not be empty")

    confirmation = hidden_password("Confirm proof-wallet password: ")
    if password != confirmation:
        raise ValueError("Password confirmation does not match")
    del confirmation

    record = {
        "purpose": "disposable-account-control-proof-only",
        "network": args.network,
        "genesis_id": args.expected_genesis_id,
        "genesis_hash_base64": args.expected_genesis_hash,
        "wallet_name": "metawork-disposable-proof-" + uuid.uuid4().hex,
        "wallet_id": None,
        "accounts": {},
        "application_id": None,
        "application_address": None,
        "transaction_ids": [],
        "storage": {
            "container": CONTAINER,
            "directory_candidate": WALLET_DIRECTORY,
            "new_wallet_files": [],
            "location_verified": False,
            "ordinary_restart_persistence": "not tested",
            "container_removal_or_localnet_reset_survival": "not guaranteed",
        },
        "fresh_process_signing": "not tested",
        "funding": "not performed",
        "rekeying": "not performed",
        "status": "preparation_started",
    }

    # Reserve the public record before any wallet creation.
    RECORD.parent.mkdir(parents=True, exist_ok=True)
    with RECORD.open("x", encoding="utf-8") as output:
        json.dump(record, output, indent=2, sort_keys=True)
        output.write("\n")

    kmd = KMDClient(LOCALNET_TOKEN, "http://127.0.0.1:4002")
    handle = None

    try:
        context.fresh_params()
        wallet = kmd.create_wallet(
            record["wallet_name"],
            password,
            driver_name="sqlite",
        )
        record["wallet_id"] = wallet["id"]
        record["status"] = "wallet_created"
        save(record)

        handle = kmd.init_wallet_handle(wallet["id"], password)

        for role in ROLES:
            address = require_disposable_address(
                kmd.generate_key(handle, display_mnemonic=False)
            )
            if address in record["accounts"].values():
                raise RuntimeError("KMD returned a duplicate proof address")
            record["accounts"][role] = address
            save(record)

        if set(kmd.list_keys(handle)) != set(record["accounts"].values()):
            raise RuntimeError("Dedicated wallet key inventory mismatch")

        new_files = sorted(wallet_files(docker) - files_before)
        record["storage"]["new_wallet_files"] = new_files
        save(record)

        if not new_files:
            raise RuntimeError(
                "Could not associate wallet creation with new storage files"
            )

        record["storage"]["location_verified"] = True
        record["storage"]["outside_repository"] = (
            "Docker container filesystem; no wallet file written by this "
            "script to the repository"
        )
        record["status"] = "keys_prepared_reopen_and_restart_checks_required"
        save(record)

    except Exception as error:
        record["status"] = "preparation_incomplete"
        # Do not record arbitrary exception messages from secret-bearing calls.
        record["failure_type"] = type(error).__name__
        save(record)
        raise RuntimeError(
            "Wallet preparation stopped. Preserve the public record and "
            "existing wallet; do not rerun creation or delete keys."
        ) from None

    finally:
        if handle is not None:
            try:
                kmd.release_wallet_handle(handle)
            except Exception:
                record["handle_release"] = "not confirmed"
                save(record)
        del password

    print(json.dumps(record, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()