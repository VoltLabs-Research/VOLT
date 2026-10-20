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

    @property
    def timestep(self) -> int:
        return int(self._get('timestep', 0))

    @property
    def natoms(self) -> int:
        return int(self._get('natoms', 0))

    def atoms(self, analysis_id: str = 'default') -> pd.DataFrame:
        """Return every atom of this frame as a DataFrame.

        Fetches all pages of the columnar atom stream and concatenates them, so
        the result is the full frame regardless of size.
        """
        import pandas as _pd

        from voltsdk.io.atoms import atoms_columnar_as_df, atoms_columnar_meta

        team_id = self._client.team_id
        path = f'/trajectories/{team_id}/{self._trajectory_id}/frame/{self._get("timestep", 0)}/atoms'
        params = {'analysisId': analysis_id, 'fmt': 'bin', 'page': 1}

        first = self._client.get_bytes(path, params=params)
        frames = [atoms_columnar_as_df(first)]
        total_pages = atoms_columnar_meta(first)['total_pages']

        for page in range(2, total_pages + 1):
            payload = self._client.get_bytes(path, params={**params, 'page': page})
            frames.append(atoms_columnar_as_df(payload))

        return _pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]

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
