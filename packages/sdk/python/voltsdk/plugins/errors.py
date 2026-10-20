from __future__ import annotations

class PluginError(RuntimeError):
    pass

class PluginNotFoundError(PluginError):
    pass

class PluginVerificationError(PluginError):
    pass

class PluginYankedError(PluginError):
    pass

class NetworkError(PluginError):
    pass
