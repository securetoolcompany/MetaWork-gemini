"""Compile the disposable Tokenizer for explicit public TestNet identities.

Only public read/compile requests and new compilation-artifact writes.
No wallet access, identity creation, transaction preparation, signing,
submission, funding, ASA creation, opt-in, rekeying, or initialization.
"""

import argparse
import base64
import hashlib
from importlib.metadata import version
import json
from pathlib import Path
import uuid

from algosdk import encoding
from algosdk.v2client.algod import AlgodClient
import pyteal as pt

from tokenizer import GLOBAL_BYTES, GLOBAL_UINTS, approval_program, clear_program
from tokenizer_testnet_config import (
    ALGOD_URL, APPROVED_ROLES, GENESIS_HASH_BASE64, GENESIS_ID,
    SIGNING_ARRANGEMENT, validate_endpoint, validate_network, validate_roles,
)

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "tokenizer-testnet"
INPUTS = (
    "compile_tokenizer_testnet.py",
    "requirements.txt",
    "tokenizer.py",
    "tokenizer_asset.py",
    "tokenizer_authority.py",
    "tokenizer_config.py",
    "tokenizer_initialization.py",
    "tokenizer_localnet_config.py",
    "tokenizer_testnet_config.py",
    "localnet_safety.py",
)
DEPENDENCIES = {"pyteal": "0.27.0", "py-algorand-sdk": "2.11.1"}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def input_hashes():
    result = {}
    for name in INPUTS:
        path = ROOT / name
        require(path.is_file() and not path.is_symlink(),
                "Required regular compilation input missing: " + name)
        result[name] = sha256(path.read_bytes())
    return result


def check_network(client):
    observed_versions = client.versions()
    params = client.suggested_params()
    validate_network(
        network="testnet", genesis_id=observed_versions["genesis_id"],
        genesis_hash_base64=observed_versions["genesis_hash_b64"],
    )
    validate_network(
        network="testnet", genesis_id=params.gen,
        genesis_hash_base64=params.gh,
    )
    require(type(params.first) is int and params.first >= 0,
            "Invalid observed TestNet round")
    return observed_versions, params


def compile_one(client, teal):
    response = client.compile(teal)
    bytecode = base64.b64decode(response["result"], validate=True)
    require(bytecode and bytecode[0] == 10, "Unexpected compiled AVM version")
    program_hash = encoding.encode_address(
        hashlib.new("sha512_256", b"Program" + bytecode).digest()
    )
    require(response["hash"] == program_hash,
            "Algod program hash does not match returned bytecode")
    raw_teal = teal.encode("utf-8")
    return bytecode, {
        "teal_bytes": len(raw_teal),
        "teal_sha256": sha256(raw_teal),
        "bytecode_bytes": len(bytecode),
        "bytecode_sha256": sha256(bytecode),
        "algod_program_hash": program_hash,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--network", required=True, choices=["testnet"])
    parser.parse_args()

    validate_endpoint(ALGOD_URL)
    validate_roles(dict(APPROVED_ROLES))
    dependencies = {name: version(name) for name in DEPENDENCIES}
    require(dependencies == DEPENDENCIES,
            "Installed compiler/SDK versions differ from the reviewed versions")
    require((GLOBAL_UINTS, GLOBAL_BYTES) == (8, 3), "Unexpected schema")
    require(not any(path.is_symlink() for path in (ROOT, *ROOT.parents)),
            "Symlinked source directory is forbidden")
    require(not any(path.is_symlink() for path in (ARTIFACTS, *ARTIFACTS.parents)),
            "Symlinked artifact directory is forbidden")

    before = input_hashes()
    teal = {
        "approval": pt.compileTeal(approval_program(network="testnet"),
                                   mode=pt.Mode.Application, version=10),
        "clear": pt.compileTeal(clear_program(),
                                mode=pt.Mode.Application, version=10),
    }
    for address in APPROVED_ROLES.values():
        require("addr " + address in teal["approval"],
                "Selected TestNet role missing from generated approval TEAL")

    client = AlgodClient("", ALGOD_URL)
    versions_before, params_before = check_network(client)
    programs, records = {}, {}
    for name in ("approval", "clear"):
        programs[name], records[name] = compile_one(client, teal[name])

    require(all(len(program) <= 2048 for program in programs.values())
            and sum(map(len, programs.values())) <= 2048,
            "Programs exceed the reviewed zero-extra-page envelope")
    versions_after, params_after = check_network(client)
    require(input_hashes() == before, "Compilation inputs changed; preserve existing artifacts")

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    destination = ARTIFACTS / ("compile-testnet-" + uuid.uuid4().hex)
    destination.mkdir(exist_ok=False)
    metadata = {
        "purpose": "disposable-day1-tokenizer-testnet-only",
        "stage": "algod-bytecode-compilation",
        "network": "testnet",
        "algod_url": ALGOD_URL,
        "genesis_id": GENESIS_ID,
        "genesis_hash_base64": GENESIS_HASH_BASE64,
        "approved_roles": dict(APPROVED_ROLES),
        "signing_arrangement": SIGNING_ARRANGEMENT,
        "avm_version": 10,
        "dependencies": dependencies,
        "global_schema": {"num_uints": GLOBAL_UINTS, "num_byte_slices": GLOBAL_BYTES},
        "local_schema": {"num_uints": 0, "num_byte_slices": 0},
        "extra_pages": 0,
        "source_sha256": before,
        "programs": records,
        "observed_round_before": params_before.first,
        "observed_round_after": params_after.first,
        "node_build_before": versions_before.get("build"),
        "node_build_after": versions_after.get("build"),
        "minimum_fee_before": params_before.min_fee,
        "minimum_fee_after": params_after.min_fee,
        "transaction_preparation": "not performed",
        "simulation": "not performed",
        "wallet_access": "not performed",
        "signing": "not performed",
        "submission": "not performed",
        "deployment": "not performed",
        "execution_approval": "not requested",
    }
    for name in ("approval", "clear"):
        with (destination / (name + ".teal")).open("xb") as output:
            output.write(teal[name].encode("utf-8"))
        with (destination / (name + ".bin")).open("xb") as output:
            output.write(programs[name])
    with (destination / "compile-testnet.json").open("x", encoding="utf-8") as output:
        json.dump(metadata, output, indent=2, sort_keys=True)
        output.write("\n")
    print(json.dumps({
        "status": "testnet_compiled_not_prepared_not_deployed",
        "artifact_directory": str(destination.relative_to(ROOT)),
        "programs": records,
        "observed_round": params_after.first,
        "extra_pages": 0,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()