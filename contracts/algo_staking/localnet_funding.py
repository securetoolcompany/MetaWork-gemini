"""Fund generated proof accounts from the disposable LocalNet faucet."""

from algosdk.kmd import KMDClient
from algosdk.transaction import PaymentTxn, wait_for_confirmation

from localnet_safety import (
    LOCALNET_TOKEN,
    LocalNetContext,
    is_unset_address,
    require_disposable_address,
)
from proof_wallet import KmdProofSigner


def fund_disposable_accounts(context, signers):
    """Send exactly 2 ALGO to each generated signer; return public receipts."""

    if not isinstance(context, LocalNetContext):
        raise ValueError("A verified LocalNet context is required")

    if (
        not isinstance(signers, (list, tuple))
        or not signers
        or len(signers) > 4
        or any(not isinstance(signer, KmdProofSigner) for signer in signers)
    ):
        raise ValueError(
            "Supply one to four persisted, dedicated-wallet KMD proof signers"
        )

    addresses = [
        require_disposable_address(signer.address)
        for signer in signers
    ]
    if len(set(addresses)) != len(addresses):
        raise ValueError("Duplicate funding recipients are forbidden")

    context.fresh_params()

    # Verify all recipients through their existing KMD session before
    # beginning funding. These challenge transactions are never submitted.
    for signer in signers:
        challenge = PaymentTxn(
            sender=signer.address,
            sp=context.fresh_params(),
            receiver=signer.address,
            amt=0,
        )
        signer.sign(context, challenge)

    kmd = KMDClient(LOCALNET_TOKEN, "http://127.0.0.1:4002")
    wallets = [
        wallet
        for wallet in kmd.list_wallets()
        if wallet["name"] == "unencrypted-default-wallet"
    ]
    if len(wallets) != 1:
        raise ValueError("Expected exactly one default disposable LocalNet wallet")

    handle = kmd.init_wallet_handle(wallets[0]["id"], "")

    try:
        amount = 2_000_000
        fee = context.fresh_params().fee
        required = len(addresses) * (amount + fee)
        faucet = None

        for candidate in sorted(kmd.list_keys(handle)):
            require_disposable_address(candidate)

            if candidate in addresses:
                continue

            info = context.client.account_info(candidate)
            if not is_unset_address(info.get("auth-addr")):
                continue

            available = info["amount"] - info["min-balance"]
            if available >= required:
                faucet = candidate
                break

        if faucet is None:
            raise ValueError("No sufficiently funded unrekeyed LocalNet faucet")

        receipts = []

        for recipient in addresses:
            txn = PaymentTxn(
                sender=faucet,
                sp=context.fresh_params(),
                receiver=recipient,
                amt=amount,
            )

            context.validate_transaction(txn)
            signed = kmd.sign_transaction(handle, "", txn)

            # Verify the live genesis again immediately before submission.
            context.validate_transaction(txn)
            txid = context.client.send_transaction(signed)
            result = wait_for_confirmation(context.client, txid, 10)

            receipts.append(
                {
                    "sender": faucet,
                    "recipient": recipient,
                    "amount_microalgo": amount,
                    "txid": txid,
                    "confirmed_round": result["confirmed-round"],
                }
            )

        return receipts
    finally:
        kmd.release_wallet_handle(handle)