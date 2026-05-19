#!/usr/bin/env python3
"""Clone the VOLT plugin source repositories needed to build binary wheels."""

from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path


REPOSITORIES = [
    "CoreToolkit",
    "StructureIdentification",
    "AcklandJonesStructureIdentification",
    "AtomicStrain",
    "BasalPlaneVector",
    "CentroSymmetryParameter",
    "ClusterAnalysis",
    "CommonNeighborAnalysis",
    "ComputeProperty",
    "ConstructSurfaceMesh",
    "CoordinationAnalysis",
    "DisplacementsAnalysis",
    "ElasticStrain",
    "GrainSegmentation",
    "LineReconstructionDXA",
    "LocalComposition",
    "OpenDXA",
    "PolyhedralTemplateMatching",
    "SteinhardtOrderParameters",
    "VoronoiAnalysis",
    "WignerSeitzDefectAnalysis",
]


def run(command: list[str], cwd: Path | None = None) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dest", type=Path, required=True, help="Destination plugins root")
    parser.add_argument("--owner", default=os.environ.get("VOLT_PLUGIN_GITHUB_OWNER", "VoltLabs-Research"))
    parser.add_argument("--ref", default=os.environ.get("VOLT_PLUGIN_REF"), help="Optional branch/tag/SHA to checkout")
    parser.add_argument("--repository", action="append", choices=REPOSITORIES, help="Clone only this repository")
    args = parser.parse_args()

    args.dest.mkdir(parents=True, exist_ok=True)
    repositories = args.repository or REPOSITORIES
    for name in repositories:
        target = args.dest / name
        if target.exists():
            if (target / ".git").exists():
                run(["git", "fetch", "--tags", "--prune"], cwd=target)
                if args.ref:
                    run(["git", "checkout", args.ref], cwd=target)
            else:
                print(f"Skipping existing non-git directory: {target}")
            continue

        url = f"https://github.com/{args.owner}/{name}.git"
        clone_command = ["git", "clone", "--depth", "1"]
        if args.ref:
            clone_command.extend(["--branch", args.ref])
        clone_command.extend([url, str(target)])
        run(clone_command)


if __name__ == "__main__":
    main()
