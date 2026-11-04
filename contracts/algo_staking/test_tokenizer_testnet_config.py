"""Offline-only TestNet public configuration tests. No wallet or node access."""

import base64
import hashlib
from pathlib import Path
import subprocess
import sys
import unittest

import tokenizer_testnet_config as config


def address_for(key):
    checksum = hashlib.new("sha512_256", key).digest()[-4:]
    return base64.b32encode(key + checksum).decode("ascii").rstrip("=")


class TestTestNetConfiguration(unittest.TestCase):
    def test_exact_selected_addresses(self):
        self.assertEqual(dict(config.APPROVED_ROLES), {
            "creator_initializer": "BR5RLDLNCHCXHATTP7GVWGAUJTBREOXPUAYUMKHX5YDZFTVR3XEGPNQN2Y",
            "staking": "7IWKOOY22UXFIWDRPAONF7HJC2TPICOPHHG3TUIPPZLJWDKDXQ3K6SOFAM",
            "seed_recipient": "COYJN7VFKE4FJO4BSUSYQA56GIE6CL6MUJLA5YY2HR47Z5RX2GH27TUOTE",
        })
        config.validate_roles(dict(config.APPROVED_ROLES))

    def test_selected_addresses_have_valid_checksums(self):
        for address in config.APPROVED_ROLES.values():
            self.assertEqual(len(config.decode_public_address(address)), 32)

    def test_role_mapping_immutable(self):
        with self.assertRaises(TypeError):
            config.APPROVED_ROLES["staking"] = "replacement"

    def test_missing_extra_and_substituted_roles_rejected(self):
        missing = dict(config.APPROVED_ROLES)
        del missing["staking"]
        extra = dict(config.APPROVED_ROLES, administrator=config.STAKING)
        swapped = dict(config.APPROVED_ROLES)
        swapped["staking"], swapped["seed_recipient"] = swapped["seed_recipient"], swapped["staking"]
        substituted = dict(config.APPROVED_ROLES, staking=address_for(bytes([42]) * 32))
        for roles in (missing, extra, swapped, substituted):
            with self.subTest(roles=roles), self.assertRaises(ValueError):
                config.validate_roles(roles)

    def test_duplicate_roles_rejected(self):
        with self.assertRaises(ValueError):
            config.validate_roles(dict(config.APPROVED_ROLES, staking=config.CREATOR_INITIALIZER))

    def test_non_dictionary_roles_rejected(self):
        for value in (None, [], tuple(config.APPROVED_ROLES), config.APPROVED_ROLES):
            with self.subTest(value=value), self.assertRaises(TypeError):
                config.validate_roles(value)

    def test_zero_protected_and_localnet_addresses_rejected(self):
        values = [address_for(bytes(32)), *config.PROTECTED_ADDRESSES]
        for value in values:
            with self.subTest(value=value), self.assertRaises(ValueError):
                config.decode_public_address(value)

    def test_malformed_address_rejected(self):
        values = ("", config.STAKING.lower(), config.STAKING + "=", "A" * 57, "0" * 58)
        for value in values:
            with self.subTest(value=value), self.assertRaises(ValueError):
                config.decode_public_address(value)
        with self.assertRaises(TypeError):
            config.decode_public_address(None)

    def test_checksum_tampering_rejected(self):
        value = ("A" if config.STAKING[0] != "A" else "B") + config.STAKING[1:]
        with self.assertRaises(ValueError):
            config.decode_public_address(value)

    def test_public_keys_return_fresh_mapping(self):
        first = config.approved_role_public_keys()
        first.clear()
        second = config.approved_role_public_keys()
        self.assertEqual(set(second), set(config.APPROVED_ROLES))
        self.assertTrue(all(len(value) == 32 for value in second.values()))

    def test_canonical_testnet_genesis_pin(self):
        self.assertEqual(config.GENESIS_ID, "testnet-v1.0")
        self.assertEqual(config.GENESIS_HASH_BASE64, "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=")
        config.validate_network(network="testnet", genesis_id=config.GENESIS_ID,
                                genesis_hash_base64=config.GENESIS_HASH_BASE64)

    def test_mainnet_localnet_betanet_and_missing_selection_rejected(self):
        for network, genesis_id in (("mainnet", "mainnet-v1.0"),
                                    ("localnet", "dockernet-v1"),
                                    ("betanet", "betanet-v1.0"),
                                    (None, config.GENESIS_ID),
                                    ("TestNet", config.GENESIS_ID)):
            with self.subTest(network=network), self.assertRaises(ValueError):
                config.validate_network(network=network, genesis_id=genesis_id,
                                        genesis_hash_base64=config.GENESIS_HASH_BASE64)

    def test_testnet_label_cannot_hide_wrong_genesis(self):
        for genesis_id, genesis_hash in (
            ("mainnet-v1.0", config.GENESIS_HASH_BASE64),
            ("testnet-v1.0", "wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="),
            ("testnet-v1.0", "0TJVyrVwfL/CRhaQzRG1mF29GzfDdG4Dzr2M5uXbg2o="),
        ):
            with self.subTest(genesis_id=genesis_id), self.assertRaises(ValueError):
                config.validate_network(network="testnet", genesis_id=genesis_id,
                                        genesis_hash_base64=genesis_hash)

    def test_malformed_genesis_hash_rejected(self):
        for value in ("", "not-base64!", base64.b64encode(bytes(31)).decode(),
                      config.GENESIS_HASH_BASE64 + "\n"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                config.validate_network(network="testnet", genesis_id=config.GENESIS_ID,
                                        genesis_hash_base64=value)
        with self.assertRaises(TypeError):
            config.validate_network(network="testnet", genesis_id=config.GENESIS_ID,
                                    genesis_hash_base64=None)

    def test_only_selected_endpoint_allowed(self):
        config.validate_endpoint(config.ALGOD_URL)
        for value in ("http://testnet-api.algonode.cloud", "https://mainnet-api.algonode.cloud",
                      "http://127.0.0.1:4001", config.ALGOD_URL + ".evil.example", None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                config.validate_endpoint(value)

    def test_pera_is_metadata_not_authorization(self):
        self.assertEqual(config.SIGNING_ARRANGEMENT, "pera-wallet")
        self.assertFalse(hasattr(config, "approved"))
        self.assertFalse(hasattr(config, "execution_authorized"))

    def test_import_has_no_external_actions_or_project_dependencies(self):
        path = Path(config.__file__)
        source = path.read_bytes()
        # Keep the audit hook in a disposable child, not the test runner.
        script = "import sys,types; events=[]\n" +             "def hook(e,a):\n" +             " if e.startswith('socket.') or e in ('subprocess.Popen','os.system','os.remove','os.rename','os.mkdir'): events.append(e)\n" +             " if e=='open' and isinstance(a[2],int) and a[2]&3: events.append(e)\n" +             "sys.addaudithook(hook)\n" +             "before=set(sys.modules)\n" +             "exec(compile(" + repr(source) + ",'<testnet-config>','exec'),{})\n" +             "assert not events,events\n" +             "assert not any(n.startswith(('algosdk','pyteal','tokenizer_','prepare_','localnet_')) for n in set(sys.modules)-before)\n"
        result = subprocess.run([sys.executable, "-B", "-c", script], capture_output=True,
                                text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)