"""Offline generated-TEAL regression checks.

No network, wallets, identity generation, signing, or submission.
These checks do not establish AVM execution, branch reachability,
grouped-rekey visibility, or atomic rollback.
"""

import unittest

import pyteal as pt

from tokenizer_initialization import initialize_seed
from tokenizer_localnet_config import (
    CREATOR_INITIALIZER,
    SEED_RECIPIENT,
    STAKING,
)


def initialization_lines():
    teal = pt.compileTeal(
        pt.Seq(initialize_seed(), pt.Approve()),
        mode=pt.Mode.Application,
        version=10,
    )
    return [line.strip() for line in teal.splitlines()]


class TokenizerInitializationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lines = initialization_lines()

    def unique_sequence(self, sequence):
        matches = [
            index
            for index in range(len(self.lines) - len(sequence) + 1)
            if self.lines[index:index + len(sequence)] == sequence
        ]
        self.assertEqual(len(matches), 1, repr(sequence))
        return matches[0]

    def scratch_store(self, load):
        self.assertRegex(load, r"^load [0-9]+$")
        slot = load.split()[1]
        matches = [
            index
            for index, line in enumerate(self.lines)
            if line == "store " + slot
        ]
        self.assertEqual(len(matches), 1)
        return matches[0]

    def backing_details(self):
        amount_index = self.lines.index("itxn_field AssetAmount")
        backing_load = self.lines[amount_index - 1]
        store = self.scratch_store(backing_load)
        self.assertGreaterEqual(store, 3)
        self.assertEqual(self.lines[store - 1], "-")
        return (
            backing_load,
            store,
            self.lines[store - 3],
            self.lines[store - 2],
        )

    def test_exactly_one_inner_transfer_with_reviewed_fields(self):
        lines = self.lines
        self.assertEqual(lines.count("itxn_begin"), 1)
        self.assertEqual(lines.count("itxn_submit"), 1)
        begin = lines.index("itxn_begin")
        submit = lines.index("itxn_submit")
        self.assertLess(begin, submit)
        inner = lines[begin + 1:submit]

        expected_fields = [
            "itxn_field TypeEnum",
            "itxn_field Sender",
            "itxn_field XferAsset",
            "itxn_field AssetReceiver",
            "itxn_field AssetAmount",
            "itxn_field AssetSender",
            "itxn_field AssetCloseTo",
            "itxn_field RekeyTo",
            "itxn_field Fee",
        ]
        self.assertEqual(
            [line for line in inner if line.startswith("itxn_field ")],
            expected_fields,
        )
        self.assertEqual(
            [line for line in lines if line.startswith("itxn_field ")],
            expected_fields,
        )

        expected_values = {
            "TypeEnum": "int axfer",
            "Sender": "global CurrentApplicationAddress",
            "AssetReceiver": "addr " + SEED_RECIPIENT,
            "AssetSender": "global ZeroAddress",
            "AssetCloseTo": "global ZeroAddress",
            "RekeyTo": "global ZeroAddress",
            "Fee": "int 0",
        }
        for field, expected in expected_values.items():
            with self.subTest(field=field):
                index = inner.index("itxn_field " + field)
                self.assertGreater(index, 0)
                self.assertEqual(inner[index - 1], expected)

    def test_only_reviewed_accounting_keys_are_written(self):
        lines = self.lines
        writes = [
            index for index, line in enumerate(lines)
            if line == "app_global_put"
        ]
        self.assertEqual(len(writes), 3)
        self.assertEqual(
            [lines[index - 2] for index in writes],
            [
                'byte "outstanding_shares"',
                'byte "backing_baseline"',
                'byte "initialized"',
            ],
        )
        self.assertEqual(lines[writes[-1] - 1], "int 1")
        self.assertLess(lines.index("itxn_submit"), writes[0])
        self.assertNotIn("app_global_del", lines)

    def test_transfer_and_accounting_use_same_backing_scratch_value(self):
        backing_load, store, balance_load, minimum_load = (
            self.backing_details()
        )
        self.assertRegex(balance_load, r"^load [0-9]+$")
        self.assertRegex(minimum_load, r"^load [0-9]+$")
        self.assertNotEqual(balance_load, minimum_load)
        self.assertLess(store, self.lines.index("itxn_begin"))

        for key in ("outstanding_shares", "backing_baseline"):
            with self.subTest(key=key):
                self.unique_sequence([
                    'byte "' + key + '"',
                    backing_load,
                    "app_global_put",
                ])

    def test_backing_subtracts_staking_minimum_from_staking_balance(self):
        _, backing_store, balance_load, minimum_load = (
            self.backing_details()
        )
        for load, opcode in (
            (balance_load, "balance"),
            (minimum_load, "min_balance"),
        ):
            with self.subTest(opcode=opcode):
                store = self.scratch_store(load)
                self.assertGreaterEqual(store, 2)
                self.assertEqual(
                    self.lines[store - 2:store],
                    ["addr " + STAKING, opcode],
                )
                self.assertLess(store, backing_store)

    def test_backing_and_inventory_bounds_precede_transfer(self):
        backing_load, store, balance_load, minimum_load = (
            self.backing_details()
        )
        underflow = self.unique_sequence([
            balance_load, minimum_load, ">=", "assert",
        ])
        positive = self.unique_sequence([
            backing_load, "int 0", ">", "assert",
        ])

        inner_begin = self.lines.index("itxn_begin")
        inventory = [
            index
            for index in range(1, inner_begin - 2)
            if self.lines[index:index + 3]
            == [backing_load, ">=", "assert"]
            and self.lines[index - 1].startswith("load ")
        ]
        self.assertEqual(len(inventory), 1)
        self.assertLess(underflow + 3, store)
        self.assertLess(store, positive)
        self.assertLess(positive + 3, inventory[0])
        self.assertLess(inventory[0] + 2, inner_begin)

    def test_caller_funds_outer_group_and_one_inner_transaction(self):
        fee_guard = self.unique_sequence([
            "txn Fee",
            "global MinTxnFee",
            "global GroupSize",
            "int 1",
            "+",
            "*",
            ">=",
            "assert",
        ])
        self.assertLess(fee_guard + 7, self.lines.index("itxn_begin"))

        for index in (0, 1):
            with self.subTest(transaction=index):
                self.unique_sequence([
                    "gtxn " + str(index) + " Fee",
                    "int 0",
                    "==",
                    "assert",
                ])

    def test_grouped_transactions_pin_roles_and_rekey_destination(self):
        guards = [
            ["gtxn 0 TypeEnum", "int pay", "==", "assert"],
            ["gtxn 0 Sender", "addr " + STAKING, "==", "assert"],
            ["gtxn 0 Receiver", "addr " + STAKING, "==", "assert"],
            ["gtxn 0 Amount", "int 0", "==", "assert"],
            [
                "gtxn 0 RekeyTo",
                "global CurrentApplicationAddress",
                "==",
                "assert",
            ],
            ["gtxn 1 TypeEnum", "int axfer", "==", "assert"],
            [
                "gtxn 1 Sender",
                "addr " + SEED_RECIPIENT,
                "==",
                "assert",
            ],
            [
                "gtxn 1 AssetReceiver",
                "addr " + SEED_RECIPIENT,
                "==",
                "assert",
            ],
            ["gtxn 1 AssetAmount", "int 0", "==", "assert"],
        ]
        for guard in guards:
            with self.subTest(guard=guard):
                self.unique_sequence(guard)

    def test_grouped_close_and_optional_opt_in_rekey_are_forbidden(self):
        fields = [
            "gtxn 0 CloseRemainderTo",
            "gtxn 1 AssetSender",
            "gtxn 1 AssetCloseTo",
            "gtxn 1 CloseRemainderTo",
            "gtxn 1 RekeyTo",
        ]
        for field in fields:
            with self.subTest(field=field):
                self.unique_sequence([
                    field, "global ZeroAddress", "==", "assert",
                ])

    def test_initializer_selector_and_existing_application_are_checked(self):
        guards = [
            ["txn ApplicationID", "int 0", ">", "assert"],
            [
                "txn Sender",
                "addr " + CREATOR_INITIALIZER,
                "==",
                "assert",
            ],
            ["txn NumAppArgs", "int 1", "==", "assert"],
            [
                "txna ApplicationArgs 0",
                'byte "initialize_seed"',
                "==",
                "assert",
            ],
        ]
        for guard in guards:
            with self.subTest(guard=guard):
                self.unique_sequence(guard)

    def test_application_call_must_be_last_in_group(self):
        self.unique_sequence([
            "txn GroupIndex",
            "global GroupSize",
            "int 1",
            "-",
            "==",
            "assert",
        ])


if __name__ == "__main__":
    unittest.main()