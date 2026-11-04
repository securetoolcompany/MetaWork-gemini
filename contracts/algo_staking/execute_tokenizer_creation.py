"""Creation-only LocalNet gate.

Default mode: verify.

Never regenerate or substitute the saved candidate.

Execution requires:
1. Structurally valid, live-bound consensus evidence.
2. Interactive review of source provenance and actual override loading.
3. Separate interactive approval of the exact creation transaction.

Neither JSON approval flags nor command invocation authorize signing.

No application funding, ASA creation, opt-in, staking rekeying,
initialization, or recovery execution.
"""

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import unittest

from algosdk import encoding
from algosdk.transaction import (
    ApplicationCreateTxn,
    OnComplete,
    StateSchema,
    SuggestedParams,
    wait_for_confirmation,
)

from inspect_kmd_storage import docker_executable
from localnet_safety import LocalNetContext
from prepare_tokenizer_wallet import container_id
from tokenizer_artifacts import load_tokenizer_artifacts
from tokenizer_consensus_costs import creation_cost_projection
from tokenizer_creation_signature import verify_creation_signature
from tokenizer_localnet_config import (
    CONTAINER_ID,
    CREATOR_INITIALIZER,
    GENESIS_HASH_BASE64,
    GENESIS_ID,
    validate_container,
)


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "tokenizer"

CANDIDATE_DIRECTORY = (
    "creation-localnet-def0d6df347a4090b0a833cfd86c3205"
)
COMPILE_DIRECTORY = (
    "compile-localnet-385709a7d1ba4be5a65e3e0042662967"
)

RECORDED_TXID = (
    "ZCFVYTKDS552FMUJKWDOIGFVIGKRVPLM4ABGAQYPIUKYEE7AZGYA"
)
RECORDED_UNSIGNED_SHA256 = (
    "30b2714a50e0eb09395d38bc22119d27981ceda7a14ab681b1919ff02d818f52"
)
RECORDED_PROGRAM_SHA256 = {
    "approval": (
        "45214e892f8036a738620b9e77863ad46e7a7fadbadb4f5af7c9d911408f8218"
    ),
    "clear": (
        "baa698f7e6728cd2257d20588deaae7ff497fb535bd35e1dd745988d380c66c5"
    ),
}

FIRST_VALID = 22
LAST_VALID = 1022
FEE = 1_000


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def canonical_json(value):
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def regular_bytes(path):
    path = Path(path)

    require(
        not any(
            component.is_symlink()
            for component in (path, *path.parents)
        ),
        "Symlinked evidence paths are forbidden",
    )
    require(
        path.is_file(),
        "Required regular evidence file missing: " + path.name,
    )
    return path.read_bytes()


def nonnegative_integer(value):
    return type(value) is int and value >= 0


def execution_record_path():
    return ARTIFACTS / (
        "creation-execution-" + RECORDED_TXID + ".jsonl"
    )


def guard_exists():
    path = execution_record_path()
    return path.exists() or path.is_symlink()


def load_candidate():
    """Verify the original candidate without network or wallet access."""

    # Reuse existing offline checks for simulation transaction equality,
    # source bindings, settings, and intended initial application state.
    from test_tokenizer_creation_evidence import (
        TokenizerCreationEvidenceTests,
    )

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(
        TokenizerCreationEvidenceTests
    )
    require(
        suite.countTestCases() == 8,
        "Unexpected existing candidate-evidence test inventory",
    )

    result = unittest.TextTestRunner(
        stream=io.StringIO(),
        verbosity=0,
    ).run(suite)

    require(
        result.wasSuccessful(),
        "Existing offline candidate-evidence checks failed",
    )

    directory = ARTIFACTS / CANDIDATE_DIRECTORY

    raw = regular_bytes(
        directory / "creation.unsigned.msgpack"
    )
    preparation = json.loads(
        regular_bytes(directory / "creation-preparation.json")
    )
    simulation = json.loads(
        regular_bytes(directory / "creation-simulation.json")
    )

    encoded = base64.b64encode(raw).decode("ascii")
    transaction = encoding.msgpack_decode(encoded)

    require(
        sha256(raw) == RECORDED_UNSIGNED_SHA256,
        "Saved unsigned MessagePack differs from recorded candidate hash",
    )
    require(
        transaction.get_txid() == RECORDED_TXID,
        "Saved transaction ID differs from recorded candidate ID",
    )
    require(
        encoding.msgpack_encode(transaction) == encoded,
        "Saved transaction serialization is not canonical",
    )

    for record in (preparation, simulation):
        require(
            record["unsigned_txid"] == RECORDED_TXID
            and record["unsigned_msgpack_sha256"]
            == RECORDED_UNSIGNED_SHA256,
            "Preparation/simulation candidate association changed",
        )

    require(
        preparation["compile_directory"] == COMPILE_DIRECTORY,
        "Recorded compilation selection changed",
    )

    metadata, programs = load_tokenizer_artifacts(
        COMPILE_DIRECTORY
    )

    require(
        preparation["programs"] == metadata["programs"],
        "Preparation and compilation program records differ",
    )
    require(
        preparation["compiled_source_sha256"]
        == metadata["source_sha256"],
        "Preparation and compilation source identities differ",
    )

    for name, expected_hash in RECORDED_PROGRAM_SHA256.items():
        require(
            sha256(programs[name]) == expected_hash,
            "Compiled program differs from recorded candidate: " + name,
        )

    expected = ApplicationCreateTxn(
        sender=CREATOR_INITIALIZER,
        sp=SuggestedParams(
            fee=FEE,
            first=FIRST_VALID,
            last=LAST_VALID,
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
        encoding.msgpack_encode(transaction)
        == encoding.msgpack_encode(expected),
        "Saved transaction differs from the exact recorded creation template",
    )

    binding = {
        "transaction_id": RECORDED_TXID,
        "unsigned_msgpack_sha256": RECORDED_UNSIGNED_SHA256,
        "program_sha256": dict(RECORDED_PROGRAM_SHA256),
        "network": "localnet",
        "algod_url": "http://127.0.0.1:4001",
        "genesis_id": GENESIS_ID,
        "genesis_hash_base64": GENESIS_HASH_BASE64,
        "container_id": CONTAINER_ID,
        "fee_microalgo": FEE,
        "first_valid_round": FIRST_VALID,
        "last_valid_round": LAST_VALID,
        "global_schema": {
            "num_uints": 8,
            "num_byte_slices": 3,
        },
        "local_schema": {
            "num_uints": 0,
            "num_byte_slices": 0,
        },
        "extra_pages": 0,
    }

    return transaction, programs, simulation, binding


def new_context():
    return LocalNetContext(
        network="localnet",
        algod_url="http://127.0.0.1:4001",
        expected_genesis_id=GENESIS_ID,
        expected_genesis_hash=GENESIS_HASH_BASE64,
    )


def docker_read(docker, *arguments):
    return subprocess.run(
        [docker, "exec", CONTAINER_ID, *arguments],
        check=True,
        capture_output=True,
        timeout=15,
    ).stdout


def observe_live_state(context, docker):
    """Read live bindings. No wallet access or node configuration changes."""

    validate_container(container_id(docker))

    parameters = context.fresh_params()
    status = context.client.status()
    versions = context.client.versions()
    creator = context.client.account_info(CREATOR_INITIALIZER)

    protocol = status.get("last-version")
    require(
        isinstance(protocol, str) and protocol,
        "Full live protocol identifier unavailable",
    )

    build = versions.get("build")
    require(
        isinstance(build, dict)
        and isinstance(build.get("commit-hash"), str)
        and bool(build["commit-hash"]),
        "Live Algod build commit unavailable",
    )

    pids = docker_read(
        docker,
        "pidof",
        "algod",
    ).decode("utf-8").split()

    require(
        len(pids) == 1 and pids[0].isdigit(),
        "Cannot identify one running Algod process",
    )

    command_line = docker_read(
        docker,
        "cat",
        "/proc/" + pids[0] + "/cmdline",
    )
    arguments = command_line.decode("utf-8").rstrip("\0").split("\0")

    require(
        arguments.count("-d") == 1,
        "Cannot establish the running Algod data directory from -d",
    )

    index = arguments.index("-d")
    require(
        index + 1 < len(arguments),
        "Running Algod process has no data-directory value",
    )

    data_directory = arguments[index + 1]
    require(
        data_directory.startswith("/")
        and ".." not in data_directory.split("/"),
        "Running Algod data directory is ambiguous",
    )

    override_path = (
        data_directory.rstrip("/") + "/consensus.json"
    )

    probe = subprocess.run(
        [
            docker,
            "exec",
            CONTAINER_ID,
            "test",
            "-e",
            override_path,
        ],
        capture_output=True,
        timeout=15,
    )

    require(
        probe.returncode in (0, 1),
        "Cannot establish consensus override-file presence",
    )

    override_hash = None
    if probe.returncode == 0:
        override_hash = sha256(
            docker_read(
                docker,
                "cat",
                override_path,
            )
        )

    validate_container(container_id(docker))

    return {
        "protocol": protocol,
        "build": build,
        "process_cmdline_sha256": sha256(command_line),
        "data_directory": data_directory,
        "override_path": override_path,
        "override_sha256": override_hash,
        "node_round": status.get("last-round"),
        "suggested_round": parameters.first,
        "minimum_fee_microalgo": parameters.min_fee,
        "creator": creator,
    }


def check_live_preconditions(context, transaction, live):
    context.validate_transaction(transaction)

    creator = live["creator"]

    require(
        creator.get("address") == CREATOR_INITIALIZER,
        "Creator account response mismatch",
    )
    require(
        creator.get("auth-addr")
        in (None, "", CREATOR_INITIALIZER),
        "Creator authority changed",
    )

    for key in ("amount", "min-balance", "round"):
        require(
            nonnegative_integer(creator.get(key)),
            "Malformed creator numeric field: " + key,
        )

    require(
        live["minimum_fee_microalgo"]
        == transaction.fee
        == FEE,
        "Exact recorded candidate fee is no longer applicable",
    )

    for key in ("node_round", "suggested_round"):
        require(
            nonnegative_integer(live[key])
            and FIRST_VALID <= live[key] <= LAST_VALID,
            "Saved candidate is outside current validity bounds; "
            "preserve it and do not regenerate",
        )


def validate_consensus_evidence(path, live):
    """Validate evidence integrity and live bindings, not source semantics.

    A matching manifest is not proof that its source files are authentic,
    its derivation is correct, or its overrides were actually loaded.
    Those questions require the separate explicit provenance review below.
    """

    require(
        path is not None,
        "Effective consensus provenance bundle is missing",
    )

    path = Path(path)
    raw = regular_bytes(path)
    evidence = json.loads(raw)

    require(
        evidence.get("purpose")
        == "tokenizer-effective-consensus-review-v1",
        "Unexpected consensus-evidence purpose",
    )

    for key in (
        "protocol",
        "build",
        "process_cmdline_sha256",
        "data_directory",
        "override_path",
        "override_sha256",
    ):
        require(
            key in evidence and evidence[key] == live[key],
            "Consensus evidence/live binding mismatch: " + key,
        )

    sources = evidence.get("sources")
    require(
        isinstance(sources, list) and len(sources) >= 2,
        "Exact-build default definitions and override-loading "
        "source evidence are required",
    )

    roles = set()

    for item in sources:
        require(
            isinstance(item, dict),
            "Malformed consensus source-evidence entry",
        )
        require(
            item.get("commit") == live["build"]["commit-hash"],
            "Consensus source entry is not pinned to the live build",
        )

        role = item.get("role")
        require(
            role in ("defaults", "override_loading"),
            "Unexpected consensus source-evidence role",
        )
        roles.add(role)

        relative = item.get("file")
        require(
            isinstance(relative, str)
            and relative
            and not Path(relative).is_absolute()
            and ".." not in Path(relative).parts
            and ":" not in relative
            and "\\" not in relative,
            "Unsafe consensus source-evidence path",
        )

        require(
            sha256(regular_bytes(path.parent / relative))
            == item.get("sha256"),
            "Consensus source-evidence digest mismatch",
        )

    require(
        roles == {"defaults", "override_loading"},
        "Missing default definitions or override-loading source evidence",
    )

    for key in ("derivation", "loaded_override_basis"):
        require(
            isinstance(evidence.get(key), str)
            and bool(evidence[key].strip()),
            "Missing consensus review evidence: " + key,
        )

    costs = creation_cost_projection(
        evidence.get("parameters"),
        live["protocol"],
    )

    require(
        costs.get("node_loading_verified") is False,
        "Unexpected consensus-cost helper contract",
    )

    return costs, sha256(raw), evidence


def check_creator_balance(transaction, live, costs):
    creator = live["creator"]

    require(
        creator["amount"] - transaction.fee
        >= creator["min-balance"]
        + costs["additional_minimum_microalgo"],
        "Creator balance is insufficient for fee and "
        "the evidence-based creation minimum balance",
    )


def interactive_decision(label, payload):
    """Require an explicit terminal decision bound to a nonce and payload."""

    require(
        sys.stdin.isatty() and sys.stdout.isatty(),
        "Interactive terminal input/output required; "
        "piped approval is not supported",
    )

    nonce = secrets.token_hex(16)
    payload_hash = sha256(canonical_json(payload))
    phrase = label + " " + payload_hash + " " + nonce

    print(json.dumps(payload, indent=2, sort_keys=True))
    print()
    print("Enter exactly to grant this decision only:")
    print(phrase)

    require(
        input().strip() == phrase,
        "Explicit interactive decision was not granted",
    )

    return {
        "decision": label,
        "payload_sha256": payload_hash,
        "nonce": nonce,
    }


def append_record(descriptor, state, **details):
    entry = {
        "state": state,
        "transaction_id": RECORDED_TXID,
        **details,
    }

    payload = canonical_json(entry) + b"\n"
    offset = 0

    while offset < len(payload):
        written = os.write(descriptor, payload[offset:])
        require(
            written > 0,
            "Execution-record write failed",
        )
        offset += written

    os.fsync(descriptor)


def normalized_state(entries, *, delta=False):
    state = {}

    for entry in entries:
        key = entry["key"]
        require(
            key not in state,
            "Duplicate application-state key",
        )

        value = entry["value"]
        kind = value["action" if delta else "type"]

        require(
            type(kind) is int and kind in (1, 2),
            "Unexpected application-state type",
        )

        if kind == 1:
            content = base64.b64decode(
                value.get("bytes", ""),
                validate=True,
            )
        else:
            content = value.get("uint", 0)
            require(
                nonnegative_integer(content),
                "Malformed application-state uint",
            )

        state[key] = (kind, content)

    return state


def verify_confirmed_creation(
    context,
    confirmation,
    programs,
    simulation,
):
    require(
        nonnegative_integer(confirmation.get("confirmed-round"))
        and confirmation["confirmed-round"] > 0,
        "Creation is not confirmed",
    )
    require(
        not confirmation.get("pool-error"),
        "Confirmed result reports a pool error",
    )

    application_id = confirmation.get("application-index")
    require(
        type(application_id) is int and application_id > 0,
        "Confirmed creation has no valid application ID",
    )

    parameters = context.client.application_info(
        application_id
    )["params"]

    require(
        parameters["creator"] == CREATOR_INITIALIZER,
        "Deployed creator mismatch",
    )

    program_fields = {
        "approval": "approval-program",
        "clear": "clear-state-program",
    }

    for name, field in program_fields.items():
        deployed = base64.b64decode(
            parameters[field],
            validate=True,
        )
        require(
            deployed == programs[name],
            "Deployed program mismatch: " + name,
        )

    zero_schema = {
        "num-uint": 0,
        "num-byte-slice": 0,
    }

    require(
        parameters.get("global-state-schema")
        == {
            "num-uint": 8,
            "num-byte-slice": 3,
        },
        "Deployed global schema mismatch",
    )
    require(
        parameters.get("local-state-schema", zero_schema)
        == zero_schema,
        "Deployed local schema mismatch",
    )
    require(
        parameters.get("extra-program-pages", 0) == 0,
        "Deployed extra program pages mismatch",
    )

    expected_delta = (
        simulation["response"]["txn-groups"][0]
        ["txn-results"][0]["txn-result"]["global-state-delta"]
    )

    require(
        normalized_state(parameters.get("global-state", []))
        == normalized_state(expected_delta, delta=True),
        "Deployed initial global state mismatch",
    )

    return application_id


def reconcile(context, programs, simulation):
    """Read-only reconciliation; never modify or remove an execution guard."""

    path = execution_record_path()
    require(
        path.exists() or path.is_symlink(),
        "No execution record exists for this candidate",
    )

    # Preserve even an incomplete/truncated record after interruption.
    regular_bytes(path)

    try:
        confirmation = context.client.pending_transaction_info(
            RECORDED_TXID
        )
    except Exception:
        print(json.dumps({
            "status": "outcome_unknown_do_not_retry",
            "transaction_id": RECORDED_TXID,
            "guard_preserved": True,
        }))
        return 2

    if not confirmation.get("confirmed-round"):
        print(json.dumps({
            "status": "not_confirmed_outcome_unresolved_do_not_retry",
            "transaction_id": RECORDED_TXID,
            "pool_error_present": bool(
                confirmation.get("pool-error")
            ),
            "guard_preserved": True,
        }))
        return 2

    try:
        application_id = verify_confirmed_creation(
            context,
            confirmation,
            programs,
            simulation,
        )
    except Exception as error:
        print(json.dumps({
            "status": "creation_confirmed_verification_failed",
            "transaction_id": RECORDED_TXID,
            "application_id": confirmation.get(
                "application-index"
            ),
            "confirmed_round": confirmation.get(
                "confirmed-round"
            ),
            "failure_type": type(error).__name__,
            "guard_preserved": True,
        }))
        return 3

    print(json.dumps({
        "status": "creation_confirmed_verified_not_initialized",
        "transaction_id": RECORDED_TXID,
        "application_id": application_id,
        "guard_preserved": True,
        "initialization": "not performed",
    }))
    return 0

def require_effective_consensus_provenance(live, evidence):
    """Fail closed until actual running-node provenance is established.

    Manifest consistency, source hashes, and human attestation do not
    establish which consensus overrides the running process loaded.

    No evidence-file boolean may unlock this gate.
    """
    raise RuntimeError(
        "Effective consensus provenance unresolved: the executor checks "
        "the live protocol/build and current override-file identity, "
        "but does not establish that those overrides were loaded by "
        "the running Algod process, or derive the effective active-protocol "
        "parameters from the exact build's defaults and loading semantics. "
        "Wallet access is blocked. Preserve the candidate and execution "
        "records; do not sign, submit, restart, or reconfigure the node."
    )

def execute(
    context,
    docker,
    transaction,
    programs,
    simulation,
    binding,
    evidence_path,
    evidence_hash,
    evidence,
):

    """One-shot creation, reachable only after explicit terminal decisions."""

    require_effective_consensus_provenance(
        live=None,
        evidence=evidence,
    )

    provenance_review = interactive_decision(
        "ATTEST_CONSENSUS_SOURCE_AND_LOADED_BASIS",
        {
            "evidence_sha256": evidence_hash,
            "evidence": evidence,
            "notice": (
                "Review source authenticity at the exact running build, "
                "active-protocol derivation, override-loading semantics, "
                "and evidence that these overrides were actually loaded. "
                "Matching hashes and manifest fields alone do not prove "
                "these facts. Do not attest unresolved provenance."
            ),
        },
    )

    execution_approval = interactive_decision(
        "AUTHORIZE_EXACT_CREATION",
        {
            "candidate": binding,
            "consensus_evidence_sha256": evidence_hash,
            "notice": (
                "Authorize one signing/submission attempt for this exact "
                "application creation only. This does not authorize "
                "funding, ASA creation, opt-in, rekeying, initialization, "
                "or recovery."
            ),
        },
    )

    live = observe_live_state(context, docker)
    check_live_preconditions(context, transaction, live)

    costs, fresh_hash, _ = validate_consensus_evidence(
        evidence_path,
        live,
    )
    require(
        fresh_hash == evidence_hash,
        "Consensus evidence changed during approval",
    )
    check_creator_balance(transaction, live, costs)

    require(
        not any(
            component.is_symlink()
            for component in (ARTIFACTS, *ARTIFACTS.parents)
        ),
        "Symlinked execution-record directory is forbidden",
    )

    # Exclusive creation is the persistent one-shot guard.
    # Never automatically delete it, including after pre-submission failures.
    descriptor = os.open(
        execution_record_path(),
        os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_APPEND,
        0o600,
    )

    confirmed = False
    confirmation = {}

    try:
        append_record(
            descriptor,
            "guard_acquired",
            candidate=binding,
            approval=execution_approval,
            consensus_review=provenance_review,
        )

        from tokenizer_wallet import (
            TokenizerCreationWalletSession,
        )

        append_record(
            descriptor,
            "wallet_opening_signing_may_follow_do_not_retry",
        )

        wallet = TokenizerCreationWalletSession(
            context,
            compile_directory=COMPILE_DIRECTORY,
        )

        with wallet:
            signed = wallet.sign_creation(transaction)

            require(
                verify_creation_signature(
                    signed,
                    transaction,
                ) == RECORDED_TXID,
                "Returned signed transaction differs from candidate",
            )

        require(
            wallet.handle_release == "confirmed",
            "Wallet-handle release unconfirmed; stop without submission",
        )

        append_record(
            descriptor,
            "signed_handle_released_not_submitted",
        )

        live = observe_live_state(context, docker)
        check_live_preconditions(context, transaction, live)

        costs, final_hash, _ = validate_consensus_evidence(
            evidence_path,
            live,
        )
        require(
            final_hash == evidence_hash,
            "Consensus evidence changed before submission",
        )
        check_creator_balance(transaction, live, costs)

        require(
            verify_creation_signature(
                signed,
                transaction,
            ) == RECORDED_TXID,
            "Signed candidate changed before submission",
        )

        append_record(
            descriptor,
            "submission_intent_do_not_retry",
        )

        # Exactly one application-level submission call. No retry loop.
        submitted_id = context.client.send_transaction(signed)

        require(
            submitted_id == RECORDED_TXID,
            "Submission response ID differs; reconcile the exact candidate",
        )

        append_record(
            descriptor,
            "submitted_confirmation_pending",
        )

        confirmation = wait_for_confirmation(
            context.client,
            RECORDED_TXID,
            10,
        )

        confirmed = (
            nonnegative_integer(
                confirmation.get("confirmed-round")
            )
            and confirmation["confirmed-round"] > 0
        )

        require(
            confirmed,
            "Confirmation unavailable; reconcile without retrying",
        )

        append_record(
            descriptor,
            "creation_confirmed_verification_pending",
            application_id=confirmation.get(
                "application-index"
            ),
            confirmed_round=confirmation["confirmed-round"],
        )

        application_id = verify_confirmed_creation(
            context,
            confirmation,
            programs,
            simulation,
        )

        append_record(
            descriptor,
            "creation_confirmed_verified_not_initialized",
            application_id=application_id,
        )

        print(json.dumps({
            "status": "creation_confirmed_verified_not_initialized",
            "transaction_id": RECORDED_TXID,
            "application_id": application_id,
            "initialization": "not performed",
        }))
        return 0

    except BaseException as error:
        state = (
            "creation_confirmed_verification_failed"
            if confirmed
            else "stopped_outcome_requires_reconciliation_do_not_retry"
        )

        details = {
            "failure_type": type(error).__name__,
        }

        if confirmed:
            details["application_id"] = confirmation.get(
                "application-index"
            )
            details["confirmed_round"] = confirmation.get(
                "confirmed-round"
            )

        try:
            append_record(
                descriptor,
                state,
                **details,
            )
        except Exception:
            # Existing guard remains authoritative even if logging fails.
            pass

        print(json.dumps({
            "status": state,
            "transaction_id": RECORDED_TXID,
            "guard_preserved": True,
            **details,
        }))

        return 3 if confirmed else 2

    finally:
        os.close(descriptor)


def main():
    parser = argparse.ArgumentParser(description=__doc__)

    parser.add_argument(
        "--mode",
        choices=("verify", "execute", "reconcile"),
        default="verify",
    )
    parser.add_argument(
        "--consensus-evidence",
        type=Path,
    )

    arguments = parser.parse_args()

    transaction, programs, simulation, binding = load_candidate()

    docker = docker_executable()
    validate_container(container_id(docker))
    context = new_context()

    if arguments.mode == "reconcile":
        # Reconciliation does not require current validity, current fee,
        # or resolved consensus evidence to inspect a historical outcome.
        return reconcile(
            context,
            programs,
            simulation,
        )

    live = observe_live_state(context, docker)

    blockers = []
    costs = None
    evidence = None
    evidence_hash = None

    try:
        check_live_preconditions(
            context,
            transaction,
            live,
        )
    except Exception as error:
        blockers.append(str(error))

    try:
        costs, evidence_hash, evidence = (
            validate_consensus_evidence(
                arguments.consensus_evidence,
                live,
            )
        )
    except Exception as error:
        blockers.append(str(error))

    if costs is not None:
        try:
            check_creator_balance(
                transaction,
                live,
                costs,
            )
        except Exception as error:
            blockers.append(str(error))

    if guard_exists():
        blockers.append(
            "Execution guard exists; use read-only reconciliation. "
            "Do not clear the guard or automatically retry."
        )

    if arguments.mode == "verify":
        print(json.dumps({
            "mode": "verify",
            "candidate": binding,
            "live": live,
            "blockers": blockers,
            "consensus_evidence_sha256": evidence_hash,
            "consensus_provenance": (
                "not established by manifest validation; "
                "source origin, derivation, and actual loading "
                "require separate review"
            ),
            "execution_authorized": False,
            "wallet_access": "not performed",
            "signing": "not performed",
            "submission": "not performed",
            "initialization": "not performed",
        }, indent=2, sort_keys=True))

        # Verification never represents execution readiness or approval.
        return 2

    require(
        not blockers,
        "; ".join(blockers),
    )

    return execute(
        context=context,
        docker=docker,
        transaction=transaction,
        programs=programs,
        simulation=simulation,
        binding=binding,
        evidence_path=arguments.consensus_evidence,
        evidence_hash=evidence_hash,
        evidence=evidence,
    )


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({
            "status": "blocked_no_automatic_retry",
            "reason": str(error),
            "execution_record_must_be_preserved": True,
        }))
        raise SystemExit(2)