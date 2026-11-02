"""Reopen-only Tokenizer wallet adapter, restricted to application creation.

Opening a session does not sign challenge transactions.
No key creation/export, funding, submission, ASA creation, or rekeying.

Do not open or invoke signing without the applicable execution approval.
"""

import base64
import json
from pathlib import Path

from algosdk import encoding
from algosdk.kmd import KMDClient
from algosdk.transaction import (
    ApplicationCallTxn,
    ApplicationCreateTxn,
    OnComplete,
    StateSchema,
    SuggestedParams,
)
from nacl.signing import VerifyKey

from inspect_kmd_storage import docker_executable
from localnet_safety import LOCALNET_TOKEN, LocalNetContext
from prepare_tokenizer_wallet import container_id, hidden_password
from tokenizer_artifacts import load_tokenizer_artifacts
from tokenizer_localnet_config import (
    CREATOR_INITIALIZER,
    validate_container,
    validate_network,
    validate_roles,
)


ROOT = Path(__file__).resolve().parent
PUBLIC_RECORD = ROOT / "artifacts" / "tokenizer" / "kmd-tokenizer-wallet.json"
WALLET_ID = "147e5400ba0afa7e1ef3935426e876e6"
WALLET_NAME = "metawork-disposable-tokenizer-6649f0c6d57f4526ab9fede6d7e30ea2"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


class TokenizerCreationWalletSession:
    """Existing dedicated wallet; only exact approved-code creation may sign."""

    def __init__(self, context, *, compile_directory):
        require(
            isinstance(context, LocalNetContext),
            "A verified LocalNet context is required",
        )
        self.context = context
        self.metadata, programs = load_tokenizer_artifacts(compile_directory)
        self.__approval = programs["approval"]
        self.__clear = programs["clear"]
        self.__kmd = None
        self.__handle = None
        self.__password = None
        self.__used = False
        self.handle_release = "not opened"

        require(
            PUBLIC_RECORD.is_file() and not PUBLIC_RECORD.is_symlink(),
            "Existing regular Tokenizer public record is required",
        )
        self.record = json.loads(PUBLIC_RECORD.read_text(encoding="utf-8"))
        record = self.record
        require(
            record.get("purpose") == "disposable-day1-tokenizer-identities-only",
            "Unexpected wallet purpose",
        )
        validate_network(
            network=record["network"],
            genesis_id=record["genesis_id"],
            genesis_hash_base64=record["genesis_hash_base64"],
        )
        require(
            context.genesis_id == record["genesis_id"]
            and context.genesis_hash
            == base64.b64decode(record["genesis_hash_base64"], validate=True),
            "Session context differs from recorded network",
        )
        validate_roles(record["accounts"])
        require(
            record.get("wallet_id") == WALLET_ID
            and record.get("wallet_name") == WALLET_NAME,
            "Dedicated Tokenizer wallet identity mismatch",
        )
        require(
            record.get("status") == "identities_created_role_approval_pending"
            and record.get("handle_release") == "confirmed",
            "Unexpected identity-preparation checkpoint",
        )
        # Role approval is enforced by exact approved configuration above.
        # Preserve the identity record's historical approval-pending field.
        validate_container(record["storage"]["container_id"])
        self.__docker = docker_executable()
        self.__recheck()

    def __recheck(self):
        validate_container(container_id(self.__docker))
        params = self.context.fresh_params()
        validate_network(
            network="localnet",
            genesis_id=params.gen,
            genesis_hash_base64=params.gh,
        )
        return params

    def __enter__(self):
        require(self.__handle is None, "Session is already open")
        require(not self.__used, "A closed session cannot be reopened")
        self.__used = True
        self.__recheck()
        self.__kmd = KMDClient(LOCALNET_TOKEN, "http://127.0.0.1:4002")
        matches = [
            wallet for wallet in self.__kmd.list_wallets()
            if wallet["id"] == WALLET_ID
        ]
        require(
            len(matches) == 1 and matches[0]["name"] == WALLET_NAME,
            "Existing dedicated Tokenizer wallet not found",
        )

        try:
            self.__password = hidden_password(
                "Existing dedicated Tokenizer-wallet password: "
            )
            require(bool(self.__password), "Wallet password must not be empty")
            self.__recheck()
            self.__handle = self.__kmd.init_wallet_handle(
                WALLET_ID, self.__password
            )
            self.handle_release = "pending"
            require(
                set(self.__kmd.list_keys(self.__handle))
                == set(self.record["accounts"].values()),
                "Dedicated Tokenizer wallet key inventory mismatch",
            )
            return self
        except Exception:
            try:
                self.__close()
            except Exception:
                raise RuntimeError(
                    "Tokenizer wallet opening stopped and KMD handle release "
                    "could not be confirmed. Stop and inspect existing wallet "
                    "state; do not retry opening, sign, fund, or replace identities."
                ) from None

            raise RuntimeError(
                "Tokenizer wallet opening stopped. No transaction was signed "
                "by session opening. Any acquired KMD handle was released. "
                "Preserve existing wallet; do not create replacement identities."
            ) from None

    def sign_creation(self, transaction):
        """Sign one validated creation transaction; never submit it."""
        require(self.__handle is not None, "Wallet session is not open")
        params = self.__recheck()
        require(
            params.min_fee == 1000,
            "Live minimum fee differs from the proposed exact creation fee",
        )
        require(
            isinstance(transaction, ApplicationCallTxn)
            and transaction.index == 0
            and transaction.sender == CREATOR_INITIALIZER,
            "Only the fixed creator's application creation may be signed",
        )
        self.context.validate_transaction(transaction)
        require(
            transaction.first_valid_round <= params.first
            <= transaction.last_valid_round,
            "Creation transaction is outside its validity window",
        )

        expected = ApplicationCreateTxn(
            sender=CREATOR_INITIALIZER,
            sp=SuggestedParams(
                fee=1000,
                first=transaction.first_valid_round,
                last=transaction.last_valid_round,
                gh=transaction.genesis_hash,
                gen=transaction.genesis_id,
                flat_fee=True,
            ),
            on_complete=OnComplete.NoOpOC,
            approval_program=self.__approval,
            clear_program=self.__clear,
            global_schema=StateSchema(8, 3),
            local_schema=StateSchema(0, 0),
            extra_pages=0,
        )
        encoded = encoding.msgpack_encode(transaction)
        require(
            encoded == encoding.msgpack_encode(expected),
            "Creation transaction differs from exact approved-code template",
        )

        info = self.context.client.account_info(CREATOR_INITIALIZER)
        require(
            info.get("auth-addr") in (None, "", CREATOR_INITIALIZER),
            "Creator authority changed",
        )
        self.__recheck()
        signed = self.__kmd.sign_transaction(
            self.__handle, self.__password, transaction
        )
        require(
            signed.authorizing_address is None
            and encoding.msgpack_encode(signed.transaction) == encoded
            and encoding.msgpack_encode(transaction) == encoded,
            "Unexpected signing authority or changed transaction",
        )
        VerifyKey(encoding.decode_address(CREATOR_INITIALIZER)).verify(
            b"TX" + base64.b64decode(encoded),
            base64.b64decode(signed.signature, validate=True),
        )
        return signed

    def __close(self):
        handle = self.__handle
        self.__handle = None
        try:
            if handle is not None:
                self.__kmd.release_wallet_handle(handle)
                self.handle_release = "confirmed"
        except Exception:
            self.handle_release = "not confirmed"
            raise RuntimeError("Could not confirm Tokenizer handle release") from None
        finally:
            self.__password = None

    def __exit__(self, exc_type, exc_value, traceback):
        self.__close()
        return False