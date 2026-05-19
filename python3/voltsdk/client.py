"""VoltClient — the main entry point for the VoltSDK.

Usage::

    from voltsdk import VoltClient

    # Inside a Volt Jupyter notebook (zero-config):
    client = VoltClient.from_env()

    # Explicit secret key:
    client = VoltClient(secret_key="vsk_xxxxx")

    # Fully explicit (external Jupyter, e.g. Google Colab):
    client = VoltClient(
        secret_key="vsk_xxxxx",
        base_url="https://server.voltcloud.dev/api",
    )

No network calls are made during construction.  The first network call
happens lazily when a resource property is accessed.
"""

from __future__ import annotations

import os

from .http import HttpTransport
from .plugins import PluginHub
from .resources.analyses import AnalysisCollection
from .resources.teams import Team
from .resources.trajectories import TrajectoryCollection


class VoltClient:
    """Client for the Volt scientific computing platform.

    Parameters
    ----------
    secret_key:
        Team secret key (prefix ``vsk_``).  If not provided, reads from
        the ``VOLT_SECRET_KEY`` environment variable.
    base_url:
        Volt API endpoint.  If not provided, reads from
        ``VOLT_BASE_URL``, or falls back to auto-detection from the
        Jupyter proxy configuration.

    No network calls are made during construction.
    """

    def __init__(
        self,
        secret_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self._secret_key = secret_key or os.environ.get('VOLT_SECRET_KEY')
        self._base_url = (
            base_url
            or os.environ.get('VOLT_BASE_URL')
            or self._detect_base_url()
        )

        if not self._secret_key:
            raise ValueError(
                'secret_key is required. '
                'Provide it directly or set VOLT_SECRET_KEY.'
            )
        if not self._base_url:
            raise ValueError(
                'base_url is required. '
                'Provide it directly or set VOLT_BASE_URL.'
            )

        self._http = HttpTransport(
            base_url=self._base_url,
            secret_key=self._secret_key,
        )

        # Lazy-loaded team context
        self._team: Team | None = None
        self._plugins: PluginHub | None = None

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def from_env(cls) -> VoltClient:
        """Create a client using environment variables.

        Reads ``VOLT_SECRET_KEY`` and ``VOLT_BASE_URL`` from the
        environment.  This is the recommended way to authenticate inside
        Volt notebooks.
        """
        return cls()

    # ------------------------------------------------------------------
    # Auto-detection
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_base_url() -> str | None:
        """Auto-detect base URL inside Volt Jupyter containers."""
        for var in ('VOLT_SERVER_URL', 'JUPYTERHUB_API_URL'):
            url = os.environ.get(var)
            if url:
                return url.rstrip('/') + '/api'
        return None

    # ------------------------------------------------------------------
    # Team context (lazy)
    # ------------------------------------------------------------------

    @property
    def team(self) -> Team:
        """The team associated with the current secret key (lazy-loaded)."""
        if self._team is None:
            data = self._http.get('/teams/secret-keys/me')
            self._team = Team(self._http, data)
        return self._team

    # ------------------------------------------------------------------
    # Resource collections
    # ------------------------------------------------------------------

    @property
    def trajectories(self) -> TrajectoryCollection:
        """Lazy, paginated collection of trajectories."""
        return TrajectoryCollection(self._http)

    @property
    def analyses(self) -> AnalysisCollection:
        """Lazy, paginated collection of analyses (team-wide)."""
        team_id = self._http.team_id
        return AnalysisCollection(
            self._http,
            path=f'/analyses/{team_id}/',
        )

    @property
    def plugins(self) -> PluginHub:
        """Plugin marketplace (download, cache, run native plugins)."""
        if self._plugins is None:
            self._plugins = PluginHub()
        return self._plugins

    # ------------------------------------------------------------------
    # Dunder
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return f'<VoltClient base_url={self._base_url!r}>'
