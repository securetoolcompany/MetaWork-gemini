"""Offline tests only; no node or wallet access."""

import unittest

from tokenizer_consensus_costs import (
    REVIEWED_COSTS,
    creation_cost_projection,
)


class TokenizerConsensusCostsTests(unittest.TestCase):
    def setUp(self):
        self.protocol = "synthetic-offline-test"
        self.parameters = {self.protocol: dict(REVIEWED_COSTS)}

    def test_reviewed_schedule_projects_without_authorizing(self):
        result = creation_cost_projection(self.parameters, self.protocol)
        self.assertEqual(result, {
            "protocol": self.protocol,
            "additional_minimum_microalgo": 478_000,
            "fee_microalgo": 1_000,
            "node_loading_verified": False,
            "execution_authorized": False,
        })

    def test_missing_active_protocol_does_not_use_other_entry(self):
        parameters = {"different-protocol": dict(REVIEWED_COSTS)}
        with self.assertRaisesRegex(
            ValueError, "^Active protocol entry is missing$"
        ):
            creation_cost_projection(parameters, self.protocol)

    def test_each_required_parameter_is_mandatory(self):
        for name in REVIEWED_COSTS:
            with self.subTest(parameter=name):
                entry = dict(REVIEWED_COSTS)
                del entry[name]
                with self.assertRaisesRegex(
                    ValueError, "^Missing consensus parameter: " + name + "$"
                ):
                    creation_cost_projection(
                        {self.protocol: entry}, self.protocol
                    )

    def test_each_parameter_requires_exact_integer_value(self):
        for name, expected in REVIEWED_COSTS.items():
            for invalid in (True, float(expected), str(expected), expected + 1):
                with self.subTest(parameter=name, invalid=invalid):
                    entry = dict(REVIEWED_COSTS)
                    entry[name] = invalid
                    with self.assertRaisesRegex(
                        ValueError,
                        "^Unreviewed consensus parameter: " + name + "$",
                    ):
                        creation_cost_projection(
                            {self.protocol: entry}, self.protocol
                        )

    def test_input_is_not_mutated(self):
        entry = dict(REVIEWED_COSTS)
        parameters = {self.protocol: entry}
        creation_cost_projection(parameters, self.protocol)
        self.assertEqual(entry, REVIEWED_COSTS)
        self.assertIs(parameters[self.protocol], entry)

    def test_invalid_input_shapes_are_rejected(self):
        with self.assertRaisesRegex(
            TypeError, "^Consensus parameters must be a dictionary$"
        ):
            creation_cost_projection([], self.protocol)
        for protocol in (None, "", 1):
            with self.subTest(protocol=protocol):
                with self.assertRaisesRegex(
                    ValueError, "^An explicit protocol identity is required$"
                ):
                    creation_cost_projection(self.parameters, protocol)
        with self.assertRaisesRegex(
            TypeError, "^Protocol entry must be a dictionary$"
        ):
            creation_cost_projection({self.protocol: []}, self.protocol)


if __name__ == "__main__":
    unittest.main()