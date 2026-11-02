"""Offline reference calculation for disposable Day 1 seed issuance.

No network access, identity creation, signing, or transaction preparation.

Inputs must come from execution-time state and explicitly approved policy.
This module does not approve exclusions, establish their independence, or
implement on-chain enforcement. It is not a deposit/redemption calculator.
"""


UINT64_MAX = (1 << 64) - 1


def _require_uint64(name: str, value: int) -> int:
    if type(value) is not int:
        raise TypeError(f"{name} must be an integer, not a boolean or float")
    if value < 0 or value > UINT64_MAX:
        raise ValueError(f"{name} must be within uint64 range")
    return value


def calculate_seed_shares(
    *,
    staking_balance: int,
    staking_min_balance: int,
    operating_reserve_above_minimum: int,
    other_excluded_funds: int,
    accrued_algo_fee_liability: int,
    available_share_inventory: int,
) -> int:
    """Return initialization-only shares at one atomic unit per microALGO.

    All amounts are atomic units. Every input is required: there are no
    historical-balance, reserve, fee-liability, or inventory defaults.

    The caller must establish that exclusion categories do not overlap.
    Operating reserve is additional to minimum balance, not inclusive of it.
    Application funding must not be included in staking_balance.

    On successful atomic initialization, the contract must transfer exactly
    this many shares and set initial outstanding shares to that same amount.
    Merely calling this function performs neither action.
    """
    amounts = {
        "staking_balance": staking_balance,
        "staking_min_balance": staking_min_balance,
        "operating_reserve_above_minimum": operating_reserve_above_minimum,
        "other_excluded_funds": other_excluded_funds,
        "accrued_algo_fee_liability": accrued_algo_fee_liability,
        "available_share_inventory": available_share_inventory,
    }
    for name, value in amounts.items():
        _require_uint64(name, value)

    # Subtract each exclusion only after checking affordability. This avoids
    # relying on an exclusion sum that could overflow uint64 in the contract.
    backing = staking_balance
    for name in (
        "staking_min_balance",
        "operating_reserve_above_minimum",
        "other_excluded_funds",
        "accrued_algo_fee_liability",
    ):
        exclusion = amounts[name]
        if exclusion > backing:
            raise ValueError("exclusions exceed staking balance")
        backing -= exclusion

    if backing == 0:
        raise ValueError("redeemable seed backing must be positive")
    if backing > available_share_inventory:
        raise ValueError("insufficient share inventory")

    return backing