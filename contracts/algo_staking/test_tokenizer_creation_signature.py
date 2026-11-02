"""Offline signature-verification boundary tests.

Most cryptographic checks are mocked to inspect validation behavior.
One test uses the real verifier to reject a zero-filled signature.
Valid-signature acceptance is not established.

No identity generation, signing, wallets, network, or submission.
"""

import base64
import unittest
from unittest.mock import patch

from algosdk import encoding
from algosdk.transaction import (
    ApplicationCreateTxn,
    OnComplete,
    SignedTransaction,
    StateSchema,
    SuggestedParams,
)
from nacl.exceptions import BadSignatureError

from tokenizer_creation_signature import verify_creation_signature


SENDER = "QAVXZK43SGUJC7DQ2QC6LBWTAYCKDGOG7XUSFYQRJBE23GZMHN3ORHFG3M"


def creation(fee=1000):
    return ApplicationCreateTxn(
        sender=SENDER,
        sp=SuggestedParams(
            fee=fee,
            first=1,
            last=10,
            gh=base64.b64encode(bytes(32)).decode("ascii"),
            gen="synthetic-offline-test",
            flat_fee=True,
        ),
        on_complete=OnComplete.NoOpOC,
        approval_program=b"\x01",
        clear_program=b"\x01",
        global_schema=StateSchema(8, 3),
        local_schema=StateSchema(0, 0),
    )


class TokenizerCreationSignatureTests(unittest.TestCase):
    def setUp(self):
        self.txn = creation()
        # Deliberately not a real signature; verification is mocked.
        self.signature = base64.b64encode(bytes(64)).decode("ascii")
        self.signed = SignedTransaction(self.txn, self.signature)

    def test_exact_verifier_inputs_and_returned_identity(self):
        with patch("tokenizer_creation_signature.VerifyKey") as verify_key:
            txid = verify_creation_signature(self.signed, self.txn)
            verify_key.assert_called_once_with(
                encoding.decode_address(SENDER)
            )
            verify_key.return_value.verify.assert_called_once_with(
                b"TX" + base64.b64decode(
                    encoding.msgpack_encode(self.txn), validate=True
                ),
                bytes(64),
            )
        self.assertEqual(txid, self.txn.get_txid())

    def test_wrong_unsigned_type_is_rejected(self):
        with self.assertRaisesRegex(
            TypeError, "^Expected an unsigned application transaction$"
        ):
            verify_creation_signature(self.signed, object())

    def test_existing_application_is_rejected(self):
        self.txn.index = 1
        with self.assertRaisesRegex(
            ValueError, "^Expected NoOp application creation$"
        ):
            verify_creation_signature(self.signed, self.txn)

    def test_wrong_signed_type_is_rejected(self):
        with self.assertRaisesRegex(
            TypeError, "^Expected an ordinary signed transaction$"
        ):
            verify_creation_signature(object(), self.txn)

    def test_alternate_authorizer_is_rejected(self):
        self.signed.authorizing_address = SENDER
        with self.assertRaisesRegex(
            ValueError, "^Alternate authorizing address is not permitted$"
        ):
            verify_creation_signature(self.signed, self.txn)

    def test_missing_and_short_signatures_are_rejected(self):
        for signature in (None, "", base64.b64encode(b"x").decode("ascii")):
            with self.subTest(signature=signature):
                signed = SignedTransaction(self.txn, signature)
                message = (
                    "^Unexpected signature length$"
                    if signature
                    else "^An ordinary signature is required$"
                )
                with self.assertRaisesRegex(ValueError, message):
                    verify_creation_signature(signed, self.txn)

    def test_changed_transaction_is_rejected_before_crypto(self):
        changed = SignedTransaction(creation(fee=2000), self.signature)
        with patch("tokenizer_creation_signature.VerifyKey") as verify_key:
            with self.assertRaisesRegex(
                ValueError,
                "^Signed transaction differs from expected creation$",
            ):
                verify_creation_signature(changed, self.txn)
            verify_key.assert_not_called()
    def test_non_noop_creation_is_rejected_before_crypto(self):
        self.txn.on_complete = OnComplete.DeleteApplicationOC
        with patch("tokenizer_creation_signature.VerifyKey") as verify_key:
            with self.assertRaisesRegex(
                ValueError, "^Expected NoOp application creation$"
            ):
                verify_creation_signature(self.signed, self.txn)
            verify_key.assert_not_called()

    def test_malformed_base64_is_rejected_before_crypto(self):
        import binascii

        signed = SignedTransaction(self.txn, "!" * 88)
        with patch("tokenizer_creation_signature.VerifyKey") as verify_key:
            with self.assertRaises(binascii.Error):
                verify_creation_signature(signed, self.txn)
            verify_key.assert_not_called()

    def test_real_verifier_rejects_zero_signature(self):
        # Uses the actual verifier, not a mock.
        # The fixture contains 64 zero bytes, not a valid signature.
        with self.assertRaises(BadSignatureError):
            verify_creation_signature(self.signed, self.txn)

    def test_crypto_failure_propagates(self):
        with patch("tokenizer_creation_signature.VerifyKey") as verify_key:
            verify_key.return_value.verify.side_effect = BadSignatureError(
                "synthetic rejection"
            )
            with self.assertRaises(BadSignatureError):
                verify_creation_signature(self.signed, self.txn)


if __name__ == "__main__":
    unittest.main()