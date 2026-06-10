from __future__ import annotations

from typing import TYPE_CHECKING

from .base import BaseResource, BaseCollection

if TYPE_CHECKING:
    import pandas as pd
    from voltsdk.http import HttpTransport

class Exposure(BaseResource):

    def __init__(
        self,
        client: HttpTransport,
        data: dict,
        *,
        analysis_id: str = '',
    ) -> None:
        super().__init__(client, data)
        self._analysis_id = analysis_id

    @property
    def analysis_id(self) -> str:
        return self._analysis_id or self._get('analysis', '')

    @property
    def listings(self):
        from .listings import ListingCollection

        team_id = self._client.team_id
        return ListingCollection(
            self._client,
            path=f'/plugins/{team_id}/listings/analyses/{self.analysis_id}',
            params={'exposureId': self.id},
        )

    def sub_listings(
        self,
        sub_listing_name: str,
        timestep: int,
    ) -> pd.DataFrame:
        import pandas as _pd

        team_id = self._client.team_id
        data = self._client.get(
            f'/plugins/{team_id}/listings/analyses/{self.analysis_id}'
            f'/sub-listings/{self.id}/{timestep}/{sub_listing_name}',
        )
        rows = data.get('data', data) if isinstance(data, dict) else data
        if isinstance(rows, list):
            return _pd.DataFrame(rows)
        return _pd.DataFrame()

    def download_glb(self, timestep: int, dest: str = '.') -> str:
        team_id = self._client.team_id
        traj_id = self._get('trajectory', '')
        return self._client.download_stream(
            f'/plugins/{team_id}/exposures/glb/{traj_id}/{self.analysis_id}/{self.id}/{timestep}',
            fallback_name=f'exposure-{self.id}-{timestep}.glb',
            dest=dest,
        )

    def open_in_volt(
        self,
        timestep: int,
        *,
        volt_url: str | None = None,
        open_browser: bool = True,
    ) -> str:
        from voltsdk.viewer import open_canvas_view

        trajectory_id = self._get('trajectory', '')
        if not trajectory_id:
            raise ValueError('Exposure does not include a trajectory ID.')

        return open_canvas_view(
            trajectory_id=trajectory_id,
            analysis_id=self.analysis_id,
            exposure_id=self.id,
            timestep=timestep,
            volt_url=volt_url,
            open_browser=open_browser,
        )

class ExposureCollection(BaseCollection['Exposure']):

    def __init__(
        self,
        client: HttpTransport,
        path: str,
        analysis_id: str = '',
        params: dict | None = None,
        page_size: int = 100,
    ) -> None:
        super().__init__(
            client, path, resource_cls=None, params=params, page_size=page_size,
        )
        self._analysis_id = analysis_id

    def _wrap(self, data: dict) -> Exposure:
        return Exposure(self._client, data, analysis_id=self._analysis_id)
