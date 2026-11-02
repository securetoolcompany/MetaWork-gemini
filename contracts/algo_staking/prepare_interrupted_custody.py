"""Set up recorded disposable custody for a separate-process recovery test."""

import argparse
import base64
import hashlib
import json

from algosdk import encoding, logic
from algosdk.transaction import (
    ApplicationCreateTxn,
    OnComplete,
    PaymentTxn,
    StateSchema,
    wait_for_confirmation,
)

from localnet_safety import LocalNetContext
from proof_wallet import PUBLIC_RECORD, ProofWalletSession
from prove_account_control import (
    PAYMENT_AMOUNT,
    account_snapshot,
    global_state,
    load_programs,
)
from recover_account_control import save_public_record, snapshot


RECOVERY_RECORD = PUBLIC_RECORD.with_name("kmd-recovery-test.json")


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
    parser.add_argument(
        "--leave-custody-for-recovery",
        required=True,
        action="store_true",
    )
    args = parser.parse_args()

    context = LocalNetContext(
        network=args.network,
        algod_url=args.algod_url,
        expected_genesis_id=args.expected_genesis_id,
        expected_genesis_hash=args.expected_genesis_hash,
    )
    client = context.client
    metadata, programs = load_programs()
    require(
        metadata["genesis_id"] == context.genesis_id
        and base64.b64decode(metadata["genesis_hash_base64"])
        == context.genesis_hash,
        "Bytecode artifacts belong to a different network",
    )

    with ProofWalletSession(
        context, record_path=RECOVERY_RECORD
    ) as wallet:
        record = wallet.record
        require(
            record.get("status") == "recovery_test_record_prepared"
            and record.get("scenario")
            == "fresh-process-restoration-without-payment"
            and record.get("application_id") is None
            and record.get("rekeying") == "not performed"
            and not record.get("transactions"),
            "Recovery test already started or metadata is unexpected; "
            "do not redeploy",
        )
        require(
            hashlib.sha256(PUBLIC_RECORD.read_bytes()).hexdigest()
            == record["primary_proof"]["record_sha256"],
            "Primary proof record changed; stop and inspect",
        )

        accounts = record["accounts"]
        operator = wallet.signers["operator"]
        staking = wallet.signers["staking"]

        baseline = {
            address: account_snapshot(client, address)
            for address in accounts.values()
        }
        for address, information in baseline.items():
            require(
                information["auth_address"] == address,
                "A recorded account already has alternate authority",
            )

        fee = context.fresh_params().fee
        operator_info = baseline[operator.address]
        require(
            operator_info["amount"] - operator_info["min_balance"]
            >= 1_000_000 + 5 * fee,
            "Insufficient operator headroom; no automatic funding permitted",
        )
        staking_info = baseline[staking.address]
        require(
            staking_info["amount"] - staking_info["min_balance"] >= fee,
            "Insufficient staking balance for the binding fee",
        )

        def persist():
            save_public_record(
                record, record_path=wallet.public_record
            )

        def submit(signer, txn, label, *, rekey_app_id=None):
            signed = signer.sign(
                context, txn, proof_rekey_app_id=rekey_app_id
            )
            entry = {
                "label": label,
                "txid": txn.get_txid(),
                "status": "prepared",
            }
            record["transactions"].append(entry)
            record["transaction_ids"].append(txn.get_txid())
            persist()

            context.validate_transaction(
                txn, proof_rekey_app_id=rekey_app_id
            )
            txid = client.send_transaction(signed)
            entry["status"] = "submitted"
            persist()

            confirmation = wait_for_confirmation(client, txid, 10)
            entry["status"] = "confirmed"
            entry["confirmed_round"] = confirmation["confirmed-round"]
            persist()
            return confirmation

        record["status"] = "recovery_test_setup_started"
        record["baseline_accounts"] = baseline
        record["payment_microalgo"] = PAYMENT_AMOUNT
        record["artifact_source_sha256"] = metadata["source_sha256"]
        record["application_approval_sha256"] = (
            metadata["programs"]["approval.bin"]["sha256"]
        )
        record["funding"] = "existing balances; no faucet funding"
        persist()

        try:
            creation = ApplicationCreateTxn(
                sender=operator.address,
                sp=context.fresh_params(),
                on_complete=OnComplete.NoOpOC,
                approval_program=programs["approval.bin"],
                clear_program=programs["clear.bin"],
                global_schema=StateSchema(3, 3),
                local_schema=StateSchema(0, 0),
                app_args=[
                    encoding.decode_address(accounts["operator"]),
                    encoding.decode_address(accounts["staking"]),
                    encoding.decode_address(accounts["recipient"]),
                    PAYMENT_AMOUNT.to_bytes(8, "big"),
                ],
            )
            confirmation = submit(
                operator, creation, "create_recovery_test_application"
            )
            app_id = confirmation["application-index"]
            app_address = logic.get_application_address(app_id)

            # Persist the new identifiers before any binding transaction.
            record["application_id"] = app_id
            record["application_address"] = app_address
            persist()

            require(
                app_id != record["primary_proof"]["application_id"],
                "Recovery test must use a separate application",
            )
            submit(
                operator,
                PaymentTxn(
                    sender=operator.address,
                    sp=context.fresh_params(),
                    receiver=app_address,
                    amt=200_000,
                ),
                "fund_recovery_test_application",
            )

            deployed = client.application_info(app_id)["params"]
            require(
                hashlib.sha256(
                    base64.b64decode(
                        deployed["approval-program"], validate=True
                    )
                ).hexdigest()
                == record["application_approval_sha256"],
                "Deployed approval bytecode differs from the artifact",
            )

            state = global_state(client, app_id)
            for role in ("operator", "staking", "recipient"):
                require(
                    base64.b64decode(state[role])
                    == encoding.decode_address(accounts[role]),
                    f"Unexpected fixed {role}",
                )
            require(
                state["amount"] == PAYMENT_AMOUNT
                and state["paid"] == 0
                and state["restored"] == 0,
                "Unexpected initial application state",
            )

            record["before_binding"] = snapshot(
                client, accounts, app_id, app_address
            )
            record["rekeying"] = "prepared"
            persist()

            submit(
                staking,
                PaymentTxn(
                    sender=staking.address,
                    sp=context.fresh_params(),
                    receiver=staking.address,
                    amt=0,
                    rekey_to=app_address,
                ),
                "bind_for_fresh_process_recovery",
                rekey_app_id=app_id,
            )

            after = snapshot(client, accounts, app_id, app_address)
            record["after_binding"] = after
            persist()
            require(
                after["accounts"][staking.address]["auth_address"]
                == app_address
                and after["global_state"]["paid"] == 0
                and after["global_state"]["restored"] == 0,
                "Custody or unpaid state was not confirmed",
            )

            record["rekeying"] = "confirmed"
            record["status"] = "awaiting_fresh_process_recovery"
            persist()

            print(json.dumps({
                "status": record["status"],
                "record_name": wallet.public_record.name,
                "application_id": app_id,
                "staking_authorization": app_address,
                "paid": 0,
                "restored": 0,
                "primary_record_unchanged": (
                    hashlib.sha256(
                        PUBLIC_RECORD.read_bytes()
                    ).hexdigest()
                    == record["primary_proof"]["record_sha256"]
                ),
                "next_action": (
                    "Use recover_account_control.py with "
                    "--record selecting kmd-recovery-test.json"
                ),
            }, indent=2, sort_keys=True))

        except Exception as error:
            record["status"] = "recovery_test_setup_failed_inspect_before_retry"
            record["failure_type"] = type(error).__name__
            persist()
            raise


if __name__ == "__main__":
    main()