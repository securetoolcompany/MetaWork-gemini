"""Generate isolated disposable-proof TEAL artifacts without network access."""

import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from pyteal import Mode, OptimizeOptions, compileTeal

from account_control import (
    GLOBAL_BYTES,
    GLOBAL_UINTS,
    approval_program,
    clear_program,
)


REQUIRED_VERSIONS = {
    "pyteal": "0.27.0",
    "py-algorand-sdk": "2.11.1",
}

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts" / "account_control"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def main():
    installed = {
        package: version(package)
        for package in REQUIRED_VERSIONS
    }

    for package, required in REQUIRED_VERSIONS.items():
        if installed[package] != required:
            raise RuntimeError(
                f"{package} version mismatch: "
                f"required {required}, installed {installed[package]}"
            )

    approval = compileTeal(
        approval_program(),
        mode=Mode.Application,
        version=10,
        optimize=OptimizeOptions(scratch_slots=True),
    )
    clear = compileTeal(
        clear_program(),
        mode=Mode.Application,
        version=10,
        optimize=OptimizeOptions(scratch_slots=True),
    )

    programs = {
        "approval.teal": (approval + "\n").encode("utf-8"),
        "clear.teal": (clear + "\n").encode("utf-8"),
    }

    metadata = {
        "purpose": "disposable-account-control-proof-only",
        "stage": "pyteal-to-teal",
        "avm_version": 10,
        "dependencies": installed,
        "global_schema": {
            "num_uints": GLOBAL_UINTS,
            "num_byte_slices": GLOBAL_BYTES,
        },
        "local_schema": {
            "num_uints": 0,
            "num_byte_slices": 0,
        },
        "source_sha256": sha256(
            (ROOT / "account_control.py").read_bytes()
        ),
        "programs": {
            name: {
                "sha256": sha256(data),
                "bytes": len(data),
            }
            for name, data in programs.items()
        },
        "algod_compilation": "not executed",
        "deployment": "not executed",
    }

    ARTIFACTS.mkdir(parents=True, exist_ok=True)

    for name, data in programs.items():
        (ARTIFACTS / name).write_bytes(data)

    report = json.dumps(metadata, indent=2, sort_keys=True) + "\n"
    (ARTIFACTS / "compile.json").write_bytes(report.encode("utf-8"))

    print(report, end="")


if __name__ == "__main__":
    main()