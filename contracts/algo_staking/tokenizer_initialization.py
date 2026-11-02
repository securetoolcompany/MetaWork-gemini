"""Atomic initialization expression for the disposable Day 1 Tokenizer.

Not a complete application or deployment entry point. Importing this module
does not access the network, sign, submit, or change custody.
"""

import pyteal as pt

from tokenizer_asset import OUTSTANDING_SHARES, SHARE_ASA_ID
from tokenizer_authority import (
    INITIALIZED,
    fixed_initializer_guard,
    outer_call_guard,
)
from tokenizer_localnet_config import SEED_RECIPIENT, STAKING


OPERATING_RESERVE = pt.Bytes("operating_reserve")
OTHER_EXCLUSIONS = pt.Bytes("other_exclusions")
FEE_RATE = pt.Bytes("fee_rate")
FEE_LIABILITY = pt.Bytes("fee_liability")
BACKING_BASELINE = pt.Bytes("backing_baseline")


def _require_zero_state(key):
    value = pt.App.globalGetEx(pt.Int(0), key)
    return pt.Seq(
        value,
        pt.Assert(value.hasValue()),
        pt.Assert(value.value() == pt.Int(0)),
    )


def initialize_seed():
    """Validate one of exactly two approved initialization group shapes.

    Two transactions:
      0: staking zero-value self-payment, rekeying to this application.
      1: initializer application call; recipient is already opted in.

    Three transactions:
      0: the same designated staking rekey.
      1: recipient zero-value share-ASA self-transfer.
      2: initializer application call.

    Staking rekey and optional opt-in have zero fees. The initializer's
    application call funds all outer transactions and one inner share transfer.
    No standalone custody-binding method is provided.
    """
    staking = pt.Addr(STAKING)
    recipient = pt.Addr(SEED_RECIPIENT)
    asset_id = pt.App.globalGet(SHARE_ASA_ID)

    authority = pt.AccountParam.authAddr(staking)
    inventory = pt.AssetHolding.balance(
        pt.Global.current_application_address(), asset_id
    )
    recipient_holding = pt.AssetHolding.balance(recipient, asset_id)

    balance = pt.ScratchVar(pt.TealType.uint64)
    minimum = pt.ScratchVar(pt.TealType.uint64)
    backing = pt.ScratchVar(pt.TealType.uint64)

    rekey = pt.Gtxn[0]
    opt_in = pt.Gtxn[1]

    return pt.Seq(
        outer_call_guard(),
        pt.Assert(pt.Txn.application_id() > pt.Int(0)),
        fixed_initializer_guard(),
        pt.Assert(pt.Txn.application_args.length() == pt.Int(1)),
        pt.Assert(pt.Txn.application_args[0] == pt.Bytes("initialize_seed")),
        pt.Assert(
            pt.Or(
                pt.Global.group_size() == pt.Int(2),
                pt.Global.group_size() == pt.Int(3),
            )
        ),
        pt.Assert(
            pt.Txn.group_index() == pt.Global.group_size() - pt.Int(1)
        ),
        _require_zero_state(INITIALIZED),
        _require_zero_state(OUTSTANDING_SHARES),
        _require_zero_state(OPERATING_RESERVE),
        _require_zero_state(OTHER_EXCLUSIONS),
        _require_zero_state(FEE_RATE),
        _require_zero_state(FEE_LIABILITY),
        _require_zero_state(BACKING_BASELINE),
        pt.Assert(asset_id > pt.Int(0)),
        pt.Assert(rekey.type_enum() == pt.TxnType.Payment),
        pt.Assert(rekey.sender() == staking),
        pt.Assert(rekey.receiver() == staking),
        pt.Assert(rekey.amount() == pt.Int(0)),
        pt.Assert(rekey.fee() == pt.Int(0)),
        pt.Assert(rekey.close_remainder_to() == pt.Global.zero_address()),
        pt.Assert(
            rekey.rekey_to() == pt.Global.current_application_address()
        ),
        pt.If(pt.Global.group_size() == pt.Int(3)).Then(
            pt.Seq(
                pt.Assert(opt_in.type_enum() == pt.TxnType.AssetTransfer),
                pt.Assert(opt_in.sender() == recipient),
                pt.Assert(opt_in.asset_receiver() == recipient),
                pt.Assert(opt_in.xfer_asset() == asset_id),
                pt.Assert(opt_in.asset_amount() == pt.Int(0)),
                pt.Assert(opt_in.asset_sender() == pt.Global.zero_address()),
                pt.Assert(opt_in.asset_close_to() == pt.Global.zero_address()),
                pt.Assert(
                    opt_in.close_remainder_to() == pt.Global.zero_address()
                ),
                pt.Assert(opt_in.rekey_to() == pt.Global.zero_address()),
                pt.Assert(opt_in.fee() == pt.Int(0)),
            )
        ),
        pt.Assert(
            pt.Txn.fee()
            >= pt.Global.min_txn_fee()
            * (pt.Global.group_size() + pt.Int(1))
        ),
        authority,
        pt.Assert(authority.hasValue()),
        pt.Assert(
            authority.value() == pt.Global.current_application_address()
        ),
        recipient_holding,
        pt.Assert(recipient_holding.hasValue()),
        inventory,
        pt.Assert(inventory.hasValue()),
        balance.store(pt.Balance(staking)),
        minimum.store(pt.MinBalance(staking)),
        pt.Assert(balance.load() >= minimum.load()),
        backing.store(balance.load() - minimum.load()),
        pt.Assert(backing.load() > pt.Int(0)),
        pt.Assert(inventory.value() >= backing.load()),
        pt.InnerTxnBuilder.Begin(),
        pt.InnerTxnBuilder.SetFields(
            {
                pt.TxnField.type_enum: pt.TxnType.AssetTransfer,
                pt.TxnField.sender: pt.Global.current_application_address(),
                pt.TxnField.xfer_asset: asset_id,
                pt.TxnField.asset_receiver: recipient,
                pt.TxnField.asset_amount: backing.load(),
                pt.TxnField.asset_sender: pt.Global.zero_address(),
                pt.TxnField.asset_close_to: pt.Global.zero_address(),
                pt.TxnField.rekey_to: pt.Global.zero_address(),
                pt.TxnField.fee: pt.Int(0),
            }
        ),
        pt.InnerTxnBuilder.Submit(),
        pt.App.globalPut(OUTSTANDING_SHARES, backing.load()),
        pt.App.globalPut(BACKING_BASELINE, backing.load()),
        pt.App.globalPut(INITIALIZED, pt.Int(1)),
    )