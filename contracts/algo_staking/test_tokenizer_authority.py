"""Offline PyTeal-generation checks, not AVM execution evidence."""

import unittest

import pyteal as pt

from tokenizer_authority import (
    fixed_initializer_guard,
    outer_call_guard,
)
from tokenizer_localnet_config import CREATOR_INITIALIZER


def compile_guard(guard):
    return pt.compileTeal(
        pt.Seq(guard, pt.Approve()),
        mode=pt.Mode.Application,
        version=10,
    )


class TokenizerAuthorityTests(unittest.TestCase):
    def test_outer_guard_matches_all_four_required_assertions(self):
        expected = pt.Seq(
            pt.Assert(pt.Txn.on_completion() == pt.OnComplete.NoOp),
            pt.Assert(pt.Txn.rekey_to() == pt.Global.zero_address()),
            pt.Assert(
                pt.Txn.close_remainder_to() == pt.Global.zero_address()
            ),
            pt.Assert(pt.Txn.asset_close_to() == pt.Global.zero_address()),
        )
        self.assertEqual(
            compile_guard(outer_call_guard()),
            compile_guard(expected),
        )

    def test_outer_guard_generates_four_assertions(self):
        teal = compile_guard(outer_call_guard())
        lines = [line.strip() for line in teal.splitlines()]
        self.assertEqual(lines.count("assert"), 4)
        for field in (
            "OnCompletion",
            "RekeyTo",
            "CloseRemainderTo",
            "AssetCloseTo",
        ):
            with self.subTest(field=field):
                self.assertIn("txn " + field, lines)
    def test_restoration_generates_only_reviewed_inner_payment_fields(self):
        from tokenizer_authority import defensive_restore
        from tokenizer_localnet_config import STAKING

        teal = compile_guard(defensive_restore())
        lines = [line.strip() for line in teal.splitlines()]

        self.assertEqual(lines.count("itxn_begin"), 1)
        self.assertEqual(lines.count("itxn_submit"), 1)

        begin = lines.index("itxn_begin")
        submit = lines.index("itxn_submit")
        self.assertLess(begin, submit)

        expected_inner = [
            "int pay",
            "itxn_field TypeEnum",
            "addr " + STAKING,
            "itxn_field Sender",
            "addr " + STAKING,
            "itxn_field Receiver",
            "int 0",
            "itxn_field Amount",
            "global ZeroAddress",
            "itxn_field CloseRemainderTo",
            "addr " + STAKING,
            "itxn_field RekeyTo",
            "int 0",
            "itxn_field Fee",
        ]
        self.assertEqual(lines[begin + 1:submit], expected_inner)

        all_inner_fields = [
            line for line in lines if line.startswith("itxn_field ")
        ]
        self.assertEqual(
            all_inner_fields,
            [
                line for line in expected_inner
                if line.startswith("itxn_field ")
            ],
        )
    def test_application_starts_with_outer_guard_before_dispatch(self):
        from tokenizer import approval_program

        guard_lines = compile_guard(outer_call_guard()).splitlines()
        self.assertEqual(guard_lines[-2:], ["int 1", "return"])
        expected_prefix = guard_lines[:-2]

        application_lines = pt.compileTeal(
            approval_program(),
            mode=pt.Mode.Application,
            version=10,
        ).splitlines()

        self.assertEqual(
            application_lines[:len(expected_prefix)],
            expected_prefix,
        )

    def test_application_contains_exact_reviewed_selector_set(self):
        from tokenizer import approval_program

        teal = pt.compileTeal(
            approval_program(),
            mode=pt.Mode.Application,
            version=10,
        )
        lines = [line.strip() for line in teal.splitlines()]
        selectors = set()

        for index, line in enumerate(lines):
            if line == "txna ApplicationArgs 0":
                following = lines[index + 1:index + 4]
                self.assertEqual(len(following), 3)
                self.assertTrue(following[0].startswith('byte "'))
                self.assertEqual(following[1], "==")
                selectors.add(following[0])

        self.assertEqual(selectors, {
            'byte "create_share_asset"',
            'byte "initialize_seed"',
            'byte "restore_preinit"',
        })
                
    def test_initializer_guard_matches_pinned_sender_assertion(self):
        expected = pt.Assert(
            pt.Txn.sender() == pt.Addr(CREATOR_INITIALIZER)
        )
        self.assertEqual(
            compile_guard(fixed_initializer_guard()),
            compile_guard(expected),
        )


if __name__ == "__main__":
    unittest.main()