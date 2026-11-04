"""Offline tests for the creation-only Tokenizer executor.

No LocalNet access, Docker execution, KMD access, or existing-key signing.

Execution tests use mocked wallets/signatures.
Cryptographic tests use an ephemeral test-only key and synthetic transaction.
Execution records are written only inside temporary directories.
"""

import base64
import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from algosdk import account, encoding
from algosdk.transaction import (
    ApplicationCreateTxn,
    OnComplete,
    StateSchema,
    SuggestedParams,
)

import execute_tokenizer_creation as executor

REAL_PROVENANCE_GATE = executor.require_effective_consensus_provenance

from tokenizer_creation_signature import verify_creation_signature


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def synthetic_creation(sender, *, approval=b"\x0a\x81\x01\x43"):
    return ApplicationCreateTxn(
        sender=sender,
        sp=SuggestedParams(
            fee=1_000,
            first=22,
            last=1022,
            gh=executor.GENESIS_HASH_BASE64,
            gen=executor.GENESIS_ID,
            flat_fee=True,
        ),
        on_complete=OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=b"\x0a\x81\x00\x43",
        global_schema=StateSchema(8, 3),
        local_schema=StateSchema(0, 0),
        extra_pages=0,
    )


class ExecutorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)

        self.root = Path(self.temporary.name)
        self.root.mkdir(exist_ok=True)

        self.private_key, self.sender = account.generate_account()
        self.txn = synthetic_creation(self.sender)
        self.txid = self.txn.get_txid()

        self.programs = {
            "approval": self.txn.approval_program,
            "clear": self.txn.clear_program,
        }
        self.program_hashes = {
            name: sha256(program)
            for name, program in self.programs.items()
        }

        self.raw = base64.b64decode(
            encoding.msgpack_encode(self.txn)
        )
        self.raw_hash = sha256(self.raw)

        self.binding = {
            "transaction_id": self.txid,
            "unsigned_msgpack_sha256": self.raw_hash,
            "program_sha256": self.program_hashes,
            "network": "localnet",
            "genesis_id": executor.GENESIS_ID,
            "genesis_hash_base64": executor.GENESIS_HASH_BASE64,
            "container_id": executor.CONTAINER_ID,
            "fee_microalgo": 1_000,
            "first_valid_round": 22,
            "last_valid_round": 1022,
        }

        self.simulation = {
            "response": {
                "txn-groups": [{
                    "txn-results": [{
                        "txn-result": {
                            "global-state-delta": [{
                                "key": base64.b64encode(
                                    b"initialized"
                                ).decode(),
                                "value": {
                                    "action": 2,
                                    "uint": 0,
                                },
                            }],
                        },
                    }],
                }],
            },
        }

        self.live = {
            "protocol": "synthetic-protocol",
            "build": {
                "commit-hash": "synthetic-build",
            },
            "process_cmdline_sha256": "synthetic-cmdline",
            "data_directory": "/synthetic/data",
            "override_path": "/synthetic/data/consensus.json",
            "override_sha256": None,
            "node_round": 22,
            "suggested_round": 22,
            "minimum_fee_microalgo": 1_000,
            "creator": {
                "address": self.sender,
                "auth-addr": None,
                "amount": 1_000_000,
                "min-balance": 100_000,
                "round": 22,
            },
        }

        self.costs = {
            "additional_minimum_microalgo": 478_000,
            "fee_microalgo": 1_000,
            "node_loading_verified": False,
            "execution_authorized": False,
        }

        self.evidence = {
            "purpose": "synthetic-only",
        }
        self.evidence_hash = "synthetic-evidence-hash"
        self.evidence_path = self.root / "consensus-evidence.json"

        self.context = MagicMock()
        self.context.client.send_transaction.return_value = self.txid

        self.confirmation = {
            "confirmed-round": 23,
            "application-index": 123,
            "pool-error": "",
        }

        self.wallet = MagicMock()
        self.wallet.__enter__.return_value = self.wallet
        self.wallet.__exit__.return_value = False
        self.wallet.handle_release = "confirmed"
        self.wallet.sign_creation.return_value = object()

        self.wallet_class = MagicMock(return_value=self.wallet)
        self.wallet_module = SimpleNamespace(
            TokenizerCreationWalletSession=self.wallet_class,
        )

        self.patchers = []

        def install(target, *args, **kwargs):
            patcher = patch(target, *args, **kwargs)
            self.patchers.append(patcher)
            return patcher.start()

        self.addCleanup(self.stop_patches)

        install(
            "execute_tokenizer_creation.ARTIFACTS",
            self.root,
        )
        install(
            "execute_tokenizer_creation.CREATOR_INITIALIZER",
            self.sender,
        )
        install(
            "execute_tokenizer_creation.RECORDED_TXID",
            self.txid,
        )
        install(
            "execute_tokenizer_creation.RECORDED_UNSIGNED_SHA256",
            self.raw_hash,
        )
        install(
            "execute_tokenizer_creation.RECORDED_PROGRAM_SHA256",
            self.program_hashes,
        )

        self.load_candidate = install(
            "execute_tokenizer_creation.load_candidate",
            return_value=(
                self.txn,
                self.programs,
                self.simulation,
                self.binding,
            ),
        )
        self.new_context = install(
            "execute_tokenizer_creation.new_context",
            return_value=self.context,
        )
        self.docker = install(
            "execute_tokenizer_creation.docker_executable",
            return_value="mock-docker",
        )
        self.container = install(
            "execute_tokenizer_creation.container_id",
            return_value=executor.CONTAINER_ID,
        )
        self.validate_container = install(
            "execute_tokenizer_creation.validate_container",
        )
        self.observe = install(
            "execute_tokenizer_creation.observe_live_state",
            side_effect=lambda *_: copy.deepcopy(self.live),
        )
        self.consensus = install(
            "execute_tokenizer_creation.validate_consensus_evidence",
            side_effect=lambda *_: (
                copy.deepcopy(self.costs),
                self.evidence_hash,
                copy.deepcopy(self.evidence),
            ),
        )
        self.signature = install(
            "execute_tokenizer_creation.verify_creation_signature",
            return_value=self.txid,
        )
        self.wait = install(
            "execute_tokenizer_creation.wait_for_confirmation",
            return_value=self.confirmation,
        )
        self.verify_creation = install(
            "execute_tokenizer_creation.verify_confirmed_creation",
            return_value=123,
        )
        self.decision = install(
            "execute_tokenizer_creation.interactive_decision",
            return_value={"decision": "synthetic-approval"},
        )

        # Downstream orchestration tests assume this prerequisite has
        # independently passed. This mock is not real provenance evidence.
        self.provenance_gate = install(
            "execute_tokenizer_creation.require_effective_consensus_provenance",
            return_value=None,
        )

        wallet_patch = patch.dict(
            sys.modules,
            {"tokenizer_wallet": self.wallet_module},
        )
        self.patchers.append(wallet_patch)
        wallet_patch.start()

        self.output = install("builtins.print")

    def stop_patches(self):
        for patcher in reversed(self.patchers):
            patcher.stop()

    def run_main(self, *arguments):
        with patch.object(
            sys,
            "argv",
            [
                "execute_tokenizer_creation.py",
                *arguments,
            ],
        ):
            return executor.main()

    def execute_directly(self):
        return executor.execute(
            context=self.context,
            docker="mock-docker",
            transaction=self.txn,
            programs=self.programs,
            simulation=self.simulation,
            binding=self.binding,
            evidence_path=self.evidence_path,
            evidence_hash=self.evidence_hash,
            evidence=self.evidence,
        )

    def assert_no_signing_or_submission(self):
        self.wallet_class.assert_not_called()
        self.wallet.sign_creation.assert_not_called()
        self.context.client.send_transaction.assert_not_called()

    def record_text(self):
        return executor.execution_record_path().read_text(
            encoding="utf-8"
        )

    def test_default_verification_never_opens_signs_or_submits(self):
        self.assertEqual(self.run_main(), 2)
        self.assert_no_signing_or_submission()
        self.decision.assert_not_called()
        self.assertFalse(executor.execution_record_path().exists())

    def test_wrong_container_prevents_execution(self):
        self.validate_container.side_effect = RuntimeError(
            "Wrong container"
        )
        with self.assertRaisesRegex(RuntimeError, "Wrong container"):
            self.run_main("--mode", "execute")
        self.assert_no_signing_or_submission()

    def test_wrong_genesis_prevents_execution(self):
        self.context.validate_transaction.side_effect = ValueError(
            "Genesis hash mismatch"
        )
        with self.assertRaisesRegex(ValueError, "Genesis hash"):
            executor.check_live_preconditions(
                self.context,
                self.txn,
                self.live,
            )

        with self.assertRaises(RuntimeError):
            self.run_main("--mode", "execute")
        self.assert_no_signing_or_submission()

    def test_authority_validity_fee_and_balance_fail_closed(self):
        cases = (
            (
                "authority",
                lambda live: live["creator"].update({
                    "auth-addr": account.generate_account()[1],
                }),
            ),
            (
                "expired",
                lambda live: live.update({"node_round": 1023}),
            ),
            (
                "suggested-round-expired",
                lambda live: live.update({"suggested_round": 1023}),
            ),
            (
                "fee",
                lambda live: live.update({
                    "minimum_fee_microalgo": 2_000,
                }),
            ),
            (
                "balance",
                lambda live: live["creator"].update({
                    "amount": 100_000,
                }),
            ),
        )

        original = copy.deepcopy(self.live)

        for name, mutate in cases:
            with self.subTest(name=name):
                self.live = copy.deepcopy(original)
                mutate(self.live)

                with self.assertRaises(RuntimeError):
                    self.run_main("--mode", "execute")

                self.assert_no_signing_or_submission()

        self.live = original

    def test_missing_or_mismatched_consensus_blocks_execution(self):
        for reason in (
            "Effective consensus provenance bundle is missing",
            "Consensus evidence/live binding mismatch: protocol",
        ):
            with self.subTest(reason=reason):
                self.consensus.side_effect = RuntimeError(reason)

                with self.assertRaises(RuntimeError):
                    self.run_main("--mode", "execute")

                self.assert_no_signing_or_submission()

    def test_structural_evidence_still_requires_provenance_decision(self):
        self.decision.side_effect = RuntimeError(
            "Provenance review rejected"
        )

        with self.assertRaisesRegex(RuntimeError, "Provenance"):
            self.run_main("--mode", "execute")

        self.assertEqual(
            self.decision.call_args.args[0],
            "ATTEST_CONSENSUS_SOURCE_AND_LOADED_BASIS",
        )
        self.assert_no_signing_or_submission()

    def test_rejecting_exact_creation_decision_prevents_signing(self):
        self.decision.side_effect = [
            {"decision": "synthetic-provenance-review"},
            RuntimeError("Exact creation rejected"),
        ]

        with self.assertRaisesRegex(RuntimeError, "creation rejected"):
            self.run_main("--mode", "execute")

        self.assertEqual(self.decision.call_count, 2)
        self.assert_no_signing_or_submission()
        self.assertFalse(executor.execution_record_path().exists())

    def test_existing_guard_prevents_another_attempt(self):
        executor.execution_record_path().write_text(
            "existing execution evidence\n",
            encoding="utf-8",
        )

        with self.assertRaisesRegex(RuntimeError, "guard exists"):
            self.run_main("--mode", "execute")

        self.assert_no_signing_or_submission()
        self.assertEqual(
            self.record_text(),
            "existing execution evidence\n",
        )

    def test_signature_failure_or_unexpected_signed_bytes_blocks_submit(self):
        for reason in (
            "Signed transaction differs from expected creation",
            "Cryptographic signature verification failed",
        ):
            with self.subTest(reason=reason):
                path = executor.execution_record_path()
                if path.exists():
                    # Test-fixture cleanup only. Production code never clears it.
                    path.unlink()

                self.signature.side_effect = ValueError(reason)

                self.assertEqual(self.execute_directly(), 2)
                self.context.client.send_transaction.assert_not_called()
                self.assertTrue(path.exists())

    def test_unconfirmed_wallet_release_blocks_submission(self):
        self.wallet.handle_release = "not confirmed"

        self.assertEqual(self.execute_directly(), 2)
        self.wallet.sign_creation.assert_called_once()
        self.context.client.send_transaction.assert_not_called()
        self.assertTrue(executor.execution_record_path().exists())

    def test_post_approval_precondition_change_prevents_wallet_opening(self):
        changed = copy.deepcopy(self.live)
        changed["creator"]["auth-addr"] = account.generate_account()[1]
        self.observe.return_value = changed
        self.observe.side_effect = None

        with self.assertRaisesRegex(RuntimeError, "authority"):
            self.execute_directly()

        self.assert_no_signing_or_submission()

    def test_post_signing_precondition_change_blocks_submission(self):
        changed = copy.deepcopy(self.live)
        changed["node_round"] = 1023

        self.observe.side_effect = [
            copy.deepcopy(self.live),
            changed,
        ]

        self.assertEqual(self.execute_directly(), 2)
        self.wallet.sign_creation.assert_called_once()
        self.context.client.send_transaction.assert_not_called()
        self.assertTrue(executor.execution_record_path().exists())

    def test_post_approval_evidence_change_prevents_wallet_opening(self):
        self.consensus.side_effect = None
        self.consensus.return_value = (
            self.costs,
            "changed-evidence",
            self.evidence,
        )

        with self.assertRaisesRegex(RuntimeError, "evidence changed"):
            self.execute_directly()

        self.assert_no_signing_or_submission()

    def test_post_signing_evidence_change_blocks_submission(self):
        self.consensus.side_effect = [
            (self.costs, self.evidence_hash, self.evidence),
            (self.costs, "changed-evidence", self.evidence),
        ]

        self.assertEqual(self.execute_directly(), 2)
        self.wallet.sign_creation.assert_called_once()
        self.context.client.send_transaction.assert_not_called()
        self.assertTrue(executor.execution_record_path().exists())

    def test_submission_exception_preserves_guard_without_retry(self):
        self.context.client.send_transaction.side_effect = OSError(
            "Synthetic connection loss"
        )

        self.assertEqual(self.execute_directly(), 2)
        self.wallet.sign_creation.assert_called_once()
        self.context.client.send_transaction.assert_called_once()

        record = self.record_text()
        self.assertIn("submission_intent_do_not_retry", record)
        self.assertIn(
            "stopped_outcome_requires_reconciliation_do_not_retry",
            record,
        )

        with self.assertRaises(FileExistsError):
            self.execute_directly()

        self.wallet.sign_creation.assert_called_once()
        self.context.client.send_transaction.assert_called_once()

    def test_confirmation_timeout_preserves_guard_without_resubmission(self):
        self.wait.side_effect = TimeoutError(
            "Synthetic confirmation timeout"
        )

        self.assertEqual(self.execute_directly(), 2)
        self.context.client.send_transaction.assert_called_once()
        self.wallet.sign_creation.assert_called_once()

        record = self.record_text()
        self.assertIn("submitted_confirmation_pending", record)
        self.assertIn(
            "stopped_outcome_requires_reconciliation_do_not_retry",
            record,
        )

    def test_guard_and_submission_intent_exist_before_submission(self):
        def inspect_submission(_signed):
            record = self.record_text()
            self.assertIn("guard_acquired", record)
            self.assertIn("submission_intent_do_not_retry", record)
            self.assertEqual(
                self.wallet.handle_release,
                "confirmed",
            )
            return self.txid

        self.context.client.send_transaction.side_effect = (
            inspect_submission
        )

        self.assertEqual(self.execute_directly(), 0)
        self.wallet.sign_creation.assert_called_once()
        self.context.client.send_transaction.assert_called_once()
        self.wait.assert_called_once_with(
            self.context.client,
            self.txid,
            10,
        )
        self.assertIn(
            "creation_confirmed_verified_not_initialized",
            self.record_text(),
        )

    def test_confirmed_verification_failure_is_not_reported_as_no_creation(self):
        self.verify_creation.side_effect = ValueError(
            "Synthetic deployed-bytecode mismatch"
        )

        self.assertEqual(self.execute_directly(), 3)

        record = self.record_text()
        self.assertIn(
            "creation_confirmed_verification_failed",
            record,
        )
        self.assertTrue(executor.execution_record_path().exists())
        self.context.client.send_transaction.assert_called_once()

    def test_reconciliation_is_read_only_even_when_candidate_expired(self):
        path = executor.execution_record_path()
        original = b'{"state":"submission_intent_do_not_retry"}\n'
        path.write_bytes(original)

        self.live["node_round"] = 5000
        self.context.client.pending_transaction_info.return_value = (
            self.confirmation
        )

        with patch(
            "execute_tokenizer_creation.os.open",
            side_effect=AssertionError("Unexpected execution-record write"),
        ):
            self.assertEqual(
                self.run_main("--mode", "reconcile"),
                0,
            )

        self.assertEqual(path.read_bytes(), original)
        self.assert_no_signing_or_submission()
        self.decision.assert_not_called()
        self.observe.assert_not_called()
        self.context.client.pending_transaction_info.assert_called_once_with(
            self.txid
        )

    def test_uncertain_reconciliation_never_retries_or_clears_guard(self):
        path = executor.execution_record_path()
        path.write_bytes(b"interrupted record")

        self.context.client.pending_transaction_info.side_effect = (
            OSError("Synthetic unavailable result")
        )

        self.assertEqual(
            executor.reconcile(
                self.context,
                self.programs,
                self.simulation,
            ),
            2,
        )
        self.assertEqual(path.read_bytes(), b"interrupted record")
        self.assert_no_signing_or_submission()

    def test_human_attestation_alone_cannot_establish_loaded_overrides(self):
        """The real provenance gate must reject unresolved loading evidence."""

        self.provenance_gate.side_effect = REAL_PROVENANCE_GATE

        self.costs["node_loading_verified"] = False
        self.evidence["loaded_override_basis"] = (
            "Unsubstantiated human assertion; no loading evidence"
        )

        with self.assertRaisesRegex(
            RuntimeError,
            "Effective consensus provenance unresolved",
        ):
            self.run_main("--mode", "execute")

        self.provenance_gate.assert_called_once()
        self.decision.assert_not_called()
        self.assert_no_signing_or_submission()
        self.assertFalse(
            executor.execution_record_path().exists()
        )


class CandidateTamperingTests(unittest.TestCase):
    def setUp(self):
        self.private_key, self.sender = account.generate_account()
        self.txn = synthetic_creation(self.sender)
        self.raw = base64.b64decode(
            encoding.msgpack_encode(self.txn)
        )

        self.programs = {
            "approval": self.txn.approval_program,
            "clear": self.txn.clear_program,
        }

        self.metadata = {
            "programs": {
                name: {
                    "bytecode_sha256": sha256(value),
                }
                for name, value in self.programs.items()
            },
            "source_sha256": {
                "tokenizer.py": "synthetic-source-hash",
            },
        }

        self.preparation = {
            "unsigned_txid": self.txn.get_txid(),
            "unsigned_msgpack_sha256": sha256(self.raw),
            "compile_directory": executor.COMPILE_DIRECTORY,
            "programs": copy.deepcopy(self.metadata["programs"]),
            "compiled_source_sha256": copy.deepcopy(
                self.metadata["source_sha256"]
            ),
        }
        self.simulation = {
            "unsigned_txid": self.txn.get_txid(),
            "unsigned_msgpack_sha256": sha256(self.raw),
        }

    def read_fixture(self, path):
        name = Path(path).name
        if name == "creation.unsigned.msgpack":
            return self.raw
        if name == "creation-preparation.json":
            return json.dumps(self.preparation).encode()
        if name == "creation-simulation.json":
            return json.dumps(self.simulation).encode()
        raise AssertionError("Unexpected fixture read: " + name)

    def load(self):
        synthetic_suite = MagicMock()
        synthetic_suite.countTestCases.return_value = 8

        successful_result = MagicMock()
        successful_result.wasSuccessful.return_value = True

        with (
            patch.object(
                executor.unittest.defaultTestLoader,
                "loadTestsFromTestCase",
                return_value=synthetic_suite,
            ),
            patch.object(
                executor.unittest,
                "TextTestRunner",
            ) as runner,
            patch.object(
                executor,
                "regular_bytes",
                side_effect=self.read_fixture,
            ),
            patch.object(
                executor,
                "load_tokenizer_artifacts",
                return_value=(self.metadata, self.programs),
            ),
            patch.object(
                executor,
                "CREATOR_INITIALIZER",
                self.sender,
            ),
            patch.object(
                executor,
                "RECORDED_TXID",
                self.txn.get_txid(),
            ),
            patch.object(
                executor,
                "RECORDED_UNSIGNED_SHA256",
                self.preparation["unsigned_msgpack_sha256"],
            ),
            patch.object(
                executor,
                "RECORDED_PROGRAM_SHA256",
                {
                    name: self.metadata["programs"][name][
                        "bytecode_sha256"
                    ]
                    for name in self.programs
                },
            ),
        ):
            runner.return_value.run.return_value = successful_result
            return executor.load_candidate()

    def test_synthetic_candidate_fixture_is_valid(self):
        txn, _, _, _ = self.load()
        self.assertEqual(txn.get_txid(), self.txn.get_txid())

    def test_unsigned_bytes_tampering_is_rejected(self):
        self.raw += b"\x00"

        with self.assertRaises(Exception):
            self.load()

    def test_program_tampering_is_rejected(self):
        self.programs["approval"] += b"\x00"

        with self.assertRaisesRegex(RuntimeError, "program"):
            self.load()

    def test_simulation_association_tampering_is_rejected(self):
        self.simulation["unsigned_txid"] = "wrong-candidate"

        with self.assertRaisesRegex(RuntimeError, "association"):
            self.load()

    def test_compilation_selection_tampering_is_rejected(self):
        self.preparation["compile_directory"] = "compile-localnet-other"

        with self.assertRaisesRegex(RuntimeError, "compilation"):
            self.load()

    def test_compilation_record_binding_tampering_is_rejected(self):
        self.preparation["compiled_source_sha256"] = {
            "tokenizer.py": "different-source",
        }

        with self.assertRaisesRegex(RuntimeError, "source identities"):
            self.load()


class ConsensusEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

        self.live = {
            "protocol": "synthetic-protocol",
            "build": {
                "commit-hash": "synthetic-build",
            },
            "process_cmdline_sha256": "synthetic-cmdline",
            "data_directory": "/synthetic/data",
            "override_path": "/synthetic/data/consensus.json",
            "override_sha256": None,
        }

        sources = []

        for role in ("defaults", "override_loading"):
            name = role + ".txt"
            raw = ("Synthetic evidence only: " + role).encode()
            (self.root / name).write_bytes(raw)
            sources.append({
                "role": role,
                "commit": "synthetic-build",
                "file": name,
                "sha256": sha256(raw),
            })

        self.evidence = {
            "purpose": "tokenizer-effective-consensus-review-v1",
            **self.live,
            "sources": sources,
            "derivation": "Synthetic derivation, not real evidence",
            "loaded_override_basis": "Synthetic assertion only",
            "parameters": {
                "synthetic-protocol": {
                    "AppFlatParamsMinBalance": 100_000,
                    "SchemaMinBalancePerEntry": 25_000,
                    "SchemaUintMinBalance": 3_500,
                    "SchemaBytesMinBalance": 25_000,
                    "MinTxnFee": 1_000,
                },
            },
        }

        self.path = self.root / "evidence.json"

    def write_evidence(self):
        self.path.write_text(
            json.dumps(self.evidence),
            encoding="utf-8",
        )

    def test_missing_evidence_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "missing"):
            executor.validate_consensus_evidence(None, self.live)

    def test_protocol_build_and_override_mismatches_rejected(self):
        for key, changed in (
            ("protocol", "different-protocol"),
            ("build", {"commit-hash": "different-build"}),
            ("override_sha256", "different-override"),
        ):
            with self.subTest(key=key):
                original = copy.deepcopy(self.evidence[key])
                self.evidence[key] = changed
                self.write_evidence()

                with self.assertRaisesRegex(RuntimeError, "binding mismatch"):
                    executor.validate_consensus_evidence(
                        self.path,
                        self.live,
                    )

                self.evidence[key] = original

    def test_source_tampering_rejected(self):
        self.write_evidence()
        (self.root / "defaults.txt").write_text(
            "tampered",
            encoding="utf-8",
        )

        with self.assertRaisesRegex(RuntimeError, "digest mismatch"):
            executor.validate_consensus_evidence(
                self.path,
                self.live,
            )

    def test_matching_structure_does_not_claim_loading_verified(self):
        self.write_evidence()

        costs, _, _ = executor.validate_consensus_evidence(
            self.path,
            self.live,
        )

        self.assertIs(costs["node_loading_verified"], False)
        self.assertIs(costs["execution_authorized"], False)


class InteractiveDecisionTests(unittest.TestCase):
    def test_noninteractive_input_rejected_without_reading_input(self):
        with (
            patch.object(sys, "stdin") as stdin,
            patch.object(sys, "stdout") as stdout,
            patch("builtins.input") as read_input,
        ):
            stdin.isatty.return_value = False
            stdout.isatty.return_value = True

            with self.assertRaisesRegex(RuntimeError, "Interactive"):
                executor.interactive_decision(
                    "AUTHORIZE_EXACT_CREATION",
                    {"candidate": "synthetic"},
                )

            read_input.assert_not_called()

    def test_rejection_at_either_decision_is_rejected(self):
        for label in (
            "ATTEST_CONSENSUS_SOURCE_AND_LOADED_BASIS",
            "AUTHORIZE_EXACT_CREATION",
        ):
            with self.subTest(label=label):
                with (
                    patch.object(sys, "stdin") as stdin,
                    patch.object(sys, "stdout") as stdout,
                    patch("builtins.input", return_value="no"),
                    patch("builtins.print"),
                ):
                    stdin.isatty.return_value = True
                    stdout.isatty.return_value = True

                    with self.assertRaisesRegex(RuntimeError, "not granted"):
                        executor.interactive_decision(
                            label,
                            {"candidate": "synthetic"},
                        )


class ConfirmedCreationTests(unittest.TestCase):
    def setUp(self):
        _, self.sender = account.generate_account()
        self.programs = {
            "approval": b"synthetic-approval",
            "clear": b"synthetic-clear",
        }
        self.key = base64.b64encode(b"initialized").decode()

        self.parameters = {
            "creator": self.sender,
            "approval-program": base64.b64encode(
                self.programs["approval"]
            ).decode(),
            "clear-state-program": base64.b64encode(
                self.programs["clear"]
            ).decode(),
            "global-state-schema": {
                "num-uint": 8,
                "num-byte-slice": 3,
            },
            "local-state-schema": {
                "num-uint": 0,
                "num-byte-slice": 0,
            },
            "extra-program-pages": 0,
            "global-state": [{
                "key": self.key,
                "value": {
                    "type": 2,
                    "uint": 0,
                },
            }],
        }

        self.simulation = {
            "response": {
                "txn-groups": [{
                    "txn-results": [{
                        "txn-result": {
                            "global-state-delta": [{
                                "key": self.key,
                                "value": {
                                    "action": 2,
                                    "uint": 0,
                                },
                            }],
                        },
                    }],
                }],
            },
        }

        self.context = MagicMock()
        self.context.client.application_info.return_value = {
            "params": self.parameters,
        }

        self.confirmation = {
            "confirmed-round": 23,
            "application-index": 123,
            "pool-error": "",
        }

    def verify(self):
        with patch.object(
            executor,
            "CREATOR_INITIALIZER",
            self.sender,
        ):
            return executor.verify_confirmed_creation(
                self.context,
                self.confirmation,
                self.programs,
                self.simulation,
            )

    def test_correct_algod_response_is_accepted(self):
        # Uses actual Algod response field names. A failure here is a
        # concrete executor defect, not a reason to alter the fixture.
        self.assertEqual(self.verify(), 123)

    def test_creator_bytecode_schema_and_state_mismatches_rejected(self):
        mutations = (
            ("creator", "creator", account.generate_account()[1]),
            (
                "approval",
                "approval-program",
                base64.b64encode(b"changed").decode(),
            ),
            (
                "schema",
                "global-state-schema",
                {"num-uint": 7, "num-byte-slice": 3},
            ),
            (
                "initial-state",
                "global-state",
                [{
                    "key": self.key,
                    "value": {
                        "type": 2,
                        "uint": 1,
                    },
                }],
            ),
        )

        for name, key, value in mutations:
            with self.subTest(name=name):
                original = copy.deepcopy(self.parameters[key])
                self.parameters[key] = value

                with self.assertRaises(Exception):
                    self.verify()

                self.parameters[key] = original


class EphemeralCryptographicTests(unittest.TestCase):
    def setUp(self):
        # Fresh, test-only key. Never serialized or printed.
        self.private_key, self.sender = account.generate_account()
        self.txn = synthetic_creation(self.sender)

    def test_real_valid_signature(self):
        signed = self.txn.sign(self.private_key)

        self.assertEqual(
            verify_creation_signature(signed, self.txn),
            self.txn.get_txid(),
        )

    def test_changed_transaction_rejected(self):
        signed = self.txn.sign(self.private_key)
        expected = copy.deepcopy(self.txn)
        signed.transaction.fee += 1

        with self.assertRaises(Exception):
            verify_creation_signature(signed, expected)

    def test_changed_signature_rejected(self):
        signed = self.txn.sign(self.private_key)
        raw = bytearray(
            base64.b64decode(signed.signature, validate=True)
        )
        raw[0] ^= 1
        signed.signature = base64.b64encode(raw).decode()

        with self.assertRaises(Exception):
            verify_creation_signature(signed, self.txn)


if __name__ == "__main__":
    unittest.main(verbosity=2)