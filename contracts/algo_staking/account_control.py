"""Disposable account-control proof only. Not the Tokenizer contract."""

import pyteal as pt


GLOBAL_UINTS = 3
GLOBAL_BYTES = 3

OPERATOR = pt.Bytes("operator")
STAKING = pt.Bytes("staking")
RECIPIENT = pt.Bytes("recipient")
AMOUNT = pt.Bytes("amount")
PAID = pt.Bytes("paid")
RESTORED = pt.Bytes("restored")

PRODUCTION_ADDRESS = pt.Addr(
    "73C6PQVLAPE6M2GFV3ZKXJRHCNZ4P75GY3LMTHJ7MS2MALZJ6RRJKNWHBU"
)


def approval_program():
    """Creation args: operator, staking, recipient, uint64 payment amount."""

    operator = pt.App.globalGet(OPERATOR)
    staking = pt.App.globalGet(STAKING)
    recipient = pt.App.globalGet(RECIPIENT)

    create = pt.Seq(
        pt.Assert(pt.Txn.application_args.length() == pt.Int(4)),
        pt.Assert(pt.Len(pt.Txn.application_args[0]) == pt.Int(32)),
        pt.Assert(pt.Len(pt.Txn.application_args[1]) == pt.Int(32)),
        pt.Assert(pt.Len(pt.Txn.application_args[2]) == pt.Int(32)),
        pt.Assert(pt.Len(pt.Txn.application_args[3]) == pt.Int(8)),
        pt.Assert(pt.Txn.application_args[0] != pt.Global.zero_address()),
        pt.Assert(pt.Txn.application_args[1] != pt.Global.zero_address()),
        pt.Assert(pt.Txn.application_args[2] != pt.Global.zero_address()),
        pt.Assert(pt.Txn.application_args[0] != PRODUCTION_ADDRESS),
        pt.Assert(pt.Txn.application_args[1] != PRODUCTION_ADDRESS),
        pt.Assert(pt.Txn.application_args[2] != PRODUCTION_ADDRESS),
        pt.Assert(pt.Txn.sender() == pt.Txn.application_args[0]),
        pt.Assert(pt.Btoi(pt.Txn.application_args[3]) > pt.Int(0)),
        pt.App.globalPut(OPERATOR, pt.Txn.application_args[0]),
        pt.App.globalPut(STAKING, pt.Txn.application_args[1]),
        pt.App.globalPut(RECIPIENT, pt.Txn.application_args[2]),
        pt.App.globalPut(AMOUNT, pt.Btoi(pt.Txn.application_args[3])),
        pt.App.globalPut(PAID, pt.Int(0)),
        pt.App.globalPut(RESTORED, pt.Int(0)),
        pt.Approve(),
    )

    authority = pt.AccountParam.authAddr(staking)

    pay_once = pt.Seq(
        pt.Assert(pt.App.globalGet(PAID) == pt.Int(0)),
        pt.InnerTxnBuilder.Begin(),
        pt.InnerTxnBuilder.SetFields(
            {
                pt.TxnField.type_enum: pt.TxnType.Payment,
                pt.TxnField.sender: staking,
                pt.TxnField.receiver: recipient,
                pt.TxnField.amount: pt.App.globalGet(AMOUNT),
                # CloseRemainderTo and RekeyTo remain unset: both default zero.
                pt.TxnField.fee: pt.Int(0),
            }
        ),
        pt.InnerTxnBuilder.Submit(),
        pt.App.globalPut(PAID, pt.Int(1)),
        pt.Approve(),
    )

    restore = pt.Seq(
        pt.InnerTxnBuilder.Begin(),
        pt.InnerTxnBuilder.SetFields(
            {
                pt.TxnField.type_enum: pt.TxnType.Payment,
                pt.TxnField.sender: staking,
                pt.TxnField.receiver: staking,
                pt.TxnField.amount: pt.Int(0),
                # CloseRemainderTo remains unset: no account close-out.
                pt.TxnField.rekey_to: staking,
                pt.TxnField.fee: pt.Int(0),
            }
        ),
        pt.InnerTxnBuilder.Submit(),
        pt.App.globalPut(RESTORED, pt.Int(1)),
        pt.Approve(),
    )

    operate = pt.Seq(
        pt.Assert(pt.Txn.sender() == operator),
        pt.Assert(pt.Txn.application_args.length() == pt.Int(1)),
        pt.Assert(pt.App.globalGet(RESTORED) == pt.Int(0)),
        authority,
        pt.Assert(authority.hasValue()),
        pt.Assert(
            authority.value() == pt.Global.current_application_address()
        ),
        pt.Cond(
            [pt.Txn.application_args[0] == pt.Bytes("pay_once"), pay_once],
            [pt.Txn.application_args[0] == pt.Bytes("restore"), restore],
        ),
    )

    return pt.Seq(
        pt.Assert(pt.Global.group_size() == pt.Int(1)),
        pt.Assert(pt.Txn.rekey_to() == pt.Global.zero_address()),
        pt.Assert(pt.Txn.close_remainder_to() == pt.Global.zero_address()),
        pt.Assert(pt.Txn.asset_close_to() == pt.Global.zero_address()),
        pt.Assert(pt.Txn.on_completion() == pt.OnComplete.NoOp),
        pt.If(pt.Txn.application_id() == pt.Int(0))
        .Then(create)
        .Else(operate),
    )


def clear_program():
    """No local state or clear-state functionality is used."""
    return pt.Reject()