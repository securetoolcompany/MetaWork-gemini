"""Read-only inspection of the explicitly selected local Algod instance."""

import argparse
import base64
import json
from urllib.parse import urlsplit

from algosdk.v2client.algod import AlgodClient


# Standard disposable AlgoKit LocalNet API token; not a production secret.
LOCALNET_TOKEN = "a" * 64


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--network",
        required=True,
        choices=["localnet"],
    )
    parser.add_argument("--algod-url", required=True)
    args = parser.parse_args()

    endpoint = urlsplit(args.algod_url)

    if (
        endpoint.scheme != "http"
        or endpoint.hostname not in ("localhost", "127.0.0.1")
        or endpoint.port != 4001
        or endpoint.username is not None
        or endpoint.password is not None
        or endpoint.path not in ("", "/")
        or endpoint.query
        or endpoint.fragment
    ):
        raise ValueError(
            "Disposable LocalNet inspection requires "
            "http://localhost:4001 or http://127.0.0.1:4001"
        )

    client = AlgodClient(
        LOCALNET_TOKEN,
        args.algod_url.rstrip("/"),
    )

    params = client.suggested_params()
    genesis_id = params.gen
    genesis_hash = params.gh

    if (
        not isinstance(genesis_id, str)
        or not genesis_id
        or any(
            name in genesis_id.lower()
            for name in ("mainnet", "testnet", "betanet")
        )
    ):
        raise ValueError("Refusing unexpected public-network genesis ID")

    if not isinstance(genesis_hash, str):
        raise ValueError("Expected a base64-encoded genesis hash")

    decoded_hash = base64.b64decode(genesis_hash, validate=True)

    if len(decoded_hash) != 32:
        raise ValueError("Genesis hash must decode to exactly 32 bytes")

    status = client.status()

    print(
        json.dumps(
            {
                "network": args.network,
                "algod_url": args.algod_url.rstrip("/"),
                "genesis_id": genesis_id,
                "genesis_hash_base64": genesis_hash,
                "last_round": status["last-round"],
                "catchup_time": status.get("catchup-time"),
                "inspection": "read-only",
                "signing": "not performed",
                "submission": "not performed",
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()