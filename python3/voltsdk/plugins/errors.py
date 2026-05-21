from __future__ import annotations


class PluginError(RuntimeError):
    """Base error for the Volt plugin hub."""


class PluginNotFoundError(PluginError):
    """Raised when a plugin key (or version) is not in the registry."""


class PluginVerificationError(PluginError):
    """Reserved for plugin bundle validation failures."""
