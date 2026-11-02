"""Share-ASA creation expression for the disposable Day 1 Tokenizer.

Not a complete application or deployment entry point. No network access,
signing, transaction submission, or asset creation occurs on import.

Independently implemented from approved MetaWork policy.
"""

import pyteal as pt

from tokenizer_authority import (
    INITIALIZED,
    fixed_initializer_guard,
    outer_call_guard,
)
from tokenizer_config import (
    SHARE_ASA_DECIMALS,
    SHARE_ASA_DEFAULT_FROZEN,
    SHARE_ASA_NAME,
    SHARE_ASA_TOTAL,
    SHARE_ASA_UNIT_NAME,
)


# The complete contract must initialize both keys to zero during creation.
# Outstanding ownership changes only through supported ownership operations,
# never merely because the ASA exists or inventory is held by the application.
SHARE_ASA_ID = pt.Bytes("share_asa_id")
OUTSTANDING_SHARES = pt.Bytes("outstanding_shares")


def create_share_asset():
    """Create exactly one fixed-supply ASA before seed initialization.

    The fixed initializer funds the outer fee pool. Application funding for
    minimum-balance requirements must already exist and is not seed backing.

    The caller cannot supply asset parameters or an alternative recipient.
    This expression does not issue seed ownership or change outstanding shares.
    The complete dispatcher must approve only after this expression succeeds.
    """
    initialized = pt.App.globalGetEx(pt.Int(0), INITIALIZED)
    asset_id = pt.App.globalGetEx(pt.Int(0), SHARE_ASA_ID)
    outstanding = pt.App.globalGetEx(pt.Int(0), OUTSTANDING_SHARES)

    return pt.Seq(
        outer_call_guard(),
        pt.Assert(pt.Txn.application_id() > pt.Int(0)),
        pt.Assert(pt.Global.group_size() == pt.Int(1)),
        pt.Assert(pt.Txn.application_args.length() == pt.Int(1)),
        pt.Assert(pt.Txn.application_args[0] == pt.Bytes("create_share_asset")),
        fixed_initializer_guard(),
        initialized,
        pt.Assert(initialized.hasValue()),
        pt.Assert(initialized.value() == pt.Int(0)),
        asset_id,
        pt.Assert(asset_id.hasValue()),
        pt.Assert(asset_id.value() == pt.Int(0)),
        outstanding,
        pt.Assert(outstanding.hasValue()),
        pt.Assert(outstanding.value() == pt.Int(0)),
        pt.Assert(pt.Txn.fee() >= pt.Global.min_txn_fee() * pt.Int(2)),
        pt.InnerTxnBuilder.Begin(),
        pt.InnerTxnBuilder.SetFields(
            {
                pt.TxnField.type_enum: pt.TxnType.AssetConfig,
                pt.TxnField.sender: pt.Global.current_application_address(),
                pt.TxnField.config_asset: pt.Int(0),
                pt.TxnField.config_asset_total: pt.Int(SHARE_ASA_TOTAL),
                pt.TxnField.config_asset_decimals: pt.Int(SHARE_ASA_DECIMALS),
                pt.TxnField.config_asset_default_frozen: pt.Int(
                    int(SHARE_ASA_DEFAULT_FROZEN)
                ),
                pt.TxnField.config_asset_name: pt.Bytes(SHARE_ASA_NAME),
                pt.TxnField.config_asset_unit_name: pt.Bytes(
                    SHARE_ASA_UNIT_NAME
                ),
                pt.TxnField.config_asset_manager: pt.Global.zero_address(),
                pt.TxnField.config_asset_reserve: (
                    pt.Global.current_application_address()
                ),
                pt.TxnField.config_asset_freeze: pt.Global.zero_address(),
                pt.TxnField.config_asset_clawback: pt.Global.zero_address(),
                pt.TxnField.rekey_to: pt.Global.zero_address(),
                pt.TxnField.fee: pt.Int(0),
            }
        ),
        pt.InnerTxnBuilder.Submit(),
        pt.Assert(pt.InnerTxn.created_asset_id() > pt.Int(0)),
        pt.App.globalPut(SHARE_ASA_ID, pt.InnerTxn.created_asset_id()),
    )