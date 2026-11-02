"""Restore an interrupted KMD-backed proof using existing identifiers only."""

import argparse
import base64
import hashlib
import json
import os

from pathlib import Path

from algosdk import encoding, logic
from algosdk.transaction import ApplicationNoOpTxn, wait_for_confirmation

from localnet_safety import LocalNetContext, require_disposable_address
from proof_wallet import PUBLIC_RECORD, ProofWalletSession
from prove_account_control import account_snapshot, global_state


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def save_public_record(record, *, record_path=None):
    target = (
        PUBLIC_RECORD if record_path is None else Path(record_path)
    ).resolve()
    require(
        target.parent == PUBLIC_RECORD.parent.resolve()
        and target.suffix == ".json",
        "Record must be a JSON file in the proof artifact directory",
    )
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(record, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, target)


def snapshot(client, accounts, app_id, app_address):
    return {
        "accounts": {
            address: account_snapshot(client, address)
            for address in list(accounts.values()) + [app_address]
        },
        "global_state": global_state(client, app_id),
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
    parser.add_argument("--restore", required=True, action="store_true")
    parser.add_argument(
        "--record",
        type=Path,
        default=PUBLIC_RECORD,
        help="Existing public JSON record in the proof artifact directory",
    )
    args = parser.parse_args()

    context = LocalNetContext(
        network=args.network,
        algod_url=args.algod_url,
        expected_genesis_id=args.expected_genesis_id,
        expected_genesis_hash=args.expected_genesis_hash,
    )
    record_path = args.record.resolve()
    require(
        record_path.parent == PUBLIC_RECORD.parent.resolve()
        and record_path.suffix == ".json",
        "Recovery record must be a JSON file in the proof artifact directory",
    )
    require(
        record_path.is_file(),
        "Existing public wallet record is required",
    )
    record = json.loads(record_path.read_text(encoding="utf-8"))

    require(
        record.get("network") == "localnet"
        and record.get("genesis_id") == context.genesis_id
        and base64.b64decode(record["genesis_hash_base64"])
        == context.genesis_hash,
        "Existing recovery record belongs to a different network",
    )

    app_id = record.get("application_id")
    require(
        type(app_id) is int and app_id > 0,
        "No existing proof application is recorded; no recovery submitted",
    )
    app_address = logic.get_application_address(app_id)
    require(
        record.get("application_address") == app_address,
        "Recorded application ID and address do not agree",
    )
    require_disposable_address(app_address)

    accounts = record["accounts"]
    require(
        set(accounts) == {"operator", "staking", "recipient", "outsider"},
        "All existing proof account roles are required",
    )
    for address in accounts.values():
        require_disposable_address(address)
    require(
        len(set(accounts.values())) == 4,
        "Recorded proof accounts must be distinct",
    )

    expected_hash = record.get("application_approval_sha256")
    require(
        isinstance(expected_hash, str) and len(expected_hash) == 64,
        "Recorded deployed approval-program hash is required",
    )
    application = context.client.application_info(app_id)["params"]
    approval = base64.b64decode(
        application["approval-program"], validate=True
    )
    require(
        hashlib.sha256(approval).hexdigest() == expected_hash,
        "Deployed approval program differs from the recorded proof",
    )

    state = global_state(context.client, app_id)
    for key in ("operator", "staking", "recipient"):
        require(
            base64.b64decode(state[key])
            == encoding.decode_address(accounts[key]),
            f"On-chain fixed {key} differs from recovery metadata",
        )

    amount = record.get("payment_microalgo")
    require(
        type(amount) is int and amount > 0 and state["amount"] == amount,
        "On-chain fixed payment amount differs from recovery metadata",
    )

    before = snapshot(context.client, accounts, app_id, app_address)
    staking = accounts["staking"]
    current_auth = before["accounts"][staking]["auth_address"]

    if current_auth == staking:
        result = {
            "application_id": app_id,
            "staking": staking,
            "authorization": staking,
            "on_chain_restored_flag": state["restored"],
            "action": "none; account already authorizes with its own key",
            "submission": "not performed",
        }
        print(json.dumps(result, indent=2, sort_keys=True))
        return

    require(
        current_auth == app_address,
        "Account authority is neither itself nor the recorded application",
    )
    require(
        state["restored"] == 0,
        "Application reports terminal restoration but still holds authority",
    )

    with ProofWalletSession(context, record_path=record_path) as wallet:
        operator = wallet.signers["operator"]
        txn = ApplicationNoOpTxn(
            sender=operator.address,
            sp=context.fresh_params(fee_units=2),
            index=app_id,
            app_args=[b"restore"],
            accounts=[staking, accounts["recipient"]],
        )
        signed = operator.sign(context, txn)

        recovery = {
            "application_id": app_id,
            "application_address": app_address,
            "staking": staking,
            "txid": txn.get_txid(),
            "status": "prepared",
            "before": before,
        }
        record = wallet.record
        record["recovery"] = recovery
        identifiers = record.setdefault("transaction_ids", [])
        if txn.get_txid() not in identifiers:
            identifiers.append(txn.get_txid())
        save_public_record(record, record_path=record_path)

        context.validate_transaction(txn)
        txid = context.client.send_transaction(signed)
        recovery["status"] = "submitted"
        save_public_record(record, record_path=record_path)

        confirmation = wait_for_confirmation(context.client, txid, 10)
        after = snapshot(context.client, accounts, app_id, app_address)
        recovery["confirmed_round"] = confirmation["confirmed-round"]
        recovery["after"] = after
        recovery["status"] = "confirmed; verification pending"
        save_public_record(record, record_path=record_path)

        require(
            after["accounts"][staking]["auth_address"] == staking,
            "Original staking authority was not restored",
        )
        require(
            after["accounts"][staking]["amount"]
            == before["accounts"][staking]["amount"],
            "Restoration changed staking principal",
        )
        require(
            after["global_state"]["restored"] == 1
            and after["global_state"]["paid"] == before["global_state"]["paid"],
            "Unexpected restoration state transition",
        )

        for address in list(accounts.values()) + [app_address]:
            require(
                after["accounts"][address]["assets"]
                == before["accounts"][address]["assets"],
                "Restoration changed asset holdings",
            )
            if address != accounts["operator"]:
                require(
                    after["accounts"][address]["amount"]
                    == before["accounts"][address]["amount"],
                    "Restoration changed a non-operator balance",
                )

        require(
            before["accounts"][accounts["operator"]]["amount"]
            - after["accounts"][accounts["operator"]]["amount"]
            == txn.fee,
            "Operator balance change differs from the pooled outer fee",
        )

        recovery["status"] = "original authority restored and verified"
        record["status"] = "recovered_original_authority"
        save_public_record(record, record_path=record_path)
        print(json.dumps(recovery, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()