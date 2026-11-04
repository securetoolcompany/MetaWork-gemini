"""Authority expressions for the immutable disposable Day 1 Tokenizer.

Role selection is explicit at contract-generation time.
Existing no-argument callers retain their pinned LocalNet behavior.

No network access, signing, submission, or custody changes occur here.
"""

import pyteal as pt

from tokenizer_localnet_config import (
    CREATOR_INITIALIZER,
    SEED_RECIPIENT,
    STAKING,
)


INITIALIZED = pt.Bytes("initialized")


def _role_addresses(network):
    """Resolve one of the two explicitly configured disposable profiles."""
    if network == "localnet":
        return {
            "creator_initializer": CREATOR_INITIALIZER,
            "staking": STAKING,
            "seed_recipient": SEED_RECIPIENT,
        }

    if network == "testnet":
        from tokenizer_testnet_config import (
            APPROVED_ROLES,
            validate_roles,
        )

        roles = dict(APPROVED_ROLES)
        validate_roles(roles)
        return roles

    raise ValueError(
        "Explicit localnet or testnet contract profile required; "
        "MainNet and unknown profiles are forbidden"
    )


def outer_call_guard():
    """Reject updates, deletion, rekeying, and close-outs for every caller."""
    return pt.Seq(
        pt.Assert(pt.Txn.on_completion() == pt.OnComplete.NoOp),
        pt.Assert(pt.Txn.rekey_to() == pt.Global.zero_address()),
        pt.Assert(
            pt.Txn.close_remainder_to() == pt.Global.zero_address()
        ),
        pt.Assert(pt.Txn.asset_close_to() == pt.Global.zero_address()),
    )


def fixed_initializer_guard(*, network="localnet"):
    roles = _role_addresses(network)
    return pt.Assert(
        pt.Txn.sender() == pt.Addr(roles["creator_initializer"])
    )


def fixed_identity_arguments_guard(
    initializer,
    staking,
    seed_recipient,
    *,
    network="localnet",
):
    """Check identity expressions against the selected fixed profile."""
    roles = _role_addresses(network)

    return pt.Seq(
        pt.Assert(
            initializer == pt.Addr(roles["creator_initializer"])
        ),
        pt.Assert(staking == pt.Addr(roles["staking"])),
        pt.Assert(
            seed_recipient == pt.Addr(roles["seed_recipient"])
        ),
    )


def defensive_restore(*, network="localnet"):
    """Restore only the fixed staking account before initialization.

    No principal transfer, close-out, application-funded inner fee,
    arbitrary destination, or post-initialization restoration is allowed.
    """
    roles = _role_addresses(network)
    staking_address = pt.Addr(roles["staking"])

    initialized = pt.App.globalGetEx(pt.Int(0), INITIALIZED)
    authority = pt.AccountParam.authAddr(staking_address)

    return pt.Seq(
        outer_call_guard(),
        pt.Assert(pt.Txn.application_id() > pt.Int(0)),
        pt.Assert(pt.Global.group_size() == pt.Int(1)),
        pt.Assert(pt.Txn.application_args.length() == pt.Int(1)),
        pt.Assert(
            pt.Txn.application_args[0] == pt.Bytes("restore_preinit")
        ),
        fixed_initializer_guard(network=network),
        initialized,
        pt.Assert(initialized.hasValue()),
        pt.Assert(initialized.value() == pt.Int(0)),
        authority,
        pt.Assert(authority.hasValue()),
        pt.Assert(
            authority.value() == pt.Global.current_application_address()
        ),
        pt.Assert(
            pt.Txn.fee() >= pt.Global.min_txn_fee() * pt.Int(2)
        ),
        pt.InnerTxnBuilder.Begin(),
        pt.InnerTxnBuilder.SetFields(
            {
                pt.TxnField.type_enum: pt.TxnType.Payment,
                pt.TxnField.sender: staking_address,
                pt.TxnField.receiver: staking_address,
                pt.TxnField.amount: pt.Int(0),
                pt.TxnField.close_remainder_to: pt.Global.zero_address(),
                pt.TxnField.rekey_to: staking_address,
                pt.TxnField.fee: pt.Int(0),
            }
        ),
        pt.InnerTxnBuilder.Submit(),
    )