from __future__ import annotations

import importlib
from typing import TYPE_CHECKING

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

_LAZY = {
    "VoltClient": (".client", "VoltClient"),
    "msgpack_as_df": (".io.msgpack", "msgpack_as_df"),
    "open_in_volt": (".viewer", "open_in_volt"),
    "SpatialAssembler": (".spatial", "SpatialAssembler"),
}

if TYPE_CHECKING:

    from .client import VoltClient
    from .io.msgpack import msgpack_as_df
    from .spatial import SpatialAssembler
    from .viewer import open_in_volt

__version__ = "3.1.1"

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
    target = _LAZY.get(name)
    if target is None:
        raise AttributeError(name)
    value = getattr(importlib.import_module(target[0], __name__), target[1])
    globals()[name] = value
    return value

def __dir__() -> list[str]:
    return sorted(__all__)
