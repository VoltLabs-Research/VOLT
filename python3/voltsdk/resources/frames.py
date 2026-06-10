from __future__ import annotations

from typing import TYPE_CHECKING

from .base import BaseResource

if TYPE_CHECKING:
    import pandas as pd
    from voltsdk.http import HttpTransport

class Frame(BaseResource):

    def __init__(self, client: HttpTransport, trajectory_id: str, data: dict) -> None:
        super().__init__(client, data)
        self._trajectory_id = trajectory_id

    def atoms(self, analysis_id: str = 'default', page: int = 1, limit: int = 10_000) -> pd.DataFrame:
        import pandas as _pd

        team_id = self._client.team_id
        data = self._client.get(
            f'/trajectories/{team_id}/{self._trajectory_id}/atoms',
            params={'timestep': self._get('timestep', 0), 'analysisId': analysis_id, 'page': page, 'limit': limit},
        )
        rows = data.get('data', data) if isinstance(data, dict) else data
        return _pd.DataFrame(rows) if isinstance(rows, list) else _pd.DataFrame()

    def download_dump(self, dest: str = '.') -> str:
        team_id = self._client.team_id
        timestep = self._get('timestep', 0)
        return self._client.download_stream(
            f'/trajectories/{team_id}/{self._trajectory_id}/download',
            fallback_name=f'timestep-{timestep}.dump.gz',
            dest=dest,
            params={'timestep': timestep},
        )

    def download_glb(self, analysis_id: str = 'default', dest: str = '.') -> str:
        team_id = self._client.team_id
        timestep = self._get('timestep', 0)
        return self._client.download_stream(
            f'/trajectories/{team_id}/{self._trajectory_id}/glb/{timestep}/{analysis_id}',
            fallback_name=f'frame-{timestep}.glb',
            dest=dest,
        )

    def open_in_volt(self, analysis_id: str = 'default', *, volt_url: str | None = None, open_browser: bool = True) -> str:
        from voltsdk.viewer import open_canvas_view

        return open_canvas_view(
            trajectory_id=self._trajectory_id,
            analysis_id=analysis_id,
            timestep=self._get('timestep', 0),
            volt_url=volt_url,
            open_browser=open_browser,
        )

    def to_ovito_data(self):
        from voltsdk.integrations.ovito import frame_to_data

        return frame_to_data(self)

    def __repr__(self) -> str:
        return f'<Frame timestep={self._get("timestep", 0)}>'

class FrameCollection(list):

    def __init__(self, client: HttpTransport, trajectory_id: str, frames_data: list[dict]) -> None:
        super().__init__(Frame(client, trajectory_id, fd) for fd in frames_data)

    def first(self) -> Frame | None:
        return self[0] if self else None

    def to_dataframe(self) -> pd.DataFrame:
        import pandas as _pd

        return _pd.DataFrame([f.raw for f in self])
