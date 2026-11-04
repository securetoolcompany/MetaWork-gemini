"""Explicit public TestNet configuration for the disposable Day 1 Tokenizer.

Import performs no I/O, network access, identity creation, or wallet access.
Address selection is not proof of key control. No execution is authorized.
"""

import base64
import binascii
import hashlib
import hmac
from types import MappingProxyType

NETWORK = "testnet"
ALGOD_URL = "https://testnet-api.algonode.cloud"
GENESIS_ID = "testnet-v1.0"
GENESIS_HASH_BASE64 = "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
GENESIS_HASH_BYTES = base64.b64decode(GENESIS_HASH_BASE64, validate=True)
SIGNING_ARRANGEMENT = "pera-wallet"

CREATOR_INITIALIZER = "BR5RLDLNCHCXHATTP7GVWGAUJTBREOXPUAYUMKHX5YDZFTVR3XEGPNQN2Y"
STAKING = "7IWKOOY22UXFIWDRPAONF7HJC2TPICOPHHG3TUIPPZLJWDKDXQ3K6SOFAM"
SEED_RECIPIENT = "COYJN7VFKE4FJO4BSUSYQA56GIE6CL6MUJLA5YY2HR47Z5RX2GH27TUOTE"

APPROVED_ROLES = MappingProxyType({
    "creator_initializer": CREATOR_INITIALIZER,
    "staking": STAKING,
    "seed_recipient": SEED_RECIPIENT,
})

# Existing protected and LocalNet proof identities are not TestNet roles.
PROTECTED_ADDRESSES = frozenset({
    "73C6PQVLAPE6M2GFV3ZKXJRHCNZ4P75GY3LMTHJ7MS2MALZJ6RRJKNWHBU",
    "QAVXZK43SGUJC7DQ2QC6LBWTAYCKDGOG7XUSFYQRJBE23GZMHN3ORHFG3M",
    "V6C6BWQKI4LS3FCZEM5XIOHCM2SSQSIB7AXOIVSBHUNXVVEWMBWTMXRWFU",
    "JJOIC2KGZPABBPXRWF5JP67L3VVV5GJ334YQSTSQBS3QKZARUCUSKJER4Y",
    "HXMCSZ77QBA2EDFR2JKKFPUXHKL4AVP2666CKX5Q4AQWQCU3QJGZH62GPI",
    "UTXM245YRZLT7DV66OKQ2MVWPMGNZUVYQIIVJY6UYO7PB3WXL53GQNMMPQ",
    "2UL5373I33FB4VUN5OF5BIVRGXB47QZ7HDV3V2W4WFXRVFOWPTIDN2PGTQ",
    "QY6XONG5TIPFSSLAAMSOU2CXH4ZSE7ZAXSBQ7E2N3VVOFERZRKV7AWMGIQ",
})


def decode_public_address(address):
    """Decode a canonical Algorand address and verify its checksum offline."""
    if not isinstance(address, str):
        raise TypeError("Role address must be a string")
    if len(address) != 58 or any(c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" for c in address):
        raise ValueError("Role address must be canonical Algorand base32")
    try:
        decoded = base64.b32decode(address + "======", casefold=False)
    except (ValueError, binascii.Error) as error:
        raise ValueError("Invalid role address encoding") from error
    if len(decoded) != 36:
        raise ValueError("Invalid role address length")
    if base64.b32encode(decoded).decode("ascii").rstrip("=") != address:
        raise ValueError("Noncanonical role address encoding")
    key, checksum = decoded[:32], decoded[32:]
    expected = hashlib.new("sha512_256", key).digest()[-4:]
    if not hmac.compare_digest(checksum, expected):
        raise ValueError("Invalid role address checksum")
    if key == bytes(32) or address in PROTECTED_ADDRESSES:
        raise ValueError("Zero, protected, or preserved LocalNet role forbidden")
    return key


def validate_roles(roles):
    if not isinstance(roles, dict):
        raise TypeError("Roles must be supplied as a dictionary")
    if set(roles) != set(APPROVED_ROLES):
        raise ValueError("Exactly the three selected TestNet roles are required")
    for role, address in roles.items():
        decode_public_address(address)
        if address != APPROVED_ROLES[role]:
            raise ValueError("TestNet role differs from selected public identity")
    if len(set(roles.values())) != 3:
        raise ValueError("TestNet role addresses must be distinct")


def validate_endpoint(algod_url):
    if algod_url != ALGOD_URL:
        raise ValueError("Only the explicitly selected HTTPS TestNet endpoint is permitted")


def validate_network(*, network, genesis_id, genesis_hash_base64):
    """Check supplied identity; callers must obtain live values separately.

    A matching hostname or network label alone never establishes TestNet.
    This function intentionally performs no lookup.
    """
    if network != NETWORK or genesis_id != GENESIS_ID:
        raise ValueError("Explicit TestNet selection and genesis ID required; MainNet refused")
    if not isinstance(genesis_hash_base64, str):
        raise TypeError("Genesis hash must be a base64 string")
    try:
        decoded = base64.b64decode(genesis_hash_base64, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError("Invalid genesis hash encoding") from error
    if len(decoded) != 32 or decoded != GENESIS_HASH_BYTES:
        raise ValueError("Selected TestNet genesis hash mismatch")
    if genesis_hash_base64 != GENESIS_HASH_BASE64:
        raise ValueError("Noncanonical TestNet genesis hash")


def approved_role_public_keys():
    roles = dict(APPROVED_ROLES)
    validate_roles(roles)
    return {role: decode_public_address(address) for role, address in roles.items()}