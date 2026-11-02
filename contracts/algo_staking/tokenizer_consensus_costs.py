"""Offline validation of supplied consensus parameters.

No network access or execution approval.
A matching entry does not prove that the running node loaded it.
"""


REVIEWED_COSTS = {
    "AppFlatParamsMinBalance": 100_000,
    "SchemaMinBalancePerEntry": 25_000,
    "SchemaUintMinBalance": 3_500,
    "SchemaBytesMinBalance": 25_000,
    "MinTxnFee": 1_000,
}


def creation_cost_projection(parameters, protocol):
    """Require an exact protocol entry and the reviewed cost schedule."""
    if not isinstance(parameters, dict):
        raise TypeError("Consensus parameters must be a dictionary")
    if not isinstance(protocol, str) or not protocol:
        raise ValueError("An explicit protocol identity is required")
    if protocol not in parameters:
        raise ValueError("Active protocol entry is missing")

    entry = parameters[protocol]
    if not isinstance(entry, dict):
        raise TypeError("Protocol entry must be a dictionary")

    for name, expected in REVIEWED_COSTS.items():
        if name not in entry:
            raise ValueError("Missing consensus parameter: " + name)
        actual = entry[name]
        if type(actual) is not int or actual != expected:
            raise ValueError("Unreviewed consensus parameter: " + name)

    # Fixed Day 1 creation: eight uints, three byte slices, zero extra pages.
    additional_minimum = (
        entry["AppFlatParamsMinBalance"]
        + 11 * entry["SchemaMinBalancePerEntry"]
        + 8 * entry["SchemaUintMinBalance"]
        + 3 * entry["SchemaBytesMinBalance"]
    )
    return {
        "protocol": protocol,
        "additional_minimum_microalgo": additional_minimum,
        "fee_microalgo": entry["MinTxnFee"],
        "node_loading_verified": False,
        "execution_authorized": False,
    }