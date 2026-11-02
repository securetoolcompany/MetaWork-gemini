"""Simulate proof guard failures; never sign or submit transactions."""

import argparse
import base64
import hashlib
import json
import re

from algosdk import encoding, logic
from algosdk.source_map import SourceMap
from algosdk.transaction import (
    ApplicationCallTxn,
    OnComplete,
    PaymentTxn,
    SignedTransaction,
    assign_group_id,
)
from algosdk.v2client.models import (
    SimulateRequest,
    SimulateRequestTransactionGroup,
)

from localnet_safety import LocalNetContext
from proof_wallet import PUBLIC_RECORD
from prove_account_control import ARTIFACTS, ROOT, load_programs
from recover_account_control import save_public_record, snapshot


REPORT_PATH = ARTIFACTS / "kmd-guard-simulations.json"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


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
    parser.add_argument("--simulate", required=True, action="store_true")
    args = parser.parse_args()

    require(
        not REPORT_PATH.exists(),
        "Simulation report already exists; inspect it before repeating",
    )
    context = LocalNetContext(
        network=args.network,
        algod_url=args.algod_url,
        expected_genesis_id=args.expected_genesis_id,
        expected_genesis_hash=args.expected_genesis_hash,
    )
    client = context.client
    primary_bytes = PUBLIC_RECORD.read_bytes()
    record = json.loads(primary_bytes)
    require(
        record.get("status") == "primary_account_control_proof_passed"
        and record.get("purpose")
        == "disposable-account-control-proof-only"
        and record.get("network") == "localnet"
        and record.get("genesis_id") == context.genesis_id
        and base64.b64decode(record["genesis_hash_base64"])
        == context.genesis_hash,
        "Expected a successful primary proof on this LocalNet",
    )

    metadata, programs = load_programs()
    require(
        metadata["genesis_id"] == context.genesis_id
        and base64.b64decode(metadata["genesis_hash_base64"])
        == context.genesis_hash,
        "Artifact network differs from simulation network",
    )
    app_id = record["application_id"]
    require(type(app_id) is int and app_id > 0, "Invalid application ID")
    app_address = logic.get_application_address(app_id)
    require(
        app_address == record["application_address"],
        "Application ID/address mismatch",
    )
    deployed = client.application_info(app_id)["params"]
    require(
        base64.b64decode(deployed["approval-program"], validate=True)
        == programs["approval.bin"],
        "Deployed approval program differs from verified bytecode",
    )

    expected_teal_hash = metadata["programs"]["approval.bin"]["teal_sha256"]
    candidates = [
        path
        for path in ROOT.rglob("*.teal")
        if hashlib.sha256(path.read_bytes()).hexdigest()
        == expected_teal_hash
    ]
    require(
        bool(candidates),
        "Cannot find the exact compiled approval TEAL; no tests performed",
    )
    teal = candidates[0].read_text(encoding="utf-8")
    compiled = client.compile(teal, source_map=True)
    require(
        base64.b64decode(compiled["result"], validate=True)
        == programs["approval.bin"],
        "Source-mapped compilation differs from deployed bytecode",
    )
    source_map = SourceMap(compiled["sourcemap"])
    lines = teal.splitlines()

    def assertion_line(field_instruction):
        matches = [
            index
            for index, line in enumerate(lines)
            if line.strip() == field_instruction
        ]
        require(
            len(matches) == 1,
            f"Cannot uniquely locate guard: {field_instruction}",
        )
        start = matches[0]
        for index in range(start + 1, min(start + 8, len(lines))):
            if lines[index].strip() == "assert":
                return index
        raise RuntimeError(f"Cannot locate assertion for {field_instruction}")

    accounts = record["accounts"]
    operator = accounts["operator"]
    for role in ("operator", "staking", "recipient"):
        require(
            base64.b64decode(
                snapshot(client, accounts, app_id, app_address)
                ["global_state"][role]
            ) == encoding.decode_address(accounts[role]),
            f"Unexpected deployed {role}",
        )

    def take_snapshot():
        return snapshot(client, accounts, app_id, app_address)

    baseline = take_snapshot()
    require(
        baseline["accounts"][operator]["auth_address"] == operator,
        "Operator has unexpected alternate authority",
    )
    require(
        baseline["global_state"]["restored"] == 1,
        "Expected the already-restored primary proof",
    )

    def simulate(txns):
        context.fresh_params()
        for txn in txns:
            context.check_genesis(txn.genesis_id, txn.genesis_hash)
            require(txn.sender == operator, "Unexpected simulated sender")
        response = client.simulate_transactions(
            SimulateRequest(
                txn_groups=[
                    SimulateRequestTransactionGroup(
                        txns=[SignedTransaction(txn, None) for txn in txns]
                    )
                ],
                allow_empty_signatures=True,
            )
        )
        require(isinstance(response, dict), "Unexpected simulation response")
        groups = response.get("txn-groups", [])
        require(len(groups) == 1, "Expected one simulated group")
        return response, groups[0]

    # Control: verify unsigned simulation works without an AVM failure.
    _, control = simulate([
        PaymentTxn(
            sender=operator,
            sp=context.fresh_params(),
            receiver=operator,
            amt=0,
        )
    ])
    require(
        not control.get("failure-message"),
        "Control simulation failed; guard tests must not be counted",
    )
    require(
        take_snapshot() == baseline,
        "Tracked ledger data changed during the control",
    )

    report = {
        "purpose": "disposable-account-control-guard-simulations-only",
        "network": "localnet",
        "application_id": app_id,
        "evidence_type": "algod simulation; not submitted transactions",
        "signing": "not performed",
        "submission": "not performed",
        "status": "started",
        "control": "passed",
        "tests": [],
        "not_covered": [
            "submitted-transaction rejection for these guard cases",
            "nonzero close fields reaching application AVM assertions",
        ],
    }
    with REPORT_PATH.open("x", encoding="utf-8") as handle:
        handle.write(json.dumps(report, indent=2, sort_keys=True) + "\n")

    def persist():
        save_public_record(report, record_path=REPORT_PATH)

    def app_call(on_complete, *, note, rekey_to=None):
        fields = {}
        if on_complete == OnComplete.UpdateApplicationOC:
            fields = {
                "approval_program": programs["approval.bin"],
                "clear_program": programs["clear.bin"],
            }
        return ApplicationCallTxn(
            sender=operator,
            sp=context.fresh_params(fee_units=2),
            index=app_id,
            on_complete=on_complete,
            app_args=[b"restore"],
            accounts=[accounts["staking"], accounts["recipient"]],
            note=note,
            rekey_to=rekey_to,
            **fields,
        )

    cases = [
        (
            "update",
            [app_call(OnComplete.UpdateApplicationOC, note=b"guard-update")],
            "txn OnCompletion",
        ),
        (
            "delete",
            [app_call(OnComplete.DeleteApplicationOC, note=b"guard-delete")],
            "txn OnCompletion",
        ),
        (
            "outer_rekey",
            [app_call(
                OnComplete.NoOpOC,
                note=b"guard-rekey",
                rekey_to=accounts["outsider"],
            )],
            "txn RekeyTo",
        ),
        (
            "group_size",
            assign_group_id([
                app_call(OnComplete.NoOpOC, note=b"guard-group-1"),
                app_call(OnComplete.NoOpOC, note=b"guard-group-2"),
            ]),
            "global GroupSize",
        ),
    ]

    try:
        for label, txns, field in cases:
            before = take_snapshot()
            response, group = simulate(txns)
            after = take_snapshot()
            message = group.get("failure-message", "")
            matches = re.findall(r"\bpc=(\d+)\b", message)
            pc = int(matches[-1]) if matches else None
            actual_line = (
                source_map.get_line_for_pc(pc) if pc is not None else None
            )
            expected_line = assertion_line(field)
            passed = (
                "assert failed" in message
                and actual_line == expected_line
                and before == after
            )
            report["tests"].append({
                "label": label,
                "passed": passed,
                "expected_guard": field,
                "expected_teal_line": expected_line + 1,
                "actual_teal_line": (
                    actual_line + 1 if actual_line is not None else None
                ),
                "before": before,
                "after": after,
                "simulation": response,
            })
            persist()
            require(
                passed,
                f"{label}: intended assertion failure was not verified; "
                "inspect the saved report",
            )

        require(
            PUBLIC_RECORD.read_bytes() == primary_bytes,
            "Primary proof record changed",
        )
        report["status"] = "four_guard_simulations_passed"
        persist()
        print(json.dumps({
            "status": report["status"],
            "application_id": app_id,
            "tests": [
                {"label": test["label"], "passed": test["passed"]}
                for test in report["tests"]
            ],
            "primary_record_unchanged": True,
            "signing": "not performed",
            "submission": "not performed",
            "evidence_type": report["evidence_type"],
        }, indent=2, sort_keys=True))
    except Exception as error:
        report["status"] = "failed"
        report["failure_type"] = type(error).__name__
        persist()
        raise


if __name__ == "__main__":
    main()