"""Offline funding-runner tests with mocked node, KMD, and signature verification.

No real identity creation, wallet access, signing, funding, or submission.
"""

import base64
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from algosdk.transaction import SignedTransaction, SuggestedParams

import fund_tokenizer_accounts as funding


GENESIS_HASH = "0TJVyrVwfL/CRhaQzRG1mF29GzfDdG4Dzr2M5uXbg2o="
CONTAINER_ID = "b604c779920fde24732e79348e6cb7063fced4021c23b5a73fbb572ce96bd257"


class TokenizerFundingTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.record_path = Path(self.directory.name) / "funding.json"
        self.context = Mock()
        self.client = self.context.client
        self.kmd = Mock()

        self.balances = {funding.SENDER: 10_000_000}
        self.balances.update({
            address: 0 for address, _ in funding.PAYMENTS
        })
        self.authority = {}

        def account_info(address):
            return {
                "amount": self.balances[address],
                "min-balance": 100_000,
                "auth-addr": self.authority.get(address),
                "assets": [],
                "created-assets": [],
                "created-apps": [],
                "apps-local-state": [],
            }

        self.client.account_info.side_effect = account_info
        self.client.genesis.return_value = {
            "alloc": [{
                "addr": funding.SENDER,
                "state": {"algo": 10_000_000},
            }]
        }

        def fresh_params():
            return SuggestedParams(
                fee=1000,
                first=10,
                last=100,
                gh=GENESIS_HASH,
                gen="dockernet-v1",
                flat_fee=True,
                min_fee=1000,
            )

        self.context.fresh_params.side_effect = fresh_params
        self.kmd.list_wallets.return_value = [{
            "id": funding.WALLET_ID,
            "name": funding.WALLET_NAME,
        }]
        self.kmd.init_wallet_handle.return_value = "synthetic-handle"
        self.kmd.list_keys.return_value = [funding.SENDER]

        def fake_sign(handle, password, transaction):
            self.assertEqual(handle, "synthetic-handle")
            self.assertEqual(password, "")
            return SignedTransaction(
                transaction,
                base64.b64encode(bytes(64)).decode("ascii"),
            )

        self.kmd.sign_transaction.side_effect = fake_sign

        def fake_submit(signed):
            self.assertEqual(len(signed), 3)
            for result, (address, amount) in zip(signed, funding.PAYMENTS):
                transaction = result.transaction
                self.assertEqual(transaction.sender, funding.SENDER)
                self.assertEqual(transaction.receiver, address)
                self.assertEqual(transaction.amt, amount)
                self.assertEqual(transaction.fee, 1000)
                self.balances[address] += amount
            self.balances[funding.SENDER] -= funding.MAXIMUM_DEBIT
            return signed[0].transaction.get_txid()

        self.client.send_transactions.side_effect = fake_submit

        self.arguments = [
            "fund_tokenizer_accounts.py",
            "--network", "localnet",
            "--algod-url", "http://127.0.0.1:4001",
            "--expected-genesis-id", "dockernet-v1",
            "--expected-genesis-hash", GENESIS_HASH,
            "--expected-container-id", CONTAINER_ID,
            "--fund",
        ]

        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(
            patch.object(funding, "RECORD", self.record_path)
        )
        self.context_factory = self.stack.enter_context(
            patch.object(funding, "LocalNetContext", return_value=self.context)
        )
        self.stack.enter_context(
            patch.object(funding, "KMDClient", return_value=self.kmd)
        )
        self.stack.enter_context(
            patch.object(funding, "docker_executable", return_value="fake-docker")
        )
        self.container = self.stack.enter_context(
            patch.object(funding, "container_id", return_value=CONTAINER_ID)
        )
        self.verifier = self.stack.enter_context(
            patch.object(funding, "VerifyKey")
        )
        self.confirmation = self.stack.enter_context(
            patch.object(
                funding,
                "wait_for_confirmation",
                return_value={"confirmed-round": 22},
            )
        )

    def invoke(self):
        output = io.StringIO()
        with patch("sys.argv", self.arguments):
            with contextlib.redirect_stdout(output):
                funding.main()
        return output.getvalue()

    def record(self):
        return json.loads(self.record_path.read_text(encoding="utf-8"))

    def test_success_preserves_exact_budget_and_public_receipts(self):
        output = json.loads(self.invoke())
        self.assertEqual(
            output["status"], "three_exact_funding_payments_confirmed"
        )
        self.assertEqual(output["maximum_total_debit_microalgo"], 3_203_000)
        self.assertEqual(self.kmd.sign_transaction.call_count, 3)
        self.client.send_transactions.assert_called_once()
        self.assertEqual(self.confirmation.call_count, 3)
        self.assertEqual(self.verifier.return_value.verify.call_count, 3)
        self.assertEqual(
            self.balances[funding.SENDER], 10_000_000 - 3_203_000
        )
        for address, amount in funding.PAYMENTS:
            self.assertEqual(self.balances[address], amount)
        for payment in output["payments"]:
            self.assertEqual(payment["fee_microalgo"], 1000)
            self.assertEqual(payment["confirmed_round"], 22)
            self.assertTrue(payment["txid"])
        self.kmd.release_wallet_handle.assert_called_once_with(
            "synthetic-handle"
        )
        text = self.record_path.read_text(encoding="utf-8")
        self.assertNotIn("synthetic-handle", text)
        self.assertEqual(self.record()["handle_release"], "confirmed")

    def test_existing_record_blocks_setup(self):
        self.record_path.write_text("preserve", encoding="utf-8")
        with self.assertRaises(RuntimeError):
            self.invoke()
        self.context_factory.assert_not_called()
        self.kmd.init_wallet_handle.assert_not_called()
        self.assertEqual(
            self.record_path.read_text(encoding="utf-8"), "preserve"
        )

    def test_container_mismatch_blocks_wallet_opening(self):
        self.container.return_value = "b" * 64
        with self.assertRaises(ValueError):
            self.invoke()
        self.kmd.init_wallet_handle.assert_not_called()
        self.client.send_transactions.assert_not_called()

    def test_changed_sender_authority_blocks_wallet_opening(self):
        self.authority[funding.SENDER] = funding.PAYMENTS[0][0]
        with self.assertRaises(ValueError):
            self.invoke()
        self.kmd.init_wallet_handle.assert_not_called()

    def test_nonzero_destination_blocks_wallet_opening(self):
        self.balances[funding.PAYMENTS[0][0]] = 1
        with self.assertRaises(ValueError):
            self.invoke()
        self.kmd.init_wallet_handle.assert_not_called()

    def test_changed_fee_blocks_wallet_opening(self):
        params = self.context.fresh_params()
        params.min_fee = 2000
        self.context.fresh_params.side_effect = None
        self.context.fresh_params.return_value = params
        with self.assertRaises(ValueError):
            self.invoke()
        self.kmd.init_wallet_handle.assert_not_called()

    def test_signature_verification_failure_blocks_submission(self):
        self.verifier.return_value.verify.side_effect = ValueError(
            "synthetic-verification-failure"
        )
        with self.assertRaises(RuntimeError):
            self.invoke()
        self.client.send_transactions.assert_not_called()
        self.kmd.release_wallet_handle.assert_called_once()
        self.assertEqual(
            self.record()["last_recorded_status"], "prepared_not_signed"
        )

    def test_submission_error_preserves_all_ids_and_blocks_rerun(self):
        self.client.send_transactions.side_effect = RuntimeError(
            "synthetic-submission-error"
        )
        with self.assertRaises(RuntimeError):
            self.invoke()
        record = self.record()
        self.assertEqual(
            record["last_recorded_status"], "submission_requested_do_not_retry"
        )
        self.assertEqual(len(record["payments"]), 3)
        self.assertTrue(all(p["txid"] for p in record["payments"]))
        self.assertEqual(record["handle_release"], "confirmed")
        self.assertNotIn(
            "synthetic-submission-error",
            self.record_path.read_text(encoding="utf-8"),
        )
        with self.assertRaises(RuntimeError):
            self.invoke()
        self.assertEqual(self.client.send_transactions.call_count, 1)


if __name__ == "__main__":
    unittest.main()