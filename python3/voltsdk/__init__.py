"""VoltSDK - Python SDK for the Volt scientific computing platform.

Quick start::

    from voltsdk import VoltClient, PluginHub

    hub = PluginHub(default_publisher="voltlabs")
    ptm = hub.get("polyhedral-template-matching")
    run = ptm("frame.dump", output_dir="out", rmsd=0.1)
    print(run["annotated.dump"].path)

    client = VoltClient.from_env()
    dxa = client.plugins.get("voltlabs@opendxa")
    dxa("frame.dump", output_dir="out")
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
    NetworkError,
    Plugin,
    PluginArtifact,
    PluginError,
    PluginHub,
    PluginNotFoundError,
    PluginRun,
    PluginVerificationError,
    PluginYankedError,
)
from .native import root as native_root

__version__ = "3.0.0"

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
    "open_in_volt",
    "SpatialAssembler",
    "view_glb",
    "Plugin",
    "PluginArtifact",
    "PluginError",
    "PluginHub",
    "PluginNotFoundError",
    "PluginRun",
    "PluginVerificationError",
    "PluginYankedError",
    "NetworkError",
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
    if name == "open_in_volt":
        from .viewer import open_in_volt

        globals()[name] = open_in_volt
        return open_in_volt
    if name == "SpatialAssembler":
        from .spatial import SpatialAssembler

        globals()[name] = SpatialAssembler
        return SpatialAssembler
    if name == "view_glb":
        from .integrations.glb import view_glb

        globals()[name] = view_glb
        return view_glb
    raise AttributeError(name)
