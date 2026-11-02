"""Inspect public Tokenizer prerequisites without wallet access or writes.

No KMD connection, secret prompt, identity creation, signing, funding,
transaction preparation, deployment, or submission.

This inspection does not authorize execution or choose funding amounts.
"""

import argparse
import json

from algosdk.error import AlgodHTTPError

from inspect_kmd_storage import docker_executable
from localnet_safety import LocalNetContext, is_unset_address
from prepare_tokenizer_wallet import container_id
from tokenizer_artifacts import load_tokenizer_artifacts
from tokenizer_localnet_config import (
    APPROVED_ROLES,
    validate_container,
    validate_network,
    validate_roles,
)


def account_summary(client, address):
    try:
        info = client.account_info(address)
    except AlgodHTTPError as error:
        if error.code != 404:
            raise
        return {
            "address": address,
            "lookup": "not_found_404",
            "amount_microalgo": None,
            "minimum_balance_microalgo": None,
            "effective_authority": None,
            "assets": None,
            "created_asset_count": None,
            "created_application_count": None,
            "local_application_count": None,
        }

    amount = info["amount"]
    minimum = info["min-balance"]
    if (
        type(amount) is not int
        or type(minimum) is not int
        or amount < 0
        or minimum < 0
    ):
        raise ValueError("Unexpected account balance fields")

    auth = info.get("auth-addr")
    return {
        "address": address,
        "lookup": "returned",
        "round": info.get("round"),
        "status": info.get("status"),
        "amount_microalgo": amount,
        "minimum_balance_microalgo": minimum,
        "effective_authority": address if is_unset_address(auth) else auth,
        "assets": [
            {
                "asset_id": holding["asset-id"],
                "amount": holding["amount"],
                "frozen": holding.get("is-frozen"),
            }
            for holding in info.get("assets", [])
        ],
        "created_asset_count": len(info.get("created-assets", [])),
        "created_application_count": len(info.get("created-apps", [])),
        "local_application_count": len(info.get("apps-local-state", [])),
    }


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
    parser.add_argument("--compile-directory", required=True)
    args = parser.parse_args()

    validate_network(
        network=args.network,
        genesis_id=args.expected_genesis_id,
        genesis_hash_base64=args.expected_genesis_hash,
    )
    validate_container(args.expected_container_id)
    validate_roles(dict(APPROVED_ROLES))
    metadata, programs = load_tokenizer_artifacts(args.compile_directory)

    docker = docker_executable()

    def check_container():
        actual = container_id(docker)
        validate_container(actual)
        return actual

    actual_container = check_container()
    context = LocalNetContext(
        network=args.network,
        algod_url=args.algod_url,
        expected_genesis_id=args.expected_genesis_id,
        expected_genesis_hash=args.expected_genesis_hash,
    )
    params = context.fresh_params()
    status = context.client.status()

    accounts = {}
    for role, address in APPROVED_ROLES.items():
        check_container()
        context.fresh_params()
        accounts[role] = account_summary(context.client, address)

    check_container()
    context.fresh_params()

    print(json.dumps({
        "purpose": "disposable-tokenizer-public-preflight-only",
        "network": args.network,
        "genesis_id": params.gen,
        "genesis_hash_base64": params.gh,
        "container_id": actual_container,
        "node_last_round": status.get("last-round"),
        "node_last_version": status.get("last-version"),
        "minimum_transaction_fee_microalgo": params.min_fee,
        "compile_directory": args.compile_directory,
        "compiled_program_bytes": {
            name: len(program) for name, program in programs.items()
        },
        "global_schema": metadata["global_schema"],
        "local_schema": metadata["local_schema"],
        "accounts": accounts,
        "snapshot_limit": (
            "Separate public reads; not an atomic same-round snapshot."
        ),
        "funding_plan": "not approved or executed",
        "wallet_access": "not performed",
        "signing": "not performed",
        "submission": "not performed",
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()