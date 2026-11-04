"""Prepare and strictly simulate one unsigned disposable TestNet creation.

No wallet access, signing, submission, funding, ASA creation, or custody change.
Existing creation artifacts are never replaced. Failures preserve all evidence.
"""

import base64
import hashlib
from importlib.metadata import version
import json
import argparse
from pathlib import Path


from algosdk import encoding
from algosdk.transaction import (
    ApplicationCreateTxn, OnComplete, SignedTransaction, StateSchema,
)
from algosdk.v2client.algod import AlgodClient
from algosdk.v2client.models import SimulateRequest, SimulateRequestTransactionGroup

from tokenizer_testnet_config import (
    ALGOD_URL, APPROVED_ROLES, CREATOR_INITIALIZER, GENESIS_ID,
    GENESIS_HASH_BASE64, approved_role_public_keys,
    validate_endpoint, validate_network, validate_roles,
)

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "tokenizer-testnet"
COMPILE = "compile-testnet-4ed0b7d0e5024620b807cdf1cb48bf8f"
DESTINATION = ARTIFACTS / "creation-testnet-day1"
EXPECTED = {
    "approval": (1186, "647becfb6530849c0335bea8a31af2a7e6d6f24b58be093a32b584c3b4383878"),
    "clear": (4, "baa698f7e6728cd2257d20588deaae7ff497fb535bd35e1dd745988d380c66c5"),
}
UINT_KEYS = {
    "initialized", "share_asa_id", "outstanding_shares", "operating_reserve",
    "other_exclusions", "fee_rate", "fee_liability", "backing_baseline",
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def read_regular(path):
    require(not any(p.is_symlink() for p in (path, *path.parents)),
            "Symlinked source/artifact path forbidden")
    require(path.is_file(), "Required regular file missing: " + path.name)
    return path.read_bytes()


def write_json(path, record):
    with path.open("x", encoding="utf-8") as output:
        json.dump(record, output, indent=2, sort_keys=True)
        output.write("\n")


def load_compilation():
    directory = ARTIFACTS / COMPILE
    metadata = json.loads(read_regular(directory / "compile-testnet.json"))
    require(metadata.get("purpose") == "disposable-day1-tokenizer-testnet-only"
            and metadata.get("stage") == "algod-bytecode-compilation"
            and metadata.get("avm_version") == 10, "Unexpected compilation record")
    validate_network(network=metadata["network"], genesis_id=metadata["genesis_id"],
                     genesis_hash_base64=metadata["genesis_hash_base64"])
    validate_endpoint(metadata["algod_url"])
    validate_roles(metadata["approved_roles"])
    require(metadata["global_schema"] == {"num_uints": 8, "num_byte_slices": 3}
            and metadata["local_schema"] == {"num_uints": 0, "num_byte_slices": 0}
            and metadata["extra_pages"] == 0, "Compilation schema mismatch")
    require(metadata["dependencies"] == {"pyteal": "0.27.0", "py-algorand-sdk": "2.11.1"},
            "Unreviewed dependency record")
    for package, expected in metadata["dependencies"].items():
        require(version(package) == expected, "Installed dependency changed: " + package)
    sources = metadata["source_sha256"]
    require(isinstance(sources, dict) and "tokenizer.py" in sources
            and "tokenizer_testnet_config.py" in sources, "Missing compilation source bindings")
    for name, expected in sources.items():
        require(isinstance(name, str) and Path(name).name == name
                and "/" not in name and "\\" not in name, "Invalid source binding name")
        require(sha256(read_regular(ROOT / name)) == expected,
                "Compilation source changed: " + name)
    programs = {}
    for name, (size, expected) in EXPECTED.items():
        raw = read_regular(directory / (name + ".bin"))
        teal = read_regular(directory / (name + ".teal"))
        record = metadata["programs"][name]
        require(len(raw) == size and sha256(raw) == expected, "Recorded TestNet program changed")
        require(record["bytecode_sha256"] == expected and record["bytecode_bytes"] == size
                and record["teal_sha256"] == sha256(teal) and record["teal_bytes"] == len(teal),
                "Compilation record/file mismatch")
        program_hash = encoding.encode_address(hashlib.new("sha512_256", b"Program" + raw).digest())
        require(record["algod_program_hash"] == program_hash, "Compiled program address mismatch")
        programs[name] = raw
    return metadata, programs


def live(client):
    versions = client.versions()
    params = client.suggested_params()
    validate_network(network="testnet", genesis_id=versions["genesis_id"],
                     genesis_hash_base64=versions["genesis_hash_b64"])
    validate_network(network="testnet", genesis_id=params.gen, genesis_hash_base64=params.gh)
    info = client.account_info(CREATOR_INITIALIZER)
    require(info.get("address") == CREATOR_INITIALIZER, "Creator account response mismatch")
    require(info.get("auth-addr") in (None, "", CREATOR_INITIALIZER), "Creator authority changed")
    for key in ("amount", "min-balance", "round"):
        require(type(info.get(key)) is int and info[key] >= 0, "Invalid creator field: " + key)
    require(params.min_fee == 1000, "Minimum fee differs from proposed exact fee")
    require(info["amount"] >= info["min-balance"] + 1000,
            "Creator cannot cover current minimum balance plus fee; no automatic funding")
    return params, {key: info.get(key) for key in ("amount", "min-balance", "round", "auth-addr")}


def validate_simulation(response, txn):
    require(isinstance(response, dict), "Malformed simulation response")
    require(response.get("eval-overrides") == {"allow-empty-signatures": True},
            "Unexpected simulation relaxation/override")
    require(type(response.get("last-round")) is int, "Missing simulation ledger round")
    # The simulator evaluates the next block from this ledger round.
    require(txn.first_valid_round <= response["last-round"] + 1 <= txn.last_valid_round,
            "Simulation evaluation round outside candidate validity")
    groups = response.get("txn-groups", [])
    require(len(groups) == 1, "Expected one simulated group")
    group = groups[0]
    require(not group.get("failure-message") and "failed-at" not in group,
            "Simulation reported evaluation failure")
    require(not group.get("unnamed-resources-accessed"), "Unexpected unnamed resources")
    require(group.get("group-fees-paid") == txn.fee, "Simulated group fee mismatch")
    results = group.get("txn-results", [])
    require(len(results) == 1, "Expected one simulated outer transaction")
    result = results[0]
    require(not result.get("fixed-signer") and not result.get("unnamed-resources-accessed"),
            "Unexpected signer correction or unnamed resources")
    applied = result["txn-result"]
    require(not applied.get("pool-error") and not applied.get("inner-txns")
            and not applied.get("logs"), "Unexpected error, inner transaction, or log")
    require(type(applied.get("application-index")) is int
            and applied["application-index"] > 0, "Simulation has no creation result")
    expected_json = {}
    for key, value in txn.dictify().items():
        if isinstance(value, bytes):
            value = encoding.encode_address(value) if key == "snd" else base64.b64encode(value).decode()
        expected_json[key] = value
    observed = dict(applied["txn"]["txn"])
    expected_json.setdefault("apan", 0)
    observed.setdefault("apan", 0)
    require(observed == expected_json, "Simulated transaction differs from exact saved candidate")
    delta = applied.get("global-state-delta", [])
    keys = {}
    for entry in delta:
        key = base64.b64decode(entry["key"], validate=True).decode("utf-8")
        require(key not in keys, "Duplicate simulated state key")
        keys[key] = entry["value"]
    roles = approved_role_public_keys()
    role_keys = {"initializer": roles["creator_initializer"],
                 "staking": roles["staking"], "seed_recipient": roles["seed_recipient"]}
    require(set(keys) == UINT_KEYS | set(role_keys), "Unexpected simulated initial-state keys")
    for key in UINT_KEYS:
        value = keys[key]
        require(value.get("action") == 2 and type(value.get("uint", 0)) is int
                and value.get("uint", 0) == 0 and set(value) <= {"action", "uint"},
                "Unexpected initial uint state: " + key)
    for key, public_key in role_keys.items():
        value = keys[key]
        require(set(value) == {"action", "bytes"} and value["action"] == 1
                and base64.b64decode(value["bytes"], validate=True) == public_key,
                "Unexpected initial role state: " + key)


def main():
    global DESTINATION

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--replacement-once",
        action="store_true",
        help="Prepare the separately approved first replacement only",
    )
    args = parser.parse_args()

    replacement_of = None

    if args.replacement_once:
        original_directory = ARTIFACTS / "creation-testnet-day1"
        original_raw = read_regular(
            original_directory / "creation.unsigned.msgpack"
        )
        original_record_raw = read_regular(
            original_directory / "creation-preparation.json"
        )
        original_simulation_raw = read_regular(
            original_directory / "creation-simulation.json"
        )

        original_record = json.loads(original_record_raw)
        original_simulation = json.loads(original_simulation_raw)
        original_txn = encoding.msgpack_decode(
            base64.b64encode(original_raw).decode("ascii")
        )

        original_txid = (
            "S373DMUTPW2IVRXOXRDOYSXIOKDBT3NCBMWJWTQSDYJ5AOI2YLVA"
        )
        original_hash = (
            "37252b1c268d0eb75324d700af6f6a5782ca06d20dd613d1a60a1489a161e19f"
        )

        require(
            sha256(original_raw) == original_hash
            and original_txn.get_txid() == original_txid
            and base64.b64decode(
                encoding.msgpack_encode(original_txn)
            ) == original_raw,
            "Original candidate identity changed; stop",
        )

        for original_evidence in (
            original_record,
            original_simulation,
        ):
            require(
                original_evidence["unsigned_txid"] == original_txid
                and original_evidence["unsigned_msgpack_sha256"]
                == original_hash,
                "Original candidate/evidence association changed; stop",
            )

        require(
            original_record["compile_directory"] == COMPILE,
            "Original compilation association changed; stop",
        )

        replacement_of = {
            "artifact_directory": original_directory.name,
            "unsigned_txid": original_txid,
            "unsigned_msgpack_sha256": original_hash,
            "preparation_record_sha256": sha256(original_record_raw),
            "simulation_record_sha256": sha256(
                original_simulation_raw
            ),
            "authorization_scope": (
                "One separately approved replacement preparation and "
                "strict unsigned simulation only; no execution approval"
            ),
        }

        DESTINATION = (
            ARTIFACTS / "creation-testnet-day1-replacement-1"
        )

    require(
        not DESTINATION.exists() and not DESTINATION.is_symlink(),
        "Selected preparation directory exists; preserve it. "
        "No automatic rebuild or further replacement is permitted.",
    )
    validate_endpoint(ALGOD_URL)
    validate_roles(dict(APPROVED_ROLES))
    metadata, programs = load_compilation()
    client = AlgodClient("", ALGOD_URL)
    params, creator = live(client)
    require(type(params.first) is int and type(params.last) is int
            and 0 <= params.first <= params.last and params.last - params.first <= 1000,
            "Invalid suggested validity window")
    params.flat_fee = True
    params.fee = 1000
    txn = ApplicationCreateTxn(sender=CREATOR_INITIALIZER, sp=params,
        on_complete=OnComplete.NoOpOC, approval_program=programs["approval"],
        clear_program=programs["clear"], global_schema=StateSchema(8, 3),
        local_schema=StateSchema(0, 0), extra_pages=0)
    encoded = encoding.msgpack_encode(txn)
    raw = base64.b64decode(encoded, validate=True)
    require(encoding.msgpack_encode(encoding.msgpack_decode(encoded)) == encoded,
            "Candidate serialization round-trip failed")
    record = {
        "replaces_candidate": replacement_of,
        "purpose": "disposable-day1-tokenizer-testnet-creation-preparation-only",
        "status": "unsigned_prepared_not_approved", "network": "testnet",
        "algod_url": ALGOD_URL, "genesis_id": GENESIS_ID,
        "genesis_hash_base64": GENESIS_HASH_BASE64,
        "creator": CREATOR_INITIALIZER, "approved_roles": dict(APPROVED_ROLES),
        "compile_directory": COMPILE, "programs": metadata["programs"],
        "compiled_source_sha256": metadata["source_sha256"],
        "preparation_script_sha256": sha256(read_regular(Path(__file__).resolve())),
        "unsigned_artifact": "creation.unsigned.msgpack",
        "unsigned_txid": txn.get_txid(), "unsigned_msgpack_sha256": sha256(raw),
        "fee_microalgo": txn.fee, "first_valid_round": txn.first_valid_round,
        "last_valid_round": txn.last_valid_round,
        "global_schema": metadata["global_schema"], "local_schema": metadata["local_schema"],
        "extra_pages": 0, "creator_snapshot": creator,
        "conditional_balance_projection": {
            "additional_minimum_microalgo": 478000,
            "headroom_microalgo": creator["amount"] - txn.fee - creator["min-balance"] - 478000,
            "basis": "conditional reviewed schedule, not proven effective numeric parameters",
        },
        "approval": "not_requested", "wallet_access": "not_performed",
        "signing": "not_performed", "submission": "not_performed",
    }
    # Candidate bytes are saved once before simulation; never overwritten on failure.
    DESTINATION.mkdir(exist_ok=False)
    with (DESTINATION / "creation.unsigned.msgpack").open("xb") as output:
        output.write(raw)
    write_json(DESTINATION / "creation-preparation.json", record)
    settings = {"allow_empty_signatures": True, "fix_signers": False,
                "allow_unnamed_resources": False, "allow_more_logs": False,
                "extra_opcode_budget": 0}
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
    response = client.simulate_transactions(request)
    # Save the complete response even if strict validation then fails.
    evidence = {"purpose": "unsigned-testnet-creation-simulation-only",
                "unsigned_txid": txn.get_txid(), "unsigned_msgpack_sha256": sha256(raw),
                "settings": settings, "response": response,
                "signing_authority_proven": False, "ledger_changes_committed": False,
                "execution_approved": False}
    write_json(DESTINATION / "creation-simulation.json", evidence)
    validate_simulation(response, txn)
    fresh_params, fresh_creator = live(client)
    require(txn.first_valid_round <= fresh_params.first <= txn.last_valid_round,
            "Candidate expired during preparation; preserve, never substitute")
    require(all(fresh_creator[k] == creator[k] for k in ("amount", "min-balance", "auth-addr")),
            "Creator state changed during preparation; preserve candidate")
    load_compilation()
    require(read_regular(DESTINATION / "creation.unsigned.msgpack") == raw,
            "Saved candidate changed during simulation")
    print(json.dumps({
        "status": "unsigned_testnet_candidate_simulated_not_approved_not_deployed",
        "artifact_directory": str(DESTINATION.relative_to(ROOT)),
        "unsigned_txid": txn.get_txid(), "unsigned_msgpack_sha256": sha256(raw),
        "first_valid_round": txn.first_valid_round, "last_valid_round": txn.last_valid_round,
        "fee_microalgo": txn.fee, "simulation_ledger_round": response["last-round"],
        "observed_round_after": fresh_params.first,
        "replaces_candidate": replacement_of,
        "creator_snapshot": creator,
        "conditional_balance_projection": record["conditional_balance_projection"],
        "programs": metadata["programs"],
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()