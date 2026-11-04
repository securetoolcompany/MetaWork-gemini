"""Prepare unsigned Tokenizer creation using read-only LocalNet queries.

Writes new public preparation artifacts only.
No KMD access, signing, submission, funding, or initialization.
"""

import base64
import hashlib
import json
import subprocess
import uuid
from pathlib import Path
import argparse

from algosdk import encoding
from algosdk.transaction import (
    ApplicationCreateTxn,
    OnComplete,
    StateSchema,
)

from inspect_kmd_storage import docker_executable
from localnet_safety import LocalNetContext
from prepare_tokenizer_wallet import container_id
from tokenizer_artifacts import load_tokenizer_artifacts
from tokenizer_localnet_config import (
    CREATOR_INITIALIZER,
    GENESIS_HASH_BASE64,
    GENESIS_ID,
    validate_container,
)


ROOT = Path(__file__).resolve().parent
COMPILE_DIRECTORY = "compile-localnet-385709a7d1ba4be5a65e3e0042662967"
EXPECTED_PROGRAMS = {
    "approval": (
        1186,
        "45214e892f8036a738620b9e77863ad46e7a7fadbadb4f5af7c9d911408f8218",
    ),
    "clear": (
        4,
        "baa698f7e6728cd2257d20588deaae7ff497fb535bd35e1dd745988d380c66c5",
    ),
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def git(*args):
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def main():
    metadata, programs = load_tokenizer_artifacts(COMPILE_DIRECTORY)
    for name, (length, digest) in EXPECTED_PROGRAMS.items():
        require(
            len(programs[name]) == length
            and hashlib.sha256(programs[name]).hexdigest() == digest,
            "Program differs from fixed preparation identity",
        )

    docker = docker_executable()
    observed_container = container_id(docker)
    validate_container(observed_container)

    context = LocalNetContext(
        network="localnet",
        algod_url="http://127.0.0.1:4001",
        expected_genesis_id=GENESIS_ID,
        expected_genesis_hash=GENESIS_HASH_BASE64,
    )
    creator_info = context.client.account_info(CREATOR_INITIALIZER)
    require(
        creator_info.get("address") == CREATOR_INITIALIZER,
        "Unexpected creator account response",
    )
    require(
        creator_info.get("auth-addr") in (None, "", CREATOR_INITIALIZER),
        "Creator authority changed",
    )

    params = context.fresh_params()
    require(
        params.min_fee == 1000 and params.fee == 1000,
        "Exact 1000-microALGO fee is unavailable",
    )
    require(
        type(params.first) is int
        and type(params.last) is int
        and 0 <= params.first <= params.last
        and params.last - params.first <= 1000,
        "Unexpected transaction validity window",
    )

    txn = ApplicationCreateTxn(
        sender=CREATOR_INITIALIZER,
        sp=params,
        on_complete=OnComplete.NoOpOC,
        approval_program=programs["approval"],
        clear_program=programs["clear"],
        global_schema=StateSchema(8, 3),
        local_schema=StateSchema(0, 0),
        extra_pages=0,
    )
    context.validate_transaction(txn)
    validate_container(container_id(docker))

    encoded = encoding.msgpack_encode(txn)
    raw = base64.b64decode(encoded, validate=True)
    require(
        encoding.msgpack_encode(encoding.msgpack_decode(encoded)) == encoded,
        "Unsigned transaction serialization round-trip failed",
    )

    source_hashes = {}
    for path in sorted(ROOT.glob("*.py")):
        require(not path.is_symlink(), "Symlinked Python source is not permitted")
        source_hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()

    record = {
        "purpose": "disposable-day1-tokenizer-creation-preparation-only",
        "status": "unsigned_prepared_not_simulated_not_approved",
        "network": "localnet",
        "algod_url": "http://127.0.0.1:4001",
        "genesis_id": GENESIS_ID,
        "genesis_hash_base64": GENESIS_HASH_BASE64,
        "container_id": observed_container,
        "creator": CREATOR_INITIALIZER,
        "creator_account_snapshot": {
            key: creator_info.get(key)
            for key in ("round", "amount", "min-balance", "auth-addr")
        },
        "source_commit": git("rev-parse", "HEAD"),
        "working_tree_status": git(
            "status", "--short", "--untracked-files=all", "--", "."
        ),
        "current_python_source_sha256": source_hashes,
        "compiled_source_sha256": metadata["source_sha256"],
        "compile_directory": COMPILE_DIRECTORY,
        "programs": metadata["programs"],
        "global_schema": metadata["global_schema"],
        "local_schema": metadata["local_schema"],
        "extra_pages": 0,
        "fee_microalgo": txn.fee,
        "first_valid_round": txn.first_valid_round,
        "last_valid_round": txn.last_valid_round,
        "unsigned_txid": txn.get_txid(),
        "unsigned_msgpack_sha256": hashlib.sha256(raw).hexdigest(),
        "unsigned_artifact": "creation.unsigned.msgpack",
        "expected_creator_minimum_balance_commitment": "pending_verification",
        "simulation": "not_performed",
        "approval": "not_requested",
        "expiry_policy": (
            "Never submit an expired transaction. Rebuild only with the same "
            "approved programs and parameters, repeat verification and "
            "simulation, and present the refreshed transaction for approval."
        ),
    }

    destination = (
        ROOT / "artifacts" / "tokenizer" / ("creation-localnet-" + uuid.uuid4().hex)
    )
    destination.mkdir(exist_ok=False)
    with (destination / "creation.unsigned.msgpack").open("xb") as output:
        output.write(raw)
    with (destination / "creation-preparation.json").open(
        "x", encoding="utf-8"
    ) as output:
        json.dump(record, output, indent=2, sort_keys=True)
        output.write("\n")

    print(json.dumps({
        "status": record["status"],
        "artifact_directory": str(destination.relative_to(ROOT)),
        "unsigned_txid": record["unsigned_txid"],
        "first_valid_round": record["first_valid_round"],
        "last_valid_round": record["last_valid_round"],
        "fee_microalgo": record["fee_microalgo"],
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()