from __future__ import annotations


class PluginError(RuntimeError):
    """Base error for the Volt plugin hub."""


class PluginNotFoundError(PluginError):
    """Raised when a plugin key (or version) is not in the registry."""


class PluginVerificationError(PluginError):
    """Raised when a downloaded bundle fails integrity checks (sha256/signature)."""


class PluginYankedError(PluginError):
    """Raised when the requested version has been yanked from the registry."""


class NetworkError(PluginError):
    """Raised on transport failures while talking to the registry."""
