"""Read-only verification of isolated Tokenizer compilation artifacts.

No network access, wallet opening, signing, or transaction preparation.
Artifact verification does not establish deployment or behavioral correctness.
"""

import base64
import hashlib
import json
from pathlib import Path

from tokenizer_localnet_config import (
    validate_container,
    validate_network,
    validate_roles,
)


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "tokenizer"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def load_tokenizer_artifacts(directory_name):
    """Load one explicitly selected direct-child compilation directory."""
    if (
        not isinstance(directory_name, str)
        or not directory_name.startswith("compile-localnet-")
        or Path(directory_name).name != directory_name
        or "/" in directory_name
        or "\\" in directory_name
    ):
        raise ValueError("Select an explicit Tokenizer compilation directory name")

    directory = (ARTIFACTS / directory_name).resolve()
    if directory.parent != ARTIFACTS.resolve() or not directory.is_dir():
        raise ValueError("Compilation directory must be directly under Tokenizer artifacts")

    def read_file(name):
        path = directory / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("Expected a regular, non-symlink artifact file")
        return path.read_bytes()

    metadata = json.loads(read_file("compile-localnet.json"))
    if (
        metadata.get("purpose") != "disposable-day1-tokenizer-only"
        or metadata.get("stage") != "algod-bytecode-compilation"
        or metadata.get("avm_version") != 10
    ):
        raise ValueError("Unexpected compilation purpose, stage, or AVM version")

    validate_network(
        network=metadata["network"],
        genesis_id=metadata["genesis_id"],
        genesis_hash_base64=metadata["genesis_hash_base64"],
    )
    validate_container(metadata["container_id"])
    validate_roles(metadata["approved_roles"])

    if metadata.get("global_schema") != {
        "num_uints": 8,
        "num_byte_slices": 3,
    }:
        raise ValueError("Unexpected global schema")
    if metadata.get("local_schema") != {
        "num_uints": 0,
        "num_byte_slices": 0,
    }:
        raise ValueError("Unexpected local schema")
    if metadata.get("dependencies") != {
        "pyteal": "0.27.0",
        "py-algorand-sdk": "2.11.1",
    }:
        raise ValueError("Unexpected recorded dependency versions")

    sources = metadata.get("source_sha256")
    if not isinstance(sources, dict) or "tokenizer.py" not in sources:
        raise ValueError("Missing recorded source hashes")

    for name, expected_hash in sources.items():
        if (
            not isinstance(name, str)
            or Path(name).name != name
            or "/" in name
            or "\\" in name
        ):
            raise ValueError("Source hash entry must name a local source file")
        path = ROOT / name
        if path.is_symlink() or sha256(path.read_bytes()) != expected_hash:
            raise ValueError("Current source differs from compilation record")

    programs = {}
    for name in ("approval", "clear"):
        recorded = metadata["programs"][name]
        teal = read_file(name + ".teal")
        bytecode = read_file(name + ".bin")
        if not bytecode:
            raise ValueError("Empty compiled program")
        if (
            len(teal) != recorded["teal_bytes"]
            or sha256(teal) != recorded["teal_sha256"]
            or len(bytecode) != recorded["bytecode_bytes"]
            or sha256(bytecode) != recorded["bytecode_sha256"]
        ):
            raise ValueError("Program differs from compilation record")

        # Algorand program address: SHA-512/256 of the Program domain prefix
        # and bytecode, encoded as an Algorand address.
        from algosdk import encoding

        digest = hashlib.new("sha512_256", b"Program" + bytecode).digest()
        if encoding.encode_address(digest) != recorded["algod_program_hash"]:
            raise ValueError("Program hash differs from compilation record")

        programs[name] = bytecode

    return metadata, programs