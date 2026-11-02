"""Authority expressions for the immutable disposable Day 1 Tokenizer.

These helpers are not a complete application or a deployment entry point.
No network access, transaction signing, or submission occurs here.

Independently implemented from approved MetaWork policy; no upstream source
is copied or adapted.
"""

import pyteal as pt

from tokenizer_localnet_config import (
    CREATOR_INITIALIZER,
    SEED_RECIPIENT,
    STAKING,
)


# The complete contract must initialize this key to zero during creation,
# set it to one only within successful atomic seed initialization, and
# expose no method that resets or deletes it.
INITIALIZED = pt.Bytes("initialized")


def outer_call_guard():
    """Reject update/deletion and dangerous fields for every caller.

    Creation and supported methods must additionally validate their own
    arguments, group structure, references, and permissions.
    """
    return pt.Seq(
        pt.Assert(pt.Txn.on_completion() == pt.OnComplete.NoOp),
        pt.Assert(pt.Txn.rekey_to() == pt.Global.zero_address()),
        pt.Assert(pt.Txn.close_remainder_to() == pt.Global.zero_address()),
        pt.Assert(pt.Txn.asset_close_to() == pt.Global.zero_address()),
    )


def fixed_initializer_guard():
    return pt.Assert(pt.Txn.sender() == pt.Addr(CREATOR_INITIALIZER))


def fixed_identity_arguments_guard(initializer, staking, seed_recipient):
    """Validate decoded 32-byte identity expressions against approved roles."""
    return pt.Seq(
        pt.Assert(initializer == pt.Addr(CREATOR_INITIALIZER)),
        pt.Assert(staking == pt.Addr(STAKING)),
        pt.Assert(seed_recipient == pt.Addr(SEED_RECIPIENT)),
    )


def defensive_restore():
    """Restore only the fixed staking account before initialization.

    The complete dispatcher must route exactly the restore_preinit method
    to this expression. This helper also checks that selector itself.

    This is defensive recovery only. Normal custody binding and seed
    initialization must remain one atomic group.

    No principal transfer, close-out, application-funded inner fee, arbitrary
    destination, or post-initialization restoration is permitted.
    """
    initialized = pt.App.globalGetEx(pt.Int(0), INITIALIZED)
    authority = pt.AccountParam.authAddr(pt.Addr(STAKING))

    return pt.Seq(
        outer_call_guard(),
        pt.Assert(pt.Txn.application_id() > pt.Int(0)),
        pt.Assert(pt.Global.group_size() == pt.Int(1)),
        pt.Assert(pt.Txn.application_args.length() == pt.Int(1)),
        pt.Assert(
            pt.Txn.application_args[0] == pt.Bytes("restore_preinit")
        ),
        fixed_initializer_guard(),
        initialized,
        pt.Assert(initialized.hasValue()),
        pt.Assert(initialized.value() == pt.Int(0)),
        authority,
        pt.Assert(authority.hasValue()),
        pt.Assert(
            authority.value() == pt.Global.current_application_address()
        ),
        # A singleton outer call must cover itself and its one inner payment.
        pt.Assert(pt.Txn.fee() >= pt.Global.min_txn_fee() * pt.Int(2)),
        pt.InnerTxnBuilder.Begin(),
        pt.InnerTxnBuilder.SetFields(
            {
                pt.TxnField.type_enum: pt.TxnType.Payment,
                pt.TxnField.sender: pt.Addr(STAKING),
                pt.TxnField.receiver: pt.Addr(STAKING),
                pt.TxnField.amount: pt.Int(0),
                pt.TxnField.close_remainder_to: pt.Global.zero_address(),
                pt.TxnField.rekey_to: pt.Addr(STAKING),
                pt.TxnField.fee: pt.Int(0),
            }
        ),
        pt.InnerTxnBuilder.Submit(),
    )