"""Immutable disposable Day 1 Tokenizer. Not for production funds.

No investor redemption or post-initialization authority restoration exists.
Initialized backing may remain inaccessible. Replacement deployment does
not migrate custody, backing, or ownership.

Importing this module does not compile through Algod, deploy, sign, submit,
create an ASA, or change custody.
"""

import pyteal as pt

from tokenizer_asset import (
    OUTSTANDING_SHARES,
    SHARE_ASA_ID,
    create_share_asset,
)
from tokenizer_authority import (
    INITIALIZED,
    defensive_restore,
    fixed_initializer_guard,
    outer_call_guard,
)
from tokenizer_initialization import (
    BACKING_BASELINE,
    FEE_LIABILITY,
    FEE_RATE,
    OPERATING_RESERVE,
    OTHER_EXCLUSIONS,
    initialize_seed,
)
from tokenizer_localnet_config import (
    CREATOR_INITIALIZER,
    SEED_RECIPIENT,
    STAKING,
)


GLOBAL_UINTS = 8
GLOBAL_BYTES = 3

INITIALIZER_ADDRESS = pt.Bytes("initializer")
STAKING_ADDRESS = pt.Bytes("staking")
SEED_RECIPIENT_ADDRESS = pt.Bytes("seed_recipient")

UINT_STATE_KEYS = (
    INITIALIZED,
    SHARE_ASA_ID,
    OUTSTANDING_SHARES,
    OPERATING_RESERVE,
    OTHER_EXCLUSIONS,
    FEE_RATE,
    FEE_LIABILITY,
    BACKING_BASELINE,
)


def approval_program():
    """Creation has no arguments; approved public identities are fixed.

    Only three post-creation selectors exist:
      create_share_asset
      initialize_seed
      restore_preinit

    No administrator role, upgrade, deletion, arbitrary payment, asset
    reconfiguration, reserve change, fee change, or migration method exists.
    """
    create = pt.Seq(
        pt.Assert(pt.Global.group_size() == pt.Int(1)),
        pt.Assert(pt.Txn.application_args.length() == pt.Int(0)),
        fixed_initializer_guard(),
        *[
            pt.App.globalPut(key, pt.Int(0))
            for key in UINT_STATE_KEYS
        ],
        pt.App.globalPut(
            INITIALIZER_ADDRESS, pt.Addr(CREATOR_INITIALIZER)
        ),
        pt.App.globalPut(STAKING_ADDRESS, pt.Addr(STAKING)),
        pt.App.globalPut(
            SEED_RECIPIENT_ADDRESS, pt.Addr(SEED_RECIPIENT)
        ),
        pt.Approve(),
    )

    operate = pt.Seq(
        pt.Assert(pt.Txn.application_args.length() == pt.Int(1)),
        pt.Cond(
            [
                pt.Txn.application_args[0] == pt.Bytes("create_share_asset"),
                pt.Seq(create_share_asset(), pt.Approve()),
            ],
            [
                pt.Txn.application_args[0] == pt.Bytes("initialize_seed"),
                pt.Seq(initialize_seed(), pt.Approve()),
            ],
            [
                pt.Txn.application_args[0] == pt.Bytes("restore_preinit"),
                pt.Seq(defensive_restore(), pt.Approve()),
            ],
        ),
    )

    return pt.Seq(
        # Apply to creation and every existing-application path, regardless
        # of caller. Non-NoOp completions cannot reach any method.
        outer_call_guard(),
        pt.If(pt.Txn.application_id() == pt.Int(0))
        .Then(create)
        .Else(operate),
    )


def clear_program():
    """No local state is used; clearing grants no capability."""
    return pt.Reject()