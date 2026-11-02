"""Compile proof TEAL through explicitly verified disposable LocalNet."""

import argparse
import base64
import hashlib
import json
from pathlib import Path

from algosdk.v2client.algod import AlgodClient


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "account_control"
LOCALNET_TOKEN = "a" * 64


def sha256(data):
    return hashlib.sha256(data).hexdigest()


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
    args = parser.parse_args()

    if (
        not args.expected_genesis_id
        or any(
            name in args.expected_genesis_id.lower()
            for name in ("mainnet", "testnet", "betanet")
        )
    ):
        raise ValueError("Expected genesis must identify disposable LocalNet")

    expected_hash = base64.b64decode(
        args.expected_genesis_hash,
        validate=True,
    )
    if len(expected_hash) != 32:
        raise ValueError("Expected genesis hash must decode to 32 bytes")

    client = AlgodClient(LOCALNET_TOKEN, args.algod_url)
    params = client.suggested_params()

    if params.gen != args.expected_genesis_id:
        raise ValueError("Node genesis ID does not match expected genesis")

    actual_hash = base64.b64decode(params.gh, validate=True)
    if actual_hash != expected_hash:
        raise ValueError("Node genesis hash does not match expected genesis")

    metadata = json.loads(
        (ARTIFACTS / "compile.json").read_text(encoding="utf-8")
    )

    source = (ROOT / "account_control.py").read_bytes()
    if sha256(source) != metadata["source_sha256"]:
        raise ValueError("Contract source changed; regenerate TEAL first")

    sources = {}
    for name in ("approval.teal", "clear.teal"):
        data = (ARTIFACTS / name).read_bytes()
        if sha256(data) != metadata["programs"][name]["sha256"]:
            raise ValueError(f"{name} differs from recorded compilation")
        sources[name] = data.decode("utf-8")

    compiled = {}
    outputs = {}

    for name, source_text in sources.items():
        response = client.compile(source_text)
        bytecode = base64.b64decode(response["result"], validate=True)

        if not bytecode:
            raise ValueError(f"Algod returned empty bytecode for {name}")

        output_name = name.replace(".teal", ".bin")
        outputs[output_name] = bytecode
        compiled[output_name] = {
            "bytes": len(bytecode),
            "sha256": sha256(bytecode),
            "algod_program_hash": response["hash"],
            "teal_sha256": metadata["programs"][name]["sha256"],
        }

    report = {
        "purpose": "disposable-account-control-proof-only",
        "stage": "algod-bytecode-compilation",
        "network": args.network,
        "algod_url": args.algod_url,
        "genesis_id": params.gen,
        "genesis_hash_base64": params.gh,
        "source_sha256": metadata["source_sha256"],
        "programs": compiled,
        "signing": "not performed",
        "deployment": "not executed",
    }

    for name, bytecode in outputs.items():
        (ARTIFACTS / name).write_bytes(bytecode)

    encoded_report = json.dumps(report, indent=2, sort_keys=True) + "\n"
    (ARTIFACTS / "compile-localnet.json").write_bytes(
        encoded_report.encode("utf-8")
    )
    print(encoded_report, end="")


if __name__ == "__main__":
    main()