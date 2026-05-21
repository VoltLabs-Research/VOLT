"""VoltSDK - Python SDK for the Volt scientific computing platform.

Quick start::

    from voltsdk import VoltClient, PluginHub

    # Marketplace, no auth needed:
    hub = PluginHub()
    ptm = hub.get("voltlabs@polyhedral-template-matching")
    ptm.run("frame.dump", output_base="out/frame", rmsd=0.1)

    # Or via an authenticated client:
    client = VoltClient.from_env()
    client.plugins.get("voltlabs@opendxa").run("frame.dump", output_base="out/frame")
"""

from __future__ import annotations

from .exceptions import (
    VoltAPIError,
    VoltAuthenticationError,
    VoltConnectionError,
    VoltError,
    VoltNotFoundError,
    VoltPermissionError,
    VoltTimeoutError,
)
from .plugins import (
    Plugin,
    PluginError,
    PluginHub,
    PluginNotFoundError,
    PluginRun,
    PluginVerificationError,
)
from .native import root as native_root

__version__ = "2.2.2"

__all__ = [
    "VoltClient",
    "VoltError",
    "VoltAPIError",
    "VoltAuthenticationError",
    "VoltConnectionError",
    "VoltNotFoundError",
    "VoltPermissionError",
    "VoltTimeoutError",
    "msgpack_as_df",
    "view_glb",
    "Plugin",
    "PluginError",
    "PluginHub",
    "PluginNotFoundError",
    "PluginRun",
    "PluginVerificationError",
    "native_root",
]


def __getattr__(name: str):
    if name == "VoltClient":
        from .client import VoltClient

        globals()[name] = VoltClient
        return VoltClient
    if name == "msgpack_as_df":
        from .io.msgpack import msgpack_as_df

        globals()[name] = msgpack_as_df
        return msgpack_as_df
    if name == "view_glb":
        from .integrations.glb import view_glb

        globals()[name] = view_glb
        return view_glb
    raise AttributeError(name)
