#!/usr/bin/env python3
"""Smoke-test bundled native VOLT binaries."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install-root", type=Path)
    parser.add_argument("--timeout", type=float, default=20)
    args = parser.parse_args()

    root = _native_root(args.install_root)
    bin_dir = root / "bin"
    binaries = sorted(path for path in bin_dir.iterdir() if path.is_file() and os.access(path, os.X_OK))
    if not binaries:
        raise SystemExit(f"No native plugin binaries found in {bin_dir}")

    env = os.environ.copy()
    for key, paths in {
        "PATH": [root / "bin", root / "lib"],
        "LD_LIBRARY_PATH": [root / "lib"],
        "DYLD_LIBRARY_PATH": [root / "lib"],
    }.items():
        prefix = os.pathsep.join(str(path) for path in paths if path.exists())
        current = env.get(key)
        env[key] = prefix if not current else prefix + os.pathsep + current

    failures: dict[str, str] = {}
    print(f"Discovered {len(binaries)} binary/binaries")
    for binary in binaries:
        completed = subprocess.run(
            [str(binary), "--help"],
            cwd=root,
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=args.timeout,
        )
        status = "ok" if completed.returncode in {0, 1} else f"exit-{completed.returncode}"
        print(f"{binary.name}: {status}")
        if status != "ok":
            failures[binary.name] = status
    if failures:
        raise SystemExit(f"Smoke test failed: {failures}")


def _package_native_root() -> Path:
    try:
        from voltsdk.native import root as native_root

        return native_root()
    except ModuleNotFoundError:
        repo_python = Path(__file__).resolve().parents[2] / "python3" / "voltsdk"
        if (repo_python / "__init__.py").exists():
            sys.path.insert(0, str(repo_python.parent))
        from voltsdk.native import root as native_root

        return native_root()


def _native_root(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit.expanduser().resolve()
    env_root = os.environ.get("VOLTSDK_NATIVE_ROOT")
    if env_root:
        return Path(env_root).expanduser().resolve()
    return _package_native_root().resolve()


if __name__ == "__main__":
    main()
