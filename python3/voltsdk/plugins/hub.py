"""High-level entry point: plugin marketplace + instantiation."""

from __future__ import annotations

import os
from pathlib import Path

from .errors import PluginNotFoundError
from .plugin import Plugin
from .registry import PluginRegistry


class PluginHub:
    """Hugging Face-style hub for Volt plugins.

    Usage::

        hub = PluginHub()
        ptm = hub.get("voltlabs@polyhedral-template-matching")
        ptm.run("frame.dump", output_base="out/frame", rmsd=0.1)
    """

    def __init__(
        self,
        registry: PluginRegistry | None = None,
        *,
        url: str | None = None,
        cache_dir: str | os.PathLike[str] | None = None,
    ) -> None:
        self.registry = registry or PluginRegistry(url=url, cache_dir=cache_dir)

    # ------------------------------------------------------------------
    # Marketplace
    # ------------------------------------------------------------------

    def list(self) -> list[str]:
        return self.registry.list()

    def versions(self, key: str) -> list[str]:
        return self.registry.versions(key)

    def install(self, key: str, version: str | None = None, *, force: bool = False) -> Path:
        return self.registry.install(key, version, force=force)

    def uninstall(self, key: str, version: str | None = None) -> None:
        self.registry.uninstall(key, version)

    # ------------------------------------------------------------------
    # Instantiation
    # ------------------------------------------------------------------

    def get(self, key: str, version: str | None = None) -> Plugin:
        installed = self.registry.installed(key, version) if not version else None
        root = installed or self.registry.install(key, version)
        resolved_version = version or root.parent.name
        return Plugin(key, resolved_version, root)

    # ------------------------------------------------------------------
    # Sugar
    # ------------------------------------------------------------------

    def __getitem__(self, key: str) -> Plugin:
        return self.get(key)

    def __contains__(self, key: str) -> bool:
        try:
            self.registry.resolve(key)
        except (PluginNotFoundError, ValueError):
            return False
        return True

    def __repr__(self) -> str:
        return f"<PluginHub url={self.registry.url!r} cache={self.registry.cache_dir!s}>"
