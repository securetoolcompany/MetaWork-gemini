"""Execute one recorded disposable proof using existing KMD-held accounts."""

import argparse
import base64
import json

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
from localnet_safety import LocalNetContext
from proof_wallet import ProofWalletSession
from prove_account_control import (
    PAYMENT_AMOUNT,
    account_snapshot,
    global_state,
    load_programs,
)
from recover_account_control import save_public_record, snapshot


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
        metadata["genesis_id"] == context.genesis_id
        and base64.b64decode(metadata["genesis_hash_base64"])
        == context.genesis_hash,
        "Bytecode artifact network differs from execution network",
    )

    with ProofWalletSession(context) as wallet:
        record = wallet.record
        require(
            record.get("status") == "wallet_ready_for_proof"
            and record.get("application_id") is None
            and record.get("funding") == "not performed"
            and record.get("rekeying") == "not performed",
            "This wallet is not an unused prepared proof. "
            "Inspect the existing record or use recovery; do not redeploy.",
        )

        signers = wallet.signers
        operator = signers["operator"]
        staking = signers["staking"]
        recipient = signers["recipient"]
        outsider = signers["outsider"]
        accounts = record["accounts"]
        app_id = None
        app_address = None

        record["payment_microalgo"] = PAYMENT_AMOUNT
        record["artifact_source_sha256"] = metadata["source_sha256"]
        record["application_approval_sha256"] = (
            metadata["programs"]["approval.bin"]["sha256"]
        )
        record["transactions"] = []
        record["rejections"] = []
        record["checks"] = {}
        record["status"] = "proof_started"
        save_public_record(record)

        def submit(signer, txn, label, rekey_app_id=None):
            signed = signer.sign(
                context,
                txn,
                proof_rekey_app_id=rekey_app_id,
            )
            entry = {
                "label": label,
                "txid": txn.get_txid(),
                "status": "prepared",
            }
            record["transactions"].append(entry)
            record["transaction_ids"].append(txn.get_txid())
            save_public_record(record)

            context.validate_transaction(
                txn,
                proof_rekey_app_id=rekey_app_id,
            )
            txid = client.send_transaction(signed)
            entry["status"] = "submitted"
            save_public_record(record)

            result = wait_for_confirmation(client, txid, 10)
            entry["status"] = "confirmed"
            entry["confirmed_round"] = result["confirmed-round"]
            save_public_record(record)
            return result

        def app_call(signer, action):
            references = [
                address
                for address in (staking.address, recipient.address)
                if address != signer.address
            ]
            return ApplicationNoOpTxn(
                sender=signer.address,
                sp=context.fresh_params(fee_units=2),
                index=app_id,
                app_args=[action.encode("ascii")],
                accounts=references,
            )

        def take_snapshot():
            return snapshot(client, accounts, app_id, app_address)

        def reject(signer, txn, label, expected_error):
            before = take_snapshot()
            signed = signer.sign(context, txn)
            context.validate_transaction(txn)

            try:
                client.send_transaction(signed)
            except AlgodHTTPError as error:
                if error.code != 400:
                    raise
                after = take_snapshot()
                entry = {
                    "label": label,
                    "txid": txn.get_txid(),
                    "http_status": error.code,
                    "error": str(error),
                    "expected_error_fragment": expected_error,
                    "expected_error_matched": expected_error in str(error),
                    "before": before,
                    "after": after,
                    "rollback_unchanged": before == after,
                }
                record["rejections"].append(entry)
                save_public_record(record)
                require(
                    entry["expected_error_matched"],
                    f"{label}: rejection was not the expected failure",
                )
                require(
                    before == after,
                    f"{label}: rejection changed tracked account/state data",
                )
            else:
                raise RuntimeError(
                    f"{label}: node unexpectedly accepted the transaction"
                )

        def restore(label):
            before = take_snapshot()
            txn = app_call(operator, "restore")
            submit(operator, txn, label)
            after = take_snapshot()

            # Save evidence before assertions so failed verification is retained.
            record["restoration_before"] = before
            record["restoration_after"] = after
            save_public_record(record)

            require(
                after["accounts"][staking.address]["auth_address"]
                == staking.address,
                "Restoration did not return original account authority",
            )
            require(
                after["global_state"]["restored"] == 1
                and after["global_state"]["paid"]
                == before["global_state"]["paid"],
                "Unexpected restoration state transition",
            )
            for address in list(accounts.values()) + [app_address]:
                require(
                    before["accounts"][address]["assets"]
                    == after["accounts"][address]["assets"],
                    "Restoration changed asset holdings",
                )
                if address != operator.address:
                    require(
                        before["accounts"][address]["amount"]
                        == after["accounts"][address]["amount"],
                        "Restoration changed a non-operator balance",
                    )
            require(
                before["accounts"][operator.address]["amount"]
                - after["accounts"][operator.address]["amount"]
                == txn.fee,
                "Restoration operator balance change differs from outer fee",
            )
            record["checks"]["restoration"] = "passed"
            save_public_record(record)

        try:
            # Mark intent before funding: interrupted funding must not be
            # silently repeated by launching this runner again.
            record["funding"] = "started"
            save_public_record(record)
            record["funding_receipts"] = fund_disposable_accounts(
                context,
                [operator, staking, recipient, outsider],
            )
            record["funding"] = "confirmed"
            save_public_record(record)

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
            record["application_id"] = app_id
            record["application_address"] = app_address
            save_public_record(record)

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

            state = global_state(client, app_id)
            for role in ("operator", "staking", "recipient"):
                require(
                    base64.b64decode(state[role])
                    == encoding.decode_address(accounts[role]),
                    f"Incorrect on-chain fixed {role}",
                )
            require(
                state["amount"] == PAYMENT_AMOUNT
                and state["paid"] == 0
                and state["restored"] == 0,
                "Unexpected initial proof state",
            )
            record["checks"]["fixed_creation_parameters"] = "passed"
            save_public_record(record)

            record["rekeying"] = "prepared"
            save_public_record(record)
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
                "Staking authorization does not match proof application",
            )
            record["rekeying"] = "confirmed"
            record["checks"]["application_authorization"] = "passed"
            save_public_record(record)

            reject(
                outsider,
                app_call(outsider, "pay_once"),
                "unauthorized_payment",
                "assert failed",
            )
            reject(
                outsider,
                app_call(outsider, "restore"),
                "unauthorized_restoration",
                "assert failed",
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
                "should have been authorized",
            )

            before_payment = take_snapshot()
            payment_call = app_call(operator, "pay_once")
            submit(operator, payment_call, "fixed_inner_payment")
            after_payment = take_snapshot()
            record["payment_before"] = before_payment
            record["payment_after"] = after_payment
            save_public_record(record)

            before_accounts = before_payment["accounts"]
            after_accounts = after_payment["accounts"]
            require(
                after_accounts[recipient.address]["amount"]
                - before_accounts[recipient.address]["amount"]
                == PAYMENT_AMOUNT,
                "Recipient did not receive the exact fixed amount",
            )
            require(
                before_accounts[staking.address]["amount"]
                - after_accounts[staking.address]["amount"]
                == PAYMENT_AMOUNT,
                "Staking balance effect differs from the fixed payment",
            )
            require(
                before_accounts[operator.address]["amount"]
                - after_accounts[operator.address]["amount"]
                == payment_call.fee,
                "Operator did not bear exactly the pooled outer fee",
            )
            require(
                before_accounts[app_address]["amount"]
                == after_accounts[app_address]["amount"],
                "Application unexpectedly paid principal or an inner fee",
            )
            require(
                after_payment["global_state"]["paid"] == 1,
                "On-chain payment-once flag was not recorded",
            )
            record["checks"]["fixed_inner_payment"] = "passed"
            save_public_record(record)

            reject(
                operator,
                app_call(operator, "pay_once"),
                "repeat_payment",
                "assert failed",
            )

            restore("restore_original_authority")

            reject(
                operator,
                app_call(operator, "pay_once"),
                "payment_after_restoration",
                "assert failed",
            )
            reject(
                operator,
                app_call(operator, "restore"),
                "repeat_restoration",
                "assert failed",
            )

            original_key_txn = PaymentTxn(
                sender=staking.address,
                sp=context.fresh_params(),
                receiver=staking.address,
                amt=0,
            )
            before_original = account_snapshot(client, staking.address)
            submit(
                staking,
                original_key_txn,
                "original_key_after_restoration",
            )
            after_original = account_snapshot(client, staking.address)
            require(
                before_original["amount"] - after_original["amount"]
                == original_key_txn.fee
                and after_original["auth_address"] == staking.address,
                "Restored original-key transaction had unexpected effects",
            )
            record["checks"]["original_key_after_restoration"] = "passed"
            record["status"] = "primary_account_control_proof_passed"
            record["remaining_tests"] = [
                "restoration without a successful proof payment",
                "fresh-process recovery of interrupted application custody",
                "on-chain update and deletion rejection",
                "on-chain forbidden outer transaction fields",
            ]
            save_public_record(record)

        except Exception as error:
            record["status"] = "failed"
            record["failure_type"] = type(error).__name__
            save_public_record(record)
            raise

        finally:
            if app_id is not None:
                try:
                    authority = account_snapshot(
                        client, staking.address
                    )["auth_address"]
                    if authority == app_address:
                        restore("failure_cleanup_restoration")
                        record["cleanup"] = "original authority restored"
                    else:
                        record["cleanup"] = (
                            "application does not hold staking authority"
                        )
                except Exception as error:
                    record["cleanup"] = {
                        "status": "restoration not confirmed",
                        "failure_type": type(error).__name__,
                        "next_action": (
                            "Preserve this wallet and record. Use the "
                            "existing-identifier recovery entry point."
                        ),
                    }
            save_public_record(record)
            print(json.dumps(record, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()