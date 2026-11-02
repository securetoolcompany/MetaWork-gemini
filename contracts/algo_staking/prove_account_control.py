"""Execute the disposable account-control proof on explicit LocalNet only."""

import argparse
import base64
import hashlib
import json
from pathlib import Path

from algosdk import encoding, logic
from algosdk.error import AlgodHTTPError
from algosdk.transaction import (
    ApplicationCreateTxn,
    ApplicationNoOpTxn,
    OnComplete,
    PaymentTxn,
    StateSchema,
    wait_for_confirmation,
)

from localnet_funding import fund_disposable_accounts
from localnet_safety import (
    DisposableSigner,
    LocalNetContext,
)


ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "account_control"
PAYMENT_AMOUNT = 10_000


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def load_programs():
    metadata = json.loads(
        (ARTIFACTS / "compile-localnet.json").read_text(encoding="utf-8")
    )
    require(
        sha256((ROOT / "account_control.py").read_bytes())
        == metadata["source_sha256"],
        "Contract source changed since Algod compilation",
    )

    programs = {}
    for name in ("approval.bin", "clear.bin"):
        data = (ARTIFACTS / name).read_bytes()
        require(
            sha256(data) == metadata["programs"][name]["sha256"],
            f"Bytecode hash mismatch: {name}",
        )
        programs[name] = data

    return metadata, programs


def global_state(client, app_id):
    entries = client.application_info(app_id)["params"].get(
        "global-state", []
    )
    state = {}
    for entry in entries:
        key = base64.b64decode(entry["key"]).decode("ascii")
        value = entry["value"]
        state[key] = (
            value["uint"] if value["type"] == 2 else value["bytes"]
        )
    return state


def account_snapshot(client, address):
    info = client.account_info(address)
    return {
        "amount": info["amount"],
        "min_balance": info["min-balance"],
        "auth_address": info.get("auth-addr") or address,
        "assets": sorted(
            info.get("assets", []),
            key=lambda item: item["asset-id"],
        ),
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
    parser.add_argument("--execute", required=True, action="store_true")
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
        metadata["genesis_id"] == args.expected_genesis_id
        and base64.b64decode(metadata["genesis_hash_base64"])
        == context.genesis_hash,
        "Compiled artifact network differs from execution network",
    )

    operator = DisposableSigner()
    staking = DisposableSigner()
    recipient = DisposableSigner()
    outsider = DisposableSigner()

    signers = [operator, staking, recipient, outsider]
    addresses = [signer.address for signer in signers]
    require(len(set(addresses)) == 4, "Proof accounts must be distinct")

    record_path = ARTIFACTS / (
        f"proof-localnet-{staking.address}.json"
    )
    report = {
        "purpose": "disposable-account-control-proof-only",
        "network": args.network,
        "genesis_id": args.expected_genesis_id,
        "genesis_hash_base64": args.expected_genesis_hash,
        "operator": operator.address,
        "staking": staking.address,
        "recipient": recipient.address,
        "outsider": outsider.address,
        "payment_microalgo": PAYMENT_AMOUNT,
        "application_id": None,
        "application_address": None,
        "artifact_source_sha256": metadata["source_sha256"],
        "transactions": [],
        "rejections": [],
        "checks": {},
        "status": "started",
    }
    app_id = None
    app_address = None

    def save():
        record_path.write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

    def submit(signer, txn, label, rekey_app_id=None):
        signed = signer.sign(
            context, txn, proof_rekey_app_id=rekey_app_id
        )
        context.validate_transaction(
            txn, proof_rekey_app_id=rekey_app_id
        )
        entry = {
            "label": label,
            "txid": txn.get_txid(),
            "status": "prepared",
        }
        report["transactions"].append(entry)
        save()

        txid = client.send_transaction(signed)
        entry["status"] = "submitted"
        save()

        result = wait_for_confirmation(client, txid, 10)
        entry["status"] = "confirmed"
        entry["confirmed_round"] = result["confirmed-round"]
        save()
        return result

    def app_call(signer, action):
        references = list(
            dict.fromkeys(
                address
                for address in (staking.address, recipient.address)
                if address != signer.address
            )
        )
        return ApplicationNoOpTxn(
            sender=signer.address,
            sp=context.fresh_params(fee_units=2),
            index=app_id,
            app_args=[action.encode("ascii")],
            accounts=references,
        )

    def snapshot():
        watched = addresses + [app_address]
        return {
            "accounts": {
                address: account_snapshot(client, address)
                for address in watched
            },
            "global_state": global_state(client, app_id),
        }

    def reject(signer, txn, label):
        before = snapshot()
        signed = signer.sign(context, txn)
        context.validate_transaction(txn)

        try:
            client.send_transaction(signed)
        except AlgodHTTPError as error:
            if error.code != 400:
                raise
            after = snapshot()
            entry = {
                "label": label,
                "txid": txn.get_txid(),
                "http_status": error.code,
                "error": str(error),
                "before": before,
                "after": after,
                "rollback_unchanged": before == after,
            }
            report["rejections"].append(entry)
            save()
            require(
                before == after,
                f"{label}: rejection changed tracked balances or state",
            )
        else:
            raise AssertionError(f"{label}: node unexpectedly accepted transaction")

    save()

    try:
        report["funding"] = fund_disposable_accounts(context, signers)
        save()

        creation = ApplicationCreateTxn(
            sender=operator.address,
            sp=context.fresh_params(),
            on_complete=OnComplete.NoOpOC,
            approval_program=programs["approval.bin"],
            clear_program=programs["clear.bin"],
            global_schema=StateSchema(3, 3),
            local_schema=StateSchema(0, 0),
            app_args=[
                encoding.decode_address(operator.address),
                encoding.decode_address(staking.address),
                encoding.decode_address(recipient.address),
                PAYMENT_AMOUNT.to_bytes(8, "big"),
            ],
        )
        result = submit(operator, creation, "create_proof_application")
        app_id = result["application-index"]
        app_address = logic.get_application_address(app_id)
        report["application_id"] = app_id
        report["application_address"] = app_address
        save()

        submit(
            operator,
            PaymentTxn(
                sender=operator.address,
                sp=context.fresh_params(),
                receiver=app_address,
                amt=200_000,
            ),
            "fund_proof_application",
        )

        initial_state = global_state(client, app_id)
        require(initial_state["paid"] == 0, "Unexpected initial paid state")
        require(
            initial_state["restored"] == 0,
            "Unexpected initial restoration state",
        )
        for key, address in (
            ("operator", operator.address),
            ("staking", staking.address),
            ("recipient", recipient.address),
        ):
            require(
                base64.b64decode(initial_state[key])
                == encoding.decode_address(address),
                f"Incorrect fixed {key}",
            )
        require(
            initial_state["amount"] == PAYMENT_AMOUNT,
            "Incorrect fixed payment amount",
        )
        report["checks"]["fixed_creation_parameters"] = "passed"
        save()

        submit(
            staking,
            PaymentTxn(
                sender=staking.address,
                sp=context.fresh_params(),
                receiver=staking.address,
                amt=0,
                rekey_to=app_address,
            ),
            "bind_disposable_account",
            rekey_app_id=app_id,
        )
        require(
            account_snapshot(client, staking.address)["auth_address"]
            == app_address,
            "Staking account authorization does not match application",
        )
        report["checks"]["application_authorization"] = "passed"
        save()

        reject(
            outsider,
            app_call(outsider, "pay_once"),
            "unauthorized_payment",
        )
        reject(
            outsider,
            app_call(outsider, "restore"),
            "unauthorized_restoration",
        )
        reject(
            staking,
            PaymentTxn(
                sender=staking.address,
                sp=context.fresh_params(),
                receiver=recipient.address,
                amt=1,
            ),
            "original_key_spending_before_restoration",
        )

        before_payment = snapshot()
        submit(operator, app_call(operator, "pay_once"), "fixed_inner_payment")
        after_payment = snapshot()

        require(
            after_payment["accounts"][recipient.address]["amount"]
            - before_payment["accounts"][recipient.address]["amount"]
            == PAYMENT_AMOUNT,
            "Recipient did not receive the exact fixed amount",
        )
        require(
            before_payment["accounts"][staking.address]["amount"]
            - after_payment["accounts"][staking.address]["amount"]
            == PAYMENT_AMOUNT,
            "Staking balance change differs from fixed payment",
        )
        require(
            before_payment["accounts"][app_address]["amount"]
            == after_payment["accounts"][app_address]["amount"],
            "Application balance unexpectedly paid the inner fee or principal",
        )
        require(
            after_payment["global_state"]["paid"] == 1,
            "On-chain payment flag was not recorded",
        )
        report["payment_before"] = before_payment
        report["payment_after"] = after_payment
        report["checks"]["fixed_inner_payment"] = "passed"
        save()

        reject(
            operator,
            app_call(operator, "pay_once"),
            "repeat_payment",
        )

        before_restore = snapshot()
        submit(operator, app_call(operator, "restore"), "restore_original_authority")
        after_restore = snapshot()

        require(
            after_restore["accounts"][staking.address]["auth_address"]
            == staking.address,
            "Original account authorization was not restored",
        )
        require(
            before_restore["accounts"][staking.address]["amount"]
            == after_restore["accounts"][staking.address]["amount"],
            "Restoration changed staking principal",
        )
        require(
            after_restore["global_state"]["restored"] == 1,
            "Restoration terminal state was not recorded",
        )
        report["restoration_before"] = before_restore
        report["restoration_after"] = after_restore
        report["checks"]["restoration"] = "passed"
        save()

        reject(
            operator,
            app_call(operator, "pay_once"),
            "payment_after_restoration",
        )
        reject(
            operator,
            app_call(operator, "restore"),
            "repeat_restoration",
        )

        original_key_txn = PaymentTxn(
            sender=staking.address,
            sp=context.fresh_params(),
            receiver=staking.address,
            amt=0,
        )
        before_original = account_snapshot(client, staking.address)
        submit(staking, original_key_txn, "original_key_after_restoration")
        after_original = account_snapshot(client, staking.address)
        require(
            before_original["amount"] - after_original["amount"]
            == original_key_txn.fee,
            "Restored original-key transaction has unexpected balance effect",
        )
        report["checks"]["original_key_after_restoration"] = "passed"
        report["status"] = "primary_account_control_proof_passed"
        report["remaining_tests"] = [
            "restoration without a successful proof payment",
            "on-chain update and deletion rejection",
            "on-chain forbidden outer transaction fields",
        ]
        save()

    except Exception as error:
        report["status"] = "failed"
        report["error"] = {
            "type": type(error).__name__,
            "message": str(error),
        }
        save()
        raise

    finally:
        if app_id is not None:
            try:
                auth = account_snapshot(
                    client, staking.address
                )["auth_address"]
                if auth == app_address:
                    submit(
                        operator,
                        app_call(operator, "restore"),
                        "failure_cleanup_restoration",
                    )
                    require(
                        account_snapshot(
                            client, staking.address
                        )["auth_address"] == staking.address,
                        "Cleanup did not restore original authority",
                    )
                    report["cleanup"] = "original authority restored"
                else:
                    report["cleanup"] = "application does not hold authority"
            except Exception as error:
                report["cleanup"] = {
                    "status": "restoration failed",
                    "type": type(error).__name__,
                    "message": str(error),
                }
        save()
        print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()