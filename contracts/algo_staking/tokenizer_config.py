"""Approved disposable Day 1 Tokenizer share-ASA configuration.

Configuration only: importing this module performs no network access,
creates no identities, and prepares or submits no transactions.

No Folks Finance source is copied or adapted here.
"""

from types import MappingProxyType


ZERO_ADDRESS_BYTES = bytes(32)

SHARE_ASA_NAME = "MetaWork Day1 Share"
SHARE_ASA_UNIT_NAME = "MWD1"
SHARE_ASA_DECIMALS = 6
SHARE_ASA_TOTAL = 1_000_000_000_000_000
SHARE_ASA_DEFAULT_FROZEN = False

SHARE_ASA_MANAGER = ZERO_ADDRESS_BYTES
SHARE_ASA_FREEZE = ZERO_ADDRESS_BYTES
SHARE_ASA_CLAWBACK = ZERO_ADDRESS_BYTES

# Resolve these roles to the current application address inside the contract.
# The reserve field is metadata, not enforcement of inventory or ownership.
SHARE_ASA_CREATOR_ROLE = "tokenizer_application"
SHARE_ASA_INITIAL_HOLDER_ROLE = "tokenizer_application"
SHARE_ASA_RESERVE_ROLE = "tokenizer_application"

# Configured total supply is not outstanding ownership. The contract must
# maintain a separate outstanding-share counter and verify actual holdings.
#
# No seed conversion ratio is specified here. It requires explicit approval
# before seed-issuance implementation.

APPROVED_SHARE_ASA_CONFIG = MappingProxyType(
    {
        "name": SHARE_ASA_NAME,
        "unit_name": SHARE_ASA_UNIT_NAME,
        "decimals": SHARE_ASA_DECIMALS,
        "total": SHARE_ASA_TOTAL,
        "default_frozen": SHARE_ASA_DEFAULT_FROZEN,
        "creator_role": SHARE_ASA_CREATOR_ROLE,
        "initial_holder_role": SHARE_ASA_INITIAL_HOLDER_ROLE,
        "reserve_role": SHARE_ASA_RESERVE_ROLE,
        "manager": SHARE_ASA_MANAGER,
        "freeze": SHARE_ASA_FREEZE,
        "clawback": SHARE_ASA_CLAWBACK,
    }
)