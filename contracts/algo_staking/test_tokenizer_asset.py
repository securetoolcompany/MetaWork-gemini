"""Offline generated-TEAL checks for Day 1 share-ASA creation.

No network, wallets, signing, submission, or actual ASA creation.
These tests do not establish AVM rejection or live asset parameters.
"""

import unittest

import pyteal as pt

from tokenizer_asset import create_share_asset
from tokenizer_config import (
    SHARE_ASA_DECIMALS,
    SHARE_ASA_DEFAULT_FROZEN,
    SHARE_ASA_NAME,
    SHARE_ASA_TOTAL,
    SHARE_ASA_UNIT_NAME,
)
from tokenizer_localnet_config import CREATOR_INITIALIZER


class TokenizerAssetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        teal = pt.compileTeal(
            pt.Seq(create_share_asset(), pt.Approve()),
            mode=pt.Mode.Application,
            version=10,
        )
        cls.lines = [line.strip() for line in teal.splitlines()]

    def unique_sequence(self, sequence):
        matches = [
            index
            for index in range(len(self.lines) - len(sequence) + 1)
            if self.lines[index:index + len(sequence)] == sequence
        ]
        self.assertEqual(len(matches), 1, repr(sequence))
        return matches[0]

    def test_configuration_matches_reviewed_values(self):
        self.assertEqual(SHARE_ASA_NAME, "MetaWork Day1 Share")
        self.assertEqual(SHARE_ASA_UNIT_NAME, "MWD1")
        self.assertIs(type(SHARE_ASA_TOTAL), int)
        self.assertEqual(SHARE_ASA_TOTAL, 1_000_000_000_000_000)
        self.assertIs(type(SHARE_ASA_DECIMALS), int)
        self.assertEqual(SHARE_ASA_DECIMALS, 6)
        self.assertIs(SHARE_ASA_DEFAULT_FROZEN, False)

    def test_exact_single_inner_asset_creation(self):
        lines = self.lines
        self.assertEqual(lines.count("itxn_begin"), 1)
        self.assertEqual(lines.count("itxn_submit"), 1)

        begin = lines.index("itxn_begin")
        submit = lines.index("itxn_submit")
        self.assertLess(begin, submit)

        expected = [
            "int acfg",
            "itxn_field TypeEnum",
            "global CurrentApplicationAddress",
            "itxn_field Sender",
            "int 0",
            "itxn_field ConfigAsset",
            "int 1000000000000000",
            "itxn_field ConfigAssetTotal",
            "int 6",
            "itxn_field ConfigAssetDecimals",
            "int 0",
            "itxn_field ConfigAssetDefaultFrozen",
            'byte "MetaWork Day1 Share"',
            "itxn_field ConfigAssetName",
            'byte "MWD1"',
            "itxn_field ConfigAssetUnitName",
            "global ZeroAddress",
            "itxn_field ConfigAssetManager",
            "global CurrentApplicationAddress",
            "itxn_field ConfigAssetReserve",
            "global ZeroAddress",
            "itxn_field ConfigAssetFreeze",
            "global ZeroAddress",
            "itxn_field ConfigAssetClawback",
            "global ZeroAddress",
            "itxn_field RekeyTo",
            "int 0",
            "itxn_field Fee",
        ]
        self.assertEqual(lines[begin + 1:submit], expected)
        self.assertEqual(
            [line for line in lines if line.startswith("itxn_field ")],
            [line for line in expected if line.startswith("itxn_field ")],
        )

    def test_outer_dangerous_fields_are_guarded(self):
        guards = [
            ["txn OnCompletion", "int NoOp", "==", "assert"],
            ["txn RekeyTo", "global ZeroAddress", "==", "assert"],
            [
                "txn CloseRemainderTo",
                "global ZeroAddress",
                "==",
                "assert",
            ],
            ["txn AssetCloseTo", "global ZeroAddress", "==", "assert"],
        ]
        for guard in guards:
            with self.subTest(guard=guard):
                position = self.unique_sequence(guard)
                self.assertLess(position + len(guard) - 1,
                                self.lines.index("itxn_begin"))

    def test_existing_app_singleton_selector_and_initializer(self):
        guards = [
            ["txn ApplicationID", "int 0", ">", "assert"],
            ["global GroupSize", "int 1", "==", "assert"],
            ["txn NumAppArgs", "int 1", "==", "assert"],
            [
                "txna ApplicationArgs 0",
                'byte "create_share_asset"',
                "==",
                "assert",
            ],
            [
                "txn Sender",
                "addr " + CREATOR_INITIALIZER,
                "==",
                "assert",
            ],
        ]
        for guard in guards:
            with self.subTest(guard=guard):
                position = self.unique_sequence(guard)
                self.assertLess(position + len(guard) - 1,
                                self.lines.index("itxn_begin"))

    def test_three_required_state_values_exist_and_are_zero(self):
        for key in ("initialized", "share_asa_id", "outstanding_shares"):
            with self.subTest(key=key):
                position = self.unique_sequence([
                    "int 0",
                    'byte "' + key + '"',
                    "app_global_get_ex",
                ])
                following = self.lines[position + 3:position + 12]
                self.assertEqual(len(following), 9)

                # globalGetEx leaves the value and existence flag on stack.
                self.assertRegex(following[0], r"^store [0-9]+$")
                self.assertRegex(following[1], r"^store [0-9]+$")
                exists_slot = following[0].split()[1]
                value_slot = following[1].split()[1]
                self.assertNotEqual(exists_slot, value_slot)
                self.assertEqual(following[2:], [
                    "load " + exists_slot,
                    "assert",
                    "load " + value_slot,
                    "int 0",
                    "==",
                    "assert",
                    # The next instruction is outside this guard.
                    following[8],
                ])
                self.assertLess(position + 10,
                                self.lines.index("itxn_begin"))

    def test_caller_fee_covers_outer_and_one_inner_transaction(self):
        position = self.unique_sequence([
            "txn Fee",
            "global MinTxnFee",
            "int 2",
            "*",
            ">=",
            "assert",
        ])
        self.assertLess(position + 5, self.lines.index("itxn_begin"))

    def test_created_asset_id_is_positive_before_recording(self):
        position = self.unique_sequence([
            "itxn CreatedAssetID",
            "int 0",
            ">",
            "assert",
        ])
        self.assertGreater(position, self.lines.index("itxn_submit"))

        write = self.unique_sequence([
            'byte "share_asa_id"',
            "itxn CreatedAssetID",
            "app_global_put",
        ])
        self.assertLess(position + 3, write)

    def test_only_asset_id_is_written_without_ownership_issuance(self):
        self.assertEqual(self.lines.count("app_global_put"), 1)
        self.assertNotIn("app_global_del", self.lines)
        self.assertNotIn("itxn_field AssetAmount", self.lines)
        self.assertNotIn("itxn_field AssetReceiver", self.lines)


if __name__ == "__main__":
    unittest.main()