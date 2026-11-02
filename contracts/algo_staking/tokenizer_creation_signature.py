"""Offline verification of an ordinary creator signature.

No wallet access, signing, submission, or execution approval.
"""

import base64

from algosdk import encoding
from algosdk.transaction import (
    ApplicationCallTxn,
    OnComplete,
    SignedTransaction,
)
from nacl.signing import VerifyKey


def verify_creation_signature(signed, expected_unsigned):
    """Verify signature and exact transaction identity; return the txid."""
    if not isinstance(expected_unsigned, ApplicationCallTxn):
        raise TypeError("Expected an unsigned application transaction")
    if (
        expected_unsigned.index != 0
        or expected_unsigned.on_complete != OnComplete.NoOpOC
    ):
        raise ValueError("Expected NoOp application creation")

    if not isinstance(signed, SignedTransaction):
        raise TypeError("Expected an ordinary signed transaction")
    if signed.authorizing_address is not None:
        raise ValueError("Alternate authorizing address is not permitted")
    if not isinstance(signed.signature, str) or not signed.signature:
        raise ValueError("An ordinary signature is required")

    expected_encoded = encoding.msgpack_encode(expected_unsigned)
    if encoding.msgpack_encode(signed.transaction) != expected_encoded:
        raise ValueError("Signed transaction differs from expected creation")

    signature = base64.b64decode(signed.signature, validate=True)
    if len(signature) != 64:
        raise ValueError("Unexpected signature length")

    payload = base64.b64decode(expected_encoded, validate=True)
    VerifyKey(
        encoding.decode_address(expected_unsigned.sender)
    ).verify(b"TX" + payload, signature)

    return expected_unsigned.get_txid()