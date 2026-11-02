"""Offline tests. Algod is mocked; no network or submission is performed."""

import base64
import unittest
from unittest.mock import patch

from algosdk import logic
from algosdk.transaction import (
    ApplicationNoOpTxn,
    ApplicationUpdateTxn,
    AssetTransferTxn,
    PaymentTxn,
    SuggestedParams,
)

from localnet_safety import (
    PRODUCTION_ADDRESS,
    DisposableSigner,
    LocalNetContext,
)


GENESIS_ID = "dockernet-v1"
GENESIS_HASH = base64.b64encode(bytes([11]) * 32).decode("ascii")
OTHER_HASH = base64.b64encode(bytes([22]) * 32).decode("ascii")


def params():
    return SuggestedParams(
        fee=1000,
        first=1,
        last=100,
        gh=GENESIS_HASH,
        gen=GENESIS_ID,
        flat_fee=True,
        min_fee=1000,
    )


class LocalNetSafetyTests(unittest.TestCase):
    def setUp(self):
        patcher = patch("localnet_safety.AlgodClient")
        self.addCleanup(patcher.stop)
        self.client_class = patcher.start()
        self.client = self.client_class.return_value
        self.client.suggested_params.side_effect = (
            lambda: params()
        )

        self.context = self.connect()
        self.signer = DisposableSigner()
        self.other = DisposableSigner()

    def tearDown(self):
        self.client.send_transaction.assert_not_called()
        self.client.send_transactions.assert_not_called()

    def connect(self, **overrides):
        settings = {
            "network": "localnet",
            "algod_url": "http://127.0.0.1:4001",
            "expected_genesis_id": GENESIS_ID,
            "expected_genesis_hash": GENESIS_HASH,
        }
        settings.update(overrides)
        return LocalNetContext(**settings)

    def payment(self, **overrides):
        fields = {
            "sender": self.signer.address,
            "sp": params(),
            "receiver": self.other.address,
            "amt": 1000,
        }
        fields.update(overrides)
        return PaymentTxn(**fields)

    def test_signs_generated_account_payment(self):
        txn = self.payment()
        signed = self.signer.sign(self.context, txn)
        self.assertEqual(signed.transaction.get_txid(), txn.get_txid())
        self.assertIsNotNone(signed.signature)

    def test_rejects_mainnet_and_missing_network(self):
        for network in ("mainnet", "testnet", "", None):
            with self.subTest(network=network):
                with self.assertRaises(ValueError):
                    self.connect(network=network)

    def test_rejects_nonlocal_endpoints(self):
        for endpoint in (
            "https://mainnet-api.algonode.cloud",
            "http://example.com:4001",
            "http://127.0.0.1:4002",
        ):
            with self.subTest(endpoint=endpoint):
                with self.assertRaises(ValueError):
                    self.connect(algod_url=endpoint)

    def test_rejects_wrong_node_genesis(self):
        with self.assertRaises(ValueError):
            self.connect(expected_genesis_hash=OTHER_HASH)

        with self.assertRaises(ValueError):
            self.connect(expected_genesis_id="another-localnet")

    def test_rechecks_live_genesis_before_signing(self):
        changed = params()
        changed.gh = OTHER_HASH
        self.client.suggested_params.side_effect = lambda: changed

        with self.assertRaises(ValueError):
            self.signer.sign(self.context, self.payment())

    def test_rejects_transaction_genesis_mismatch(self):
        txn = self.payment()
        txn.genesis_hash = OTHER_HASH

        with self.assertRaises(ValueError):
            self.signer.sign(self.context, txn)

    def test_rejects_production_sender_and_receiver(self):
        for field in ("sender", "receiver"):
            with self.subTest(field=field):
                txn = self.payment(**{field: PRODUCTION_ADDRESS})
                with self.assertRaises(ValueError):
                    self.context.validate_transaction(txn)

    def test_rejects_other_account_signing(self):
        txn = self.payment(sender=self.other.address)

        with self.assertRaises(ValueError):
            self.signer.sign(self.context, txn)

    def test_rejects_close_and_ordinary_rekey(self):
        for fields in (
            {"close_remainder_to": self.other.address},
            {"rekey_to": self.other.address},
        ):
            with self.subTest(fields=tuple(fields)):
                with self.assertRaises(ValueError):
                    self.signer.sign(
                        self.context,
                        self.payment(**fields),
                    )

    def test_allows_only_exact_designated_proof_rekey(self):
        app_id = 123
        destination = logic.get_application_address(app_id)
        txn = self.payment(
            receiver=self.signer.address,
            amt=0,
            rekey_to=destination,
        )

        signed = self.signer.sign(
            self.context,
            txn,
            proof_rekey_app_id=app_id,
        )
        self.assertEqual(signed.transaction.rekey_to, destination)

        for fields in (
            {"receiver": self.other.address, "amt": 0},
            {"receiver": self.signer.address, "amt": 1},
            {
                "receiver": self.signer.address,
                "amt": 0,
                "rekey_to": self.other.address,
            },
        ):
            values = {"rekey_to": destination}
            values.update(fields)
            with self.subTest(fields=tuple(fields)):
                with self.assertRaises(ValueError):
                    self.signer.sign(
                        self.context,
                        self.payment(**values),
                        proof_rekey_app_id=app_id,
                    )

    def test_rejects_asset_transfer_and_application_update(self):
        asset_txn = AssetTransferTxn(
            sender=self.signer.address,
            sp=params(),
            receiver=self.other.address,
            amt=0,
            index=1,
        )
        update_txn = ApplicationUpdateTxn(
            sender=self.signer.address,
            sp=params(),
            index=123,
            approval_program=b"\x0a\x81\x01",
            clear_program=b"\x0a\x81\x00",
        )

        for txn in (asset_txn, update_txn):
            with self.subTest(type=type(txn).__name__):
                with self.assertRaises(ValueError):
                    self.signer.sign(self.context, txn)

    def test_rejects_production_application_account_reference(self):
        txn = ApplicationNoOpTxn(
            sender=self.signer.address,
            sp=params(),
            index=123,
            accounts=[PRODUCTION_ADDRESS],
        )

        with self.assertRaises(ValueError):
            self.signer.sign(self.context, txn)


if __name__ == "__main__":
    unittest.main()