"""Approved public identity configuration for the disposable Day 1 Tokenizer.

No secrets, network access, signing, funding, or transaction preparation.
Configuration assigns no privileges beyond the separately approved policy.
"""

import base64
from types import MappingProxyType

from algosdk import encoding

from localnet_safety import require_disposable_address


NETWORK = "localnet"
GENESIS_ID = "dockernet-v1"
GENESIS_HASH_BASE64 = "0TJVyrVwfL/CRhaQzRG1mF29GzfDdG4Dzr2M5uXbg2o="
GENESIS_HASH_BYTES = base64.b64decode(GENESIS_HASH_BASE64, validate=True)
CONTAINER_ID = (
    "b604c779920fde24732e79348e6cb7063fced4021c23b5a73fbb572ce96bd257"
)

CREATOR_INITIALIZER = (
    "QAVXZK43SGUJC7DQ2QC6LBWTAYCKDGOG7XUSFYQRJBE23GZMHN3ORHFG3M"
)
STAKING = (
    "V6C6BWQKI4LS3FCZEM5XIOHCM2SSQSIB7AXOIVSBHUNXVVEWMBWTMXRWFU"
)
SEED_RECIPIENT = (
    "JJOIC2KGZPABBPXRWF5JP67L3VVV5GJ334YQSTSQBS3QKZARUCUSKJER4Y"
)

APPROVED_ROLES = MappingProxyType(
    {
        "creator_initializer": CREATOR_INITIALIZER,
        "staking": STAKING,
        "seed_recipient": SEED_RECIPIENT,
    }
)

PRESERVED_PROOF_ADDRESSES = frozenset(
    {
        "HXMCSZ77QBA2EDFR2JKKFPUXHKL4AVP2666CKX5Q4AQWQCU3QJGZH62GPI",
        "UTXM245YRZLT7DV66OKQ2MVWPMGNZUVYQIIVJY6UYO7PB3WXL53GQNMMPQ",
        "2UL5373I33FB4VUN5OF5BIVRGXB47QZ7HDV3V2W4WFXRVFOWPTIDN2PGTQ",
        "QY6XONG5TIPFSSLAAMSOU2CXH4ZSE7ZAXSBQ7E2N3VVOFERZRKV7AWMGIQ",
    }
)


def validate_roles(roles):
    """Reject missing, additional, substituted, or overlapping roles."""
    if not isinstance(roles, dict):
        raise TypeError("Roles must be supplied as a dictionary")
    if set(roles) != set(APPROVED_ROLES):
        raise ValueError("Exactly the three approved Tokenizer roles are required")

    for role, address in roles.items():
        require_disposable_address(address)
        if address in PRESERVED_PROOF_ADDRESSES:
            raise ValueError("Preserved proof identities cannot be Tokenizer roles")
        if address != APPROVED_ROLES[role]:
            raise ValueError("Tokenizer role differs from approved identity")

    if len(set(roles.values())) != 3:
        raise ValueError("Tokenizer identities must be distinct")


def validate_network(*, network, genesis_id, genesis_hash_base64):
    """Compare supplied identity with the approved network binding.

    Callers must obtain live genesis separately and invoke this check before
    any future state-changing operation. This function performs no lookup.
    """
    if network != NETWORK or genesis_id != GENESIS_ID:
        raise ValueError("Approved Tokenizer LocalNet identity mismatch")
    if not isinstance(genesis_hash_base64, str):
        raise TypeError("Genesis hash must be a base64 string")

    decoded = base64.b64decode(genesis_hash_base64, validate=True)
    if len(decoded) != 32 or decoded != GENESIS_HASH_BYTES:
        raise ValueError("Approved Tokenizer genesis hash mismatch")


def validate_container(actual_container_id):
    if actual_container_id != CONTAINER_ID:
        raise ValueError("Approved Tokenizer container identity mismatch")


def approved_role_public_keys():
    """Return fresh decoded public-key values for future contract arguments."""
    validate_roles(dict(APPROVED_ROLES))
    return {
        role: encoding.decode_address(address)
        for role, address in APPROVED_ROLES.items()
    }