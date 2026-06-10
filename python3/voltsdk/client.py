from __future__ import annotations

import os

from .http import HttpTransport
from .plugins import PluginHub
from .resources.analyses import AnalysisCollection
from .resources.trajectories import TrajectoryCollection

class VoltClient:

    def __init__(
        self,
        secret_key: str | None = None,
        base_url: str | None = None,
        *,
        plugin_registry_url: str | None = None,
        plugin_registry_token: str | None = None,
        plugin_cache_dir: str | None = None,
    ) -> None:
        self._secret_key = secret_key or os.environ.get('VOLT_SECRET_KEY')
        self._base_url = (
            base_url
            or os.environ.get('VOLT_BASE_URL')
            or self._detect_base_url()
        )

        self._plugin_registry_url = plugin_registry_url
        self._plugin_registry_token = plugin_registry_token
        self._plugin_cache_dir = plugin_cache_dir

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

        self._team: dict | None = None
        self._plugins: PluginHub | None = None

    @classmethod
    def from_env(cls) -> VoltClient:
        return cls()

    @staticmethod
    def _detect_base_url() -> str | None:
        for var in ('VOLT_SERVER_URL', 'JUPYTERHUB_API_URL'):
            url = os.environ.get(var)
            if url:
                return url.rstrip('/') + '/api'
        return None

    @property
    def team(self) -> dict:
        if self._team is None:
            self._team = self._http.get('/teams/secret-keys/me')
        return self._team

    @property
    def trajectories(self) -> TrajectoryCollection:
        return TrajectoryCollection(self._http)

    @property
    def analyses(self) -> AnalysisCollection:
        team_id = self._http.team_id
        return AnalysisCollection(
            self._http,
            path=f'/analyses/{team_id}/',
        )

    @property
    def plugins(self) -> PluginHub:
        if self._plugins is None:
            self._plugins = PluginHub(
                url=self._plugin_registry_url,
                token=self._plugin_registry_token,
                cache_dir=self._plugin_cache_dir,
            )
        return self._plugins

    def __repr__(self) -> str:
        return f'<VoltClient base_url={self._base_url!r}>'
