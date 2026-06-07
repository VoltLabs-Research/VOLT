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

        hub = PluginHub(default_publisher="voltlabs")
        ptm = hub.get("polyhedral-template-matching")
        ptm("frame.dump", output_dir="out", rmsd=0.1)
    """

    def __init__(
        self,
        registry: PluginRegistry | None = None,
        *,
        url: str | None = None,
        cache_dir: str | os.PathLike[str] | None = None,
        default_publisher: str | None = None,
        token: str | None = None,
    ) -> None:
        self.registry = registry or PluginRegistry(url=url, cache_dir=cache_dir, token=token)
        self.default_publisher = default_publisher

    # ------------------------------------------------------------------
    # Marketplace
    # ------------------------------------------------------------------

    def list(self) -> list[str]:
        return self.registry.list()

    def versions(self, key: str) -> list[str]:
        return self.registry.versions(self._plugin_key(key))

    def install(self, key: str, version: str | None = None, *, force: bool = False) -> Path:
        return self.registry.install(self._plugin_key(key), version, force=force)

    def uninstall(self, key: str, version: str | None = None) -> None:
        self.registry.uninstall(self._plugin_key(key), version)

    # ------------------------------------------------------------------
    # Instantiation
    # ------------------------------------------------------------------

    def get(self, key: str, version: str | None = None) -> Plugin:
        plugin_key = self._plugin_key(key)
        installed = self.registry.installed(plugin_key, version) if not version else None
        root = installed or self.registry.install(plugin_key, version)
        resolved_version = version or root.parent.name
        return Plugin(_legacy_key(plugin_key), resolved_version, root)

    # ------------------------------------------------------------------
    # Sugar
    # ------------------------------------------------------------------

    def __getitem__(self, key: str) -> Plugin:
        return self.get(key)

    def __contains__(self, key: str) -> bool:
        try:
            self.registry.resolve(self._plugin_key(key))
        except (PluginNotFoundError, ValueError):
            return False
        return True

    def _plugin_key(self, key: str) -> str:
        if '@' in key or '/' in key or not self.default_publisher:
            return key
        return f'{self.default_publisher}@{key}'

    def __repr__(self) -> str:
        return (
            f'<PluginHub url={self.registry.url!r} '
            f'cache={self.registry.cache_dir!s} '
            f'default_publisher={self.default_publisher!r}>'
        )


def _legacy_key(key: str) -> str:
    """Render a normalized publisher@name key from either canonical or legacy input."""
    from .registry import _resolve_key

    try:
        scope, name = _resolve_key(key)
    except ValueError:
        return key
    return f'{scope}@{name}'
