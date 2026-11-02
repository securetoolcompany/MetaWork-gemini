"""Create dedicated disposable Tokenizer identities only after approval.

Do not execute this script without separate identity-creation approval.
No funding, transaction signing, submission, deployment, or rekeying.

Private keys remain in KMD. Only public metadata is written to the repository.
A partial failure requires inspection, never automatic rerunning or cleanup.
"""

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
RECORD = ROOT / "artifacts" / "tokenizer" / "kmd-tokenizer-wallet.json"
CONTAINER = "algokit_sandbox_algod"
WALLET_DIRECTORY = "/algod/data/kmd-v0.5/sqlite_wallets"
ROLES = ("creator_initializer", "staking", "seed_recipient")

PRESERVED_PROOF_ADDRESSES = frozenset(
    {
        "HXMCSZ77QBA2EDFR2JKKFPUXHKL4AVP2666CKX5Q4AQWQCU3QJGZH62GPI",
        "UTXM245YRZLT7DV66OKQ2MVWPMGNZUVYQIIVJY6UYO7PB3WXL53GQNMMPQ",
        "2UL5373I33FB4VUN5OF5BIVRGXB47QZ7HDV3V2W4WFXRVFOWPTIDN2PGTQ",
        "QY6XONG5TIPFSSLAAMSOU2CXH4ZSE7ZAXSBQ7E2N3VVOFERZRKV7AWMGIQ",
    }
)


def hidden_password(prompt):
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        return getpass.getpass(prompt)


def container_id(docker):
    identity = run_public_command(
        [docker, "inspect", "--format", "{{.Id}}", CONTAINER]
    ).strip()
    if len(identity) != 64 or any(
        character not in "0123456789abcdef" for character in identity
    ):
        raise RuntimeError("Unexpected container identity")
    return identity


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


def save_record(record):
    temporary = RECORD.with_suffix(".json.tmp")
    with temporary.open("x", encoding="utf-8") as output:
        json.dump(record, output, indent=2, sort_keys=True)
        output.write("\n")
        output.flush()
    temporary.replace(RECORD)


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
    parser.add_argument("--expected-container-id", required=True)
    parser.add_argument("--create", required=True, action="store_true")
    args = parser.parse_args()

    if RECORD.exists() or RECORD.with_suffix(".json.tmp").exists():
        raise RuntimeError(
            "Tokenizer record or temporary record exists. Preserve it and "
            "inspect existing wallet state; do not rerun creation."
        )

    context = LocalNetContext(
        network=args.network,
        algod_url=args.algod_url,
        expected_genesis_id=args.expected_genesis_id,
        expected_genesis_hash=args.expected_genesis_hash,
    )
    docker = docker_executable()
    expected_container = args.expected_container_id
    if len(expected_container) != 64 or any(
        character not in "0123456789abcdef"
        for character in expected_container
    ):
        raise ValueError("Expected container ID must be 64 lowercase hex digits")

    original_container = container_id(docker)
    if original_container != expected_container:
        raise RuntimeError("LocalNet container does not match expected identity")

    files_before = wallet_files(docker)
    kmd = KMDClient(LOCALNET_TOKEN, "http://127.0.0.1:4002")
    existing_wallet_ids = {wallet["id"] for wallet in kmd.list_wallets()}

    password = hidden_password("New dedicated Tokenizer-wallet password: ")
    if not password:
        raise ValueError("Wallet password must not be empty")
    confirmation = hidden_password("Confirm Tokenizer-wallet password: ")
    if password != confirmation:
        raise ValueError("Password confirmation does not match")
    del confirmation

    record = {
        "purpose": "disposable-day1-tokenizer-identities-only",
        "network": args.network,
        "genesis_id": args.expected_genesis_id,
        "genesis_hash_base64": args.expected_genesis_hash,
        "wallet_name": "metawork-disposable-tokenizer-" + uuid.uuid4().hex,
        "wallet_id": None,
        "accounts": {},
        "role_mapping_approval": "pending",
        "deployment_configuration_binding": "not performed",
        "status": "preparation_started",
        "storage": {
            "container": CONTAINER,
            "container_id": original_container,
            "directory_candidate": WALLET_DIRECTORY,
            "new_wallet_files": [],
            "location_verified": False,
            "restart_persistence": "not tested",
            "reset_or_container_removal_survival": "not guaranteed",
        },
        "funding": "not performed",
        "signing": "not performed",
        "submission": "not performed",
        "deployment": "not performed",
        "rekeying": "not performed",
        "handle_release": "not opened",
    }

    RECORD.parent.mkdir(parents=True, exist_ok=True)
    with RECORD.open("x", encoding="utf-8") as output:
        json.dump(record, output, indent=2, sort_keys=True)
        output.write("\n")

    def recheck():
        context.fresh_params()
        if container_id(docker) != original_container:
            raise RuntimeError("LocalNet container identity changed")

    handle = None
    failed = False
    try:
        recheck()
        record["status"] = "wallet_creation_requested"
        save_record(record)
        wallet = kmd.create_wallet(
            record["wallet_name"], password, driver_name="sqlite"
        )
        record["wallet_id"] = wallet["id"]
        record["status"] = "wallet_created"
        save_record(record)

        if (
            wallet["id"] in existing_wallet_ids
            or wallet["name"] != record["wallet_name"]
        ):
            raise RuntimeError("New dedicated wallet identity mismatch")

        recheck()
        handle = kmd.init_wallet_handle(wallet["id"], password)
        record["handle_release"] = "pending"
        save_record(record)

        if kmd.list_keys(handle):
            raise RuntimeError("New Tokenizer wallet is not empty")

        for role in ROLES:
            recheck()
            record["status"] = "key_generation_requested:" + role
            save_record(record)
            address = kmd.generate_key(handle, display_mnemonic=False)
            record["accounts"][role] = address
            save_record(record)
            require_disposable_address(address)
            if address in PRESERVED_PROOF_ADDRESSES:
                raise RuntimeError("Preserved proof identity returned")
            if len(set(record["accounts"].values())) != len(record["accounts"]):
                raise RuntimeError("Duplicate Tokenizer identity")

        recheck()
        if set(kmd.list_keys(handle)) != set(record["accounts"].values()):
            raise RuntimeError("Tokenizer wallet inventory mismatch")

        record["storage"]["new_wallet_files"] = sorted(
            wallet_files(docker) - files_before
        )
        if not record["storage"]["new_wallet_files"]:
            raise RuntimeError("New wallet storage files not observed")

        record["storage"]["location_verified"] = False
        record["storage"]["location_note"] = (
            "New filenames observed in candidate directory; exact wallet-file "
            "association and persistence are not independently verified."
        )
        record["status"] = "identities_created_role_approval_pending"
        save_record(record)

    except Exception as error:
        failed = True
        record["status"] = "preparation_incomplete_do_not_rerun"
        record["failure_type"] = type(error).__name__
        try:
            save_record(record)
        except Exception:
            pass
    finally:
        if handle is not None:
            try:
                kmd.release_wallet_handle(handle)
                record["handle_release"] = "confirmed"
            except Exception:
                failed = True
                record["handle_release"] = "not confirmed"
                record["status"] = "preparation_incomplete_do_not_rerun"
            try:
                save_record(record)
            except Exception:
                failed = True
        del password

    if failed:
        raise RuntimeError(
            "Tokenizer identity preparation stopped. Preserve records and "
            "wallet storage. Inspect before any further action; do not rerun."
        ) from None

    print(
        json.dumps(
            {"proposed_role_mapping": record["accounts"]},
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        raise SystemExit(
            "Preparation stopped. No automatic retry or cleanup is permitted. "
            "Preserve any public record and inspect before continuing."
        ) from None