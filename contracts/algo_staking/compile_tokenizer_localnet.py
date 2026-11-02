"""Generate Tokenizer TEAL and compile through pinned disposable LocalNet.

No wallet access, signing, funding, deployment, or transaction submission.
Each run writes a new isolated directory and never overwrites proof artifacts.
"""

import argparse
import base64
import hashlib
import json
import uuid
from importlib.metadata import version
from pathlib import Path

import pyteal as pt

from inspect_kmd_storage import docker_executable
from localnet_safety import LocalNetContext
from prepare_tokenizer_wallet import container_id
from tokenizer import (
    GLOBAL_BYTES,
    GLOBAL_UINTS,
    approval_program,
    clear_program,
)
from tokenizer_localnet_config import (
    APPROVED_ROLES,
    validate_container,
    validate_network,
)


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "tokenizer"
SOURCE_FILES = (
    "compile_tokenizer_localnet.py",
    "tokenizer.py",
    "tokenizer_authority.py",
    "tokenizer_asset.py",
    "tokenizer_initialization.py",
    "tokenizer_config.py",
    "tokenizer_localnet_config.py",
    "localnet_safety.py",
    "inspect_kmd_storage.py",
    "prepare_tokenizer_wallet.py",
    "requirements.txt",
)
REQUIRED_VERSIONS = {
    "pyteal": "0.27.0",
    "py-algorand-sdk": "2.11.1",
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def source_hashes():
    return {
        name: sha256((ROOT / name).read_bytes())
        for name in SOURCE_FILES
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
    args = parser.parse_args()

    validate_network(
        network=args.network,
        genesis_id=args.expected_genesis_id,
        genesis_hash_base64=args.expected_genesis_hash,
    )
    validate_container(args.expected_container_id)

    installed = {
        package: version(package)
        for package in REQUIRED_VERSIONS
    }
    if installed != REQUIRED_VERSIONS:
        raise RuntimeError("Installed dependency versions differ from required pins")

    sources_before = source_hashes()
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

    outputs = {}
    programs = {}

    for name, expression in (
        ("approval", approval_program()),
        ("clear", clear_program()),
    ):
        teal = (
            pt.compileTeal(
                expression,
                mode=pt.Mode.Application,
                version=10,
                optimize=pt.OptimizeOptions(scratch_slots=True),
            )
            + "\n"
        )
        check_container()
        params = context.fresh_params()
        validate_network(
            network=args.network,
            genesis_id=params.gen,
            genesis_hash_base64=params.gh,
        )
        response = context.client.compile(teal)
        bytecode = base64.b64decode(response["result"], validate=True)
        if not bytecode:
            raise RuntimeError("Algod returned empty program bytecode")

        teal_bytes = teal.encode("utf-8")
        outputs[name + ".teal"] = teal_bytes
        outputs[name + ".bin"] = bytecode
        programs[name] = {
            "teal_bytes": len(teal_bytes),
            "teal_sha256": sha256(teal_bytes),
            "bytecode_bytes": len(bytecode),
            "bytecode_sha256": sha256(bytecode),
            "algod_program_hash": response["hash"],
        }

    check_container()
    context.fresh_params()
    if source_hashes() != sources_before:
        raise RuntimeError("Source changed during compilation; artifacts not saved")

    run_directory = ARTIFACTS / ("compile-localnet-" + uuid.uuid4().hex)
    report = {
        "purpose": "disposable-day1-tokenizer-only",
        "stage": "algod-bytecode-compilation",
        "network": args.network,
        "algod_url": args.algod_url,
        "genesis_id": args.expected_genesis_id,
        "genesis_hash_base64": args.expected_genesis_hash,
        "container_id": actual_container,
        "dependencies": installed,
        "source_sha256": sources_before,
        "approved_roles": dict(APPROVED_ROLES),
        "avm_version": 10,
        "global_schema": {
            "num_uints": GLOBAL_UINTS,
            "num_byte_slices": GLOBAL_BYTES,
        },
        "local_schema": {
            "num_uints": 0,
            "num_byte_slices": 0,
        },
        "programs": programs,
        "artifact_directory": run_directory.relative_to(ROOT).as_posix(),
        "program_page_requirements": "not yet assessed",
        "simulation": "not performed",
        "signing": "not performed",
        "deployment": "not performed",
    }

    run_directory.mkdir(parents=True, exist_ok=False)
    for name, data in outputs.items():
        with (run_directory / name).open("xb") as output:
            output.write(data)
    with (run_directory / "compile-localnet.json").open(
        "x", encoding="utf-8"
    ) as output:
        json.dump(report, output, indent=2, sort_keys=True)
        output.write("\n")

    print(json.dumps({
        "artifact_directory": report["artifact_directory"],
        "programs": programs,
        "stage": report["stage"],
        "deployment": report["deployment"],
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()