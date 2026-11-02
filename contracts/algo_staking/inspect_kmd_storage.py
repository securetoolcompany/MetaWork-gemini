"""Read-only discovery of LocalNet container mounts and KMD directories."""

import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path, PurePosixPath


def docker_executable():
    found = shutil.which("docker") or shutil.which("docker.exe")
    if found:
        return found

    program_files = os.environ.get("ProgramFiles")
    if program_files:
        candidate = (
            Path(program_files)
            / "Docker"
            / "Docker"
            / "resources"
            / "bin"
            / "docker.exe"
        )
        if candidate.is_file():
            return str(candidate)

    raise RuntimeError("Docker executable not found")


def run_public_command(arguments):
    result = subprocess.run(
        arguments,
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    if result.returncode != 0:
        # Do not echo arbitrary subprocess output into proof records.
        raise RuntimeError(
            f"Read-only Docker command failed with exit code "
            f"{result.returncode}"
        )
    return result.stdout


def covering_mount(directory, mounts):
    path = PurePosixPath(directory)
    candidates = []

    for mount in mounts:
        destination = PurePosixPath(mount["Destination"])
        if path == destination or destination in path.parents:
            candidates.append(mount)

    if not candidates:
        return None

    return max(
        candidates,
        key=lambda mount: len(PurePosixPath(mount["Destination"]).parts),
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--container",
        required=True,
        choices=["algokit_sandbox_algod"],
    )
    args = parser.parse_args()
    docker = docker_executable()

    # Select only mount metadata, never the container environment/configuration.
    mounts = json.loads(
        run_public_command(
            [
                docker,
                "inspect",
                "--format",
                "{{json .Mounts}}",
                args.container,
            ]
        )
    )

    public_mounts = [
        {
            "Type": mount.get("Type"),
            "Name": mount.get("Name"),
            "Source": mount.get("Source"),
            "Destination": mount["Destination"],
            "RW": mount.get("RW"),
        }
        for mount in mounts
    ]

    # Discover directory names only. Do not read wallet files, API tokens,
    # KMD configuration contents, process environments, or wallet handles.
    output = run_public_command(
        [
            docker,
            "exec",
            args.container,
            "sh",
            "-c",
            "find / -maxdepth 8 -type d -name 'kmd-v*' "
            "-print 2>/dev/null; true",
        ]
    )
    directories = sorted(
        {
            line.strip()
            for line in output.splitlines()
            if line.strip().startswith("/")
        }
    )

    storage_details = []

    for directory in directories:
        resolved = run_public_command(
            [
                docker,
                "exec",
                args.container,
                "readlink",
                "-f",
                directory,
            ]
        ).strip()

        children_output = run_public_command(
            [
                docker,
                "exec",
                args.container,
                "find",
                resolved,
                "-maxdepth",
                "2",
                "-type",
                "d",
                "-print",
            ]
        )

        # Read configuration internally, but report only the wallet-path field.
        # Never print raw configuration or read API-token/wallet files.
        config_path = str(PurePosixPath(resolved) / "kmd_config.json")
        config_result = subprocess.run(
            [
                docker,
                "exec",
                args.container,
                "cat",
                config_path,
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=60,
        )

        configured_wallets_dir = None
        config_status = "not available; default path not yet verified"

        if config_result.returncode == 0:
            configuration = json.loads(config_result.stdout)
            drivers = configuration.get("drivers", {})
            sqlite = drivers.get("sqlite", {})
            configured_wallets_dir = sqlite.get("wallets_dir")

            if configured_wallets_dir is not None:
                if not isinstance(configured_wallets_dir, str):
                    raise ValueError("Unexpected sqlite wallet-directory type")
                config_status = "wallets_dir field inspected"
            else:
                config_status = "wallets_dir field absent"

        storage_details.append(
            {
                "kmd_directory": directory,
                "resolved_kmd_directory": resolved,
                "covering_mount": covering_mount(resolved, public_mounts),
                "configuration_status": config_status,
                "configured_sqlite_wallets_dir": configured_wallets_dir,
                "child_directories": sorted(
                    {
                        line.strip()
                        for line in children_output.splitlines()
                        if line.strip().startswith("/")
                    }
                ),
            }
        )

    report = {
        "kmd_storage_details": storage_details,
        "inspection": "read-only-storage-discovery",
        "container": args.container,
        "mounts": public_mounts,
        "kmd_directory_candidates": [
            {
                "directory": directory,
                "covering_mount": covering_mount(directory, public_mounts),
            }
            for directory in directories
        ],
        "wallet_storage_location_verified": False,
        "outside_repository_verified": False,
        "restart_persistence_test": "not executed",
        "fresh_process_wallet_signing_test": "not executed",
        "wallet_creation": "not performed",
        "funding": "not performed",
        "rekeying": "not performed",
    }

    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()