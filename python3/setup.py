from __future__ import annotations

import os
from pathlib import Path

from setuptools import setup

try:
    from wheel.bdist_wheel import bdist_wheel as _bdist_wheel
except ImportError:  # pragma: no cover - build backend provides wheel
    _bdist_wheel = None


PROJECT_ROOT = Path(__file__).resolve().parent
PACKAGE_ROOT = PROJECT_ROOT / "voltsdk"
NATIVE_ROOT = PACKAGE_ROOT / "native"
PLATFORM_TAG_ENV = "VOLTSDK_PLATFORM_TAG"


def _native_runtime_staged() -> bool:
    return any((NATIVE_ROOT / name).exists() for name in ("bin", "lib", "share"))


def _requested_platform_tag() -> str:
    return os.environ.get(PLATFORM_TAG_ENV, "").strip()


cmdclass: dict[str, type] = {}
setup_kwargs = {"zip_safe": False}


if _bdist_wheel is not None:

    class bdist_wheel(_bdist_wheel):
        def finalize_options(self) -> None:
            super().finalize_options()
            platform_tag = _requested_platform_tag()
            if platform_tag:
                self.plat_name_supplied = True
                self.plat_name = platform_tag
            if platform_tag or _native_runtime_staged():
                self.root_is_pure = False

        def get_tag(self) -> tuple[str, str, str]:
            python_tag, abi_tag, platform_tag = super().get_tag()
            requested = _requested_platform_tag()
            if requested:
                platform_tag = requested
            return python_tag, abi_tag, platform_tag

    cmdclass["bdist_wheel"] = bdist_wheel


if cmdclass:
    setup_kwargs["cmdclass"] = cmdclass


setup(**setup_kwargs)
