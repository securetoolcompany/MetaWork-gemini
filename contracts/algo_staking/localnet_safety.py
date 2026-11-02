"""Network and signing safeguards for the disposable LocalNet proof."""

import base64

from algosdk import account, encoding, logic
from algosdk.transaction import (
    ApplicationCallTxn,
    OnComplete,
    PaymentTxn,
)
from algosdk.v2client.algod import AlgodClient


LOCALNET_TOKEN = "a" * 64
PRODUCTION_ADDRESS = (
    "73C6PQVLAPE6M2GFV3ZKXJRHCNZ4P75GY3LMTHJ7MS2MALZJ6RRJKNWHBU"
)
ZERO_ADDRESS = encoding.encode_address(bytes(32))


def require_disposable_address(address):
    if (
        not isinstance(address, str)
        or not encoding.is_valid_address(address)
        or address in (PRODUCTION_ADDRESS, ZERO_ADDRESS)
    ):
        raise ValueError("Invalid or protected disposable-network address")
    return address


def is_unset_address(address):
    return address in (None, "", ZERO_ADDRESS)


class LocalNetContext:
    """Explicit loopback connection pinned to a caller-supplied genesis."""

    def __init__(
        self,
        *,
        network,
        algod_url,
        expected_genesis_id,
        expected_genesis_hash,
    ):
        if network != "localnet":
            raise ValueError("Only explicit localnet selection is permitted")

        if algod_url not in (
            "http://127.0.0.1:4001",
            "http://localhost:4001",
        ):
            raise ValueError("Only the disposable LocalNet endpoint is permitted")

        if (
            not isinstance(expected_genesis_id, str)
            or not expected_genesis_id
            or any(
                name in expected_genesis_id.lower()
                for name in ("mainnet", "testnet", "betanet")
            )
        ):
            raise ValueError("Public-network genesis is forbidden")

        expected_hash = base64.b64decode(
            expected_genesis_hash,
            validate=True,
        )
        if len(expected_hash) != 32:
            raise ValueError("Genesis hash must decode to 32 bytes")

        self.genesis_id = expected_genesis_id
        self.genesis_hash = expected_hash
        self.client = AlgodClient(LOCALNET_TOKEN, algod_url)
        self.fresh_params()

    def check_genesis(self, genesis_id, genesis_hash):
        if genesis_id != self.genesis_id:
            raise ValueError("Genesis ID mismatch")

        decoded = base64.b64decode(genesis_hash, validate=True)
        if decoded != self.genesis_hash:
            raise ValueError("Genesis hash mismatch")

    def fresh_params(self, fee_units=1):
        if type(fee_units) is not int or fee_units < 1:
            raise ValueError("Fee units must be a positive integer")

        params = self.client.suggested_params()
        self.check_genesis(params.gen, params.gh)

        minimum_fee = params.min_fee
        if type(minimum_fee) is not int or minimum_fee < 1:
            raise ValueError("Invalid node minimum transaction fee")

        params.flat_fee = True
        params.fee = minimum_fee * fee_units
        return params

    def validate_transaction(self, txn, *, proof_rekey_app_id=None):
        # Recheck the live endpoint immediately before signing.
        self.fresh_params()
        self.check_genesis(txn.genesis_id, txn.genesis_hash)
        require_disposable_address(txn.sender)

        if not is_unset_address(getattr(txn, "close_remainder_to", None)):
            raise ValueError("Account close-out is forbidden")
        if not is_unset_address(getattr(txn, "close_assets_to", None)):
            raise ValueError("Asset close-out is forbidden")

        if isinstance(txn, PaymentTxn):
            require_disposable_address(txn.receiver)
            if type(txn.amt) is not int or not 0 <= txn.amt < 2**64:
                raise ValueError("Payment amount must be an integer uint64")

        elif isinstance(txn, ApplicationCallTxn):
            if txn.on_complete != OnComplete.NoOpOC:
                raise ValueError("Only application creation and NoOp are allowed")
            if txn.index:
                require_disposable_address(
                    logic.get_application_address(txn.index)
                )
            for address in txn.accounts or []:
                require_disposable_address(address)
        else:
            raise ValueError("Unsupported proof transaction type")

        if proof_rekey_app_id is None:
            if not is_unset_address(txn.rekey_to):
                raise ValueError("Rekeying requires designated proof validation")
            return

        if (
            type(proof_rekey_app_id) is not int
            or proof_rekey_app_id < 1
            or not isinstance(txn, PaymentTxn)
            or txn.receiver != txn.sender
            or txn.amt != 0
            or txn.rekey_to
            != logic.get_application_address(proof_rekey_app_id)
        ):
            raise ValueError("Invalid designated proof rekey transaction")

        require_disposable_address(txn.rekey_to)


class DisposableSigner:
    """Generate a fresh in-memory account; never accept imported secrets."""

    def __init__(self):
        self.__private_key, self.address = account.generate_account()
        require_disposable_address(self.address)

    def sign(self, context, txn, *, proof_rekey_app_id=None):
        if txn.sender != self.address:
            raise ValueError("Signer may authorize only its generated account")

        context.validate_transaction(
            txn,
            proof_rekey_app_id=proof_rekey_app_id,
        )
        return txn.sign(self.__private_key)