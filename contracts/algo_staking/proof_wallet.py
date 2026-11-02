"""Reopen-only signing adapter for the existing dedicated proof wallet."""

import base64
import json
from pathlib import Path

from algosdk import encoding
from algosdk.kmd import KMDClient
from algosdk.transaction import PaymentTxn
from nacl.signing import VerifyKey

from localnet_safety import (
    LOCALNET_TOKEN,
    LocalNetContext,
    require_disposable_address,
)
from prepare_proof_wallet import hidden_password
from verify_proof_wallet import container_marker


ROOT = Path(__file__).resolve().parent
PUBLIC_RECORD = (
    ROOT / "artifacts" / "account_control" / "kmd-proof-wallet.json"
)
ROLES = {"operator", "staking", "recipient", "outsider"}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def verify_signed_transaction(address, txn, signed):
    require(
        encoding.msgpack_encode(signed.transaction)
        == encoding.msgpack_encode(txn),
        "KMD returned a different transaction",
    )
    require(
        signed.authorizing_address is None,
        "Unexpected alternate signing authority",
    )

    message = b"TX" + base64.b64decode(encoding.msgpack_encode(txn))
    signature = base64.b64decode(signed.signature, validate=True)
    VerifyKey(encoding.decode_address(address)).verify(message, signature)


class KmdProofSigner:
    """Public address and validated signing; no private-key interface."""

    def __init__(self, session, address):
        self.__session = session
        self.__address = require_disposable_address(address)

    @property
    def address(self):
        return self.__address

    def sign(self, context, txn, *, proof_rekey_app_id=None):
        require(
            context is self.__session.context,
            "Signer must use its verified wallet-session context",
        )
        require(
            txn.sender == self.address,
            "Signer may authorize only its recorded account",
        )
        context.validate_transaction(
            txn,
            proof_rekey_app_id=proof_rekey_app_id,
        )
        return self.__session.sign_existing_account(
            self.address,
            txn,
            proof_rekey_app_id=proof_rekey_app_id,
        )


class ProofWalletSession:
    """Reopen an existing wallet from a selected public proof record."""

    def __init__(self, context, *, record_path=None):
        require(
            isinstance(context, LocalNetContext),
            "A verified LocalNet context is required",
        )
        self.context = context
        self.__kmd = None
        self.__handle = None
        self.__password = None
        self.signers = {}

        selected_record = (
            PUBLIC_RECORD if record_path is None else Path(record_path)
        )
        self.public_record = selected_record.resolve()
        allowed_directory = PUBLIC_RECORD.parent.resolve()

        require(
            self.public_record.parent == allowed_directory
            and self.public_record.suffix == ".json",
            "Wallet record must be a JSON file in the proof artifact directory",
        )
        require(
            self.public_record.is_file(),
            "Existing wallet record is required; no replacement permitted",
        )
        self.record = json.loads(
            self.public_record.read_text(encoding="utf-8")
        )

        record = self.record
        require(
            record.get("purpose") == "disposable-account-control-proof-only",
            "Unexpected wallet purpose",
        )
        require(
            record.get("network") == "localnet"
            and record.get("genesis_id") == context.genesis_id
            and base64.b64decode(record["genesis_hash_base64"])
            == context.genesis_hash,
            "Recorded wallet belongs to a different network",
        )
        require(
            isinstance(record.get("wallet_name"), str)
            and record["wallet_name"].startswith(
                "metawork-disposable-proof-"
            ),
            "A dedicated proof wallet is required",
        )
        require(
            set(record.get("accounts", {})) == ROLES,
            "Existing account metadata must contain all four proof roles",
        )
        addresses = [
            require_disposable_address(address)
            for address in record["accounts"].values()
        ]
        require(
            len(set(addresses)) == 4,
            "Recorded proof accounts must be distinct",
        )

        restart = record.get("restart_verification")
        require(
            isinstance(restart, dict)
            and restart.get("wallet_id") == record["wallet_id"],
            "Successful existing-wallet restart verification is required",
        )
        verified_accounts = restart.get("accounts", {})
        for role, address in record["accounts"].items():
            result = verified_accounts.get(role, {})
            require(
                result.get("address") == address
                and result.get("signature_verified") is True,
                f"Missing restart signature verification for {role}",
            )

        current_container = container_marker()
        require(
            current_container["container_id"]
            == restart["container"]["container_id"],
            "LocalNet container was replaced; stop and investigate",
        )

    def __enter__(self):
        require(self.__handle is None, "Wallet session is already open")
        self.context.fresh_params()
        self.__kmd = KMDClient(
            LOCALNET_TOKEN,
            "http://127.0.0.1:4002",
        )

        matches = [
            wallet
            for wallet in self.__kmd.list_wallets()
            if wallet["id"] == self.record["wallet_id"]
        ]
        require(
            len(matches) == 1
            and matches[0]["name"] == self.record["wallet_name"],
            "Existing recorded wallet not found; no replacement permitted",
        )

        try:
            self.__password = hidden_password(
                "Existing dedicated proof-wallet password: "
            )
            require(bool(self.__password), "Wallet password must not be empty")
            self.__handle = self.__kmd.init_wallet_handle(
                self.record["wallet_id"],
                self.__password,
            )
            require(
                set(self.__kmd.list_keys(self.__handle))
                == set(self.record["accounts"].values()),
                "Existing wallet account inventory mismatch",
            )

            self.signers = {
                role: KmdProofSigner(self, address)
                for role, address in self.record["accounts"].items()
            }

            # Prove every required account can sign in this fresh process
            # before callers can obtain the opened session.
            for signer in self.signers.values():
                txn = PaymentTxn(
                    sender=signer.address,
                    sp=self.context.fresh_params(),
                    receiver=signer.address,
                    amt=0,
                )
                signer.sign(self.context, txn)

            return self

        except Exception:
            self.__close()
            raise RuntimeError(
                "Existing proof-wallet opening/signing failed. "
                "Do not fund, rekey, create keys, or replace the wallet."
            ) from None

    def sign_existing_account(
        self,
        address,
        txn,
        *,
        proof_rekey_app_id=None,
    ):
        require(self.__handle is not None, "Wallet session is not open")
        require(
            address in self.record["accounts"].values()
            and txn.sender == address,
            "Signing requires an existing recorded proof account",
        )
        self.context.validate_transaction(
            txn,
            proof_rekey_app_id=proof_rekey_app_id,
        )
        signed = self.__kmd.sign_transaction(
            self.__handle,
            self.__password,
            txn,
        )
        verify_signed_transaction(address, txn, signed)
        return signed

    def __close(self):
        handle = self.__handle
        self.__handle = None
        self.signers = {}
        try:
            if handle is not None and self.__kmd is not None:
                self.__kmd.release_wallet_handle(handle)
        finally:
            self.__password = None

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            self.__close()
        except Exception:
            if exc_type is None:
                raise RuntimeError(
                    "Could not confirm KMD wallet-handle release"
                ) from None
        return False