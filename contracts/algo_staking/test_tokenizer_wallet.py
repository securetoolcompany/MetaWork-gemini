"""Isolated Tokenizer wallet boundary tests. No real KMD or node access."""

import copy
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from algosdk import encoding
from algosdk.transaction import (
    ApplicationCreateTxn,
    OnComplete,
    StateSchema,
    SuggestedParams,
)

import tokenizer_wallet as wallet
from tokenizer_localnet_config import (
    APPROVED_ROLES,
    CREATOR_INITIALIZER,
    GENESIS_HASH_BASE64,
    GENESIS_ID,
    STAKING,
)


class TokenizerWalletTests(unittest.TestCase):
    def setUp(self):
        self.params = SuggestedParams(
            fee=1000,
            first=100,
            last=200,
            gh=GENESIS_HASH_BASE64,
            gen=GENESIS_ID,
            flat_fee=True,
            min_fee=1000,
        )
        self.context = Mock()
        self.context.client.account_info.return_value = {
            "address": CREATOR_INITIALIZER
        }

        # Bypass constructor only for isolated session-method tests.
        # Record/artifact constructor validation is not covered here.
        self.session = wallet.TokenizerCreationWalletSession.__new__(
            wallet.TokenizerCreationWalletSession
        )
        self.session.context = self.context
        self.session.record = {
            "accounts": dict(APPROVED_ROLES),
        }
        self.session.handle_release = "not opened"
        self.session._TokenizerCreationWalletSession__approval = b"\x0a\x01"
        self.session._TokenizerCreationWalletSession__clear = b"\x0a\x00"
        self.session._TokenizerCreationWalletSession__password = None
        self.session._TokenizerCreationWalletSession__handle = None
        self.session._TokenizerCreationWalletSession__kmd = None
        self.session._TokenizerCreationWalletSession__used = False
        self.session._TokenizerCreationWalletSession__recheck = Mock(
            return_value=self.params
        )

        self.kmd = Mock()
        self.kmd.list_wallets.return_value = [
            {"id": wallet.WALLET_ID, "name": wallet.WALLET_NAME}
        ]
        self.kmd.init_wallet_handle.return_value = "mock-handle"
        self.kmd.list_keys.return_value = list(APPROVED_ROLES.values())

        self.kmd_patch = patch.object(
            wallet, "KMDClient", return_value=self.kmd
        )
        self.password_patch = patch.object(
            wallet, "hidden_password", return_value="mock-password"
        )
        self.kmd_patch.start()
        self.password_patch.start()
        self.addCleanup(self.kmd_patch.stop)
        self.addCleanup(self.password_patch.stop)

    def transaction(self):
        return ApplicationCreateTxn(
            sender=CREATOR_INITIALIZER,
            sp=copy.deepcopy(self.params),
            on_complete=OnComplete.NoOpOC,
            approval_program=b"\x0a\x01",
            clear_program=b"\x0a\x00",
            global_schema=StateSchema(8, 3),
            local_schema=StateSchema(0, 0),
            extra_pages=0,
        )

    def test_open_and_close_do_not_sign(self):
        with self.session:
            self.kmd.sign_transaction.assert_not_called()
        self.kmd.release_wallet_handle.assert_called_once_with("mock-handle")
        self.assertEqual(self.session.handle_release, "confirmed")
        self.assertIsNone(
            self.session._TokenizerCreationWalletSession__password
        )

    def test_open_failure_reports_release_failure(self):
        self.kmd.list_keys.return_value = []
        self.kmd.release_wallet_handle.side_effect = RuntimeError(
            "mock private diagnostic"
        )
        with self.assertRaisesRegex(RuntimeError, "could not be confirmed"):
            self.session.__enter__()
        self.assertEqual(self.session.handle_release, "not confirmed")
        self.kmd.sign_transaction.assert_not_called()
        self.assertIsNone(
            self.session._TokenizerCreationWalletSession__password
        )

    def test_closed_session_cannot_sign(self):
        with self.assertRaisesRegex(RuntimeError, "not open"):
            self.session.sign_creation(self.transaction())
        self.kmd.sign_transaction.assert_not_called()

    def test_creation_template_rejects_changes_before_kmd_signing(self):
        changes = {
            "fee": 2000,
            "sender": STAKING,
            "index": 7,
            "on_complete": OnComplete.OptInOC,
            "approval_program": b"\x0a\x02",
            "clear_program": b"\x0a\x03",
            "global_schema": StateSchema(9, 3),
            "local_schema": StateSchema(1, 0),
            "extra_pages": 1,
            "app_args": [b"create_share_asset"],
            "accounts": [STAKING],
            "foreign_apps": [7],
            "foreign_assets": [7],
            "note": b"unexpected",
            "lease": b"\x01" * 32,
            "group": b"\x02" * 32,
            "rekey_to": STAKING,
        }
        with self.session:
            for field, value in changes.items():
                with self.subTest(field=field):
                    txn = self.transaction()
                    setattr(txn, field, value)
                    with self.assertRaises(Exception):
                        self.session.sign_creation(txn)
                    self.kmd.sign_transaction.assert_not_called()

    def test_expired_window_is_rejected(self):
        txn = self.transaction()
        txn.first_valid_round = 1
        txn.last_valid_round = 99
        with self.session:
            with self.assertRaisesRegex(RuntimeError, "validity window"):
                self.session.sign_creation(txn)
        self.kmd.sign_transaction.assert_not_called()

    def test_changed_creator_authority_is_rejected(self):
        self.context.client.account_info.return_value = {"auth-addr": STAKING}
        with self.session:
            with self.assertRaisesRegex(RuntimeError, "authority changed"):
                self.session.sign_creation(self.transaction())
        self.kmd.sign_transaction.assert_not_called()

    def test_exact_template_reaches_mock_signing_and_verification(self):
        txn = self.transaction()
        signed = SimpleNamespace(
            transaction=txn,
            authorizing_address=None,
            signature="AA==",
        )
        self.kmd.sign_transaction.return_value = signed

        with patch.object(wallet, "VerifyKey") as verify_key:
            with self.session:
                result = self.session.sign_creation(txn)

            self.assertIs(result, signed)
            self.kmd.sign_transaction.assert_called_once()
            verify_key.assert_called_once_with(
                encoding.decode_address(CREATOR_INITIALIZER)
            )
            verify_key.return_value.verify.assert_called_once()

    def test_alternate_signing_authority_is_rejected(self):
        txn = self.transaction()
        self.kmd.sign_transaction.return_value = SimpleNamespace(
            transaction=txn,
            authorizing_address=STAKING,
            signature="AA==",
        )
        with self.session:
            with self.assertRaisesRegex(RuntimeError, "signing authority"):
                self.session.sign_creation(txn)

    def test_returned_transaction_substitution_is_rejected(self):
        txn = self.transaction()
        changed = copy.deepcopy(txn)
        changed.fee = 2000
        self.kmd.sign_transaction.return_value = SimpleNamespace(
            transaction=changed,
            authorizing_address=None,
            signature="AA==",
        )
        with self.session:
            with self.assertRaisesRegex(RuntimeError, "changed transaction"):
                self.session.sign_creation(txn)


if __name__ == "__main__":
    unittest.main()