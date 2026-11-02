"""Read-only discovery of disposable LocalNet genesis funding candidates.

Open only the existing unencrypted-default-wallet. Never export keys,
generate identities, sign, submit, fund, or change authority.

Wallet membership alone is insufficient: candidates must also appear as
funded accounts in this verified node's genesis allocations and currently
retain original-address authorization. Multiple candidates are ambiguous;
this script never silently chooses between them.
"""

import argparse
import json

from algosdk.kmd import KMDClient

from inspect_kmd_storage import docker_executable
from localnet_safety import (
    LOCALNET_TOKEN,
    LocalNetContext,
    PRODUCTION_ADDRESS,
    ZERO_ADDRESS,
    is_unset_address,
    require_disposable_address,
)
from prepare_tokenizer_wallet import container_id
from tokenizer_localnet_config import (
    APPROVED_ROLES,
    PRESERVED_PROOF_ADDRESSES,
    validate_container,
    validate_network,
)


EXCLUDED = (
    set(PRESERVED_PROOF_ADDRESSES)
    | set(APPROVED_ROLES.values())
    | {PRODUCTION_ADDRESS, ZERO_ADDRESS}
)
PLANNED_PAYMENTS = 3_200_000
PLANNED_PAYMENT_COUNT = 3


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
    args = parser.parse_args()

    validate_network(
        network=args.network,
        genesis_id=args.expected_genesis_id,
        genesis_hash_base64=args.expected_genesis_hash,
    )
    validate_container(args.expected_container_id)

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

    def recheck():
        check_container()
        return context.fresh_params()

    params = recheck()
    genesis = context.client.genesis()
    allocations = genesis.get("alloc")
    if not isinstance(allocations, list):
        raise ValueError("Genesis allocation list unavailable")

    genesis_funding = {}
    for allocation in allocations:
        address = allocation.get("addr")
        amount = allocation.get("state", {}).get("algo")
        if isinstance(address, str) and type(amount) is int and amount > 0:
            genesis_funding[address] = amount

    kmd = KMDClient(LOCALNET_TOKEN, "http://127.0.0.1:4002")
    wallets = [
        wallet for wallet in kmd.list_wallets()
        if wallet["name"] == "unencrypted-default-wallet"
    ]
    if len(wallets) != 1:
        raise RuntimeError("Default funding wallet is missing or ambiguous")

    report = {
        "network": args.network,
        "genesis_id": params.gen,
        "genesis_hash_base64": params.gh,
        "container_id": actual_container,
        "wallet_name": "unencrypted-default-wallet",
        "wallet_id": wallets[0]["id"],
        "candidates": [],
        "excluded_address_count": 0,
        "proposed_faucet": None,
        "handle_release": "not opened",
        "signing": "not performed",
        "submission": "not performed",
        "funding": "not performed",
        "status": "discovery_started",
    }

    handle = None
    try:
        recheck()
        handle = kmd.init_wallet_handle(wallets[0]["id"], "")
        report["handle_release"] = "pending"

        for address in sorted(set(kmd.list_keys(handle))):
            if address in EXCLUDED:
                report["excluded_address_count"] += 1
                continue
            require_disposable_address(address)
            recheck()
            info = context.client.account_info(address)
            amount = info["amount"]
            minimum = info["min-balance"]
            if (
                type(amount) is not int
                or type(minimum) is not int
                or amount < minimum
                or minimum < 0
            ):
                raise ValueError("Unexpected funding-account balance fields")

            auth = info.get("auth-addr")
            effective_auth = address if is_unset_address(auth) else auth
            available = amount - minimum
            required = PLANNED_PAYMENTS + PLANNED_PAYMENT_COUNT * params.min_fee
            eligible = (
                address in genesis_funding
                and effective_auth == address
                and available >= required
            )
            report["candidates"].append({
                "address": address,
                "balance_microalgo": amount,
                "minimum_balance_microalgo": minimum,
                "available_microalgo": available,
                "effective_authority": effective_auth,
                "default_wallet_member": True,
                "funded_genesis_allocation": address in genesis_funding,
                "genesis_allocation_microalgo": genesis_funding.get(address),
                "eligible_for_proposal": eligible,
                "planned_fee_per_payment_microalgo": params.min_fee,
                "planned_maximum_total_debit_microalgo": required,
            })

        recheck()
        eligible = [
            candidate for candidate in report["candidates"]
            if candidate["eligible_for_proposal"]
        ]
        if len(eligible) == 1:
            report["proposed_faucet"] = eligible[0]["address"]
            report["status"] = "single_candidate_found_funding_not_authorized"
        else:
            report["status"] = "no_unique_candidate_stop_for_review"

    except Exception as error:
        report["status"] = "discovery_incomplete_stop"
        report["failure_type"] = type(error).__name__
    finally:
        if handle is not None:
            try:
                kmd.release_wallet_handle(handle)
                report["handle_release"] = "confirmed"
            except Exception:
                report["handle_release"] = "not confirmed"
                report["status"] = "discovery_incomplete_stop"

    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        raise SystemExit(
            "Discovery stopped before completion. No retry, wallet switching, "
            "or funding is authorized. Report this message for inspection."
        ) from None