"""Execute the three specifically approved disposable LocalNet payments.

Do not run automatically. Existing evidence blocks reruns.
No identity creation, key export, deployment, ASA creation, or rekeying.
"""

import argparse
import base64
import json
from pathlib import Path

from algosdk import encoding
from algosdk.kmd import KMDClient
from algosdk.transaction import (
    PaymentTxn,
    assign_group_id,
    wait_for_confirmation,
)
from nacl.signing import VerifyKey

from inspect_kmd_storage import docker_executable
from localnet_safety import (
    LOCALNET_TOKEN,
    LocalNetContext,
    is_unset_address,
    require_disposable_address,
)
from prepare_tokenizer_wallet import container_id
from tokenizer_localnet_config import (
    APPROVED_ROLES,
    PRESERVED_PROOF_ADDRESSES,
    validate_container,
    validate_network,
)


ROOT = Path(__file__).resolve().parent
RECORD = ROOT / "artifacts" / "tokenizer" / "funding-localnet.json"
SENDER = "2KCNNJI2GQEZ7OWNAMNYV5IJN74QP6J77YA6SNOBNLPL3IBOFL4ROTW5NU"
WALLET_ID = "e10bffa165b871191b7295078b85265e"
WALLET_NAME = "unencrypted-default-wallet"
FEE = 1_000
MAXIMUM_DEBIT = 3_203_000
PAYMENTS = (
    (APPROVED_ROLES["creator_initializer"], 1_000_000),
    (APPROVED_ROLES["staking"], 2_000_000),
    (APPROVED_ROLES["seed_recipient"], 200_000),
)


def save_record(record):
    temporary = RECORD.with_suffix(".json.tmp")
    with temporary.open("x", encoding="utf-8") as output:
        json.dump(record, output, indent=2, sort_keys=True)
        output.write("\n")
    temporary.replace(RECORD)


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
    parser.add_argument("--expected-container-id", required=True)
    parser.add_argument("--fund", required=True, action="store_true")
    args = parser.parse_args()

    if RECORD.exists() or RECORD.with_suffix(".json.tmp").exists():
        raise RuntimeError("Funding evidence exists; inspect it, never rerun")

    validate_network(
        network=args.network,
        genesis_id=args.expected_genesis_id,
        genesis_hash_base64=args.expected_genesis_hash,
    )
    validate_container(args.expected_container_id)
    docker = docker_executable()

    def check_container():
        validate_container(container_id(docker))

    check_container()
    context = LocalNetContext(
        network=args.network,
        algod_url=args.algod_url,
        expected_genesis_id=args.expected_genesis_id,
        expected_genesis_hash=args.expected_genesis_hash,
    )
    client = context.client
    kmd = KMDClient(LOCALNET_TOKEN, "http://127.0.0.1:4002")

    for address in (SENDER, *(address for address, _ in PAYMENTS)):
        require_disposable_address(address)
        if address in PRESERVED_PROOF_ADDRESSES:
            raise ValueError("Preserved proof identity forbidden")
    if SENDER in APPROVED_ROLES.values():
        raise ValueError("Tokenizer identity cannot be the faucet")
    if len({address for address, _ in PAYMENTS}) != 3:
        raise ValueError("Funding destinations must be distinct")
    if sum(amount + FEE for _, amount in PAYMENTS) != MAXIMUM_DEBIT:
        raise ValueError("Funding budget differs from approval")

    def snapshot(address):
        info = client.account_info(address)
        auth = info.get("auth-addr")
        return {
            "amount": info["amount"],
            "min_balance": info["min-balance"],
            "authority": address if is_unset_address(auth) else auth,
            "assets": info.get("assets", []),
            "created_assets": info.get("created-assets", []),
            "created_apps": info.get("created-apps", []),
            "local_apps": info.get("apps-local-state", []),
        }

    def inspect_prerequisites():
        check_container()
        params = context.fresh_params()
        if params.min_fee != FEE or params.fee != FEE:
            raise ValueError("Fee requirement differs from approved exact fee")

        wallets = [
            wallet for wallet in kmd.list_wallets()
            if wallet["name"] == WALLET_NAME
        ]
        if len(wallets) != 1 or wallets[0]["id"] != WALLET_ID:
            raise ValueError("Approved faucet wallet identity mismatch")

        allocations = client.genesis().get("alloc", [])
        if not any(
            allocation.get("addr") == SENDER
            and type(allocation.get("state", {}).get("algo")) is int
            and allocation["state"]["algo"] > 0
            for allocation in allocations
        ):
            raise ValueError("Sender is not a funded LocalNet genesis allocation")

        states = {
            address: snapshot(address)
            for address in (SENDER, *(address for address, _ in PAYMENTS))
        }
        source = states[SENDER]
        if source["authority"] != SENDER:
            raise ValueError("Faucet authority changed")
        if source["amount"] - source["min_balance"] < MAXIMUM_DEBIT:
            raise ValueError("Insufficient available faucet funds")

        for address, _ in PAYMENTS:
            state = states[address]
            if (
                state["authority"] != address
                or state["amount"] != 0
                or state["assets"]
                or state["created_assets"]
                or state["created_apps"]
                or state["local_apps"]
            ):
                raise ValueError("Dedicated destination state differs from preflight")
        return params, states

    params, before = inspect_prerequisites()
    transactions = assign_group_id([
        PaymentTxn(
            sender=SENDER,
            sp=params,
            receiver=address,
            amt=amount,
        )
        for address, amount in PAYMENTS
    ])
    group_id = transactions[0].group

    def validate_transactions():
        for transaction, (address, amount) in zip(transactions, PAYMENTS):
            context.validate_transaction(transaction)
            if (
                transaction.sender != SENDER
                or transaction.receiver != address
                or transaction.amt != amount
                or transaction.fee != FEE
                or transaction.group != group_id
                or not is_unset_address(transaction.rekey_to)
                or not is_unset_address(transaction.close_remainder_to)
            ):
                raise ValueError("Funding transaction differs from approval")

    validate_transactions()
    record = {
        "purpose": "approved-disposable-tokenizer-account-funding-only",
        "network": args.network,
        "genesis_id": args.expected_genesis_id,
        "genesis_hash_base64": args.expected_genesis_hash,
        "container_id": args.expected_container_id,
        "sender": SENDER,
        "wallet_id": WALLET_ID,
        "maximum_total_debit_microalgo": MAXIMUM_DEBIT,
        "group_id_base64": base64.b64encode(group_id).decode("ascii"),
        "payments": [
            {
                "destination": address,
                "amount_microalgo": amount,
                "fee_microalgo": FEE,
                "txid": transaction.get_txid(),
                "confirmed_round": None,
            }
            for transaction, (address, amount) in zip(transactions, PAYMENTS)
        ],
        "before": before,
        "status": "prepared_not_signed",
        "handle_release": "not opened",
    }
    RECORD.parent.mkdir(parents=True, exist_ok=True)
    with RECORD.open("x", encoding="utf-8") as output:
        json.dump(record, output, indent=2, sort_keys=True)
        output.write("\n")

    handle = None
    failed = False
    try:
        _, current = inspect_prerequisites()
        if current != before:
            raise ValueError("Account state changed before signing")
        handle = kmd.init_wallet_handle(WALLET_ID, "")
        record["handle_release"] = "pending"
        save_record(record)
        if SENDER not in kmd.list_keys(handle):
            raise ValueError("Approved faucet key absent")

        signed = []
        for transaction in transactions:
            _, current = inspect_prerequisites()
            if current != before:
                raise ValueError("Account state changed before signing")
            validate_transactions()
            encoded = encoding.msgpack_encode(transaction)
            result = kmd.sign_transaction(handle, "", transaction)
            if (
                result.signature is None
                or result.authorizing_address not in (None, SENDER)
                or encoding.msgpack_encode(result.transaction) != encoded
            ):
                raise ValueError("Unexpected signed transaction")
            VerifyKey(encoding.decode_address(SENDER)).verify(
                b"TX" + base64.b64decode(encoded),
                base64.b64decode(result.signature, validate=True),
            )
            signed.append(result)

        record["status"] = "signed_not_submitted"
        save_record(record)
        _, current = inspect_prerequisites()
        if current != before:
            raise ValueError("Account state changed before submission")
        validate_transactions()
        record["status"] = "submission_requested_do_not_retry"
        save_record(record)

        submitted = client.send_transactions(signed)
        record["submission_response_txid"] = submitted
        record["status"] = "submitted_confirmation_pending"
        save_record(record)

        for payment in record["payments"]:
            confirmation = wait_for_confirmation(client, payment["txid"], 10)
            payment["confirmed_round"] = confirmation["confirmed-round"]
            save_record(record)

        after = {
            address: snapshot(address)
            for address in before
        }
        record["after"] = after
        for address, amount in PAYMENTS:
            expected = dict(before[address])
            expected["amount"] = amount
            if after[address] != expected:
                raise ValueError("Destination post-funding state differs")
        expected_source = dict(before[SENDER])
        expected_source["amount"] -= MAXIMUM_DEBIT
        if after[SENDER] != expected_source:
            raise ValueError("Faucet post-funding state differs")
        if len({p["confirmed_round"] for p in record["payments"]}) != 1:
            raise ValueError("Funding group confirmation rounds differ")
        record["status"] = "three_exact_funding_payments_confirmed"
        save_record(record)

    except Exception as error:
        failed = True
        record["last_recorded_status"] = record["status"]
        record["status"] = "stopped_inspect_before_any_further_action"
        record["failure_type"] = type(error).__name__
        try:
            save_record(record)
        except Exception:
            pass
    finally:
        if handle is not None:
            try:
                kmd.release_wallet_handle(handle)
                record["handle_release"] = "confirmed"
            except Exception:
                failed = True
                record["handle_release"] = "not confirmed"
            try:
                save_record(record)
            except Exception:
                failed = True

    if failed:
        raise RuntimeError(
            "Funding stopped. Preserve evidence and inspect recorded IDs and "
            "live state. Do not retry or create replacement payments."
        ) from None

    print(json.dumps({
        "status": record["status"],
        "payments": record["payments"],
        "resulting_balances_microalgo": {
            address: state["amount"] for address, state in record["after"].items()
        },
        "handle_release": record["handle_release"],
        "maximum_total_debit_microalgo": MAXIMUM_DEBIT,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        raise SystemExit(
            "Funding stopped. Inspect public evidence and live state; no "
            "automatic retry, cleanup, or replacement payment is permitted."
        ) from None