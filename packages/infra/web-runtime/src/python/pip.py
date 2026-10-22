"""pip as the runtime's python3 runs it (`python3 -m pip`, and `%pip` in a notebook): installs into the
running environment, the virtual environment of the interpreter or the machine's site-packages, with
micropip: Pyodide's builds of packages with native code, and pure-Python wheels from PyPI and from
files."""

import argparse
import importlib
import importlib.metadata
import json
import os
import re
import sys

import micropip
from pyodide.ffi import create_proxy, to_js

# The wheels the machine has of packages of its own (the VOLT SDK of its server), which a requirement
# that names one without a version installs, rather than the index's.
WHEELS = "/usr/local/share/python-wheels"


def _canonical(name):
    return re.sub(r"[-_.]+", "-", name).lower()


def local_wheel(requirement):
    """The machine's wheel of the package a requirement names, if it names one alone."""
    name = requirement.strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", name) or not os.path.isdir(WHEELS):
        return None
    for filename in sorted(os.listdir(WHEELS)):
        if filename.endswith(".whl") and _canonical(filename.split("-")[0]) == _canonical(name):
            return os.path.join(WHEELS, filename)
    return None


def wheel_version(path):
    return os.path.basename(path).split("-")[1]


def _installed_version(name):
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def _requirements_file(path):
    requirements = []
    with open(path) as file:
        for raw in file:
            # Comments, and the per-requirement options (hashes) micropip has no use for.
            line = raw.split(" #", 1)[0].split(" --", 1)[0].strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith(("-r ", "--requirement ")):
                included = line.split(None, 1)[1].strip()
                requirements += _requirements_file(os.path.join(os.path.dirname(path), included))
                continue
            # Index options: micropip's own index applies.
            if line.startswith("-"):
                continue
            requirements.append(line)
    return requirements


def _installed():
    installed = {}
    for distribution in importlib.metadata.distributions():
        name = distribution.metadata["Name"]
        if name:
            installed[name] = distribution.version
    return installed


def _parser():
    parser = argparse.ArgumentParser(prog="pip")
    parser.add_argument("-V", "--version", action="store_true")
    commands = parser.add_subparsers(dest="command")

    install = commands.add_parser("install")
    install.add_argument("packages", nargs="*")
    install.add_argument("-r", "--requirement", action="append", default=[])
    install.add_argument("-U", "--upgrade", action="store_true")
    install.add_argument("--force-reinstall", action="store_true")
    install.add_argument("--no-deps", action="store_true")
    install.add_argument("--pre", action="store_true")
    install.add_argument("-q", "--quiet", action="count", default=0)
    install.add_argument("-i", "--index-url")
    install.add_argument("--extra-index-url", action="append", default=[])
    # Accepted as pip accepts them; installs land in the running environment, from the network.
    install.add_argument("--user", action="store_true")
    install.add_argument("--no-cache-dir", action="store_true")
    install.add_argument("--disable-pip-version-check", action="store_true")

    uninstall = commands.add_parser("uninstall")
    uninstall.add_argument("packages", nargs="*")
    uninstall.add_argument("-r", "--requirement", action="append", default=[])
    uninstall.add_argument("-y", "--yes", action="store_true")

    listing = commands.add_parser("list")
    listing.add_argument("--format", choices=["columns", "freeze", "json"], default="columns")

    commands.add_parser("freeze")

    show = commands.add_parser("show")
    show.add_argument("packages", nargs="+")
    return parser


class _PackageMessages:
    """Pyodide's messages as it loads the packages of its own that micropip installs: which ones,
    and not where it downloads and caches them."""

    def __init__(self, quiet):
        self._quiet = quiet
        self._layer = getattr(getattr(micropip, "_compat", None), "compatibility_layer", None)
        self._load = getattr(self._layer, "loadPackage", None)
        self._callback = None

    def _show(self, message):
        if not self._quiet and message.startswith("Loading "):
            print(message.replace("Loading ", "Installing ", 1))

    def __enter__(self):
        if self._load is not None:
            import js

            self._callback = create_proxy(self._show)
            options = to_js({"messageCallback": self._callback}, dict_converter=js.Object.fromEntries)
            load = self._load

            async def load_package(names):
                return await load(names, options)

            self._layer.loadPackage = load_package
        return self

    def __exit__(self, *_exception):
        if self._callback is not None:
            self._layer.loadPackage = self._load
            self._callback.destroy()


def _wheel_file(requirement, options):
    """The wheel file a requirement installs: the file it is, or the machine's wheel of the package it
    names, unless the environment has that package and is not asked to change it."""
    if requirement.endswith(".whl") and os.path.isfile(requirement):
        return requirement
    wheel = local_wheel(requirement)
    if wheel is None:
        return None
    installed = _installed_version(requirement.strip())
    if installed is None or options.force_reinstall or (options.upgrade and installed != wheel_version(wheel)):
        return wheel
    return None


async def _install(options):
    requirements = list(options.packages)
    for path in options.requirement:
        requirements += _requirements_file(path)
    if not requirements:
        print("ERROR: You must give at least one requirement to install", file=sys.stderr)
        return 1
    wheels = [_wheel_file(requirement, options) for requirement in requirements]
    # micropip reads a wheel of the file system from its emfs: URL.
    targets = [f"emfs:{os.path.abspath(wheel)}" if wheel else requirement for requirement, wheel in zip(requirements, wheels)]
    index_urls = [url for url in [options.index_url, *options.extra_index_url] if url] or None
    before = _installed()
    with _PackageMessages(options.quiet):
        await micropip.install(
            targets,
            deps=not options.no_deps,
            pre=options.pre,
            index_urls=index_urls,
            # A wheel file replaces the version of its package the environment has, as with pip.
            reinstall=options.upgrade or options.force_reinstall or any(wheels),
        )
    importlib.invalidate_caches()
    changed = sorted(f"{name}-{version}" for name, version in _installed().items() if before.get(name) != version)
    if not options.quiet:
        if changed:
            print("Successfully installed " + " ".join(changed))
        else:
            print("Requirement already satisfied: " + ", ".join(requirements))
    return 0


def _uninstall(options):
    names = list(options.packages)
    for path in options.requirement:
        names += _requirements_file(path)
    installed = {name.lower() for name in _installed()}
    missing = [name for name in names if name.lower() not in installed]
    for name in missing:
        print(f"WARNING: Skipping {name} as it is not installed.", file=sys.stderr)
    present = [name for name in names if name.lower() in installed]
    if present:
        micropip.uninstall(present)
        importlib.invalidate_caches()
        for name in present:
            print(f"Successfully uninstalled {name}")
    return 0


def _list(options):
    installed = sorted(_installed().items(), key=lambda item: item[0].lower())
    if options.format == "json":
        print(json.dumps([{"name": name, "version": version} for name, version in installed]))
    elif options.format == "freeze":
        for name, version in installed:
            print(f"{name}=={version}")
    else:
        width = max([len("Package"), *(len(name) for name, _ in installed)])
        print(f"{'Package'.ljust(width)} Version")
        print(f"{'-' * width} -------")
        for name, version in installed:
            print(f"{name.ljust(width)} {version}")
    return 0


def _freeze():
    for name, version in sorted(_installed().items(), key=lambda item: item[0].lower()):
        if name != "micropip":
            print(f"{name}=={version}")
    return 0


def _show(options):
    found = False
    for name in options.packages:
        try:
            distribution = importlib.metadata.distribution(name)
        except importlib.metadata.PackageNotFoundError:
            print(f"WARNING: Package(s) not found: {name}", file=sys.stderr)
            continue
        if found:
            print("---")
        found = True
        metadata = distribution.metadata
        print(f"Name: {metadata['Name']}")
        print(f"Version: {distribution.version}")
        print(f"Summary: {metadata.get('Summary', '')}")
        print(f"Location: {distribution.locate_file('')}")
        print(f"Requires: {', '.join(distribution.requires or [])}")
    return 0 if found else 1


async def main(argv):
    try:
        options = _parser().parse_args(list(argv))
    except SystemExit as exit:
        return exit.code if isinstance(exit.code, int) else 2
    try:
        if options.version:
            print(f"pip (micropip {micropip.__version__}) from {os.path.dirname(micropip.__file__)} (python {sys.version_info.major}.{sys.version_info.minor})")
            return 0
        if options.command == "install":
            return await _install(options)
        if options.command == "uninstall":
            return _uninstall(options)
        if options.command == "list":
            return _list(options)
        if options.command == "freeze":
            return _freeze()
        if options.command == "show":
            return _show(options)
        _parser().print_help()
        return 0
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
