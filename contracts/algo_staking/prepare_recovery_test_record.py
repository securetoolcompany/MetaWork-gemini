"""Prepare separate public metadata for an intentional recovery test."""

import copy
import hashlib
import json
import os

from proof_wallet import PUBLIC_RECORD


RECOVERY_RECORD = PUBLIC_RECORD.with_name("kmd-recovery-test.json")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    source_bytes = PUBLIC_RECORD.read_bytes()
    primary = json.loads(source_bytes)

    require(
        primary.get("status") == "primary_account_control_proof_passed",
        "The original record must contain a successful primary proof",
    )
    require(
        primary.get("purpose") == "disposable-account-control-proof-only"
        and primary.get("network") == "localnet",
        "Unexpected original proof purpose or network",
    )
    require(
        type(primary.get("application_id")) is int
        and primary["application_id"] > 0,
        "The successful primary application must remain recorded",
    )
    require(
        any(
            entry.get("label") == "original_key_after_restoration"
            and entry.get("status") == "confirmed"
            for entry in primary.get("transactions", [])
        ),
        "Confirmed original-key use after restoration is required",
    )
    require(
        not RECOVERY_RECORD.exists(),
        "Recovery-test record already exists; inspect it rather than overwrite",
    )

    identity_fields = (
        "purpose",
        "network",
        "genesis_id",
        "genesis_hash_base64",
        "wallet_id",
        "wallet_name",
        "accounts",
        "restart_verification",
    )
    record = {
        key: copy.deepcopy(primary[key])
        for key in identity_fields
    }
    for key in ("algod_url", "storage", "reopen_verification"):
        if key in primary:
            record[key] = copy.deepcopy(primary[key])

    record.update({
        "scenario": "fresh-process-restoration-without-payment",
        "status": "recovery_test_record_prepared",
        "application_id": None,
        "application_address": None,
        "funding": "not performed",
        "rekeying": "not performed",
        "transaction_ids": [],
        "transactions": [],
        "checks": {},
        "primary_proof": {
            "record_name": PUBLIC_RECORD.name,
            "record_sha256": hashlib.sha256(source_bytes).hexdigest(),
            "application_id": primary["application_id"],
            "status": primary["status"],
        },
    })

    require(
        PUBLIC_RECORD.read_bytes() == source_bytes,
        "Primary record changed during preparation; stop and inspect",
    )
    with RECOVERY_RECORD.open("x", encoding="utf-8") as handle:
        handle.write(json.dumps(record, indent=2, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())

    print(json.dumps({
        "status": record["status"],
        "record_name": RECOVERY_RECORD.name,
        "primary_application_id": primary["application_id"],
        "existing_wallet_referenced": True,
        "new_accounts_created": False,
        "submission": "not performed",
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()