"""Settled initialization policy for the disposable Day 1 Tokenizer.

Offline reference calculation only. No network access, signing, transaction
preparation, or custody changes occur here.

This version reserves no additional operating cushion. Do not carry that
choice into Day 2 or production without reviewing lifecycle expenses and
minimum-balance requirements.

No Folks Finance source is copied or adapted here.
"""

from seed_accounting import calculate_seed_shares


ADDITIONAL_OPERATING_RESERVE_MICROALGO = 0
OTHER_EXCLUDED_FUNDS_MICROALGO = 0
INITIAL_ACCRUED_ALGO_FEE_LIABILITY_MICROALGO = 0

SEED_SHARE_ATOMIC_UNITS_PER_MICROALGO = 1


def calculate_day1_seed_shares(
    *,
    staking_balance: int,
    staking_min_balance: int,
    available_share_inventory: int,
) -> int:
    """Apply the approved Day 1 policy to execution-time staking inputs.

    staking_balance and staking_min_balance must describe the designated
    staking account at initialization execution time. This offline function
    cannot verify their provenance.

    Application balance is deliberately not an input: application funding
    is not staking backing and must not generate seed ownership.

    Minimum balance is required, never hard-coded or defaulted. The shared
    calculation validates uint64 inputs, rejects unaffordable exclusions
    before subtraction, subtracts minimum balance once, and rejects zero
    backing or insufficient inventory.

    The returned quantity is the exact seed transfer amount and initial
    outstanding-share count, not the ASA's configured total supply.

    These Python constants are not on-chain immutability enforcement.
    The Tokenizer contract must independently enforce this policy and expose
    no method that changes additional reserve or other-exclusion settings.
    """
    return calculate_seed_shares(
        staking_balance=staking_balance,
        staking_min_balance=staking_min_balance,
        operating_reserve_above_minimum=(
            ADDITIONAL_OPERATING_RESERVE_MICROALGO
        ),
        other_excluded_funds=OTHER_EXCLUDED_FUNDS_MICROALGO,
        accrued_algo_fee_liability=(
            INITIAL_ACCRUED_ALGO_FEE_LIABILITY_MICROALGO
        ),
        available_share_inventory=available_share_inventory,
    )