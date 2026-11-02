"""Read-only preflight of the existing unsigned Tokenizer creation.

No KMD access, signing, submission, funding, transaction rebuilding,
identity creation, or artifact writes.
"""

import argparse
import json
import unittest

from inspect_kmd_storage import docker_executable
from localnet_safety import LocalNetContext, is_unset_address
from prepare_tokenizer_wallet import container_id
from test_tokenizer_creation_evidence import (
    TokenizerCreationEvidenceTests,
)
from tokenizer_localnet_config import (
    APPROVED_ROLES,
    CREATOR_INITIALIZER,
    GENESIS_HASH_BASE64,
    GENESIS_ID,
    validate_container,
    validate_roles,
)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--network", required=True, choices=["localnet"])
    args = parser.parse_args()

    validate_roles(dict(APPROVED_ROLES))

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(
        TokenizerCreationEvidenceTests
    )
    require(suite.countTestCases() == 8, "Unexpected offline test inventory")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    require(result.wasSuccessful(), "Offline evidence checks failed; stop")

    record = TokenizerCreationEvidenceTests.preparation
    txn = TokenizerCreationEvidenceTests.txn
    require(
        record["creator"] == txn.sender == CREATOR_INITIALIZER,
        "Saved creator differs from approved initializer",
    )

    docker = docker_executable()

    def check_container():
        actual = container_id(docker)
        validate_container(actual)
        return actual

    observed_container = check_container()
    context = LocalNetContext(
        network=args.network,
        algod_url="http://127.0.0.1:4001",
        expected_genesis_id=GENESIS_ID,
        expected_genesis_hash=GENESIS_HASH_BASE64,
    )
    context.validate_transaction(txn)
    check_container()

    info = context.client.account_info(CREATOR_INITIALIZER)
    require(
        info.get("address") == CREATOR_INITIALIZER,
        "Unexpected creator account response",
    )
    for key in ("amount", "min-balance", "round"):
        require(
            type(info.get(key)) is int and info[key] >= 0,
            "Unexpected creator account numeric field: " + key,
        )

    auth = info.get("auth-addr")
    authority_matches = (
        is_unset_address(auth) or auth == CREATOR_INITIALIZER
    )

    check_container()
    params = context.fresh_params()
    status = context.client.status()
    check_container()
    last_round = status.get("last-round")
    require(
        type(last_round) is int and last_round >= 0,
        "Unexpected node round",
    )
    require(type(params.first) is int, "Unexpected suggested first round")

    window_matches = (
        txn.first_valid_round <= last_round <= txn.last_valid_round
        and txn.first_valid_round <= params.first <= txn.last_valid_round
    )
    fee_matches = (
        params.min_fee == 1000 and txn.fee == 1000
    )

    # Projection under the previously reviewed schedule, not live
    # consensus-parameter verification.
    additional_minimum = 478_000
    projected_minimum = info["min-balance"] + additional_minimum
    projected_amount = info["amount"] - txn.fee
    headroom = projected_amount - projected_minimum

    blockers = [
        "Applicable live consensus minimum-balance parameters remain "
        "unverified; balance figures are projections only"
    ]
    if not authority_matches:
        blockers.append("Creator effective authority changed")
    if not window_matches:
        blockers.append("Saved transaction is outside observed round bounds")
    if not fee_matches:
        blockers.append("Exact reviewed fee assumptions no longer match")
    if headroom < 0:
        blockers.append("Creator fails the reviewed balance projection")

    print(json.dumps({
        "purpose": "saved-tokenizer-creation-read-only-preflight",
        "network": args.network,
        "container_id": observed_container,
        "genesis_id": params.gen,
        "genesis_hash_base64": params.gh,
        "offline_evidence_tests_passed": result.testsRun,
        "unsigned_txid": txn.get_txid(),
        "creator": CREATOR_INITIALIZER,
        "creator_account_round": info["round"],
        "creator_effective_authority": (
            CREATOR_INITIALIZER if is_unset_address(auth) else auth
        ),
        "creator_amount_microalgo": info["amount"],
        "creator_minimum_balance_microalgo": info["min-balance"],
        "node_last_round": last_round,
        "node_last_version": status.get("last-version"),
        "suggested_first_round": params.first,
        "saved_first_valid_round": txn.first_valid_round,
        "saved_last_valid_round": txn.last_valid_round,
        "live_minimum_fee_microalgo": params.min_fee,
        "saved_fee_microalgo": txn.fee,
        "balance_projection": {
            "additional_minimum_microalgo": additional_minimum,
            "projected_minimum_microalgo": projected_minimum,
            "projected_amount_after_fee_microalgo": projected_amount,
            "projected_headroom_microalgo": headroom,
            "basis": "previously reviewed schedule, not live consensus verification",
        },
        "blockers": blockers,
        "execution_approval": "not_requested",
        "wallet_access": "not_performed",
        "signing": "not_performed",
        "submission": "not_performed",
        "limitations": [
            "Separate reads are not an atomic same-round snapshot.",
            "Matching auth-addr does not prove access to a signing key.",
            "No fresh simulation is performed.",
            "Live consensus minimum-balance parameters are not verified.",
            "An empty blocker list does not authorize execution.",
        ],
    }, indent=2, sort_keys=True))

    if blockers:
        raise SystemExit("Preflight blocked. Preserve output; do not retry automatically.")


if __name__ == "__main__":
    main()