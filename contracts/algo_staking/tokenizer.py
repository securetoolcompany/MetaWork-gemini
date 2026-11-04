"""Immutable disposable Day 1 Tokenizer. Not for production funds.

No investor redemption or post-initialization authority restoration exists.
Initialized backing may remain inaccessible. Replacement deployment does
not migrate custody, backing, or ownership.

Profiles select fixed identities at contract-generation time only.
Importing this module does not contact Algod, sign, submit, or change custody.
"""

import pyteal as pt

from tokenizer_asset import (
    OUTSTANDING_SHARES,
    SHARE_ASA_ID,
    create_share_asset,
)
from tokenizer_authority import (
    INITIALIZED,
    _role_addresses,
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


def approval_program(*, network="localnet"):
    """Generate the immutable application with one fixed identity profile.

    Creation accepts no arguments.

    Supported post-creation selectors:
      create_share_asset
      initialize_seed
      restore_preinit

    No administrator, upgrade, deletion, arbitrary payment, configurable
    fees, migration, or post-initialization recovery capability is provided.
    """
    roles = _role_addresses(network)

    create = pt.Seq(
        pt.Assert(pt.Global.group_size() == pt.Int(1)),
        pt.Assert(pt.Txn.application_args.length() == pt.Int(0)),
        fixed_initializer_guard(network=network),
        *[
            pt.App.globalPut(key, pt.Int(0))
            for key in UINT_STATE_KEYS
        ],
        pt.App.globalPut(
            INITIALIZER_ADDRESS,
            pt.Addr(roles["creator_initializer"]),
        ),
        pt.App.globalPut(
            STAKING_ADDRESS,
            pt.Addr(roles["staking"]),
        ),
        pt.App.globalPut(
            SEED_RECIPIENT_ADDRESS,
            pt.Addr(roles["seed_recipient"]),
        ),
        pt.Approve(),
    )

    operate = pt.Seq(
        pt.Assert(pt.Txn.application_args.length() == pt.Int(1)),
        pt.Cond(
            [
                pt.Txn.application_args[0]
                == pt.Bytes("create_share_asset"),
                pt.Seq(
                    create_share_asset(network=network),
                    pt.Approve(),
                ),
            ],
            [
                pt.Txn.application_args[0]
                == pt.Bytes("initialize_seed"),
                pt.Seq(
                    initialize_seed(network=network),
                    pt.Approve(),
                ),
            ],
            [
                pt.Txn.application_args[0]
                == pt.Bytes("restore_preinit"),
                pt.Seq(
                    defensive_restore(network=network),
                    pt.Approve(),
                ),
            ],
        ),
    )

    return pt.Seq(
        outer_call_guard(),
        pt.If(pt.Txn.application_id() == pt.Int(0))
        .Then(create)
        .Else(operate),
    )


def clear_program():
    """No local state is used; clearing grants no capability."""
    return pt.Reject()