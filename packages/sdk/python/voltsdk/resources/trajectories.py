from __future__ import annotations

from typing import TYPE_CHECKING

from .base import BaseResource, BaseCollection

if TYPE_CHECKING:
    from voltsdk.http import HttpTransport
    from .analyses import AnalysisCollection
    from .frames import FrameCollection
    from .listings import TrajectoryListingProxy

class Trajectory(BaseResource):

    @property
    def frames(self) -> FrameCollection:
        from .frames import FrameCollection as _FC

        return _FC(self._client, self.id, self._get('frames', []))

    @property
    def analyses(self) -> AnalysisCollection:
        from .analyses import AnalysisCollection as _AC

        team_id = self._client.team_id
        return _AC(self._client, path=f'/analyses/{team_id}/trajectory/{self.id}')

    @property
    def simulation_cell(self) -> dict | None:
        team_id = self._client.team_id
        return self._client.get(f'/simulation-cells/{team_id}/trajectories/{self.id}') or None

    @property
    def listings(self) -> TrajectoryListingProxy:
        from .listings import TrajectoryListingProxy as _TLP

        return _TLP(self._client, self)

    def download(self, dest: str = '.') -> str:
        team_id = self._client.team_id
        return self._client.download_stream(
            f'/trajectories/{team_id}/{self.id}/download',
            fallback_name=f'trajectory-{self.id}.zip',
            dest=dest,
        )

    def open_in_volt(
        self,
        *,
        analysis_id: str | None = None,
        timestep: int | None = None,
        volt_url: str | None = None,
        open_browser: bool = True,
    ) -> str:
        from voltsdk.viewer import open_canvas_view

        return open_canvas_view(
            trajectory_id=self.id,
            analysis_id=analysis_id,
            timestep=timestep,
            volt_url=volt_url,
            open_browser=open_browser,
        )

    def to_ovito_pipeline(self, timesteps=None):
        from voltsdk.integrations.ovito import create_pipeline

        return create_pipeline(self, timesteps=timesteps)

class TrajectoryCollection(BaseCollection['Trajectory']):

    def __init__(
        self,
        client: HttpTransport,
        params: dict | None = None,
        page_size: int = 100,
    ) -> None:
        team_id = client.team_id
        super().__init__(
            client,
            path=f'/trajectories/{team_id}/',
            resource_cls=Trajectory,
            params=params,
            page_size=page_size,
        )

    def get(self, trajectory_id: str) -> Trajectory:
        team_id = self._client.team_id
        return Trajectory(self._client, self._client.get(f'/trajectories/{team_id}/{trajectory_id}'))

    def list(self, search: str | None = None) -> list[Trajectory]:
        if search:
            self._params['search'] = search
        return super().list()
