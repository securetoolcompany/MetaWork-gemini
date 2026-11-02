"""Reopen the existing proof wallet and verify signing without submission."""

import argparse
import base64
import json
from pathlib import Path

from algosdk import encoding
from algosdk.kmd import KMDClient
from algosdk.transaction import PaymentTxn
from nacl.signing import VerifyKey

from inspect_kmd_storage import docker_executable, run_public_command
from localnet_safety import (
    LOCALNET_TOKEN,
    LocalNetContext,
    require_disposable_address,
)
from prepare_proof_wallet import hidden_password


ROOT = Path(__file__).resolve().parent
RECORD = ROOT / "artifacts" / "account_control" / "kmd-proof-wallet.json"
ROLES = {"operator", "staking", "recipient", "outsider"}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def container_marker():
    output = run_public_command(
        [
            docker_executable(),
            "inspect",
            "--format",
            "{{.Id}} {{.State.StartedAt}} {{.State.Running}}",
            "algokit_sandbox_algod",
        ]
    )
    fields = output.strip().split()
    require(
        len(fields) == 3 and fields[2] == "true",
        "Expected the existing LocalNet container to be running",
    )
    return {"container_id": fields[0], "started_at": fields[1]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", required=True, choices=["reopen", "after-restart"]
    )
    parser.add_argument("--network", required=True, choices=["localnet"])
    parser.add_argument(
        "--algod-url",
        required=True,
        choices=["http://127.0.0.1:4001", "http://localhost:4001"],
    )
    parser.add_argument("--expected-genesis-id", required=True)
    parser.add_argument("--expected-genesis-hash", required=True)
    args = parser.parse_args()

    require(RECORD.is_file(), "Existing public wallet record is required")
    record = json.loads(RECORD.read_text(encoding="utf-8"))

    context = LocalNetContext(
        network=args.network,
        algod_url=args.algod_url,
        expected_genesis_id=args.expected_genesis_id,
        expected_genesis_hash=args.expected_genesis_hash,
    )
    require(
        record["network"] == args.network
        and record["genesis_id"] == args.expected_genesis_id
        and base64.b64decode(record["genesis_hash_base64"])
        == context.genesis_hash,
        "Recorded wallet network does not match the verified node",
    )
    require(
        record["purpose"] == "disposable-account-control-proof-only",
        "Unexpected wallet purpose",
    )
    require(
        record["wallet_name"].startswith("metawork-disposable-proof-")
        and record["wallet_name"] != "unencrypted-default-wallet",
        "A dedicated proof wallet is required",
    )
    require(
        set(record["accounts"]) == ROLES,
        "All four recorded proof roles are required",
    )
    addresses = [
        require_disposable_address(address)
        for address in record["accounts"].values()
    ]
    require(len(set(addresses)) == 4, "Proof roles must have distinct accounts")

    marker = container_marker()

    if args.check == "after-restart":
        previous = record.get("reopen_verification")
        require(
            isinstance(previous, dict),
            "Complete the fresh-process reopen check before restarting",
        )
        require(
            marker["container_id"] == previous["container"]["container_id"],
            "Container was replaced, not ordinarily restarted; stop",
        )
        require(
            marker["started_at"] != previous["container"]["started_at"],
            "No container restart has been observed",
        )

    kmd = KMDClient(LOCALNET_TOKEN, "http://127.0.0.1:4002")
    matches = [
        wallet
        for wallet in kmd.list_wallets()
        if wallet["id"] == record["wallet_id"]
    ]
    require(
        len(matches) == 1
        and matches[0]["name"] == record["wallet_name"],
        "Recorded wallet identity was not found; do not create a replacement",
    )

    password = hidden_password("Existing dedicated proof-wallet password: ")
    handle = None
    results = {}

    try:
        handle = kmd.init_wallet_handle(record["wallet_id"], password)
        require(
            set(kmd.list_keys(handle)) == set(addresses),
            "Existing wallet key inventory differs from recorded proof roles",
        )

        for role, address in sorted(record["accounts"].items()):
            txn = PaymentTxn(
                sender=address,
                sp=context.fresh_params(),
                receiver=address,
                amt=0,
            )
            context.validate_transaction(txn)
            signed = kmd.sign_transaction(handle, password, txn)

            require(
                encoding.msgpack_encode(signed.transaction)
                == encoding.msgpack_encode(txn),
                f"{role}: signed transaction differs from requested transaction",
            )
            require(
                signed.authorizing_address is None,
                f"{role}: unexpected alternate signing authority",
            )

            message = b"TX" + base64.b64decode(
                encoding.msgpack_encode(txn)
            )
            signature = base64.b64decode(signed.signature, validate=True)
            VerifyKey(encoding.decode_address(address)).verify(
                message, signature
            )

            results[role] = {
                "address": address,
                "signature_verified": True,
                "submitted": False,
            }

    except Exception:
        raise RuntimeError(
            "Existing-wallet signing verification failed. Preserve the "
            "wallet and record; do not fund, rekey, or generate replacements."
        ) from None
    finally:
        try:
            if handle is not None:
                kmd.release_wallet_handle(handle)
        finally:
            del password

    verification = {
        "wallet_id": record["wallet_id"],
        "container": marker,
        "accounts": results,
        "submission": "not performed",
    }

    if args.check == "reopen":
        record["reopen_verification"] = verification
        record["fresh_process_signing"] = "verified for all four accounts"
        record["status"] = "reopen_verified_restart_check_required"
    else:
        record["restart_verification"] = verification
        record["storage"]["ordinary_restart_persistence"] = (
            "verified by reopening and signing after container restart"
        )
        record["status"] = "wallet_ready_for_proof"

    RECORD.write_text(
        json.dumps(record, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(record, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()