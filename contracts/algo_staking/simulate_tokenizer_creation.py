"""Simulate one saved unsigned Tokenizer creation. Never sign or submit."""

import base64
import hashlib
import json
from pathlib import Path

from algosdk import encoding
from algosdk.transaction import (
    ApplicationCallTxn,
    ApplicationCreateTxn,
    OnComplete,
    SignedTransaction,
    StateSchema,
    SuggestedParams,
)
from algosdk.v2client.models import (
    SimulateRequest,
    SimulateRequestTransactionGroup,
)

from inspect_kmd_storage import docker_executable
from localnet_safety import LocalNetContext
from prepare_tokenizer_creation import COMPILE_DIRECTORY, EXPECTED_PROGRAMS
from prepare_tokenizer_wallet import container_id
from tokenizer_artifacts import load_tokenizer_artifacts
from tokenizer_localnet_config import (
    CREATOR_INITIALIZER,
    GENESIS_HASH_BASE64,
    GENESIS_ID,
    validate_container,
)


ROOT = Path(__file__).resolve().parent
DIRECTORY = (
    ROOT / "artifacts" / "tokenizer"
    / "creation-localnet-def0d6df347a4090b0a833cfd86c3205"
)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def read_regular(name):
    path = DIRECTORY / name
    require(
        path.is_file() and not path.is_symlink(),
        "Expected an existing regular preparation artifact",
    )
    return path.read_bytes()


def main():
    output_path = DIRECTORY / "creation-simulation.json"
    require(
        not output_path.exists() and not output_path.is_symlink(),
        "Simulation record already exists; preserve it and inspect",
    )
    require(
        not DIRECTORY.is_symlink(),
        "Preparation directory must not be a symlink",
    )

    record = json.loads(read_regular("creation-preparation.json"))
    raw = read_regular("creation.unsigned.msgpack")
    encoded = base64.b64encode(raw).decode("ascii")
    txn = encoding.msgpack_decode(encoded)
    require(
        isinstance(txn, ApplicationCallTxn)
        and txn.index == 0,
        "Expected an unsigned application-call transaction with creation index zero",
    )
    require(
        hashlib.sha256(raw).hexdigest()
        == record["unsigned_msgpack_sha256"]
        and txn.get_txid() == record["unsigned_txid"],
        "Unsigned artifact differs from preparation record",
    )
    require(
        record["compile_directory"] == COMPILE_DIRECTORY,
        "Unexpected compilation selection",
    )

    metadata, programs = load_tokenizer_artifacts(COMPILE_DIRECTORY)
    for name, (length, digest) in EXPECTED_PROGRAMS.items():
        require(
            len(programs[name]) == length
            and hashlib.sha256(programs[name]).hexdigest() == digest,
            "Program differs from fixed creation identity",
        )

    expected = ApplicationCreateTxn(
        sender=CREATOR_INITIALIZER,
        sp=SuggestedParams(
            fee=1000,
            first=record["first_valid_round"],
            last=record["last_valid_round"],
            gh=GENESIS_HASH_BASE64,
            gen=GENESIS_ID,
            flat_fee=True,
        ),
        on_complete=OnComplete.NoOpOC,
        approval_program=programs["approval"],
        clear_program=programs["clear"],
        global_schema=StateSchema(8, 3),
        local_schema=StateSchema(0, 0),
        extra_pages=0,
    )
    require(
        encoding.msgpack_encode(expected) == encoded,
        "Saved transaction differs from exact creation template",
    )

    docker = docker_executable()
    validate_container(container_id(docker))
    context = LocalNetContext(
        network="localnet",
        algod_url="http://127.0.0.1:4001",
        expected_genesis_id=GENESIS_ID,
        expected_genesis_hash=GENESIS_HASH_BASE64,
    )
    params = context.fresh_params()
    require(params.min_fee == 1000, "Live minimum fee changed")
    require(
        txn.first_valid_round <= params.first <= txn.last_valid_round,
        "Saved transaction is outside its validity window; stop",
    )
    context.validate_transaction(txn)

    request = SimulateRequest(
        txn_groups=[
            SimulateRequestTransactionGroup(
                txns=[SignedTransaction(txn, None)]
            )
        ],
        allow_empty_signatures=True,
        allow_unnamed_resources=False,
        allow_more_logs=False,
        extra_opcode_budget=0,
    )
    response = context.client.simulate_transactions(request)
    require(isinstance(response, dict), "Unexpected simulation response format")

    groups = response.get("txn-groups", [])
    failures = []
    if len(groups) != 1:
        failures.append("Expected exactly one simulated group")
    for group in groups:
        if group.get("failure-message") or group.get("failed-at"):
            failures.append("Simulation reported group failure")
        results = group.get("txn-results", [])
        if len(results) != 1:
            failures.append("Expected exactly one outer transaction result")
        for result in results:
            if result.get("txn-result", {}).get("inner-txns"):
                failures.append("Creation unexpectedly produced inner transactions")

    evidence = {
        "purpose": "unsigned-tokenizer-creation-simulation-only",
        "unsigned_txid": txn.get_txid(),
        "unsigned_msgpack_sha256": hashlib.sha256(raw).hexdigest(),
        "settings": {
            "allow_empty_signatures": True,
            "allow_unnamed_resources": False,
            "allow_more_logs": False,
            "extra_opcode_budget": 0,
        },
        "automated_checks": (
            "passed_pending_response_review" if not failures else "failed"
        ),
        "failures": failures,
        "response": response,
        "limitations": [
            "Empty-signature simulation does not verify signing authority.",
            "Simulation does not submit or commit application creation.",
            "State and validity must be rechecked before approved execution.",
            "Full response and minimum-balance commitment require review.",
        ],
    }
    with output_path.open("x", encoding="utf-8") as output:
        json.dump(evidence, output, indent=2, sort_keys=True)
        output.write("\n")

    print(json.dumps(evidence, indent=2, sort_keys=True))
    if failures:
        raise SystemExit("Simulation checks failed. Stop; do not expand scope.")


if __name__ == "__main__":
    main()