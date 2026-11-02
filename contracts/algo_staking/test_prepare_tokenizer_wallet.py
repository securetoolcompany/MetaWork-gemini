"""Offline tests: no real KMD, Docker, network, keys, or transactions."""

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from algosdk import encoding

import prepare_tokenizer_wallet as setup


def fixture_address(number):
    """Deterministic public-address fixture with no generated private key."""
    return encoding.encode_address(bytes([number]) * 32)


class TokenizerWalletPreparationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.record_path = Path(self.directory.name) / "tokenizer.json"

        self.context = Mock()
        self.kmd = Mock()
        self.kmd.list_wallets.return_value = [{"id": "preserved-wallet"}]
        self.created = []

        def create_wallet(name, password, driver_name):
            self.assertEqual(password, "synthetic-test-password")
            self.assertEqual(driver_name, "sqlite")
            return {"id": "new-tokenizer-wallet", "name": name}

        def generate_key(handle, *, display_mnemonic):
            self.assertEqual(handle, "synthetic-handle")
            self.assertIs(display_mnemonic, False)
            address = fixture_address(len(self.created) + 1)
            self.created.append(address)
            return address

        self.kmd.create_wallet.side_effect = create_wallet
        self.kmd.init_wallet_handle.return_value = "synthetic-handle"
        self.kmd.generate_key.side_effect = generate_key
        self.kmd.list_keys.side_effect = lambda handle: list(self.created)

        self.arguments = [
            "prepare_tokenizer_wallet.py",
            "--network", "localnet",
            "--algod-url", "http://127.0.0.1:4001",
            "--expected-genesis-id", "synthetic-localnet",
            "--expected-genesis-hash", "synthetic-unused-by-fake-context",
            "--expected-container-id", "a" * 64,
            "--create",
        ]

        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(setup, "RECORD", self.record_path))
        self.context_factory = self.stack.enter_context(
            patch.object(setup, "LocalNetContext", return_value=self.context)
        )
        self.kmd_factory = self.stack.enter_context(
            patch.object(setup, "KMDClient", return_value=self.kmd)
        )
        self.stack.enter_context(
            patch.object(setup, "docker_executable", return_value="fake-docker")
        )
        self.container = self.stack.enter_context(
            patch.object(setup, "container_id", return_value="a" * 64)
        )
        self.stack.enter_context(
            patch.object(
                setup,
                "wallet_files",
                side_effect=[{"old-file"}, {"old-file", "new-file"}],
            )
        )
        self.password = self.stack.enter_context(
            patch.object(
                setup,
                "hidden_password",
                return_value="synthetic-test-password",
            )
        )

    def invoke(self):
        output = io.StringIO()
        with patch("sys.argv", self.arguments):
            with contextlib.redirect_stdout(output):
                setup.main()
        return output.getvalue()

    def read_record(self):
        return json.loads(self.record_path.read_text(encoding="utf-8"))

    def test_success_creates_exactly_three_fake_roles_and_releases_handle(self):
        output = self.invoke()
        record = self.read_record()

        self.assertEqual(set(record["accounts"]), set(setup.ROLES))
        self.assertEqual(len(set(record["accounts"].values())), 3)
        self.assertTrue(
            set(record["accounts"].values()).isdisjoint(
                setup.PRESERVED_PROOF_ADDRESSES
            )
        )
        self.assertEqual(self.kmd.create_wallet.call_count, 1)
        self.assertEqual(self.kmd.generate_key.call_count, 3)
        self.kmd.release_wallet_handle.assert_called_once_with(
            "synthetic-handle"
        )
        self.assertEqual(record["handle_release"], "confirmed")
        self.assertEqual(record["role_mapping_approval"], "pending")
        self.assertEqual(
            record["status"], "identities_created_role_approval_pending"
        )
        self.assertEqual(
            json.loads(output),
            {"proposed_role_mapping": record["accounts"]},
        )
        self.assertNotIn("synthetic-test-password", output)
        self.assertNotIn("synthetic-handle", output)
        text = self.record_path.read_text(encoding="utf-8")
        self.assertNotIn("synthetic-test-password", text)
        self.assertNotIn("synthetic-handle", text)
        for field in ("funding", "signing", "submission", "deployment", "rekeying"):
            self.assertEqual(record[field], "not performed")

    def test_existing_record_blocks_all_external_setup(self):
        self.record_path.write_text("preserve-this", encoding="utf-8")
        with self.assertRaises(RuntimeError):
            self.invoke()
        self.assertEqual(
            self.record_path.read_text(encoding="utf-8"), "preserve-this"
        )
        self.context_factory.assert_not_called()
        self.kmd_factory.assert_not_called()
        self.password.assert_not_called()

    def test_existing_temporary_record_blocks_setup(self):
        self.record_path.with_suffix(".json.tmp").write_text(
            "preserve-this", encoding="utf-8"
        )
        with self.assertRaises(RuntimeError):
            self.invoke()
        self.context_factory.assert_not_called()
        self.kmd_factory.assert_not_called()

    def test_key_failure_preserves_progress_without_secret_error_text(self):
        def fail_after_one(handle, *, display_mnemonic):
            if self.created:
                raise RuntimeError("synthetic-secret-error-do-not-record")
            address = fixture_address(1)
            self.created.append(address)
            return address

        self.kmd.generate_key.side_effect = fail_after_one
        with self.assertRaises(RuntimeError):
            self.invoke()

        record = self.read_record()
        self.assertEqual(record["wallet_id"], "new-tokenizer-wallet")
        self.assertEqual(len(record["accounts"]), 1)
        self.assertEqual(record["status"], "preparation_incomplete_do_not_rerun")
        self.assertEqual(record["failure_type"], "RuntimeError")
        self.assertNotIn(
            "synthetic-secret-error-do-not-record",
            self.record_path.read_text(encoding="utf-8"),
        )
        self.kmd.release_wallet_handle.assert_called_once()

    def test_initial_container_mismatch_blocks_setup_before_record_creation(self):
        self.container.return_value = "b" * 64

        with self.assertRaises(RuntimeError):
            self.invoke()

        self.kmd_factory.assert_not_called()
        self.password.assert_not_called()
        self.kmd.create_wallet.assert_not_called()
        self.kmd.generate_key.assert_not_called()
        self.assertFalse(self.record_path.exists())
        self.assertFalse(self.record_path.with_suffix(".json.tmp").exists())

    def test_malformed_expected_container_id_blocks_setup(self):
        index = self.arguments.index("--expected-container-id") + 1

        for invalid in ("", "a" * 63, "a" * 65, "A" * 64, "g" * 64):
            with self.subTest(expected_container_id=invalid):
                self.arguments[index] = invalid
                with self.assertRaises(ValueError):
                    self.invoke()

        self.container.assert_not_called()
        self.kmd_factory.assert_not_called()
        self.password.assert_not_called()
        self.assertFalse(self.record_path.exists())

    def test_container_change_blocks_wallet_creation(self):
        self.container.side_effect = ["a" * 64, "b" * 64]
        with self.assertRaises(RuntimeError):
            self.invoke()
        self.kmd.create_wallet.assert_not_called()
        self.kmd.generate_key.assert_not_called()
        self.assertEqual(
            self.read_record()["status"], "preparation_incomplete_do_not_rerun"
        )

    def test_duplicate_address_is_rejected_and_handle_released(self):
        self.kmd.generate_key.side_effect = None
        self.kmd.generate_key.return_value = fixture_address(1)
        with self.assertRaises(RuntimeError):
            self.invoke()
        self.assertEqual(self.kmd.generate_key.call_count, 2)
        self.kmd.release_wallet_handle.assert_called_once()
        self.assertEqual(
            self.read_record()["status"], "preparation_incomplete_do_not_rerun"
        )


if __name__ == "__main__":
    unittest.main()