"""Offline checks of saved Day 1 creation evidence.

No network access, wallet access, signing, or submission.
These checks do not establish deployment or signing authority.
"""

import base64
import hashlib
import json
import unittest
from pathlib import Path

from algosdk import encoding


DIRECTORY = (
    Path(__file__).resolve().parent
    / "artifacts"
    / "tokenizer"
    / "creation-localnet-def0d6df347a4090b0a833cfd86c3205"
)


def read_artifact(name):
    path = DIRECTORY / name
    if DIRECTORY.is_symlink() or path.is_symlink() or not path.is_file():
        raise ValueError("Expected existing regular evidence artifacts")
    return path.read_bytes()


class TokenizerCreationEvidenceTests(unittest.TestCase):
    maxDiff = None

    @classmethod
    def setUpClass(cls):
        cls.preparation = json.loads(
            read_artifact("creation-preparation.json")
        )
        cls.simulation = json.loads(
            read_artifact("creation-simulation.json")
        )
        cls.raw = read_artifact("creation.unsigned.msgpack")
        cls.encoded = base64.b64encode(cls.raw).decode("ascii")
        cls.txn = encoding.msgpack_decode(cls.encoded)

    def test_saved_unsigned_identity(self):
        digest = hashlib.sha256(self.raw).hexdigest()
        txid = self.txn.get_txid()
        for record in (self.preparation, self.simulation):
            self.assertEqual(record["unsigned_msgpack_sha256"], digest)
            self.assertEqual(record["unsigned_txid"], txid)
        self.assertEqual(encoding.msgpack_encode(self.txn), self.encoded)

    def test_exact_simulation_settings(self):
        self.assertEqual(
            self.simulation["settings"],
            {
                "allow_empty_signatures": True,
                "allow_unnamed_resources": False,
                "allow_more_logs": False,
                "extra_opcode_budget": 0,
            },
        )
        self.assertEqual(
            self.simulation["response"].get("eval-overrides"),
            {"allow-empty-signatures": True},
        )

    def test_single_successful_outer_result_without_inner_transactions(self):
        self.assertEqual(self.simulation["failures"], [])
        self.assertEqual(
            self.simulation["automated_checks"],
            "passed_pending_response_review",
        )
        groups = self.simulation["response"]["txn-groups"]
        self.assertEqual(len(groups), 1)
        group = groups[0]
        self.assertFalse(group.get("failure-message"))
        self.assertNotIn("failed-at", group)

        results = group["txn-results"]
        self.assertEqual(len(results), 1)
        result = results[0]["txn-result"]
        self.assertFalse(result.get("pool-error"))
        self.assertFalse(result.get("inner-txns"))
        expected = self.txn.dictify()
        self.assertEqual(expected["type"], "appl")
        self.assertNotIn("apid", expected)

        # Convert binary fields to the simulation response's JSON form.
        expected_json = {}
        for key, value in expected.items():
            if isinstance(value, bytes):
                expected_json[key] = (
                    encoding.encode_address(value)
                    if key == "snd"
                    else base64.b64encode(value).decode("ascii")
                )
            else:
                expected_json[key] = value

                # Permit only the observed omitted-zero representation of apan.
        self.assertIn("apan", expected_json)
        self.assertEqual(expected_json["apan"], 0)

        observed_json = dict(result["txn"]["txn"])
        if "apan" not in observed_json:
            observed_json["apan"] = 0

        self.assertEqual(observed_json, expected_json)

    def test_recorded_network_window_and_fee(self):
        record = self.preparation
        self.assertEqual(record["network"], "localnet")
        self.assertEqual(record["genesis_id"], "dockernet-v1")
        self.assertEqual(record["fee_microalgo"], 1000)
        self.assertEqual(self.txn.fee, record["fee_microalgo"])
        self.assertEqual(self.txn.sender, record["creator"])
        self.assertEqual(self.txn.first_valid_round, record["first_valid_round"])
        self.assertEqual(self.txn.last_valid_round, record["last_valid_round"])

        simulated_round = self.simulation["response"]["last-round"]
        self.assertLessEqual(self.txn.first_valid_round, simulated_round)
        self.assertLessEqual(simulated_round, self.txn.last_valid_round)
        self.assertEqual(
            self.simulation["response"]["txn-groups"][0]["group-fees-paid"],
            1000,
        )

    def test_historical_creator_creation_balance_projection(self):
        record = self.preparation
        snapshot = record["creator_account_snapshot"]

        # Pin the scope of this projection to the saved creation template.
        self.assertEqual(
            record["global_schema"],
            {"num_uints": 8, "num_byte_slices": 3},
        )
        self.assertEqual(
            record["local_schema"],
            {"num_uints": 0, "num_byte_slices": 0},
        )
        self.assertEqual(record["extra_pages"], 0)
        self.assertEqual(record["fee_microalgo"], 1000)

        for key in ("amount", "min-balance"):
            self.assertIs(type(snapshot[key]), int)
            self.assertGreaterEqual(snapshot[key], 0)

        global_schema = record["global_schema"]
        additional_minimum = (
            100_000 * (1 + record["extra_pages"])
            + 28_500 * global_schema["num_uints"]
            + 50_000 * global_schema["num_byte_slices"]
        )
        projected_minimum = snapshot["min-balance"] + additional_minimum
        projected_amount = snapshot["amount"] - record["fee_microalgo"]
        projected_headroom = projected_amount - projected_minimum

        self.assertEqual(additional_minimum, 478_000)
        self.assertEqual(projected_minimum, 578_000)
        self.assertEqual(projected_amount, 999_000)
        self.assertEqual(projected_headroom, 421_000)
        self.assertGreaterEqual(projected_headroom, 0)

    def test_creation_global_state_matches_reviewed_initial_values(self):
        expected_uint_keys = {
            "initialized",
            "share_asa_id",
            "outstanding_shares",
            "operating_reserve",
            "other_exclusions",
            "fee_rate",
            "fee_liability",
            "backing_baseline",
        }
        expected_roles = {
            "initializer": (
                "QAVXZK43SGUJC7DQ2QC6LBWTAYCKDGOG7XUSFYQRJBE23GZMHN3ORHFG3M"
            ),
            "staking": (
                "V6C6BWQKI4LS3FCZEM5XIOHCM2SSQSIB7AXOIVSBHUNXVVEWMBWTMXRWFU"
            ),
            "seed_recipient": (
                "JJOIC2KGZPABBPXRWF5JP67L3VVV5GJ334YQSTSQBS3QKZARUCUSKJER4Y"
            ),
        }
        self.assertEqual(
            self.preparation["creator"], expected_roles["initializer"]
        )
        self.assertEqual(len(set(expected_roles.values())), 3)

        groups = self.simulation["response"]["txn-groups"]
        self.assertEqual(len(groups), 1)
        results = groups[0]["txn-results"]
        self.assertEqual(len(results), 1)
        delta = results[0]["txn-result"]["global-state-delta"]
        self.assertIsInstance(delta, list)
        self.assertEqual(len(delta), 11)

        observed = {}
        for entry in delta:
            self.assertEqual(set(entry), {"key", "value"})
            key = base64.b64decode(
                entry["key"], validate=True
            ).decode("utf-8")
            self.assertNotIn(key, observed, "Duplicate global-state key")
            observed[key] = entry["value"]

        self.assertEqual(
            set(observed), expected_uint_keys | set(expected_roles)
        )

        for key in sorted(expected_uint_keys):
            with self.subTest(key=key):
                value = observed[key]
                self.assertIsInstance(value, dict)
                self.assertIn("action", value)
                self.assertIs(type(value["action"]), int)
                self.assertEqual(value["action"], 2)
                self.assertLessEqual(set(value), {"action", "uint"})

                # The supplied response omits the zero-valued uint field.
                amount = value.get("uint", 0)
                self.assertIs(type(amount), int)
                self.assertEqual(amount, 0)

        for key, address in expected_roles.items():
            with self.subTest(key=key):
                value = observed[key]
                self.assertIsInstance(value, dict)
                self.assertEqual(set(value), {"action", "bytes"})
                self.assertIs(type(value["action"]), int)
                self.assertEqual(value["action"], 1)
                public_key = base64.b64decode(
                    value["bytes"], validate=True
                )
                self.assertEqual(len(public_key), 32)
                self.assertEqual(
                    public_key, encoding.decode_address(address)
                )    
    def test_current_compile_inputs_match_recorded_source_identity(self):
        root = Path(__file__).resolve().parent
        compiled = self.preparation["compiled_source_sha256"]
        prepared = self.preparation["current_python_source_sha256"]

        expected_inputs = {
            "compile_tokenizer_localnet.py",
            "inspect_kmd_storage.py",
            "localnet_safety.py",
            "prepare_tokenizer_wallet.py",
            "requirements.txt",
            "tokenizer.py",
            "tokenizer_asset.py",
            "tokenizer_authority.py",
            "tokenizer_config.py",
            "tokenizer_initialization.py",
            "tokenizer_localnet_config.py",
        }
        self.assertEqual(set(compiled), expected_inputs)

        for name in sorted(expected_inputs):
            with self.subTest(source=name):
                path = root / name
                self.assertFalse(path.is_symlink())
                self.assertTrue(path.is_file())

                recorded_digest = compiled[name]
                self.assertIsInstance(recorded_digest, str)
                self.assertEqual(len(recorded_digest), 64)
                self.assertTrue(
                    all(
                        character in "0123456789abcdef"
                        for character in recorded_digest
                    )
                )

                actual_digest = hashlib.sha256(path.read_bytes()).hexdigest()
                self.assertEqual(
                    actual_digest,
                    recorded_digest,
                    "Current input differs from the recorded compile input",
                )

                if name.endswith(".py"):
                    self.assertIn(name, prepared)
                    self.assertEqual(
                        prepared[name],
                        recorded_digest,
                        "Compile and preparation source identities differ",
                    )
                        
    def test_preparation_does_not_claim_execution_approval(self):
        self.assertEqual(self.preparation["approval"], "not_requested")
        self.assertEqual(
            self.preparation["expected_creator_minimum_balance_commitment"],
            "pending_verification",
        )
        self.assertEqual(
            self.preparation["status"],
            "unsigned_prepared_not_simulated_not_approved",
        )


if __name__ == "__main__":
    unittest.main()