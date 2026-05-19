#!/usr/bin/env python3
"""Compile VOLT plugin repositories and install their native binaries.

This script follows the command documented by the plugin READMEs:

    conan install . -of build --build=missing -o "hwloc/*:shared=True"
    cmake --preset conan-release
    cmake --build build/build/Release -j

For wheel production it adds only one necessary step: ``cmake --install`` into
a shared install root that is copied into ``voltsdk/native``.
"""

from __future__ import annotations

import argparse
import os
import platform
import re
import shutil
import stat
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class PluginBuild:
    repository: str
    binary: str | None = None
    dependencies: tuple[str, ...] = field(default_factory=tuple)


PLUGINS: tuple[PluginBuild, ...] = (
    PluginBuild("StructureIdentification", None),
    PluginBuild("AcklandJonesStructureIdentification", "ackland-jones-structure-identification"),
    PluginBuild("AtomicStrain", "atomic-strain"),
    PluginBuild("BasalPlaneVector", "basal-plane-vector"),
    PluginBuild("CentroSymmetryParameter", "centrosymmetry"),
    PluginBuild("ClusterAnalysis", "cluster-analysis"),
    PluginBuild("CommonNeighborAnalysis", "common-neighbor-analysis", ("StructureIdentification",)),
    PluginBuild("ComputeProperty", "compute-property"),
    PluginBuild("ConstructSurfaceMesh", "construct-surface-mesh"),
    PluginBuild("CoordinationAnalysis", "coordination-analysis"),
    PluginBuild("DisplacementsAnalysis", "displacement-analysis"),
    PluginBuild("ElasticStrain", "elastic-strain", ("StructureIdentification",)),
    PluginBuild("GrainSegmentation", "grain-segmentation", ("StructureIdentification", "CommonNeighborAnalysis", "PolyhedralTemplateMatching")),
    PluginBuild("LineReconstructionDXA", "line-reconstruction-dxa", ("StructureIdentification", "CommonNeighborAnalysis", "PolyhedralTemplateMatching", "OpenDXA")),
    PluginBuild("LocalComposition", "local-composition"),
    PluginBuild("OpenDXA", "opendxa", ("StructureIdentification",)),
    PluginBuild("PolyhedralTemplateMatching", "polyhedral-template-matching", ("StructureIdentification", "CommonNeighborAnalysis")),
    PluginBuild("SteinhardtOrderParameters", "steinhardt-order-parameters"),
    PluginBuild("VoronoiAnalysis", "voronoi-analysis"),
    PluginBuild("WignerSeitzDefectAnalysis", "wigner-seitz-defect-analysis"),
)

DEFAULT_CONAN_OPTIONS = ("hwloc/*:shared=True",)


def run(command: list[str], cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, env=env, check=True)


def output(command: list[str]) -> str:
    completed = subprocess.run(command, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return completed.stdout


def conan_option_args(options: Iterable[str]) -> list[str]:
    args: list[str] = []
    for option in options:
        args.append(f"-o={option}")
    return args


def export_conan_recipes(plugins_root: Path) -> None:
    for repository in ["CoreToolkit", *(plugin.repository for plugin in PLUGINS)]:
        source_dir = plugins_root / repository
        conanfile = source_dir / "conanfile.py"
        if conanfile.exists():
            run(["conan", "export", str(source_dir)])


def configure_build_install(
    source_dir: Path,
    build_dir: Path,
    install_root: Path,
    *,
    jobs: int,
    conan_options: list[str],
) -> None:
    build_dir.mkdir(parents=True, exist_ok=True)
    run(
        [
            "conan",
            "install",
            ".",
            "--output-folder",
            str(build_dir),
            "--build=missing",
            "-s",
            "build_type=Release",
            *conan_option_args(conan_options),
        ],
        cwd=source_dir,
    )

    toolchain = first_path(build_dir, "conan_toolchain.cmake")
    if toolchain is None:
        raise RuntimeError(f"Unable to locate conan_toolchain.cmake under {build_dir}")

    cmake_args = [
        "cmake",
        "-S",
        ".",
        "-B",
        str(toolchain.parent.parent),
        f"-DCMAKE_TOOLCHAIN_FILE={toolchain}",
        "-DCMAKE_BUILD_TYPE=Release",
        f"-DCMAKE_INSTALL_PREFIX={install_root}",
    ]
    if sys.platform == "linux":
        cmake_args.append("-DCMAKE_EXE_LINKER_FLAGS=-static-libstdc++ -static-libgcc")
    if shutil.which("ninja"):
        cmake_args.extend(["-G", "Ninja"])

    run(cmake_args, cwd=source_dir)
    run(["cmake", "--build", str(toolchain.parent.parent), "--config", "Release", "--parallel", str(jobs)], cwd=source_dir)
    run(["cmake", "--install", str(toolchain.parent.parent), "--config", "Release"], cwd=source_dir)


def first_path(root: Path, name: str) -> Path | None:
    for path in root.rglob(name):
        return path
    return None


def installed_binary_path(install_root: Path, binary: str) -> Path:
    candidates = [install_root / "bin" / binary]
    if sys.platform == "win32" and not binary.endswith(".exe"):
        candidates.insert(0, install_root / "bin" / f"{binary}.exe")
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise RuntimeError(f"Expected executable '{binary}' was not installed under {install_root / 'bin'}")


def collect_runtime_libraries(install_root: Path, build_root: Path) -> None:
    binaries = [path for path in (install_root / "bin").glob("*") if path.is_file()]
    if sys.platform == "linux":
        lib_dir = install_root / "lib"
        lib_dir.mkdir(exist_ok=True)
        for binary in binaries:
            for dependency in linux_dependencies(binary):
                if should_copy_linux_dependency(dependency):
                    copy_file_once(dependency, lib_dir / dependency.name)
    elif sys.platform == "darwin":
        lib_dir = install_root / "lib"
        lib_dir.mkdir(exist_ok=True)
        copied: list[tuple[Path, Path]] = []
        for binary in binaries:
            for dependency in macos_dependencies(binary):
                destination = copy_file_once(dependency, lib_dir / dependency.name)
                copied.append((dependency, destination))
        rewrite_macos_install_names(binaries, copied, lib_dir)
    elif sys.platform == "win32":
        for search_root in [install_root, build_root, Path(os.environ.get("CONAN_HOME", Path.home() / ".conan2")) / "p"]:
            if not search_root.exists():
                continue
            for dependency in search_root.rglob("*.dll"):
                copy_file_once(dependency, install_root / "bin" / dependency.name)


def linux_dependencies(binary: Path) -> list[Path]:
    try:
        ldd_output = output(["ldd", str(binary)])
    except (FileNotFoundError, subprocess.CalledProcessError):
        return []
    dependencies: list[Path] = []
    for line in ldd_output.splitlines():
        match = re.search(r"=>\s+(/\S+)", line) or re.search(r"^\s*(/\S+)", line)
        if match:
            path = Path(match.group(1))
            if path.exists():
                dependencies.append(path)
    return dependencies


def should_copy_linux_dependency(path: Path) -> bool:
    system_prefixes = ("/lib/", "/lib64/", "/usr/lib/", "/usr/lib64/")
    if not str(path).startswith(system_prefixes):
        return True
    return path.name.startswith(("libtbb", "libhwloc", "libboost"))


def macos_dependencies(binary: Path) -> list[Path]:
    try:
        otool_output = output(["otool", "-L", str(binary)])
    except (FileNotFoundError, subprocess.CalledProcessError):
        return []
    dependencies: list[Path] = []
    for line in otool_output.splitlines()[1:]:
        dependency = line.strip().split(" ", 1)[0]
        if dependency.startswith(("/System/Library/", "/usr/lib/", "@rpath/", "@loader_path/", "@executable_path/")):
            continue
        path = Path(dependency)
        if path.exists():
            dependencies.append(path)
    return dependencies


def copy_file_once(source: Path, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.resolve() == source.resolve():
        return destination
    if not destination.exists():
        shutil.copy2(source, destination)
        destination.chmod(destination.stat().st_mode | stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
    return destination


def rewrite_macos_install_names(binaries: list[Path], copied: list[tuple[Path, Path]], lib_dir: Path) -> None:
    if not shutil.which("install_name_tool"):
        return
    targets = [*binaries, *sorted(lib_dir.glob("*.dylib"))]
    for target in targets:
        rpath = "@loader_path/../lib" if target.parent.name == "bin" else "@loader_path"
        subprocess.run(["install_name_tool", "-add_rpath", rpath, str(target)], check=False)
        for original, copied_path in copied:
            subprocess.run(["install_name_tool", "-change", str(original), f"@rpath/{copied_path.name}", str(target)], check=False)


def selected_plugins(requested: list[str] | None) -> list[PluginBuild]:
    if not requested:
        return list(PLUGINS)
    by_name = {plugin.repository: plugin for plugin in PLUGINS}
    result: list[PluginBuild] = []
    for name in requested:
        plugin = by_name.get(name)
        if plugin is None:
            raise SystemExit(f"Unknown plugin repository: {name}")
        for dependency in plugin.dependencies:
            dependency_plugin = by_name[dependency]
            if dependency_plugin not in result:
                result.append(dependency_plugin)
        if plugin not in result:
            result.append(plugin)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plugins-root", type=Path, required=True)
    parser.add_argument("--install-root", type=Path, required=True)
    parser.add_argument("--build-root", type=Path, default=Path("build/native-plugins"))
    parser.add_argument("--jobs", type=int, default=os.cpu_count() or 2)
    parser.add_argument("--project", action="append")
    parser.add_argument("--conan-option", action="append", default=list(DEFAULT_CONAN_OPTIONS))
    args = parser.parse_args()

    if platform.machine().lower() not in {"x86_64", "amd64", "arm64", "aarch64"}:
        raise SystemExit(f"Unsupported architecture: {platform.machine()}")

    plugins_root = args.plugins_root.resolve()
    install_root = args.install_root.resolve()
    build_root = args.build_root.resolve()
    install_root.mkdir(parents=True, exist_ok=True)
    build_root.mkdir(parents=True, exist_ok=True)

    run(["conan", "profile", "detect", "--force"])
    export_conan_recipes(plugins_root)

    for plugin in selected_plugins(args.project):
        source_dir = plugins_root / plugin.repository
        if not source_dir.exists():
            raise FileNotFoundError(source_dir)
        configure_build_install(
            source_dir,
            build_root / plugin.repository,
            install_root,
            jobs=args.jobs,
            conan_options=args.conan_option,
        )
        if plugin.binary:
            binary = installed_binary_path(install_root, plugin.binary)
            binary.chmod(binary.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    collect_runtime_libraries(install_root, build_root)
    print(f"Installed native plugin binaries into {install_root}")


if __name__ == "__main__":
    main()
