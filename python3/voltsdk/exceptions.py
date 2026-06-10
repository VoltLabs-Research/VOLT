from __future__ import annotations

class VoltError(Exception):
    pass

class VoltAPIError(VoltError):

    def __init__(self, status_code: int, message: str, url: str = '') -> None:
        self.status_code = status_code
        self.url = url
        self.server_message = message
        suffix = f' ({url})' if url else ''
        super().__init__(f'{status_code}: {message}{suffix}')

class VoltAuthenticationError(VoltAPIError):
    pass

class VoltPermissionError(VoltAPIError):
    pass

class VoltNotFoundError(VoltAPIError):
    pass

class VoltConnectionError(VoltError):
    pass

class VoltTimeoutError(VoltError):
    pass
