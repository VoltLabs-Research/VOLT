from __future__ import annotations


class PluginError(RuntimeError):
    """Base error for the Volt plugin hub."""


class PluginNotFoundError(PluginError):
    """Raised when a plugin key (or version) is not in the registry."""


class PluginVerificationError(PluginError):
    """Raised when a downloaded bundle fails sha256 verification."""
